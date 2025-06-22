import * as os from 'os';
import { Logger } from './logger';
import {
  PerformanceConfig,
  BatchingConfig,
  MemoryConfig,
  CachingConfig,
  RequestBatch,
  BatchedRequest,
  CacheEntry,
  PerformanceMetrics,
  ResourceUsage,
  RequestQueueManager,
  MemoryPoolManager,
  CompletionOptions
} from './ai-interfaces';

/**
 * Request queue manager implementation
 */
export class RequestQueue implements RequestQueueManager {
  private pendingRequests: BatchedRequest[] = [];
  private processingBatches: Map<string, RequestBatch> = new Map();
  private completedCount = 0;
  private failedCount = 0;
  private isProcessing = false;

  constructor(
    private logger: Logger,
    private batchingConfig: BatchingConfig,
    private processBatch: (batch: RequestBatch) => Promise<string[]>
  ) {}

  async enqueue(request: BatchedRequest): Promise<void> {
    this.pendingRequests.push(request);
    
    if (!this.isProcessing) {
      // Start processing if not already running
      setTimeout(() => this.processQueue(), 0);
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.pendingRequests.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.pendingRequests.length > 0) {
        const batch = this.createBatch();
        if (batch.requests.length === 0) {
          break;
        }

        this.processingBatches.set(batch.id, batch);

        try {
          const results = await this.processBatch(batch);
          
          // Resolve all requests in the batch
          batch.requests.forEach((request, index) => {
            if (results[index]) {
              request.resolve(results[index]);
              this.completedCount++;
            } else {
              request.reject(new Error('No result for request'));
              this.failedCount++;
            }
          });
        } catch (error) {
          // Reject all requests in the batch
          batch.requests.forEach(request => {
            request.reject(error instanceof Error ? error : new Error(String(error)));
            this.failedCount++;
          });
        } finally {
          this.processingBatches.delete(batch.id);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  getQueueStats() {
    return {
      pending: this.pendingRequests.length,
      processing: Array.from(this.processingBatches.values()).reduce((sum, batch) => sum + batch.requests.length, 0),
      completed: this.completedCount,
      failed: this.failedCount
    };
  }

  private createBatch(): RequestBatch {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const maxBatchSize = this.batchingConfig.maxBatchSize;
    const maxWaitTime = this.batchingConfig.maxWaitTime;
    const similarityThreshold = this.batchingConfig.similarityThreshold;

    // Get requests that have been waiting long enough or fill up to max batch size
    const now = Date.now();
    const batchRequests: BatchedRequest[] = [];

    // First, add requests that have been waiting too long
    for (let i = this.pendingRequests.length - 1; i >= 0; i--) {
      const request = this.pendingRequests[i];
      if (now - request.createdAt.getTime() >= maxWaitTime) {
        batchRequests.push(request);
        this.pendingRequests.splice(i, 1);
        
        if (batchRequests.length >= maxBatchSize) {
          break;
        }
      }
    }

    // Then, add similar requests if we have space
    if (batchRequests.length < maxBatchSize && this.batchingConfig.enabled) {
      this.addSimilarRequests(batchRequests, maxBatchSize, similarityThreshold);
    }

    // Finally, fill remaining space with any pending requests
    while (batchRequests.length < maxBatchSize && this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      if (request) {
        batchRequests.push(request);
      }
    }

    return {
      id: batchId,
      requests: batchRequests,
      createdAt: new Date(),
      priority: this.calculateBatchPriority(batchRequests)
    };
  }

  private addSimilarRequests(batchRequests: BatchedRequest[], maxBatchSize: number, similarityThreshold: number): void {
    if (batchRequests.length === 0) return;

    const baseRequest = batchRequests[0];
    
    for (let i = this.pendingRequests.length - 1; i >= 0; i--) {
      if (batchRequests.length >= maxBatchSize) break;

      const request = this.pendingRequests[i];
      const similarity = this.calculateSimilarity(baseRequest.prompt, request.prompt);
      
      if (similarity >= similarityThreshold) {
        request.similarity = similarity;
        batchRequests.push(request);
        this.pendingRequests.splice(i, 1);
      }
    }
  }

  private calculateSimilarity(prompt1: string, prompt2: string): number {
    // Simple similarity calculation based on common words
    const words1 = new Set(prompt1.toLowerCase().split(/\s+/));
    const words2 = new Set(prompt2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateBatchPriority(requests: BatchedRequest[]): number {
    // Higher priority for older requests
    const avgAge = requests.reduce((sum, req) => sum + (Date.now() - req.createdAt.getTime()), 0) / requests.length;
    return Math.min(10, Math.floor(avgAge / 1000)); // Priority 0-10 based on seconds waiting
  }
}

/**
 * Memory pool manager implementation
 */
export class MemoryPool implements MemoryPoolManager {
  private pool: ArrayBuffer[] = [];
  private usedBuffers: Set<ArrayBuffer> = new Set();
  private totalSize: number;
  private maxSize: number;

  constructor(private logger: Logger, private config: MemoryConfig) {
    this.maxSize = config.memoryPoolSize * 1024 * 1024; // Convert MB to bytes
    this.totalSize = 0;
  }

  async allocate(size: number): Promise<ArrayBuffer | null> {
    // Try to find a suitable buffer from the pool
    const suitableBufferIndex = this.pool.findIndex(buffer => buffer.byteLength >= size);
    
    if (suitableBufferIndex !== -1) {
      const buffer = this.pool.splice(suitableBufferIndex, 1)[0];
      this.usedBuffers.add(buffer);
      return buffer;
    }

    // Create new buffer if we have space
    if (this.totalSize + size <= this.maxSize) {
      const buffer = new ArrayBuffer(size);
      this.usedBuffers.add(buffer);
      this.totalSize += size;
      return buffer;
    }

    // Try garbage collection if enabled
    if (this.config.enableGarbageCollection) {
      this.triggerGarbageCollection();
      
      // Try again after GC
      if (this.totalSize + size <= this.maxSize) {
        const buffer = new ArrayBuffer(size);
        this.usedBuffers.add(buffer);
        this.totalSize += size;
        return buffer;
      }
    }

    this.logger.warn(`Memory pool exhausted. Requested: ${size}, Available: ${this.maxSize - this.totalSize}`);
    return null;
  }

  async release(buffer: ArrayBuffer): Promise<void> {
    if (this.usedBuffers.has(buffer)) {
      this.usedBuffers.delete(buffer);
      this.pool.push(buffer);
    }
  }

  getStats() {
    const usedSize = Array.from(this.usedBuffers).reduce((sum, buffer) => sum + buffer.byteLength, 0);
    
    return {
      totalSize: this.totalSize,
      usedSize,
      availableSize: this.maxSize - this.totalSize,
      fragmentationRatio: this.pool.length / Math.max(1, this.totalSize / (64 * 1024)) // Fragmentation based on 64KB chunks
    };
  }

  private triggerGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Response cache manager
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private currentSize = 0;

  constructor(private logger: Logger, private config: CachingConfig) {
    this.maxSize = config.maxCacheSize * 1024 * 1024; // Convert MB to bytes
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(key);
      this.currentSize -= this.getEntrySize(entry);
      return null;
    }

    // Update access statistics
    entry.metadata.accessCount++;
    entry.metadata.lastAccessed = new Date();
    
    return entry;
  }

  set(key: string, response: string, modelUsed: string, tokensUsed?: number): void {
    const entry: CacheEntry = {
      key,
      response,
      metadata: {
        modelUsed,
        tokensUsed,
        createdAt: new Date(),
        accessCount: 0,
        lastAccessed: new Date()
      },
      expiresAt: new Date(Date.now() + this.config.ttl * 1000)
    };

    const entrySize = this.getEntrySize(entry);

    // Make space if needed
    while (this.currentSize + entrySize > this.maxSize && this.cache.size > 0) {
      this.evictLeastRecentlyUsed();
    }

    // Add to cache
    this.cache.set(key, entry);
    this.currentSize += entrySize;
  }

  findSimilar(prompt: string, threshold = 0.8): CacheEntry | null {
    if (!this.config.enablePartialMatching) {
      return null;
    }

    let bestMatch: CacheEntry | null = null;
    let bestSimilarity = 0;

    for (const entry of this.cache.values()) {
      // Extract original prompt from key (assuming key format includes prompt)
      const similarity = this.calculateSimilarity(prompt, entry.key);
      
      if (similarity >= threshold && similarity > bestSimilarity) {
        bestMatch = entry;
        bestSimilarity = similarity;
      }
    }

    return bestMatch;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      sizeMB: this.currentSize / (1024 * 1024),
      hitRate: this.calculateHitRate()
    };
  }

  private getEntrySize(entry: CacheEntry): number {
    // Rough estimation of entry size in bytes
    return (entry.key.length + entry.response.length) * 2; // Assuming UTF-16
  }

  private evictLeastRecentlyUsed(): void {
    let oldestEntry: [string, CacheEntry] | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.metadata.lastAccessed.getTime();
        oldestEntry = [key, entry];
      }
    }

    if (oldestEntry) {
      this.cache.delete(oldestEntry[0]);
      this.currentSize -= this.getEntrySize(oldestEntry[1]);
    }
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateHitRate(): number {
    // This would need to be tracked separately in a real implementation
    return 0; // Placeholder
  }

  generateCacheKey(prompt: string, options?: CompletionOptions): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${prompt}:${optionsStr}`;
  }
}

/**
 * Performance optimizer main class
 */
export class PerformanceOptimizer {
  private requestQueue: RequestQueue;
  private memoryPool: MemoryPool;
  private responseCache: ResponseCache;
  private metrics: PerformanceMetrics;
  private startTime = Date.now();
  private requestCount = 0;
  private totalLatency = 0;
  private processingBatches: Map<string, RequestBatch> = new Map();
  private objectProcessingCache: WeakMap<object, unknown> = new WeakMap();
  private processedObjects: WeakSet<object> = new WeakSet();
  private logger: Logger;

  constructor(
    logger: Logger,
    private config: PerformanceConfig,
    private processBatch: (batch: RequestBatch) => Promise<string[]>
  ) {
    this.logger = logger;
    this.requestQueue = new RequestQueue(logger, config.batching, processBatch);
    this.memoryPool = new MemoryPool(logger, config.memory);
    this.responseCache = new ResponseCache(logger, config.caching);
    
    this.metrics = {
      requestsPerSecond: 0,
      averageLatency: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHitRate: 0,
      batchEfficiency: 0,
      throughput: 0,
      errorRate: 0,
      lastUpdated: new Date()
    };
  }

  async processRequest(prompt: string, options?: CompletionOptions): Promise<string> {
    const startTime = Date.now();
    const profileKey = `processRequest:${prompt.substring(0, 20)}...`;
    
    // Start performance profiling
    if (this.config.enableProfiling) {
      console.time(profileKey);
      console.time(`${profileKey}:cacheCheck`);
    }
    
    // Check cache first
    if (this.config.caching.enabled) {
      const cacheKey = this.responseCache.generateCacheKey(prompt, options);
      const cachedResult = this.responseCache.get(cacheKey);
      
      if (cachedResult) {
        if (this.config.enableProfiling) {
          console.timeEnd(`${profileKey}:cacheCheck`);
          console.timeEnd(profileKey);
        }
        this.updateMetrics(Date.now() - startTime, true);
        return cachedResult.response;
      }

      // Check for similar cached responses
      const similarResult = this.responseCache.findSimilar(prompt);
      if (similarResult) {
        if (this.config.enableProfiling) {
          console.timeEnd(`${profileKey}:cacheCheck`);
          console.timeEnd(profileKey);
        }
        this.updateMetrics(Date.now() - startTime, true);
        return similarResult.response;
      }
    }

    if (this.config.enableProfiling) {
      console.timeEnd(`${profileKey}:cacheCheck`);
      console.time(`${profileKey}:queueProcessing`);
    }

    // Create batched request
    return new Promise<string>((resolve, reject) => {
      const request: BatchedRequest = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        options,
        resolve: (result: string) => {
          // Cache the result
          if (this.config.caching.enabled) {
            const cacheKey = this.responseCache.generateCacheKey(prompt, options);
            this.responseCache.set(cacheKey, result, 'local');
          }
          
          if (this.config.enableProfiling) {
            console.timeEnd(`${profileKey}:queueProcessing`);
            console.timeEnd(profileKey);
          }
          this.updateMetrics(Date.now() - startTime, false);
          resolve(result);
        },
        reject: (error: Error) => {
          if (this.config.enableProfiling) {
            console.timeEnd(`${profileKey}:queueProcessing`);
            console.timeEnd(profileKey);
          }
          this.updateMetrics(Date.now() - startTime, false, true);
          reject(error);
        },
        createdAt: new Date()
      };

      this.requestQueue.enqueue(request);
    });
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const queueStats = this.requestQueue.getQueueStats();
    const cacheStats = this.responseCache.getStats();
    const memoryStats = this.memoryPool.getStats();

    this.metrics.batchEfficiency = queueStats.completed / Math.max(1, queueStats.completed + queueStats.failed);
    this.metrics.cacheHitRate = cacheStats.hitRate;
    this.metrics.memoryUsage = memoryStats.usedSize / (1024 * 1024); // MB
    this.metrics.lastUpdated = new Date();

    return { ...this.metrics };
  }

  async getResourceUsage(): Promise<ResourceUsage> {
    const memoryStats = this.memoryPool.getStats();
    
    return {
      memory: {
        used: memoryStats.usedSize / (1024 * 1024), // MB
        available: memoryStats.availableSize / (1024 * 1024), // MB
        peak: memoryStats.totalSize / (1024 * 1024) // MB
      },
      cpu: {
        usage: this.metrics.cpuUsage,
        cores: os.cpus().length,
        threads: this.config.hardware.maxThreads || os.cpus().length
      }
    };
  }

  async clearCaches(): Promise<void> {
    this.responseCache.clear();
    this.logger.info('Performance caches cleared');
  }

  async optimizeForHardware(): Promise<void> {
    if (this.config.hardware.autoDetectResources) {
      const cpus = os.cpus().length;
      const totalMemory = os.totalmem() / (1024 * 1024 * 1024); // GB

      // Adjust configuration based on hardware
      this.config.hardware.maxThreads = Math.max(1, Math.floor(cpus * 0.8));
      this.config.memory.maxMemoryUsage = Math.floor(totalMemory * 0.3 * 1024); // 30% of RAM in MB
      this.config.batching.maxBatchSize = Math.min(10, Math.max(2, Math.floor(cpus / 2)));

      this.logger.info(`Optimized for hardware: ${cpus} CPUs, ${totalMemory.toFixed(1)}GB RAM`);
    }
  }

  private updateMetrics(latency: number, cacheHit: boolean, error = false): void {
    this.requestCount++;
    this.totalLatency += latency;
    
    const elapsed = (Date.now() - this.startTime) / 1000; // seconds
    this.metrics.requestsPerSecond = this.requestCount / elapsed;
    this.metrics.averageLatency = this.totalLatency / this.requestCount;
    this.metrics.throughput = this.requestCount / elapsed;
    
    if (error) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.requestCount - 1) + 1) / this.requestCount;
    }
  }

  /**
   * Check if an object has been processed before using WeakSet
   */
  hasBeenProcessed(obj: object): boolean {
    return this.processedObjects.has(obj);
  }

  /**
   * Mark an object as processed using WeakSet
   */
  markAsProcessed(obj: object): void {
    this.processedObjects.add(obj);
  }

  /**
   * Get cached processing result for an object using WeakMap
   */
  getCachedResult(obj: object): unknown {
    return this.objectProcessingCache.get(obj);
  }

  /**
   * Cache processing result for an object using WeakMap
   */
  cacheResult(obj: object, result: unknown): void {
    this.objectProcessingCache.set(obj, result);
  }
} 