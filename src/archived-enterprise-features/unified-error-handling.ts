/**
 * Unified Error Handling and Recovery Mechanisms
 * Comprehensive error handling system for AI model abstraction layer
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

import { Logger } from './logger';
import {
  AIErrorDetails,
  AIErrorType,
  AIModelRequest,
  AIModelResponse,
  AIValidationResult,
  AIValidationError,
  AIValidationWarning
} from './unified-ai-interfaces';

// ========================================
// ENHANCED ERROR CLASSIFICATION
// ========================================

/**
 * Enhanced error classification with recovery strategies
 */
export interface AIErrorClassification {
  /** Error type from unified taxonomy */
  type: AIErrorType;
  
  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Whether error is retryable */
  retryable: boolean;
  
  /** Whether fallback is recommended */
  fallbackRecommended: boolean;
  
  /** Recovery strategy to use */
  recoveryStrategy: 'immediate' | 'delayed' | 'exponential-backoff' | 'circuit-breaker' | 'manual';
  
  /** Estimated recovery time in milliseconds */
  estimatedRecoveryTime?: number;
  
  /** Maximum retry attempts for this error type */
  maxRetries?: number;
  
  /** Whether to use circuit breaker */
  useCircuitBreaker?: boolean;
  
  /** Custom recovery actions */
  customRecoveryActions?: string[];
}

/**
 * Circuit breaker configuration for AI operations
 */
export interface AICircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number;
  
  /** Recovery timeout in milliseconds */
  recoveryTimeout: number;
  
  /** Maximum calls in half-open state */
  halfOpenMaxCalls: number;
  
  /** Minimum throughput for health check */
  minimumThroughput: number;
  
  /** Success rate threshold (0-1) */
  successRateThreshold: number;
  
  /** Rolling window size for metrics */
  rollingWindowSize: number;
}

/**
 * Retry configuration with advanced backoff strategies
 */
export interface AIRetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Base delay in milliseconds */
  baseDelay: number;
  
  /** Maximum delay cap in milliseconds */
  maxDelay: number;
  
  /** Backoff multiplier */
  backoffMultiplier: number;
  
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
  
  /** Error types that should trigger retries */
  retryableErrors: AIErrorType[];
  
  /** Custom retry predicate function */
  retryPredicate?: (error: AIErrorDetails, attempt: number) => boolean;
}

/**
 * Fallback strategy configuration
 */
export interface AIFallbackConfig {
  /** Enable automatic fallback */
  enabled: boolean;
  
  /** Fallback model identifiers in priority order */
  fallbackModels: string[];
  
  /** Maximum fallback attempts */
  maxFallbackAttempts: number;
  
  /** Fallback timeout in milliseconds */
  fallbackTimeout: number;
  
  /** Error types that trigger fallback */
  fallbackTriggers: AIErrorType[];
  
  /** Quality degradation acceptance (0-1) */
  qualityDegradationThreshold: number;
}

// ========================================
// ENHANCED ERROR CLASSES
// ========================================

/**
 * Base AI error class with enhanced context and recovery information
 */
export class AIError extends Error {
  public readonly code: string;
  public readonly type: AIErrorType;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly retryable: boolean;
  public readonly retryDelay?: number;
  public readonly context: Record<string, unknown>;
  public readonly recoveryActions: string[];
  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly model?: string;
  public readonly provider?: string;

