/**
 * Unified Error Handling and Recovery Mechanisms Test Suite
 * Comprehensive tests for error classification, retry logic, circuit breakers, and fallback mechanisms
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

import {
  AIError,
  AIErrorClassifier,
  AIRequestValidator,
  AIValidationError,
  AITimeoutError,
  AIRateLimitError,
  AIModelUnavailableError,
  createStandardError,
  isAIError,
  isRetryableError
} from '../../src/unified-error-handling';

import {
  AICircuitBreaker,
  AIRetryManager,
  AIFallbackManager,
  AIRecoveryManager,
  DEFAULT_RECOVERY_CONFIG
} from '../../src/ai-retry-recovery-manager';

import { AIErrorType } from '../../src/unified-ai-interfaces';

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('AI Error Handling and Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AIError Class', () => {
    test('should create basic AIError with default values', () => {
      const error = new AIError('Test error', AIErrorType.NETWORK_ERROR);
      
      expect(error.name).toBe('AIError');
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(error.severity).toBe('medium');
      expect(error.retryable).toBe(true);
      expect(error.code).toBe('AI_NET_001');
      expect(error.recoveryActions).toEqual(['Check internet connection', 'Retry request', 'Use different endpoint']);
    });

    test('should create AIError with custom options', () => {
      const error = new AIError('Custom error', AIErrorType.RATE_LIMITED, {
        severity: 'high',
        retryable: false,
        retryDelay: 5000,
        requestId: 'req_123',
        model: 'gpt-4',
        provider: 'openai',
        context: { customField: 'value' }
      });
      
      expect(error.severity).toBe('high');
      expect(error.retryable).toBe(false);
      expect(error.retryDelay).toBe(5000);
      expect(error.requestId).toBe('req_123');
      expect(error.model).toBe('gpt-4');
      expect(error.provider).toBe('openai');
      expect(error.context.customField).toBe('value');
    });

    test('should convert to AIErrorDetails interface', () => {
      const error = new AIError('Test error', AIErrorType.TIMEOUT, {
        requestId: 'req_123',
        model: 'gpt-4'
      });
      
      const details = error.toErrorDetails();
      
      expect(details.code).toBe('AI_TIME_001');
      expect(details.message).toBe('Test error');
      expect(details.type).toBe(AIErrorType.TIMEOUT);
      expect(details.retryable).toBe(true);
      expect(details.context?.requestId).toBe('req_123');
      expect(details.context?.model).toBe('gpt-4');
      expect(details.recoveryActions).toBeDefined();
    });
  });

  describe('Specialized Error Classes', () => {
    test('should create AIValidationError', () => {
      const validationErrors = [{
        code: 'MISSING_FIELD',
        message: 'Field is required',
        path: 'field'
      }];
      
      const error = new AIValidationError('Validation failed', validationErrors);
      
      expect(error.type).toBe(AIErrorType.VALIDATION_FAILED);
      expect(error.context.validationErrors).toEqual(validationErrors);
    });

    test('should create AITimeoutError with retry delay', () => {
      const error = new AITimeoutError('Request timed out', 30000);
      
      expect(error.type).toBe(AIErrorType.TIMEOUT);
      expect(error.retryable).toBe(true);
      expect(error.retryDelay).toBe(15000); // 50% of timeout, max 5000
      expect(error.context.timeoutMs).toBe(30000);
    });

    test('should create AIRateLimitError with retry after', () => {
      const error = new AIRateLimitError('Rate limited', 60000);
      
      expect(error.type).toBe(AIErrorType.RATE_LIMITED);
      expect(error.retryable).toBe(true);
      expect(error.retryDelay).toBe(60000);
      expect(error.context.retryAfter).toBe(60000);
    });

    test('should create AIModelUnavailableError', () => {
      const error = new AIModelUnavailableError('Model not found', 'gpt-4');
      
      expect(error.type).toBe(AIErrorType.MODEL_UNAVAILABLE);
      expect(error.retryable).toBe(false);
      expect(error.context.modelId).toBe('gpt-4');
    });
  });

  describe('AIErrorClassifier', () => {
    test('should classify AIError correctly', () => {
      const error = new AIError('Rate limited', AIErrorType.RATE_LIMITED);
      const classification = AIErrorClassifier.classify(error);
      
      expect(classification.type).toBe(AIErrorType.RATE_LIMITED);
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBe(true);
      expect(classification.fallbackRecommended).toBe(true);
      expect(classification.recoveryStrategy).toBe('exponential-backoff');
    });

    test('should classify generic error by message', () => {
      const error = new Error('Connection timeout occurred');
      const classification = AIErrorClassifier.classify(error);
      
      expect(classification.type).toBe(AIErrorType.TIMEOUT);
      expect(classification.retryable).toBe(true);
    });

    test('should provide default classification for unknown errors', () => {
      const error = new Error('Unknown issue');
      const classification = AIErrorClassifier.classify(error);
      
      expect(classification.type).toBe(AIErrorType.UNKNOWN_ERROR);
      expect(classification.severity).toBe('medium');
      expect(classification.retryable).toBe(false);
      expect(classification.fallbackRecommended).toBe(true);
    });

    test('should determine circuit breaker usage', () => {
      const timeoutError = new AIError('Timeout', AIErrorType.TIMEOUT);
      const authError = new AIError('Auth failed', AIErrorType.AUTHENTICATION_FAILED);
      
      expect(AIErrorClassifier.shouldTriggerCircuitBreaker(timeoutError)).toBe(true);
      expect(AIErrorClassifier.shouldTriggerCircuitBreaker(authError)).toBe(false);
    });

    test('should determine fallback usage', () => {
      const modelError = new AIError('Model unavailable', AIErrorType.MODEL_UNAVAILABLE);
      const validationError = new AIError('Invalid input', AIErrorType.VALIDATION_FAILED);
      
      expect(AIErrorClassifier.shouldUseFallback(modelError)).toBe(true);
      expect(AIErrorClassifier.shouldUseFallback(validationError)).toBe(false);
    });
  });

  describe('AIRequestValidator', () => {
    test('should validate valid request', () => {
      const request = {
        id: 'req_123',
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };
      
      const result = AIRequestValidator.validate(request as any);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required fields', () => {
      const request = {
        model: 'gpt-4'
        // Missing id and messages
      };
      
      const result = AIRequestValidator.validate(request as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'MISSING_REQUEST_ID')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_MESSAGES')).toBe(true);
    });

    test('should validate message structure', () => {
      const request = {
        id: 'req_123',
        model: 'gpt-4',
        messages: [
          { content: 'Hello' } // Missing role
        ]
      };
      
      const result = AIRequestValidator.validate(request as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_ROLE')).toBe(true);
    });

    test('should validate parameters', () => {
      const request = {
        id: 'req_123',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        parameters: {
          temperature: 3.0, // Invalid: > 2.0
          maxTokens: -100   // Invalid: negative
        }
      };
      
      const result = AIRequestValidator.validate(request as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TEMPERATURE')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_MAX_TOKENS')).toBe(true);
    });
  });

  describe('Type Guards and Utilities', () => {
    test('should identify AIError instances', () => {
      const aiError = new AIError('Test', AIErrorType.NETWORK_ERROR);
      const genericError = new Error('Test');
      
      expect(isAIError(aiError)).toBe(true);
      expect(isAIError(genericError)).toBe(false);
    });

    test('should check if error is retryable', () => {
      const retryableError = new AIError('Network error', AIErrorType.NETWORK_ERROR);
      const nonRetryableError = new AIError('Auth failed', AIErrorType.AUTHENTICATION_FAILED);
      
      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });

    test('should create standardized error from various sources', () => {
      const context = { requestId: 'req_123', model: 'gpt-4' };
      
      // From AIError
      const aiError = new AIError('Test', AIErrorType.TIMEOUT);
      const standardized1 = createStandardError(aiError, context);
      expect(standardized1).toBe(aiError);
      
      // From generic Error
      const genericError = new Error('Network failure');
      const standardized2 = createStandardError(genericError, context);
      expect(standardized2).toBeInstanceOf(AIError);
      expect(standardized2.requestId).toBe('req_123');
      
      // From string
      const standardized3 = createStandardError('String error', context);
      expect(standardized3).toBeInstanceOf(AIError);
      expect(standardized3.message).toBe('String error');
    });
  });

  describe('AICircuitBreaker', () => {
    let circuitBreaker: AICircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new AICircuitBreaker(
        {
          failureThreshold: 3,
          recoveryTimeout: 1000,
          halfOpenMaxCalls: 2,
          minimumThroughput: 5,
          successRateThreshold: 0.5,
          rollingWindowSize: 10
        },
        mockLogger as any,
        'test-breaker'
      );
    });

    test('should allow execution when closed', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getMetrics().state).toBe('closed');
    });

    test('should open after failure threshold', () => {
      // Record failures
      for (let i = 0; i < 3; i++) {
        circuitBreaker.onFailure(new Error('Test failure'));
      }
      
      expect(circuitBreaker.getMetrics().state).toBe('open');
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    test('should transition to half-open after recovery timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.onFailure(new Error('Test failure'));
      }
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getMetrics().state).toBe('half-open');
    });

    test('should close after successful half-open period', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.onFailure(new Error('Test failure'));
      }
      
      // Wait and transition to half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      circuitBreaker.canExecute();
      
      // Record successful calls
      circuitBreaker.onSuccess(100);
      circuitBreaker.onSuccess(150);
      
      expect(circuitBreaker.getMetrics().state).toBe('closed');
    });

    test('should track response times and metrics', () => {
      circuitBreaker.onSuccess(100);
      circuitBreaker.onSuccess(200);
      circuitBreaker.onFailure(new Error('Test'), 300);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalCalls).toBe(3);
      expect(metrics.successRate).toBeCloseTo(0.67, 2);
      expect(metrics.averageResponseTime).toBe(200);
    });
  });

  describe('AIRetryManager', () => {
    let retryManager: AIRetryManager;

    beforeEach(() => {
      retryManager = new AIRetryManager(
        {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitterFactor: 0,
          retryableErrors: [AIErrorType.NETWORK_ERROR, AIErrorType.TIMEOUT]
        },
        mockLogger as any
      );
    });

    test('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new AIError('Network error', AIErrorType.NETWORK_ERROR))
        .mockResolvedValue('success');
      
      const result = await retryManager.executeWithRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should not retry on non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new AIError('Auth failed', AIErrorType.AUTHENTICATION_FAILED));
      
      await expect(retryManager.executeWithRetry(operation)).rejects.toThrow('Auth failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should exhaust all retry attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new AIError('Network error', AIErrorType.NETWORK_ERROR));
      
      await expect(retryManager.executeWithRetry(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test('should calculate exponential backoff delays', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new AIError('Network error', AIErrorType.NETWORK_ERROR));
      
      const startTime = Date.now();
      await expect(retryManager.executeWithRetry(operation)).rejects.toThrow();
      const endTime = Date.now();
      
      // Should have delays: 0, 100, 200 = 300ms minimum
      expect(endTime - startTime).toBeGreaterThan(250);
    });
  });

  describe('AIFallbackManager', () => {
    let fallbackManager: AIFallbackManager;

    beforeEach(() => {
      fallbackManager = new AIFallbackManager(
        {
          enabled: true,
          fallbackModels: ['model-2', 'model-3'],
          maxFallbackAttempts: 2,
          fallbackTimeout: 5000,
          fallbackTriggers: [AIErrorType.MODEL_UNAVAILABLE, AIErrorType.TIMEOUT],
          qualityDegradationThreshold: 0.7
        },
        mockLogger as any
      );
    });

    test('should succeed with primary operation', async () => {
      const primaryOp = jest.fn().mockResolvedValue('primary-success');
      const fallbackOps = new Map([
        ['model-2', jest.fn().mockResolvedValue('fallback-success')]
      ]);
      
      const result = await fallbackManager.executeWithFallback(primaryOp, fallbackOps);
      
      expect(result).toBe('primary-success');
      expect(primaryOp).toHaveBeenCalledTimes(1);
    });

    test('should use fallback on triggering error', async () => {
      const primaryOp = jest.fn()
        .mockRejectedValue(new AIError('Model unavailable', AIErrorType.MODEL_UNAVAILABLE));
      const fallbackOps = new Map([
        ['model-2', jest.fn().mockResolvedValue('fallback-success')]
      ]);
      
      const result = await fallbackManager.executeWithFallback(primaryOp, fallbackOps);
      
      expect(result).toBe('fallback-success');
      expect(primaryOp).toHaveBeenCalledTimes(1);
    });

    test('should not use fallback on non-triggering error', async () => {
      const primaryOp = jest.fn()
        .mockRejectedValue(new AIError('Auth failed', AIErrorType.AUTHENTICATION_FAILED));
      const fallbackOps = new Map([
        ['model-2', jest.fn().mockResolvedValue('fallback-success')]
      ]);
      
      await expect(fallbackManager.executeWithFallback(primaryOp, fallbackOps))
        .rejects.toThrow('Auth failed');
    });

    test('should try multiple fallbacks in order', async () => {
      const primaryOp = jest.fn()
        .mockRejectedValue(new AIError('Timeout', AIErrorType.TIMEOUT));
      const fallbackOps = new Map([
        ['model-2', jest.fn().mockRejectedValue(new Error('Also failed'))],
        ['model-3', jest.fn().mockResolvedValue('final-success')]
      ]);
      
      const result = await fallbackManager.executeWithFallback(primaryOp, fallbackOps);
      
      expect(result).toBe('final-success');
    });

    test('should fail when all fallbacks fail', async () => {
      const primaryOp = jest.fn()
        .mockRejectedValue(new AIError('Timeout', AIErrorType.TIMEOUT));
      const fallbackOps = new Map([
        ['model-2', jest.fn().mockRejectedValue(new Error('Failed'))],
        ['model-3', jest.fn().mockRejectedValue(new Error('Also failed'))]
      ]);
      
      await expect(fallbackManager.executeWithFallback(primaryOp, fallbackOps))
        .rejects.toThrow();
    });
  });

  describe('AIRecoveryManager Integration', () => {
    let recoveryManager: AIRecoveryManager;

    beforeEach(() => {
      recoveryManager = new AIRecoveryManager(
        {
          ...DEFAULT_RECOVERY_CONFIG,
          circuitBreaker: {
            failureThreshold: 2,
            recoveryTimeout: 100,
            halfOpenMaxCalls: 1,
            minimumThroughput: 2,
            successRateThreshold: 0.5,
            rollingWindowSize: 5
          },
          retry: {
            maxAttempts: 2,
            baseDelay: 50,
            maxDelay: 200,
            backoffMultiplier: 2,
            jitterFactor: 0,
            retryableErrors: [AIErrorType.NETWORK_ERROR]
          }
        },
        mockLogger as any
      );
    });

    afterEach(() => {
      recoveryManager.destroy();
    });

    test('should execute operation with full recovery mechanisms', async () => {
      const primaryOp = jest.fn().mockResolvedValue('success');
      const fallbackOps = new Map();
      
      const result = await recoveryManager.executeWithRecovery(
        primaryOp,
        fallbackOps,
        { primaryModel: 'gpt-4', provider: 'openai' }
      );
      
      expect(result).toBe('success');
    });

    test('should use circuit breaker and fallback on repeated failures', async () => {
      const primaryOp = jest.fn()
        .mockRejectedValue(new AIError('Network error', AIErrorType.NETWORK_ERROR));
      const fallbackOps = new Map([
        ['gpt-3.5', jest.fn().mockResolvedValue('fallback-success')]
      ]);
      
      // First call should fail and open circuit
      await expect(recoveryManager.executeWithRecovery(primaryOp, fallbackOps))
        .rejects.toThrow();
      
      // Second call should immediately use fallback due to open circuit
      const result = await recoveryManager.executeWithRecovery(primaryOp, fallbackOps);
      expect(result).toBe('fallback-success');
    });

    test('should provide comprehensive metrics', async () => {
      const primaryOp = jest.fn()
        .mockRejectedValueOnce(new AIError('Network error', AIErrorType.NETWORK_ERROR))
        .mockResolvedValue('success');
      const fallbackOps = new Map();
      
      await recoveryManager.executeWithRecovery(primaryOp, fallbackOps);
      
      const metrics = recoveryManager.getMetrics();
      expect(metrics.circuitBreakers.size).toBeGreaterThan(0);
      expect(metrics.retry.totalAttempts).toBeGreaterThan(0);
    });

    test('should reset all metrics', async () => {
      const primaryOp = jest.fn().mockResolvedValue('success');
      const fallbackOps = new Map();
      
      await recoveryManager.executeWithRecovery(primaryOp, fallbackOps);
      recoveryManager.resetAllMetrics();
      
      const metrics = recoveryManager.getMetrics();
      expect(metrics.retry.totalAttempts).toBe(0);
    });
  });
}); 