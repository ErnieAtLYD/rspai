// src/resilience-manager.ts
// Resilience Manager Implementation
// Manages circuit breakers, caches, and load balancers for AI operations

import { Logger } from './logger';
import { AIError, AIErrorType } from './ai-interfaces';
import {
  ResilienceManager,
  ResilienceConfig,
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  FallbackChain,
  Cache,
  CacheEntry,
  CacheEntryMetadata,
  CacheStats,
  CacheKeyGenerator,
  LoadBalancer,
  AdapterHealthStatus,
  RequestContext,
  ErrorClassifier,
  ErrorClassification
} from './resilience-interfaces';
import * as crypto from 'crypto';

/**
 * Circuit breaker implementation
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
  private _state: CircuitBreakerState = 'closed';
  private _failureCount = 0;
  private _successCount = 0;
  private _totalCalls = 0;
  private _lastFailureTime: Date | null = null;
  private _lastSuccessTime: Date | null = null;
  private _nextAttemptTime: Date | null = null;
  private _halfOpenCalls = 0;

  constructor(
    private config: CircuitBreakerConfig,
    private logger: Logger
  ) {}

  get state(): CircuitBreakerState {
    return this._state;
  }

  get failureCount(): number {
    return this._failureCount;
  }

  get lastFailureTime(): Date | null {
    return this._lastFailureTime;
  }

  get nextAttemptTime(): Date | null {
    return this._nextAttemptTime;
  }

  canExecute(): boolean {
    this._totalCalls++;

    switch (this._state) {
      case 'closed':
        return true;
      
      case 'open':
        if (this._nextAttemptTime && Date.now() >= this._nextAttemptTime.getTime()) {
          this._state = 'half-open';
          this._halfOpenCalls = 0;
          this.logger.info('Circuit breaker transitioning to half-open');
          return true;
        }
        return false;
      
      case 'half-open':
        return this._halfOpenCalls < this.config.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  onSuccess(): void {
    this._successCount++;
    this._lastSuccessTime = new Date();

    if (this._state === 'half-open') {
      this._halfOpenCalls++;
      if (this._halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this._state = 'closed';
        this._failureCount = 0;
        this._nextAttemptTime = null;
        this.logger.info('Circuit breaker closed after successful half-open period');
      }
    } else if (this._state === 'closed') {
      // Reset failure count on success
      this._failureCount = Math.max(0, this._failureCount - 1);
    }
  }

  onFailure(error: Error): void {
    this._failureCount++;
    this._lastFailureTime = new Date();

    if (this._state === 'closed' && this._failureCount >= this.config.failureThreshold) {
      this._state = 'open';
      this._nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      this.logger.warn(`Circuit breaker opened after ${this._failureCount} failures`);
    } else if (this._state === 'half-open') {
      this._state = 'open';
      this._nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      this.logger.warn('Circuit breaker reopened during half-open period');
    }
  }

  reset(): void {
    this._state = 'closed';
    this._failureCount = 0;
    this._successCount = 0;
    this._lastFailureTime = null;
    this._nextAttemptTime = null;
    this._halfOpenCalls = 0;
    this.logger.info('Circuit breaker manually reset');
  }

  getMetrics(): CircuitBreakerMetrics {
    const now = Date.now();
    const uptime = this._lastSuccessTime 
      ? now - this._lastSuccessTime.getTime()
      : 0;

    return {
      state: this._state,
      failureCount: this._failureCount,
      successCount: this._successCount,
      totalCalls: this._totalCalls,
      lastFailureTime: this._lastFailureTime,
      lastSuccessTime: this._lastSuccessTime,
      uptime
    };
  }
}

/**
 * Error classifier implementation
 */