  constructor(
    message: string,
    type: AIErrorType,
    options: {
      code?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      retryable?: boolean;
      retryDelay?: number;
      context?: Record<string, unknown>;
      recoveryActions?: string[];
      requestId?: string;
      model?: string;
      provider?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'AIError';
    this.code = options.code || this.generateErrorCode(type);
    this.type = type;
    this.severity = options.severity || 'medium';
    this.retryable = options.retryable ?? this.isRetryableByDefault(type);
    this.retryDelay = options.retryDelay;
    this.context = options.context || {};
    this.recoveryActions = options.recoveryActions || this.getDefaultRecoveryActions(type);
    this.timestamp = new Date();
    this.requestId = options.requestId;
    this.model = options.model;
    this.provider = options.provider;

    // Preserve stack trace
    if (options.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, AIError.prototype);
  }

  /**
   * Convert to standardized AIErrorDetails interface
   */
  toErrorDetails(): AIErrorDetails {
    return {
      code: this.code,
      message: this.message,
      type: this.type,
      severity: this.severity,
      retryable: this.retryable,
      retryDelay: this.retryDelay,
      context: {
        requestId: this.requestId,
        model: this.model,
        provider: this.provider,
        timestamp: this.timestamp,
        stackTrace: this.stack,
        ...this.context
      },
      recoveryActions: this.recoveryActions
    };
  }

  private generateErrorCode(type: AIErrorType): string {
    const codeMap: Record<AIErrorType, string> = {
      [AIErrorType.INITIALIZATION_FAILED]: 'AI_INIT_001',
      [AIErrorType.INVALID_CONFIG]: 'AI_CONFIG_001',
      [AIErrorType.MODEL_UNAVAILABLE]: 'AI_MODEL_001',
      [AIErrorType.INVALID_REQUEST]: 'AI_REQ_001',
      [AIErrorType.VALIDATION_FAILED]: 'AI_VAL_001',
      [AIErrorType.UNSUPPORTED_OPERATION]: 'AI_OP_001',
      [AIErrorType.AUTHENTICATION_FAILED]: 'AI_AUTH_001',
      [AIErrorType.AUTHORIZATION_FAILED]: 'AI_AUTH_002',
      [AIErrorType.API_KEY_INVALID]: 'AI_AUTH_003',
      [AIErrorType.RATE_LIMITED]: 'AI_RATE_001',
      [AIErrorType.QUOTA_EXCEEDED]: 'AI_QUOTA_001',
      [AIErrorType.CONCURRENT_LIMIT_EXCEEDED]: 'AI_LIMIT_001',
      [AIErrorType.REQUEST_FAILED]: 'AI_REQ_002',
      [AIErrorType.RESPONSE_INVALID]: 'AI_RESP_001',
      [AIErrorType.PROCESSING_FAILED]: 'AI_PROC_001',
      [AIErrorType.NETWORK_ERROR]: 'AI_NET_001',
      [AIErrorType.TIMEOUT]: 'AI_TIME_001',
      [AIErrorType.CONNECTION_FAILED]: 'AI_CONN_001',
      [AIErrorType.CONTENT_FILTERED]: 'AI_CONTENT_001',
      [AIErrorType.SAFETY_VIOLATION]: 'AI_SAFETY_001',
      [AIErrorType.CONTENT_TOO_LARGE]: 'AI_SIZE_001',
      [AIErrorType.INSUFFICIENT_RESOURCES]: 'AI_RES_001',
      [AIErrorType.SYSTEM_OVERLOAD]: 'AI_SYS_001',
      [AIErrorType.INTERNAL_ERROR]: 'AI_INT_001',
      [AIErrorType.UNKNOWN_ERROR]: 'AI_UNK_001'
    };
    return codeMap[type] || 'AI_UNK_001';
  }

  private isRetryableByDefault(type: AIErrorType): boolean {
    const retryableTypes = [
      AIErrorType.NETWORK_ERROR,
      AIErrorType.TIMEOUT,
      AIErrorType.CONNECTION_FAILED,
      AIErrorType.RATE_LIMITED,
      AIErrorType.SYSTEM_OVERLOAD,
      AIErrorType.INSUFFICIENT_RESOURCES
    ];
    return retryableTypes.includes(type);
  }

  private getDefaultRecoveryActions(type: AIErrorType): string[] {
    const actionMap: Record<AIErrorType, string[]> = {
      [AIErrorType.RATE_LIMITED]: ['Wait before retrying', 'Reduce request frequency', 'Use batch processing'],
      [AIErrorType.TIMEOUT]: ['Retry with shorter timeout', 'Reduce request complexity', 'Check network connection'],
      [AIErrorType.AUTHENTICATION_FAILED]: ['Check API key', 'Verify credentials', 'Check account status'],
      [AIErrorType.QUOTA_EXCEEDED]: ['Check usage limits', 'Upgrade plan', 'Wait for quota reset'],
      [AIErrorType.NETWORK_ERROR]: ['Check internet connection', 'Retry request', 'Use different endpoint'],
      [AIErrorType.MODEL_UNAVAILABLE]: ['Try different model', 'Check model status', 'Use fallback model']
    };
    return actionMap[type] || ['Retry request', 'Check configuration', 'Contact support'];
  }
}

// ========================================
// SPECIALIZED ERROR CLASSES
// ========================================

export class AIValidationError extends AIError {
  constructor(message: string, validationErrors: AIValidationError[], options: any = {}) {
    super(message, AIErrorType.VALIDATION_FAILED, {
      ...options,
      context: { validationErrors, ...options.context }
    });
    this.name = 'AIValidationError';
  }
}

export class AITimeoutError extends AIError {
  constructor(message: string, timeoutMs: number, options: any = {}) {
    super(message, AIErrorType.TIMEOUT, {
      ...options,
      retryable: true,
      retryDelay: Math.min(timeoutMs * 0.5, 5000),
      context: { timeoutMs, ...options.context }
    });
    this.name = 'AITimeoutError';
  }
}

export class AIRateLimitError extends AIError {
  constructor(message: string, retryAfter?: number, options: any = {}) {
    super(message, AIErrorType.RATE_LIMITED, {
      ...options,
      retryable: true,
      retryDelay: retryAfter || 60000,
      context: { retryAfter, ...options.context }
    });
    this.name = 'AIRateLimitError';
  }
}

export class AIModelUnavailableError extends AIError {
  constructor(message: string, modelId: string, options: any = {}) {
    super(message, AIErrorType.MODEL_UNAVAILABLE, {
      ...options,
      retryable: false,
      context: { modelId, ...options.context }
    });
    this.name = 'AIModelUnavailableError';
  }
}

// ========================================
// ERROR CLASSIFIER
// ========================================

export class AIErrorClassifier {
  private static readonly DEFAULT_CLASSIFICATIONS: Map<AIErrorType, AIErrorClassification> = new Map([
    [AIErrorType.RATE_LIMITED, {
      type: AIErrorType.RATE_LIMITED,
      severity: 'medium',
      retryable: true,
      fallbackRecommended: true,
      recoveryStrategy: 'exponential-backoff',
      estimatedRecoveryTime: 60000,
      maxRetries: 3,
      useCircuitBreaker: false
    }],
    [AIErrorType.TIMEOUT, {
      type: AIErrorType.TIMEOUT,
      severity: 'medium',
      retryable: true,
      fallbackRecommended: true,
      recoveryStrategy: 'immediate',
      estimatedRecoveryTime: 2000,
      maxRetries: 3,
      useCircuitBreaker: true
    }],
    [AIErrorType.MODEL_UNAVAILABLE, {
      type: AIErrorType.MODEL_UNAVAILABLE,
      severity: 'high',
      retryable: false,
      fallbackRecommended: true,
      recoveryStrategy: 'manual',
      useCircuitBreaker: true
    }],
    [AIErrorType.AUTHENTICATION_FAILED, {
      type: AIErrorType.AUTHENTICATION_FAILED,
      severity: 'critical',
      retryable: false,
      fallbackRecommended: false,
      recoveryStrategy: 'manual'
    }],
    [AIErrorType.NETWORK_ERROR, {
      type: AIErrorType.NETWORK_ERROR,
      severity: 'high',
      retryable: true,
      fallbackRecommended: true,
      recoveryStrategy: 'exponential-backoff',
      estimatedRecoveryTime: 5000,
      maxRetries: 5,
      useCircuitBreaker: true
    }]
  ]);

