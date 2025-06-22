import { AICapability, AIErrorType, AIModelAdapter } from './ai-interfaces';

/**
 * Request context for intelligent routing (imported from orchestrator)
 */
export interface RequestContext {
  contentType?: 'daily-reflection' | 'goal-review' | 'habit-tracking' | 'general';
  privacyLevel?: 'local' | 'cloud' | 'hybrid';
  urgency?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'medium' | 'complex';
  requiredCapabilities?: AICapability[];
  maxCost?: number;
  preferredAdapter?: string;
}

/**
 * Circuit breaker states for adapter health management
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

/**
 * Circuit breaker interface for managing adapter failures
 */
export interface CircuitBreaker {
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly lastFailureTime: Date | null;
  readonly nextAttemptTime: Date | null;
  
  canExecute(): boolean;
  onSuccess(): void;
  onFailure(error: Error): void;
  reset(): void;
  getMetrics(): CircuitBreakerMetrics;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  uptime: number;
}

/**
 * Enhanced error classification for better handling
 */
export interface ErrorClassification {
  type: AIErrorType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  fallbackRecommended: boolean;
  recoveryStrategy: 'immediate' | 'delayed' | 'manual' | 'circuit-breaker';
  estimatedRecoveryTime?: number;
}

/**
 * Fallback strategy configuration
 */
export interface FallbackStrategy {
  enabled: boolean;
  maxFallbackDepth: number;
  fallbackTimeout: number;
  capabilityDegradation: boolean;
  performanceDegradation: boolean;
  qualityThreshold: number;
}

/**
 * Fallback chain configuration
 */
export interface FallbackChain {
  primary: string;
  fallbacks: Array<{
    adapterId: string;
    priority: number;
    requiredCapabilities?: AICapability[];
    maxLatency?: number;
    qualityThreshold?: number;
  }>;
  strategy: FallbackStrategy;
}

/**
 * Cache configuration for different cache levels
 */
export interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  persistToDisk: boolean;
  diskPath?: string;
}

/**
 * Multi-level cache configuration
 */
export interface MultiLevelCacheConfig {
  memory: CacheConfig;
  disk: CacheConfig;
  distributed?: CacheConfig & {
    nodes: string[];
    replicationFactor: number;
  };
}

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  key: string;
  contentHash: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  tags: string[];
  expiresAt: Date;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  data: T;
  metadata: CacheEntryMetadata;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  averageAccessTime: number;
  evictions: number;
  compressionRatio: number;
}

/**
 * Cache interface for different cache implementations
 */
export interface Cache<T = any> {
  get(key: string): Promise<CacheEntry<T> | null>;
  set(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
  getStats(): Promise<CacheStats>;
  invalidateByTags(tags: string[]): Promise<number>;
  warmup(keys: string[]): Promise<void>;
}

/**
 * Intelligent cache key generator
 */
export interface CacheKeyGenerator {
  generateKey(content: string, options?: any): string;
  generateSimilarityKey(content: string, threshold?: number): string;
  extractTags(content: string, options?: any): string[];
}

/**
 * Resilience configuration
 */
export interface ResilienceConfig {
  circuitBreaker: CircuitBreakerConfig;
  fallback: FallbackStrategy;
  cache: MultiLevelCacheConfig;
  timeout: {
    default: number;
    adaptive: boolean;
    maxTimeout: number;
    minTimeout: number;
  };
  bulkhead: {
    enabled: boolean;
    maxConcurrentRequests: number;
    queueSize: number;
    isolationGroups: string[];
  };
  healthCheck: {
    interval: number;
    timeout: number;
    retryCount: number;
    degradedThreshold: number;
  };
}

/**
 * Adapter health status
 */
export interface AdapterHealthStatus {
  adapterId: string;
  healthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  circuitBreakerState: CircuitBreakerState;
  capabilities: AICapability[];
  load: number;
  quality: number;
}

/**
 * Load balancer interface
 */
export interface LoadBalancer {
  selectAdapter(
    availableAdapters: string[],
    context?: RequestContext
  ): Promise<string>;
  updateAdapterMetrics(adapterId: string, metrics: any): void;
  getAdapterLoad(adapterId: string): number;
}

/**
 * Resilience manager interface
 */
export interface ResilienceManager {
  getCircuitBreaker(adapterId: string): CircuitBreaker;
  getFallbackChain(context?: RequestContext): FallbackChain;
  getCache(level: 'memory' | 'disk' | 'distributed'): Cache;
  getLoadBalancer(): LoadBalancer;
  getHealthStatus(adapterId: string): AdapterHealthStatus;
  executeWithResilience<T>(
    operation: () => Promise<T>,
    context?: RequestContext
  ): Promise<T>;
}

/**
 * Enhanced adapter interface with resilience features
 */
export interface ResilientAIAdapter extends AIModelAdapter {
  readonly circuitBreaker: CircuitBreaker;
  readonly healthStatus: AdapterHealthStatus;
  
  executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackChain?: FallbackChain
  ): Promise<T>;
  
  warmCache(commonQueries: string[]): Promise<void>;
  clearCache(): Promise<void>;
  getCacheStats(): Promise<CacheStats>;
}

/**
 * Error classifier for determining handling strategy
 */
export interface ErrorClassifier {
  classify(error: Error): ErrorClassification;
  shouldRetry(error: Error, attemptCount: number): boolean;
  shouldFallback(error: Error): boolean;
  getRecoveryStrategy(error: Error): 'immediate' | 'delayed' | 'manual' | 'circuit-breaker';
}

/**
 * Timeout manager for adaptive timeout handling
 */
export interface TimeoutManager {
  getTimeout(operation: string, context?: RequestContext): number;
  updateTimeout(operation: string, duration: number, success: boolean): void;
  getAdaptiveTimeout(operation: string, complexity?: 'simple' | 'medium' | 'complex'): number;
}

/**
 * Bulkhead pattern for isolating failures
 */
export interface Bulkhead {
  acquire(isolationGroup: string): Promise<boolean>;
  release(isolationGroup: string): void;
  getStats(isolationGroup: string): {
    active: number;
    queued: number;
    rejected: number;
    maxConcurrent: number;
  };
}

/**
 * Health monitor for continuous adapter monitoring
 */
export interface HealthMonitor {
  startMonitoring(adapterId: string): void;
  stopMonitoring(adapterId: string): void;
  getHealthStatus(adapterId: string): AdapterHealthStatus;
  getAllHealthStatuses(): Map<string, AdapterHealthStatus>;
  onHealthChange(callback: (adapterId: string, status: AdapterHealthStatus) => void): void;
} 