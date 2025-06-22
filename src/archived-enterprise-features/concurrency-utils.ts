// src/concurrency-utils.ts

/**
 * Concurrency control utilities for managing async operations
 */

/**
 * Semaphore for controlling concurrent operations
 * Limits the number of operations that can run simultaneously
 */
export class Semaphore {
	private permits: number;
	private waitQueue: Array<() => void> = [];

	constructor(permits: number) {
		if (permits <= 0) {
			throw new Error('Semaphore permits must be greater than 0');
		}
		this.permits = permits;
	}

	/**
	 * Acquire a permit - will wait if none available
	 */
	async acquire(): Promise<void> {
		return new Promise((resolve) => {
			if (this.permits > 0) {
				this.permits--;
				resolve();
			} else {
				this.waitQueue.push(resolve);
			}
		});
	}

	/**
	 * Release a permit - allows waiting operations to proceed
	 */
	release(): void {
		this.permits++;
		if (this.waitQueue.length > 0) {
			const next = this.waitQueue.shift();
			if (next) {
				this.permits--;
				next();
			}
		}
	}

	/**
	 * Get current available permits
	 */
	get availablePermits(): number {
		return this.permits;
	}

	/**
	 * Get number of waiting operations
	 */
	get queueLength(): number {
		return this.waitQueue.length;
	}

	/**
	 * Execute a function with automatic acquire/release
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire();
		try {
			return await fn();
		} finally {
			this.release();
		}
	}
}

/**
 * Rate limiter for controlling operation frequency
 */
export class RateLimiter {
	private tokens: number;
	private lastRefill: number;
	private readonly maxTokens: number;
	private readonly refillRate: number; // tokens per second

	constructor(maxTokens: number, refillRate: number) {
		this.maxTokens = maxTokens;
		this.refillRate = refillRate;
		this.tokens = maxTokens;
		this.lastRefill = Date.now();
	}

	async acquire(tokens = 1): Promise<void> {
		this.refillTokens();
		
		if (this.tokens >= tokens) {
			this.tokens -= tokens;
			return;
		}

		// Wait for tokens to be available
		const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
		await new Promise(resolve => setTimeout(resolve, waitTime));
		
		this.refillTokens();
		this.tokens -= tokens;
	}

	private refillTokens(): void {
		const now = Date.now();
		const timePassed = (now - this.lastRefill) / 1000;
		const tokensToAdd = timePassed * this.refillRate;
		
		this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
		this.lastRefill = now;
	}
}

/**
 * Batch processor for efficient bulk operations
 */
export class BatchProcessor<T, R> {
	private readonly batchSize: number;
	private readonly processor: (batch: T[]) => Promise<R[]>;
	private readonly concurrency: number;
	private readonly semaphore: Semaphore;

	constructor(
		batchSize: number,
		processor: (batch: T[]) => Promise<R[]>,
		concurrency = 3
	) {
		this.batchSize = batchSize;
		this.processor = processor;
		this.concurrency = concurrency;
		this.semaphore = new Semaphore(concurrency);
	}

	async process(items: T[]): Promise<R[]> {
		const batches = this.createBatches(items);
		const results: R[] = [];

		const batchPromises = batches.map(batch =>
			this.semaphore.execute(() => this.processor(batch))
		);

		const batchResults = await Promise.all(batchPromises);
		batchResults.forEach(batchResult => results.push(...batchResult));

		return results;
	}

	private createBatches(items: T[]): T[][] {
		const batches: T[][] = [];
		for (let i = 0; i < items.length; i += this.batchSize) {
			batches.push(items.slice(i, i + this.batchSize));
		}
		return batches;
	}
} 