  /**
   * Classify an error and determine recovery strategy
   */
  static classify(error: Error | AIError): AIErrorClassification {
    if (error instanceof AIError) {
      const defaultClassification = this.DEFAULT_CLASSIFICATIONS.get(error.type);
      if (defaultClassification) {
        return { ...defaultClassification };
      }
    }

    // Classify based on error message patterns
    return this.classifyByMessage(error);
  }

  private static classifyByMessage(error: Error): AIErrorClassification {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('etimedout')) {
      return this.DEFAULT_CLASSIFICATIONS.get(AIErrorType.TIMEOUT)!;
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return this.DEFAULT_CLASSIFICATIONS.get(AIErrorType.RATE_LIMITED)!;
    }

    if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
      return this.DEFAULT_CLASSIFICATIONS.get(AIErrorType.NETWORK_ERROR)!;
    }

    if (message.includes('unauthorized') || message.includes('authentication')) {
      return this.DEFAULT_CLASSIFICATIONS.get(AIErrorType.AUTHENTICATION_FAILED)!;
    }

    // Default classification for unknown errors
    return {
      type: AIErrorType.UNKNOWN_ERROR,
      severity: 'medium',
      retryable: false,
      fallbackRecommended: true,
      recoveryStrategy: 'manual'
    };
  }

  /**
   * Check if error should trigger circuit breaker
   */
  static shouldTriggerCircuitBreaker(error: Error | AIError): boolean {
    const classification = this.classify(error);
    return classification.useCircuitBreaker || false;
  }

  /**
   * Check if error should use fallback
   */
  static shouldUseFallback(error: Error | AIError): boolean {
    const classification = this.classify(error);
    return classification.fallbackRecommended;
  }

  /**
   * Get retry configuration for error
   */
  static getRetryConfig(error: Error | AIError): Partial<AIRetryConfig> {
    const classification = this.classify(error);
    
    if (!classification.retryable) {
      return { maxAttempts: 0 };
    }

    return {
      maxAttempts: classification.maxRetries || 3,
      baseDelay: classification.estimatedRecoveryTime || 1000,
      maxDelay: (classification.estimatedRecoveryTime || 1000) * 10,
      backoffMultiplier: classification.recoveryStrategy === 'exponential-backoff' ? 2 : 1,
      jitterFactor: 0.1
    };
  }
}

