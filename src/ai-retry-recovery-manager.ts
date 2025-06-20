/**
 * AI Retry and Recovery Manager
 * Advanced retry logic, circuit breaker patterns, and fallback mechanisms
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

import { Logger } from './logger';
import {
  AIError,
  AICircuitBreakerConfig,
  AIRetryConfig,
  AIFallbackConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  shouldUseFallback,
  createStandardError
} from './unified-error-handling';
import {
  AIErrorType
} from './unified-ai-interfaces';

// ========================================
// CIRCUIT BREAKER IMPLEMENTATION
// ========================================

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  totalCalls: number;
  successRate: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export class AICircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private totalCalls = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private halfOpenCalls = 0;
  private responseTimes: number[] = [];
  private readonly maxResponseTimeHistory = 100;

  constructor(
    private config: AICircuitBreakerConfig,
    private logger: Logger,
    private name: string = 'default'
  ) {}

  /**
   * Check if operation can be executed
   */
  canExecute(): boolean {
    this.totalCalls++;

    switch (this.state) {
      case 'closed':
        return true;
      
      case 'open':
        if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime.getTime()) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;
      
      case 'half-open':
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  /**
   * Record successful operation
   */
  onSuccess(responseTime?: number): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    if (responseTime !== undefined) {
      this.recordResponseTime(responseTime);
    }

    if (this.state === 'half-open') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.transitionToClosed();
      }
    } else if (this.state === 'closed') {
      // Gradually reduce failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record failed operation
   */
  onFailure(error: Error, responseTime?: number): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (responseTime !== undefined) {
      this.recordResponseTime(responseTime);
    }

    if (this.state === 'closed') {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    } else if (this.state === 'half-open') {
      this.transitionToOpen();
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const successRate = this.totalCalls > 0 ? this.successCount / this.totalCalls : 0;
    const averageResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalCalls: this.totalCalls,
      successRate,
      averageResponseTime,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.totalCalls = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = undefined;
    this.halfOpenCalls = 0;
    this.responseTimes = [];
    
    this.logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  private shouldOpen(): boolean {
    // Check failure threshold
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Check success rate if we have minimum throughput
    if (this.totalCalls >= this.config.minimumThroughput) {
      const successRate = this.successCount / this.totalCalls;
      if (successRate < this.config.successRateThreshold) {
        return true;
      }
    }

    return false;
  }

  private transitionToOpen(): void {
    this.state = 'open';
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    this.logger.warn(`Circuit breaker ${this.name} opened - failure count: ${this.failureCount}`);
  }

  private transitionToHalfOpen(): void {
    this.state = 'half-open';
    this.halfOpenCalls = 0;
    this.logger.info(`Circuit breaker ${this.name} transitioning to half-open`);
  }

  private transitionToClosed(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.nextAttemptTime = undefined;
    this.logger.info(`Circuit breaker ${this.name} closed after successful recovery`);
  }

  private recordResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
  }
}

// ========================================
// ADVANCED RETRY MANAGER
// ========================================

export interface RetryAttempt {
  attemptNumber: number;
  delay: number;
  error?: Error;
  timestamp: Date;
}

export interface RetryMetrics {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  averageAttempts: number;
  totalRetryTime: number;
}