export class DefaultErrorClassifier implements ErrorClassifier {
  classify(error: Error): ErrorClassification {
    if (error instanceof AIError) {
      return this.classifyAIError(error);
    }

    // Network errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return {
        type: AIErrorType.NETWORK_ERROR,
        severity: 'high',
        retryable: true,
        fallbackRecommended: true,
        recoveryStrategy: 'delayed',
        estimatedRecoveryTime: 5000
      };
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return {
        type: AIErrorType.TIMEOUT,
        severity: 'medium',
        retryable: true,
        fallbackRecommended: true,
        recoveryStrategy: 'immediate',
        estimatedRecoveryTime: 1000
      };
    }

    // Default classification
    return {
      type: AIErrorType.UNKNOWN_ERROR,
      severity: 'medium',
      retryable: false,
      fallbackRecommended: true,
      recoveryStrategy: 'manual'
    };
  }

  private classifyAIError(error: AIError): ErrorClassification {
    switch (error.type) {
      case AIErrorType.RATE_LIMITED:
        return {
          type: error.type,
          severity: 'medium',
          retryable: true,
          fallbackRecommended: true,
          recoveryStrategy: 'delayed',
          estimatedRecoveryTime: 60000 // 1 minute
        };

      case AIErrorType.QUOTA_EXCEEDED:
        return {
          type: error.type,
          severity: 'high',
          retryable: false,
          fallbackRecommended: true,
          recoveryStrategy: 'manual'
        };

      case AIErrorType.MODEL_UNAVAILABLE:
        return {
          type: error.type,
          severity: 'high',
          retryable: true,
          fallbackRecommended: true,
          recoveryStrategy: 'circuit-breaker',
          estimatedRecoveryTime: 30000
        };

      case AIErrorType.AUTHENTICATION_FAILED:
        return {
          type: error.type,
          severity: 'critical',
          retryable: false,
          fallbackRecommended: true,
          recoveryStrategy: 'manual'
        };

      case AIErrorType.TIMEOUT:
        return {
          type: error.type,
          severity: 'medium',
          retryable: true,
          fallbackRecommended: true,
          recoveryStrategy: 'immediate',
          estimatedRecoveryTime: 1000
        };

      default:
        return {
          type: error.type,
          severity: 'medium',
          retryable: error.retryable,
          fallbackRecommended: true,
          recoveryStrategy: 'delayed',
          estimatedRecoveryTime: 5000
        };
    }
  }

  shouldRetry(error: Error, attemptCount: number): boolean {
    const classification = this.classify(error);
    return classification.retryable && attemptCount < 3;
  }

  shouldFallback(error: Error): boolean {
    const classification = this.classify(error);
    return classification.fallbackRecommended;
  }

  getRecoveryStrategy(error: Error): 'immediate' | 'delayed' | 'manual' | 'circuit-breaker' {
    const classification = this.classify(error);
    return classification.recoveryStrategy;
  }
}

/**
 * Memory cache implementation
 */
export class MemoryCache<T = unknown> implements Cache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    averageAccessTime: 0,
    evictions: 0,
    compressionRatio: 1
  };

  constructor(
    private maxSize: number,
    private defaultTtl: number,
    private logger: Logger
  ) {}

  async get(key: string): Promise<CacheEntry<T> | null> {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateStats(Date.now() - startTime);
      return null;
    }

    // Check expiration
    if (entry.metadata.expiresAt < new Date()) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      this.updateStats(Date.now() - startTime);
      return null;
    }

    // Update access metadata
    entry.metadata.lastAccessed = new Date();
    entry.metadata.accessCount++;
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.updateStats(Date.now() - startTime);
    return entry;
  }

  async set(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const actualTtl = ttl || this.defaultTtl;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + actualTtl * 1000);

    const metadata: CacheEntryMetadata = {
      key,
      contentHash: this.generateHash(value),
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      size: this.estimateSize(value),
      compressed: false,
      encrypted: false,
      tags: tags || [],
      expiresAt
    };

    const entry: CacheEntry<T> = {
      data: value,
      metadata
    };

    // Evict if necessary
    while (this.cache.size >= this.maxSize && this.cache.size > 0) {
      await this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.updateCacheStats();
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
      this.updateCacheStats();
    }
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.updateCacheStats();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (entry.metadata.expiresAt < new Date()) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    
    return true;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.metadata.tags.some(tag => tags.includes(tag))) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      await this.delete(key);
      invalidated++;
    }

    return invalidated;
  }

  async warmup(keys: string[]): Promise<void> {
    // For memory cache, warmup is not applicable
    // This would be implemented for disk/distributed caches
  }

  private async evictLRU(): Promise<void> {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    this.cache.delete(lruKey);
    this.removeFromAccessOrder(lruKey);
    this.stats.evictions++;
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private generateHash(value: T): string {
    const str = JSON.stringify(value);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private estimateSize(value: T): number {
    return JSON.stringify(value).length * 2; // Rough estimate
  }

  private updateStats(accessTime: number): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    this.stats.averageAccessTime = (this.stats.averageAccessTime + accessTime) / 2;
  }

  private updateCacheStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.metadata.size, 0);
  }
}

/**
 * Intelligent cache key generator
 */
export class DefaultCacheKeyGenerator implements CacheKeyGenerator {
  generateKey(content: string, options?: Record<string, unknown>): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    const combined = content + optionsStr;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  generateSimilarityKey(content: string, threshold = 0.8): string {
    // Normalize content for similarity matching
    const normalized = content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Create a shorter hash for similarity grouping
    return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
  }