// ========================================
// ENHANCED VALIDATION SYSTEM
// ========================================

export class AIRequestValidator {
  /**
   * Comprehensive request validation with detailed error reporting
   */
  static validate(request: AIModelRequest): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    // Validate required fields
    if (!request.id) {
      errors.push({
        code: 'MISSING_REQUEST_ID',
        message: 'Request ID is required',
        path: 'id',
        expected: 'string',
        actual: typeof request.id
      });
    }

    if (!request.model) {
      errors.push({
        code: 'MISSING_MODEL',
        message: 'Model identifier is required',
        path: 'model',
        expected: 'string',
        actual: typeof request.model
      });
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      errors.push({
        code: 'INVALID_MESSAGES',
        message: 'Messages array is required and must contain at least one message',
        path: 'messages',
        expected: 'AIMessage[]',
        actual: typeof request.messages
      });
    }

    // Validate message structure
    if (request.messages && Array.isArray(request.messages)) {
      request.messages.forEach((message, index) => {
        const messageErrors = this.validateMessage(message, `messages[${index}]`);
        errors.push(...messageErrors.errors);
        warnings.push(...(messageErrors.warnings || []));
      });
    }

    // Validate parameters
    if (request.parameters) {
      const paramValidation = this.validateParameters(request.parameters);
      errors.push(...paramValidation.errors);
      warnings.push(...(paramValidation.warnings || []));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '2.0.0',
        validationTime: Date.now()
      }
    };
  }

  private static validateMessage(message: any, path: string): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    if (!message.role) {
      errors.push({
        code: 'MISSING_ROLE',
        message: 'Message role is required',
        path: `${path}.role`,
        expected: 'string',
        actual: typeof message.role
      });
    }

    if (!message.content) {
      errors.push({
        code: 'MISSING_CONTENT',
        message: 'Message content is required',
        path: `${path}.content`,
        expected: 'string | AIMessageContent[]',
        actual: typeof message.content
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private static validateParameters(parameters: any): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    if (parameters.maxTokens !== undefined) {
      if (typeof parameters.maxTokens !== 'number' || parameters.maxTokens <= 0) {
        errors.push({
          code: 'INVALID_MAX_TOKENS',
          message: 'maxTokens must be a positive number',
          path: 'parameters.maxTokens',
          expected: 'positive number',
          actual: parameters.maxTokens
        });
      }
    }

    if (parameters.temperature !== undefined) {
      if (typeof parameters.temperature !== 'number' || parameters.temperature < 0 || parameters.temperature > 2) {
        errors.push({
          code: 'INVALID_TEMPERATURE',
          message: 'temperature must be between 0 and 2',
          path: 'parameters.temperature',
          expected: '0 <= number <= 2',
          actual: parameters.temperature
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}

// ========================================
// TYPE GUARDS AND UTILITIES
// ========================================

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}

export function isRetryableError(error: unknown): boolean {
  if (isAIError(error)) {
    return error.retryable;
  }
  return AIErrorClassifier.classify(error as Error).retryable;
}

export function shouldUseFallback(error: unknown): boolean {
  return AIErrorClassifier.shouldUseFallback(error as Error);
}

export function shouldTriggerCircuitBreaker(error: unknown): boolean {
  return AIErrorClassifier.shouldTriggerCircuitBreaker(error as Error);
}

/**
 * Create standardized error from various sources
 */
export function createStandardError(
  error: unknown,
  context: {
    requestId?: string;
    model?: string;
    provider?: string;
    operation?: string;
  } = {}
): AIError {
  if (isAIError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const classification = AIErrorClassifier.classify(error);
    return new AIError(error.message, classification.type, {
      ...context,
      cause: error,
      severity: classification.severity,
      retryable: classification.retryable,
      retryDelay: classification.estimatedRecoveryTime,
      recoveryActions: classification.customRecoveryActions
    });
  }

  return new AIError(
    typeof error === 'string' ? error : 'Unknown error occurred',
    AIErrorType.UNKNOWN_ERROR,
    context
  );
}

// ========================================
// DEFAULT CONFIGURATIONS
// ========================================

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: AICircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenMaxCalls: 3,
  minimumThroughput: 10,
  successRateThreshold: 0.5,
  rollingWindowSize: 100
};

export const DEFAULT_RETRY_CONFIG: AIRetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
  retryableErrors: [
    AIErrorType.NETWORK_ERROR,
    AIErrorType.TIMEOUT,
    AIErrorType.CONNECTION_FAILED,
    AIErrorType.RATE_LIMITED,
    AIErrorType.SYSTEM_OVERLOAD,
    AIErrorType.INSUFFICIENT_RESOURCES
  ]
};

export const DEFAULT_FALLBACK_CONFIG: AIFallbackConfig = {
  enabled: true,
  fallbackModels: [],
  maxFallbackAttempts: 2,
  fallbackTimeout: 10000,
  fallbackTriggers: [
    AIErrorType.MODEL_UNAVAILABLE,
    AIErrorType.TIMEOUT,
    AIErrorType.SYSTEM_OVERLOAD,
    AIErrorType.QUOTA_EXCEEDED
  ],
  qualityDegradationThreshold: 0.7
}; 