export class AIRetryManager {
  private retryMetrics: RetryMetrics = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageAttempts: 0,
    totalRetryTime: 0
  };

  constructor(
    private config: AIRetryConfig,
    private logger: Logger
  ) {}

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      requestId?: string;
      model?: string;
      provider?: string;
      operationName?: string;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    let lastError: Error | undefined;

         for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
       try {
        this.retryMetrics.totalAttempts++;
        
        if (attempt > 1) {
          this.logger.debug(`Retry attempt ${attempt}/${this.config.maxAttempts} for ${context.operationName || 'operation'}`);
        }

        const result = await operation();
        
        if (attempt > 1) {
          this.retryMetrics.successfulRetries++;
          this.logger.info(`Operation succeeded on attempt ${attempt}/${this.config.maxAttempts}`);
        }

        // Update metrics
        this.updateRetryMetrics(attempts.length, Date.now() - startTime);
        
        return result;
        
             } catch (error) {
         const standardError = createStandardError(error, context);
         lastError = standardError;
         
         attempts.push({
           attemptNumber: attempt,
           delay: 0,
           error: standardError,
           timestamp: new Date()
         });

        // Check if we should retry
        if (attempt === this.config.maxAttempts || !this.shouldRetry(standardError, attempt)) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, standardError);
        attempts[attempts.length - 1].delay = delay;

        this.logger.debug(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
          error: standardError.message,
          errorType: standardError.type
        });

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    // All attempts failed
    this.retryMetrics.failedRetries++;
    this.updateRetryMetrics(attempts.length, Date.now() - startTime);
    
    this.logger.error(`All ${this.config.maxAttempts} retry attempts failed`, {
      attempts: attempts.map(a => ({
        attempt: a.attemptNumber,
        error: a.error?.message,
        delay: a.delay
      }))
    });

    throw lastError || new AIError('All retry attempts failed', AIErrorType.REQUEST_FAILED, context);
  }

  /**
   * Check if error should trigger retry
   */
  private shouldRetry(error: AIError, attemptNumber: number): boolean {
    // Check custom retry predicate if provided
    if (this.config.retryPredicate) {
      return this.config.retryPredicate(error.toErrorDetails(), attemptNumber);
    }

    // Check if error type is retryable
    if (!this.config.retryableErrors.includes(error.type)) {
      return false;
    }

    // Check if error is marked as retryable
    return error.retryable;
  }

  /**
   * Calculate delay for next retry attempt
   */
  private calculateDelay(attemptNumber: number, error: AIError): number {
    let delay = this.config.baseDelay;

    // Apply exponential backoff
    if (this.config.backoffMultiplier > 1) {
      delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);
    }

    // Use error-specific delay if available
    if (error.retryDelay) {
      delay = Math.max(delay, error.retryDelay);
    }

    // Apply jitter to prevent thundering herd
    if (this.config.jitterFactor > 0) {
      const jitter = delay * this.config.jitterFactor * Math.random();
      delay += jitter;
    }

    // Ensure delay doesn't exceed maximum
    delay = Math.min(delay, this.config.maxDelay);

    return Math.round(delay);
  }

  /**
   * Get retry metrics
   */
  getMetrics(): RetryMetrics {
    return { ...this.retryMetrics };
  }

  /**
   * Reset retry metrics
   */
  resetMetrics(): void {
    this.retryMetrics = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 0,
      totalRetryTime: 0
    };
  }

  private updateRetryMetrics(attempts: number, totalTime: number): void {
    const totalOperations = this.retryMetrics.successfulRetries + this.retryMetrics.failedRetries;
    this.retryMetrics.averageAttempts = this.retryMetrics.totalAttempts / Math.max(1, totalOperations);
    this.retryMetrics.totalRetryTime += totalTime;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// FALLBACK MANAGER
// ========================================

export interface FallbackAttempt {
  modelId: string;
  attemptNumber: number;
  error?: Error;
  success: boolean;
  responseTime: number;
  timestamp: Date;
}

export interface FallbackMetrics {
  totalFallbacks: number;
  successfulFallbacks: number;
  failedFallbacks: number;
  fallbacksByModel: Map<string, number>;
  averageFallbackTime: number;
}

export class AIFallbackManager {
  private fallbackMetrics: FallbackMetrics = {
    totalFallbacks: 0,
    successfulFallbacks: 0,
    failedFallbacks: 0,
    fallbacksByModel: new Map(),
    averageFallbackTime: 0
  };

  constructor(
    private config: AIFallbackConfig,
    private logger: Logger
  ) {}

  /**
   * Execute operation with fallback logic
   */
  async executeWithFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperations: Map<string, () => Promise<T>>,
    context: {
      requestId?: string;
      primaryModel?: string;
      operationName?: string;
    } = {}
  ): Promise<T> {
    if (!this.config.enabled) {
      return primaryOperation();
    }

    const startTime = Date.now();
    const attempts: FallbackAttempt[] = [];

    // Try primary operation first
    try {
      const result = await primaryOperation();
      return result;
    } catch (error) {
      const standardError = createStandardError(error, context);
      
      // Check if we should use fallback
      if (!this.shouldUseFallback(standardError)) {
        throw standardError;
      }

      attempts.push({
        modelId: context.primaryModel || 'primary',
        attemptNumber: 1,
        error: standardError,
        success: false,
        responseTime: Date.now() - startTime,
        timestamp: new Date()
      });

      this.logger.warn(`Primary operation failed, attempting fallback`, {
        error: standardError.message,
        errorType: standardError.type
      });
    }

    // Try fallback models
    let fallbackAttempt = 0;
    for (const fallbackModel of this.config.fallbackModels) {
      if (fallbackAttempt >= this.config.maxFallbackAttempts) {
        break;
      }

      const fallbackOperation = fallbackOperations.get(fallbackModel);
      if (!fallbackOperation) {
        this.logger.warn(`Fallback model ${fallbackModel} not available`);
        continue;
      }

      fallbackAttempt++;
      const attemptStartTime = Date.now();

      try {
        this.fallbackMetrics.totalFallbacks++;
        this.updateFallbackModelMetrics(fallbackModel);

        this.logger.debug(`Attempting fallback to model: ${fallbackModel}`);

        // Execute with timeout
        const result = await this.executeWithTimeout(
          fallbackOperation,
          this.config.fallbackTimeout
        );

        const responseTime = Date.now() - attemptStartTime;
        attempts.push({
          modelId: fallbackModel,
          attemptNumber: fallbackAttempt + 1,
          success: true,
          responseTime,
          timestamp: new Date()
        });

        this.fallbackMetrics.successfulFallbacks++;
        this.updateFallbackMetrics(Date.now() - startTime);

        this.logger.info(`Fallback to ${fallbackModel} succeeded`, { responseTime });
        return result;

      } catch (error) {
        const standardError = createStandardError(error, { ...context, model: fallbackModel });
        const responseTime = Date.now() - attemptStartTime;

        attempts.push({
          modelId: fallbackModel,
          attemptNumber: fallbackAttempt + 1,
          error: standardError,
          success: false,
          responseTime,
          timestamp: new Date()
        });

        this.logger.warn(`Fallback to ${fallbackModel} failed`, {
          error: standardError.message,
          responseTime
        });
      }
    }

    // All fallbacks failed
    this.fallbackMetrics.failedFallbacks++;
    this.updateFallbackMetrics(Date.now() - startTime);

    this.logger.error(`All fallback attempts failed`, {
      attempts: attempts.map(a => ({
        model: a.modelId,
        success: a.success,
        error: a.error?.message,
        responseTime: a.responseTime
      }))
    });

    const lastError = attempts[attempts.length - 1]?.error;
    throw lastError || new AIError('All fallback attempts failed', AIErrorType.REQUEST_FAILED, context);
  }

  /**
   * Check if error should trigger fallback
   */
  private shouldUseFallback(error: AIError): boolean {
    return this.config.fallbackTriggers.includes(error.type);
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new AIError(`Operation timed out after ${timeoutMs}ms`, AIErrorType.TIMEOUT));
        }, timeoutMs);
      })
    ]);
  }

  /**
   * Get fallback metrics
   */
  getMetrics(): FallbackMetrics {
    return {
      ...this.fallbackMetrics,
      fallbacksByModel: new Map(this.fallbackMetrics.fallbacksByModel)
    };
  }

  /**
   * Reset fallback metrics
   */
  resetMetrics(): void {
    this.fallbackMetrics = {
      totalFallbacks: 0,
      successfulFallbacks: 0,
      failedFallbacks: 0,
      fallbacksByModel: new Map(),
      averageFallbackTime: 0
    };
  }

  private updateFallbackModelMetrics(modelId: string): void {
    const current = this.fallbackMetrics.fallbacksByModel.get(modelId) || 0;
    this.fallbackMetrics.fallbacksByModel.set(modelId, current + 1);
  }

  private updateFallbackMetrics(totalTime: number): void {
    const totalOperations = this.fallbackMetrics.successfulFallbacks + this.fallbackMetrics.failedFallbacks;
    this.fallbackMetrics.averageFallbackTime = 
      (this.fallbackMetrics.averageFallbackTime * (totalOperations - 1) + totalTime) / totalOperations;
  }
}