  extractTags(content: string, options?: Record<string, unknown>): string[] {
    const tags: string[] = [];
    
    // Extract content type tags
    if (content.includes('daily') || content.includes('today')) {
      tags.push('daily-reflection');
    }
    if (content.includes('goal') || content.includes('objective')) {
      tags.push('goal-review');
    }
    if (content.includes('habit') || content.includes('routine')) {
      tags.push('habit-tracking');
    }
    
    // Extract option-based tags
    if (options?.analysisType) {
      tags.push(`analysis:${options.analysisType}`);
    }
    if (options?.model) {
      tags.push(`model:${options.model}`);
    }
    
    return tags;
  }
}

/**
 * Load balancer implementation
 */
export class RoundRobinLoadBalancer implements LoadBalancer {
  private currentIndex = 0;
  private adapterMetrics = new Map<string, { load: number; responseTime: number; errorRate: number }>();

  async selectAdapter(availableAdapters: string[], context?: RequestContext): Promise<string> {
    if (availableAdapters.length === 0) {
      throw new Error('No adapters available for load balancing');
    }

    // Simple round-robin for now
    const selected = availableAdapters[this.currentIndex % availableAdapters.length];
    this.currentIndex = (this.currentIndex + 1) % availableAdapters.length;
    
    return selected;
  }

  updateAdapterMetrics(adapterId: string, metrics: Record<string, unknown>): void {
    this.adapterMetrics.set(adapterId, {
      load: typeof metrics.load === 'number' ? metrics.load : 0,
      responseTime: typeof metrics.responseTime === 'number' ? metrics.responseTime : 0,
      errorRate: typeof metrics.errorRate === 'number' ? metrics.errorRate : 0
    });
  }

  getAdapterLoad(adapterId: string): number {
    return this.adapterMetrics.get(adapterId)?.load || 0;
  }
}

/**
 * Main resilience manager implementation
 */
export class DefaultResilienceManager implements ResilienceManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private caches = new Map<string, Cache>();
  private loadBalancer: LoadBalancer;
  private errorClassifier: ErrorClassifier;
  private keyGenerator: CacheKeyGenerator;
  private healthStatuses = new Map<string, AdapterHealthStatus>();

  constructor(
    private config: ResilienceConfig,
    private logger: Logger
  ) {
    this.loadBalancer = new RoundRobinLoadBalancer();
    this.errorClassifier = new DefaultErrorClassifier();
    this.keyGenerator = new DefaultCacheKeyGenerator();
    
    // Initialize caches
    this.initializeCaches();
  }

  private initializeCaches(): void {
    // Memory cache
    if (this.config.cache.memory.enabled) {
      const memoryCache = new MemoryCache(
        this.config.cache.memory.maxSize,
        this.config.cache.memory.ttl,
        this.logger
      );
      this.caches.set('memory', memoryCache);
    }

    // TODO: Implement disk and distributed caches
  }

  getCircuitBreaker(adapterId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(adapterId)) {
      const circuitBreaker = new DefaultCircuitBreaker(
        this.config.circuitBreaker,
        this.logger
      );
      this.circuitBreakers.set(adapterId, circuitBreaker);
    }
    const circuitBreaker = this.circuitBreakers.get(adapterId);
    if (!circuitBreaker) {
      throw new Error(`Failed to get circuit breaker for adapter: ${adapterId}`);
    }
    return circuitBreaker;
  }

  getFallbackChain(context?: RequestContext): FallbackChain {
    // Default fallback chain - would be configurable in real implementation
    return {
      primary: 'ollama',
      fallbacks: [
        { adapterId: 'llamacpp', priority: 1 },
        { adapterId: 'openai', priority: 2 }
      ],
      strategy: this.config.fallback
    };
  }

  getCache(level: 'memory' | 'disk' | 'distributed'): Cache {
    const cache = this.caches.get(level);
    if (!cache) {
      throw new Error(`Cache level ${level} not available`);
    }
    return cache;
  }

  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  getHealthStatus(adapterId: string): AdapterHealthStatus {
    return this.healthStatuses.get(adapterId) || {
      adapterId,
      healthy: false,
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 1,
      circuitBreakerState: 'open',
      capabilities: [],
      load: 0,
      quality: 0
    };
  }

  async executeWithResilience<T>(
    operation: () => Promise<T>,
    context?: RequestContext
  ): Promise<T> {
    let lastError: Error | null = null;

    // Try with circuit breaker protection
    try {
      const result = await this.executeWithTimeout(operation, context);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      this.logger.warn('Operation failed with resilience protection:', error);
      throw lastError;
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    context?: RequestContext
  ): Promise<T> {
    const timeout = this.config.timeout.default;
    
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AIError(AIErrorType.TIMEOUT, `Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
} 