// ========================================
// UNIFIED RECOVERY MANAGER
// ========================================

export interface RecoveryManagerConfig {
  circuitBreaker: AICircuitBreakerConfig;
  retry: AIRetryConfig;
  fallback: AIFallbackConfig;
  enableMetrics: boolean;
  metricsResetInterval?: number;
}

export class AIRecoveryManager {
  private circuitBreakers = new Map<string, AICircuitBreaker>();
  private retryManager: AIRetryManager;
  private fallbackManager: AIFallbackManager;
  private metricsResetTimer?: NodeJS.Timeout;

  constructor(
    private config: RecoveryManagerConfig,
    private logger: Logger
  ) {
    this.retryManager = new AIRetryManager(config.retry, logger);
    this.fallbackManager = new AIFallbackManager(config.fallback, logger);

    // Setup metrics reset timer if configured
    if (config.enableMetrics && config.metricsResetInterval) {
      this.metricsResetTimer = setInterval(() => {
        this.resetAllMetrics();
      }, config.metricsResetInterval);
    }
  }

  /**
   * Get or create circuit breaker for a specific model/provider
   */
  getCircuitBreaker(identifier: string): AICircuitBreaker {
    if (!this.circuitBreakers.has(identifier)) {
      const circuitBreaker = new AICircuitBreaker(
        this.config.circuitBreaker,
        this.logger,
        identifier
      );
      this.circuitBreakers.set(identifier, circuitBreaker);
    }
    
    const circuitBreaker = this.circuitBreakers.get(identifier);
    if (!circuitBreaker) {
      throw new Error(`Failed to create circuit breaker for identifier: ${identifier}`);
    }
    
    return circuitBreaker;
  }

  /**
   * Execute operation with full recovery mechanisms
   */
  async executeWithRecovery<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperations: Map<string, () => Promise<T>>,
    context: {
      requestId?: string;
      primaryModel?: string;
      provider?: string;
      operationName?: string;
    } = {}
  ): Promise<T> {
    const identifier = `${context.provider || 'unknown'}-${context.primaryModel || 'unknown'}`;
    const circuitBreaker = this.getCircuitBreaker(identifier);

    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      this.logger.warn(`Circuit breaker ${identifier} is open, using fallback immediately`);
      
      if (fallbackOperations.size > 0) {
        return this.fallbackManager.executeWithFallback(
          primaryOperation,
          fallbackOperations,
          context
        );
      } else {
        throw new AIError(
          `Service ${identifier} is unavailable (circuit breaker open)`,
          AIErrorType.MODEL_UNAVAILABLE,
          context
        );
      }
    }

         // Execute with retry logic
     try {
      const result = await this.retryManager.executeWithRetry(async () => {
        const operationStartTime = Date.now();
        
        try {
          const result = await primaryOperation();
          const responseTime = Date.now() - operationStartTime;
          circuitBreaker.onSuccess(responseTime);
          return result;
        } catch (error) {
          const responseTime = Date.now() - operationStartTime;
          circuitBreaker.onFailure(error as Error, responseTime);
          throw error;
        }
      }, context);

      return result;

    } catch (error) {
      // Primary operation and retries failed, try fallback if available
      if (shouldUseFallback(error) && fallbackOperations.size > 0) {
        this.logger.info(`Primary operation failed, attempting fallback recovery`);
        
        return this.fallbackManager.executeWithFallback(
          primaryOperation,
          fallbackOperations,
          context
        );
      }

      throw error;
    }
  }

  /**
   * Get comprehensive metrics for all recovery mechanisms
   */
  getMetrics(): {
    circuitBreakers: Map<string, CircuitBreakerMetrics>;
    retry: RetryMetrics;
    fallback: FallbackMetrics;
  } {
    const circuitBreakerMetrics = new Map<string, CircuitBreakerMetrics>();
    for (const [id, cb] of this.circuitBreakers) {
      circuitBreakerMetrics.set(id, cb.getMetrics());
    }

    return {
      circuitBreakers: circuitBreakerMetrics,
      retry: this.retryManager.getMetrics(),
      fallback: this.fallbackManager.getMetrics()
    };
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.circuitBreakers.forEach(cb => cb.reset());
    this.retryManager.resetMetrics();
    this.fallbackManager.resetMetrics();
    this.logger.debug('All recovery metrics reset');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metricsResetTimer) {
      clearInterval(this.metricsResetTimer);
    }
  }
}

// ========================================
// DEFAULT CONFIGURATIONS
// ========================================

export const DEFAULT_RECOVERY_CONFIG: RecoveryManagerConfig = {
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  fallback: DEFAULT_FALLBACK_CONFIG,
  enableMetrics: true,
  metricsResetInterval: 3600000 // 1 hour
}; 