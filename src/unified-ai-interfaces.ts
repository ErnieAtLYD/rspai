/**
 * Unified AI Model Interface Specification
 * Core contracts for AI model abstraction layer
 * 
 * This file defines the essential interfaces and types for creating a unified
 * abstraction layer that works with different AI models (OpenAI, Anthropic, 
 * local LLMs like Ollama/LlamaFile, etc.)
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

// ========================================
// CORE TYPE DEFINITIONS
// ========================================

/**
 * Supported AI model provider types
 */
export type AIProviderType = 
  | 'openai' 
  | 'anthropic' 
  | 'ollama' 
  | 'llamafile' 
  | 'google' 
  | 'cohere' 
  | 'huggingface' 
  | 'custom';

/**
 * AI model type classification (from ai-interfaces.ts for compatibility)
 */
export type AIModelType = 'local' | 'cloud';

/**
 * AI deployment types for privacy and performance considerations
 */
export type AIDeploymentType = 'cloud' | 'local' | 'hybrid';

/**
 * Enhanced privacy levels with more granular control
 */
export type AIPrivacyLevel = 
  | 'public'           // Cloud-based, data may be used for training
  | 'private'          // Cloud-based, data not used for training
  | 'confidential'     // Local processing only
  | 'encrypted'        // Encrypted processing
  | 'air-gapped';      // Completely isolated processing

/**
 * AI model capabilities with enhanced classification
 */
export type AICapability =
  | 'text-completion'
  | 'text-generation'
  | 'pattern-extraction'
  | 'summarization'
  | 'sentiment-analysis'
  | 'topic-modeling'
  | 'question-answering'
  | 'code-analysis'
  | 'translation'
  | 'classification'
  | 'embedding'
  | 'function-calling'
  | 'vision'
  | 'audio'
  | 'multimodal'
  | 'streaming'
  | 'batch-processing';

// ========================================
// STANDARDIZED MESSAGE FORMATS
// ========================================

/**
 * Universal message format compatible with all AI providers
 * Based on OpenAI's message format but extended for broader compatibility
 */
export interface AIMessage {
  /** Message role - extensible for provider-specific roles */
  readonly role: 'system' | 'user' | 'assistant' | 'function' | 'tool' | string;
  
  /** Message content - can be string or structured content */
  content: string | AIMessageContent[];
  
  /** Optional message name for identification */
  name?: string;
  
  /** Function call information (for function-calling models) */
  function_call?: {
    name: string;
    arguments: string;
  };
  
  /** Tool calls (for newer tool-calling models) */
  tool_calls?: AIToolCall[];
  
  /** Tool call ID (for tool responses) */
  tool_call_id?: string;
  
  /** Message metadata for tracking and context */
  metadata?: AIMessageMetadata;
}

/**
 * Structured content for multimodal messages
 */
export interface AIMessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
  audio_url?: {
    url: string;
    format?: string;
  };
  file_url?: {
    url: string;
    mime_type?: string;
  };
}

/**
 * Tool call structure for function-calling models
 */
export interface AIToolCall {
  readonly id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Message metadata for enhanced tracking and context
 */
export interface AIMessageMetadata {
  /** Unique message identifier */
  readonly id?: string;
  
  /** Timestamp when message was created */
  readonly timestamp?: Date;
  
  /** Source of the message (user, system, etc.) */
  source?: string;
  
  /** Message priority for processing */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Custom metadata fields */
  custom?: Record<string, unknown>;
  
  /** Privacy classification for this specific message */
  privacyLevel?: AIPrivacyLevel;
  
  /** Token count for this message (if available) */
  tokenCount?: number;
}

// ========================================
// REQUEST/RESPONSE DATA STRUCTURES
// ========================================

/**
 * Standardized AI model request structure
 * Compatible with multiple providers while maintaining extensibility
 */
export interface AIModelRequest {
  /** Unique request identifier for tracking */
  readonly id: string;
  
  /** Model identifier to use for this request */
  readonly model: string;
  
  /** Array of messages forming the conversation */
  messages: AIMessage[];
  
  /** Generation parameters */
  parameters?: AIGenerationParameters;
  
  /** Request-specific configuration */
  config?: AIRequestConfig;
  
  /** Request metadata */
  metadata?: AIRequestMetadata;
}

/**
 * AI generation parameters with comprehensive options
 */
export interface AIGenerationParameters {
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Temperature for randomness (0.0 to 2.0) */
  temperature?: number;
  
  /** Top-p sampling parameter */
  topP?: number;
  
  /** Top-k sampling parameter */
  topK?: number;
  
  /** Stop sequences to halt generation */
  stopSequences?: string[];
  
  /** Presence penalty (-2.0 to 2.0) */
  presencePenalty?: number;
  
  /** Frequency penalty (-2.0 to 2.0) */
  frequencyPenalty?: number;
  
  /** Seed for deterministic generation */
  seed?: number;
  
  /** Enable streaming response */
  stream?: boolean;
  
  /** Number of completions to generate */
  n?: number;
  
  /** Return log probabilities */
  logprobs?: boolean;
  
  /** Number of log probabilities to return */
  topLogprobs?: number;
  
  /** Response format specification */
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    schema?: Record<string, unknown>;
  };
  
  /** Tools/functions available to the model */
  tools?: AITool[];
  
  /** Tool choice strategy */
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

/**
 * Tool definition for function-calling models
 */
export interface AITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Request-specific configuration
 */
export interface AIRequestConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Number of retry attempts */
  retryAttempts?: number;
  
  /** Retry delay in milliseconds */
  retryDelay?: number;
  
  /** Enable request caching */
  enableCaching?: boolean;
  
  /** Cache TTL in seconds */
  cacheTTL?: number;
  
  /** Custom headers for the request */
  customHeaders?: Record<string, string>;
  
  /** Provider-specific parameters */
  providerParams?: Record<string, unknown>;
}

/**
 * Request metadata for tracking and analytics
 */
export interface AIRequestMetadata {
  /** Request source/origin */
  source?: string;
  
  /** User identifier */
  userId?: string;
  
  /** Session identifier */
  sessionId?: string;
  
  /** Request priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Expected response type */
  expectedResponseType?: string;
  
  /** Request tags for categorization */
  tags?: string[];
  
  /** Custom metadata */
  custom?: Record<string, unknown>;
  
  /** Privacy requirements */
  privacyRequirements?: {
    level: AIPrivacyLevel;
    dataRetention?: number; // seconds
    encryptionRequired?: boolean;
    auditRequired?: boolean;
  };
}

/**
 * Standardized AI model response structure
 */
export interface AIModelResponse {
  /** Unique response identifier */
  readonly id: string;
  
  /** Original request ID for correlation */
  readonly requestId: string;
  
  /** Model that generated the response */
  readonly model: string;
  
  /** Generated choices/completions */
  choices: AIChoice[];
  
  /** Token usage information */
  usage?: AITokenUsage;
  
  /** Response metadata */
  metadata?: AIResponseMetadata;
  
  /** Error information if request failed */
  error?: AIErrorDetails;
  
  /** Response timestamp */
  readonly createdAt: Date;
  
  /** Processing time in milliseconds */
  processingTime?: number;
}

/**
 * Individual choice/completion in the response
 */
export interface AIChoice {
  /** Choice index in the response */
  readonly index: number;
  
  /** Generated message */
  message: AIMessage;
  
  /** Reason why generation finished */
  finishReason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter' | 'null';
  
  /** Log probabilities (if requested) */
  logprobs?: {
    tokens: string[];
    tokenLogprobs: number[];
    topLogprobs?: Array<Record<string, number>>;
    textOffset: number[];
  };
  
  /** Choice-specific metadata */
  metadata?: {
    confidence?: number;
    qualityScore?: number;
    custom?: Record<string, unknown>;
  };
}

/**
 * Comprehensive token usage tracking
 */
export interface AITokenUsage {
  /** Tokens used in the prompt/input */
  promptTokens: number;
  
  /** Tokens generated in the completion */
  completionTokens: number;
  
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
  
  /** Detailed token breakdown by type */
  breakdown?: {
    systemTokens?: number;
    userTokens?: number;
    assistantTokens?: number;
    functionTokens?: number;
    toolTokens?: number;
  };
  
  /** Cost information (if available) */
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
  };
}

/**
 * Response metadata for analytics and debugging
 */
export interface AIResponseMetadata {
  /** Provider-specific response metadata */
  providerMetadata?: Record<string, unknown>;
  
  /** Response quality metrics */
  qualityMetrics?: {
    coherence?: number;
    relevance?: number;
    factualAccuracy?: number;
    creativity?: number;
  };
  
  /** Performance metrics */
  performanceMetrics?: {
    latency: number;
    throughput: number;
    cacheHit: boolean;
    retryCount: number;
  };
  
  /** Safety and moderation results */
  moderationResults?: {
    flagged: boolean;
    categories: string[];
    confidence: number;
  };
  
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

// ========================================
// BATCH PROCESSING DATA STRUCTURES
// ========================================

/**
 * Batch request for processing multiple requests efficiently
 */
export interface AIBatchRequest {
  /** Unique batch identifier */
  readonly id: string;
  
  /** Array of individual requests */
  requests: AIModelRequest[];
  
  /** Batch-specific configuration */
  config?: AIBatchConfig;
  
  /** Batch metadata */
  metadata?: AIBatchMetadata;
}

/**
 * Batch processing configuration
 */
export interface AIBatchConfig {
  /** Maximum batch size */
  maxBatchSize?: number;
  
  /** Maximum wait time before processing batch */
  maxWaitTime?: number;
  
  /** Parallel processing configuration */
  parallelism?: {
    enabled: boolean;
    maxConcurrency: number;
  };
  
  /** Error handling strategy */
  errorHandling?: {
    strategy: 'fail-fast' | 'continue-on-error' | 'retry-failed';
    maxRetries: number;
  };
  
  /** Result aggregation options */
  aggregation?: {
    enabled: boolean;
    strategy: 'collect-all' | 'first-success' | 'best-quality';
  };
}

/**
 * Batch metadata for tracking and analytics
 */
export interface AIBatchMetadata {
  /** Batch priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Expected processing time */
  expectedProcessingTime?: number;
  
  /** Resource requirements */
  resourceRequirements?: {
    memoryMB: number;
    cpuCores: number;
    gpuMemoryMB?: number;
  };
  
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Batch response containing results for all requests
 */
export interface AIBatchResponse {
  /** Unique batch response identifier */
  readonly id: string;
  
  /** Original batch request ID */
  readonly batchRequestId: string;
  
  /** Individual responses for each request */
  responses: AIModelResponse[];
  
  /** Batch-level statistics */
  statistics?: AIBatchStatistics;
  
  /** Batch metadata */
  metadata?: AIBatchResponseMetadata;
  
  /** Batch processing timestamp */
  readonly createdAt: Date;
  
  /** Total batch processing time */
  totalProcessingTime?: number;
}

/**
 * Batch processing statistics
 */
export interface AIBatchStatistics {
  /** Total requests processed */
  totalRequests: number;
  
  /** Successful requests */
  successfulRequests: number;
  
  /** Failed requests */
  failedRequests: number;
  
  /** Average processing time per request */
  averageProcessingTime: number;
  
  /** Total tokens used across all requests */
  totalTokensUsed: number;
  
  /** Total cost (if available) */
  totalCost?: number;
  
  /** Throughput (requests per second) */
  throughput: number;
}

/**
 * Batch response metadata
 */
export interface AIBatchResponseMetadata {
  /** Resource utilization during batch processing */
  resourceUtilization?: {
    peakMemoryUsage: number;
    averageCpuUsage: number;
    peakGpuUsage?: number;
  };
  
  /** Quality metrics for the batch */
  qualityMetrics?: {
    averageQuality: number;
    consistencyScore: number;
    outlierCount: number;
  };
  
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

// ========================================
// STREAMING DATA STRUCTURES
// ========================================

/**
 * Streaming response chunk for real-time processing
 */
export interface AIStreamChunk {
  /** Unique chunk identifier */
  readonly id: string;
  
  /** Original request ID */
  readonly requestId: string;
  
  /** Chunk sequence number */
  readonly index: number;
  
  /** Partial choice data */
  choices?: Partial<AIChoice>[];
  
  /** Delta content (incremental changes) */
  delta?: {
    role?: string;
    content?: string;
    function_call?: {
      name?: string;
      arguments?: string;
    };
    tool_calls?: Partial<AIToolCall>[];
  };
  
  /** Indicates if this is the final chunk */
  done: boolean;
  
  /** Chunk-specific metadata */
  metadata?: {
    timestamp: Date;
    latency: number;
    custom?: Record<string, unknown>;
  };
  
  /** Error information (if chunk represents an error) */
  error?: AIErrorDetails;
}

/**
 * Stream configuration options
 */
export interface AIStreamConfig {
  /** Enable chunked transfer */
  chunked?: boolean;
  
  /** Chunk size for streaming */
  chunkSize?: number;
  
  /** Buffer size for stream processing */
  bufferSize?: number;
  
  /** Heartbeat interval for connection keepalive */
  heartbeatInterval?: number;
  
  /** Stream timeout */
  timeout?: number;
  
  /** Error handling for stream interruptions */
  errorHandling?: {
    autoReconnect: boolean;
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
}

/**
 * Stream event types for event-driven processing
 */
export type AIStreamEventType = 
  | 'start'
  | 'chunk'
  | 'progress'
  | 'complete'
  | 'error'
  | 'abort';

/**
 * Stream event structure
 */
export interface AIStreamEvent {
  /** Event type */
  type: AIStreamEventType;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Associated stream chunk (for chunk events) */
  chunk?: AIStreamChunk;
  
  /** Progress information (for progress events) */
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  
  /** Error information (for error events) */
  error?: AIErrorDetails;
  
  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Stream callback function type
 */
export type AIStreamCallback = (event: AIStreamEvent) => void;

// ========================================
// ERROR HANDLING DATA STRUCTURES
// ========================================

/**
 * Comprehensive error details structure
 */
export interface AIErrorDetails {
  /** Error code (provider-agnostic) */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Error type classification */
  type: AIErrorType;
  
  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Whether the error is retryable */
  retryable: boolean;
  
  /** Recommended retry delay (if retryable) */
  retryDelay?: number;
  
  /** Provider-specific error details */
  providerError?: {
    originalCode?: string;
    originalMessage?: string;
    details?: unknown;
  };
  
  /** Error context and debugging information */
  context?: {
    requestId?: string;
    model?: string;
    provider?: string;
    timestamp: Date;
    stackTrace?: string;
  };
  
  /** Suggested recovery actions */
  recoveryActions?: string[];
}

/**
 * Enhanced error type enumeration
 */
export enum AIErrorType {
  // Configuration and initialization errors
  INITIALIZATION_FAILED = 'initialization_failed',
  INVALID_CONFIG = 'invalid_config',
  MODEL_UNAVAILABLE = 'model_unavailable',
  
  // Request and validation errors
  INVALID_REQUEST = 'invalid_request',
  VALIDATION_FAILED = 'validation_failed',
  UNSUPPORTED_OPERATION = 'unsupported_operation',
  
  // Authentication and authorization errors
  AUTHENTICATION_FAILED = 'authentication_failed',
  AUTHORIZATION_FAILED = 'authorization_failed',
  API_KEY_INVALID = 'api_key_invalid',
  
  // Rate limiting and quota errors
  RATE_LIMITED = 'rate_limited',
  QUOTA_EXCEEDED = 'quota_exceeded',
  CONCURRENT_LIMIT_EXCEEDED = 'concurrent_limit_exceeded',
  
  // Processing and response errors
  REQUEST_FAILED = 'request_failed',
  RESPONSE_INVALID = 'response_invalid',
  PROCESSING_FAILED = 'processing_failed',
  
  // Network and connectivity errors
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  CONNECTION_FAILED = 'connection_failed',
  
  // Content and safety errors
  CONTENT_FILTERED = 'content_filtered',
  SAFETY_VIOLATION = 'safety_violation',
  CONTENT_TOO_LARGE = 'content_too_large',
  
  // System and resource errors
  INSUFFICIENT_RESOURCES = 'insufficient_resources',
  SYSTEM_OVERLOAD = 'system_overload',
  INTERNAL_ERROR = 'internal_error',
  
  // Unknown and fallback errors
  UNKNOWN_ERROR = 'unknown_error'
}

// ========================================
// VALIDATION AND SCHEMA DEFINITIONS
// ========================================

/**
 * Schema validation result
 */
export interface AIValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors (if any) */
  errors: AIValidationError[];
  
  /** Validation warnings */
  warnings?: AIValidationWarning[];
  
  /** Validation metadata */
  metadata?: {
    validatedAt: Date;
    validatorVersion: string;
    validationTime: number;
  };
}

/**
 * Validation error details
 */
export interface AIValidationError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Field path where error occurred */
  path?: string;
  
  /** Expected value or format */
  expected?: unknown;
  
  /** Actual value that caused the error */
  actual?: unknown;
}

/**
 * Validation warning details
 */
export interface AIValidationWarning {
  /** Warning code */
  code: string;
  
  /** Warning message */
  message: string;
  
  /** Field path where warning occurred */
  path?: string;
  
  /** Suggested action */
  suggestion?: string;
}

// ========================================
// UTILITY AND HELPER TYPES
// ========================================

/**
 * Generic response wrapper for consistent API responses
 */
export interface APIResponse<T> {
  /** Response data */
  data?: T;
  
  /** Success indicator */
  success: boolean;
  
  /** Error details (if unsuccessful) */
  error?: AIErrorDetails;
  
  /** Response metadata */
  metadata?: {
    timestamp: Date;
    requestId: string;
    processingTime: number;
    version: string;
  };
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  /** Current page number */
  page: number;
  
  /** Items per page */
  pageSize: number;
  
  /** Total number of items */
  totalItems: number;
  
  /** Total number of pages */
  totalPages: number;
  
  /** Whether there are more pages */
  hasNext: boolean;
  
  /** Whether there are previous pages */
  hasPrevious: boolean;
  
  /** Next page cursor (for cursor-based pagination) */
  nextCursor?: string;
  
  /** Previous page cursor */
  previousCursor?: string;
}

/**
 * List response with pagination
 */
export interface ListResponse<T> extends APIResponse<T[]> {
  /** Pagination information */
  pagination?: PaginationInfo;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  /** Service health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Health check timestamp */
  timestamp: Date;
  
  /** Response time in milliseconds */
  responseTime: number;
  
  /** Service version */
  version?: string;
  
  /** Detailed health information */
  details?: {
    models?: Array<{
      name: string;
      status: 'available' | 'unavailable' | 'degraded';
      responseTime?: number;
      error?: string;
    }>;
    resources?: {
      memory: { used: number; available: number };
      cpu: { usage: number };
      disk?: { used: number; available: number };
    };
    dependencies?: Array<{
      name: string;
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
    }>;
  };
}

// ========================================
// TYPE GUARDS AND UTILITY FUNCTIONS
// ========================================

/**
 * Type guard to check if a response is an error response
 */
export function isErrorResponse<T>(response: APIResponse<T>): response is APIResponse<T> & { error: AIErrorDetails } {
  return !response.success && response.error !== undefined;
}

/**
 * Type guard to check if an error is retryable
 */
export function isRetryableError(error: AIErrorDetails): boolean {
  return error.retryable && [
    AIErrorType.RATE_LIMITED,
    AIErrorType.TIMEOUT,
    AIErrorType.NETWORK_ERROR,
    AIErrorType.SYSTEM_OVERLOAD,
    AIErrorType.INSUFFICIENT_RESOURCES
  ].includes(error.type);
}

/**
 * Type guard to check if a stream chunk is the final chunk
 */
export function isFinalStreamChunk(chunk: AIStreamChunk): boolean {
  return chunk.done === true;
}

/**
 * Type guard to check if a message has tool calls
 */
export function hasToolCalls(message: AIMessage): message is AIMessage & { tool_calls: AIToolCall[] } {
  return message.tool_calls !== undefined && message.tool_calls.length > 0;
}

/**
 * Type guard to check if a message has function call
 */
export function hasFunctionCall(message: AIMessage): message is AIMessage & { function_call: { name: string; arguments: string } } {
  return message.function_call !== undefined;
}

// ========================================
// CONSTANTS AND DEFAULTS
// ========================================

/**
 * Default generation parameters
 */
export const DEFAULT_GENERATION_PARAMETERS: Required<Pick<AIGenerationParameters, 'maxTokens' | 'temperature' | 'topP' | 'n'>> = {
  maxTokens: 1024,
  temperature: 0.7,
  topP: 1.0,
  n: 1
};

/**
 * Default request configuration
 */
export const DEFAULT_REQUEST_CONFIG: Required<Pick<AIRequestConfig, 'timeout' | 'retryAttempts' | 'retryDelay' | 'enableCaching'>> = {
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  enableCaching: true
};

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: Required<AIBatchConfig> = {
  maxBatchSize: 10,
  maxWaitTime: 1000, // 1 second
  parallelism: {
    enabled: true,
    maxConcurrency: 5
  },
  errorHandling: {
    strategy: 'continue-on-error',
    maxRetries: 2
  },
  aggregation: {
    enabled: false,
    strategy: 'collect-all'
  }
};

/**
 * Default stream configuration
 */
export const DEFAULT_STREAM_CONFIG: Required<AIStreamConfig> = {
  chunked: true,
  chunkSize: 1024,
  bufferSize: 4096,
  heartbeatInterval: 30000, // 30 seconds
  timeout: 300000, // 5 minutes
  errorHandling: {
    autoReconnect: true,
    maxReconnectAttempts: 3,
    reconnectDelay: 1000
  }
};

/**
 * Maximum supported values for various parameters
 */
export const AI_LIMITS = {
  MAX_TOKENS: 128000,
  MAX_MESSAGES: 1000,
  MAX_BATCH_SIZE: 100,
  MAX_TOOLS: 50,
  MAX_CHOICES: 10,
  MAX_RETRY_ATTEMPTS: 10,
  MAX_TIMEOUT: 600000, // 10 minutes
  MAX_CACHE_TTL: 86400, // 24 hours
} as const;

/**
 * Supported message roles across different providers
 */
export const SUPPORTED_MESSAGE_ROLES = [
  'system',
  'user', 
  'assistant',
  'function',
  'tool'
] as const;

/**
 * Common error codes and their descriptions
 */
export const ERROR_CODES = {
  // Request validation errors
  'INVALID_MESSAGE_FORMAT': 'Message format is invalid or unsupported',
  'MISSING_REQUIRED_FIELD': 'Required field is missing from request',
  'INVALID_PARAMETER_VALUE': 'Parameter value is outside acceptable range',
  
  // Authentication errors
  'API_KEY_MISSING': 'API key is required but not provided',
  'API_KEY_EXPIRED': 'API key has expired',
  'INSUFFICIENT_PERMISSIONS': 'API key lacks required permissions',
  
  // Rate limiting errors
  'REQUESTS_PER_MINUTE_EXCEEDED': 'Rate limit for requests per minute exceeded',
  'TOKENS_PER_MINUTE_EXCEEDED': 'Rate limit for tokens per minute exceeded',
  'CONCURRENT_REQUESTS_EXCEEDED': 'Maximum concurrent requests exceeded',
  
  // Content errors
  'CONTENT_POLICY_VIOLATION': 'Content violates usage policies',
  'CONTENT_TOO_LONG': 'Content exceeds maximum length limit',
  'UNSUPPORTED_CONTENT_TYPE': 'Content type is not supported',
  
  // System errors
  'MODEL_OVERLOADED': 'Model is currently overloaded',
  'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable',
  'INTERNAL_SERVER_ERROR': 'An internal error occurred'
} as const;

// ========================================
// UNIFIED AI MODEL ADAPTER INTERFACE
// ========================================

/**
 * Unified AI Model Adapter Interface
 * 
 * This interface bridges the simple ai-interfaces.ts system with the comprehensive
 * unified-ai-interfaces.ts system, providing backward compatibility while enabling
 * advanced features.
 */
export interface UnifiedAIModelAdapter {
  // ========================================
  // BASIC PROPERTIES (from ai-interfaces.ts)
  // ========================================
  
  /** Adapter name */
  readonly name: string;
  
  /** Adapter description */
  readonly description: string;
  
  /** Model type classification */
  readonly type: AIModelType;
  
  /** Privacy level supported */
  readonly privacyLevel: AIPrivacyLevel;
  
  /** Supported capabilities */
  readonly capabilities: AICapability[];
  
  /** Current configuration */
  readonly config: UnifiedModelConfig;
  
  // ========================================
  // LIFECYCLE METHODS
  // ========================================
  
  /**
   * Initialize the adapter
   */
  initialize(): Promise<boolean>;
  
  /**
   * Check if adapter is available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get detailed health status
   */
  getHealth(): Promise<HealthCheckResponse>;
  
  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
  
  // ========================================
  // LEGACY COMPATIBILITY METHODS (from ai-interfaces.ts)
  // ========================================
  
  /**
   * Generate text completion (legacy method)
   * @deprecated Use processRequest() for new implementations
   */
  generateCompletion(
    prompt: string,
    options?: LegacyCompletionOptions
  ): Promise<string>;
  
  /**
   * Extract patterns from content (legacy method)
   * @deprecated Use processRequest() with pattern extraction capability
   */
  extractPatterns(
    content: string,
    context?: unknown
  ): Promise<DetectedPattern[]>;
  
  /**
   * Generate summary (legacy method)
   * @deprecated Use processRequest() with summarization capability
   */
  generateSummary(
    patterns: DetectedPattern[],
    context?: unknown
  ): Promise<string>;
  
  /**
   * Analyze content (legacy method)
   * @deprecated Use processRequest() for structured analysis
   */
  analyzeContent(
    content: string,
    analysisType?: string
  ): Promise<LegacyAnalysisResult>;
  
  /**
   * Classify content (legacy method)
   * @deprecated Use processRequest() with classification capability
   */
  classifyContent(
    content: string,
    categories: string[]
  ): Promise<{ category: string; confidence: number }>;
  
  /**
   * Analyze sentiment (legacy method)
   * @deprecated Use processRequest() with sentiment analysis capability
   */
  analyzeSentiment(
    content: string
  ): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>;
  
  // ========================================
  // UNIFIED PROCESSING METHODS (New Standard)
  // ========================================
  
  /**
   * Process a single AI request (primary method)
   */
  processRequest(request: AIModelRequest): Promise<AIModelResponse>;
  
  /**
   * Process multiple requests in batch
   */
  processBatch(batchRequest: AIBatchRequest): Promise<AIBatchResponse>;
  
  /**
   * Process request with streaming response
   */
  processStream(
    request: AIModelRequest,
    callback: AIStreamCallback
  ): Promise<void>;
  
  // ========================================
  // ENHANCED CAPABILITIES
  // ========================================
  
  /**
   * Get supported capabilities dynamically
   */
  getCapabilities(): Promise<AICapability[]>;
  
  /**
   * Validate a request before processing
   */
  validateRequest(request: AIModelRequest): Promise<AIValidationResult>;
  
  /**
   * Estimate cost for a request
   */
  estimateCost(request: AIModelRequest): Promise<{
    estimatedCost: number;
    currency: string;
    breakdown: {
      inputTokens: number;
      outputTokens: number;
      inputCost: number;
      outputCost: number;
    };
  }>;
  
  /**
   * Get model metadata and information
   */
  getModelInfo(): Promise<{
    modelId: string;
    version: string;
    contextWindow: number;
    maxOutputTokens: number;
    supportedFormats: string[];
    trainingCutoff?: Date;
  }>;
  
  /**
   * Update adapter configuration
   */
  updateConfig(config: Partial<UnifiedModelConfig>): Promise<void>;
  
  // ========================================
  // ADVANCED FEATURES
  // ========================================
  
  /**
   * Create embeddings for text
   */
  createEmbeddings?(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<EmbeddingResponse>;
  
  /**
   * Fine-tune the model (if supported)
   */
  fineTune?(
    trainingData: FineTuningData,
    options?: FineTuningOptions
  ): Promise<FineTuningJob>;
  
  /**
   * Get fine-tuning job status
   */
  getFineTuningStatus?(jobId: string): Promise<FineTuningJob>;
  
  /**
   * Cancel fine-tuning job
   */
  cancelFineTuning?(jobId: string): Promise<void>;
}

// ========================================
// UNIFIED CONFIGURATION INTERFACE
// ========================================

/**
 * Unified model configuration that bridges simple and comprehensive config systems
 */
export interface UnifiedModelConfig {
  // Basic configuration (from ai-interfaces.ts)
  name: string;
  type: AIModelType;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  customHeaders?: Record<string, string>;
  customParameters?: Record<string, unknown>;
  
  // Advanced configuration (from unified-ai-interfaces.ts)
  provider?: AIProviderType;
  deploymentType?: AIDeploymentType;
  privacyLevel?: AIPrivacyLevel;
  capabilities?: AICapability[];
  
  // Request defaults
  defaultRequestConfig?: AIRequestConfig;
  defaultGenerationParams?: AIGenerationParameters;
  
  // Performance settings
  enableCaching?: boolean;
  cacheTTL?: number;
  enableBatching?: boolean;
  maxBatchSize?: number;
  
  // Resilience settings
  circuitBreakerConfig?: {
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
  
  // Monitoring and observability
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ========================================
// LEGACY COMPATIBILITY TYPES
// ========================================

/**
 * Legacy completion options for backward compatibility
 */
export interface LegacyCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
  stream?: boolean;
  timeout?: number;
}

/**
 * Legacy analysis result for backward compatibility
 */
export interface LegacyAnalysisResult {
  success: boolean;
  patterns: DetectedPattern[];
  summary: string;
  insights: string[];
  recommendations: string[];
  confidence: number;
  processingTime: number;
  modelUsed: string;
  tokensUsed?: number;
  error?: string;
}

/**
 * Detected pattern (from ai-interfaces.ts)
 */
export interface DetectedPattern {
  id: string;
  type: 'habit' | 'goal' | 'challenge' | 'insight' | 'trend' | 'relationship' | 'other';
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  timeframe?: {
    start?: Date;
    end?: Date;
    frequency?: string;
  };
  metadata: {
    sourceFiles: string[];
    keywords: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
    importance?: 'low' | 'medium' | 'high';
    category?: string;
  };
}

// ========================================
// EMBEDDING INTERFACES
// ========================================

/**
 * Embedding generation options
 */
export interface EmbeddingOptions {
  /** Embedding model to use */
  model?: string;
  
  /** Encoding format */
  encodingFormat?: 'float' | 'base64';
  
  /** Dimensions for the embedding (if supported) */
  dimensions?: number;
  
  /** User identifier for tracking */
  user?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /** Generated embeddings */
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  
  /** Model used for generation */
  model: string;
  
  /** Token usage information */
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

// ========================================
// FINE-TUNING INTERFACES
// ========================================

/**
 * Fine-tuning training data
 */
export interface FineTuningData {
  /** Training file ID or data */
  trainingFile: string | TrainingExample[];
  
  /** Validation file ID or data (optional) */
  validationFile?: string | TrainingExample[];
}

/**
 * Training example for fine-tuning
 */
export interface TrainingExample {
  /** Input messages */
  messages: AIMessage[];
  
  /** Optional weight for this example */
  weight?: number;
}

/**
 * Fine-tuning options
 */
export interface FineTuningOptions {
  /** Base model to fine-tune */
  model: string;
  
  /** Number of epochs */
  nEpochs?: number;
  
  /** Batch size */
  batchSize?: number;
  
  /** Learning rate multiplier */
  learningRateMultiplier?: number;
  
  /** Prompt loss weight */
  promptLossWeight?: number;
  
  /** Suffix for the fine-tuned model name */
  suffix?: string;
  
  /** Validation split */
  validationSplit?: number;
}

/**
 * Fine-tuning job information
 */
export interface FineTuningJob {
  /** Job ID */
  id: string;
  
  /** Object type */
  object: 'fine_tuning.job';
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Finished timestamp */
  finishedAt?: number;
  
  /** Fine-tuned model ID */
  fineTunedModel?: string;
  
  /** Hyperparameters used */
  hyperparameters: {
    nEpochs: number;
    batchSize: number;
    learningRateMultiplier: number;
  };
  
  /** Base model */
  model: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Result files */
  resultFiles: string[];
  
  /** Job status */
  status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  
  /** Training file ID */
  trainingFile: string;
  
  /** Validation file ID */
  validationFile?: string;
  
  /** Error information */
  error?: {
    code: string;
    message: string;
    param?: string;
  };
}

// ========================================
// ADAPTER FACTORY INTERFACE
// ========================================

/**
 * Factory for creating unified AI model adapters
 */
export interface UnifiedAIModelFactory {
  /**
   * Create a unified adapter instance
   */
  createAdapter(config: UnifiedModelConfig): Promise<UnifiedAIModelAdapter>;
  
  /**
   * Get available adapter types
   */
  getAvailableAdapterTypes(): Promise<string[]>;
  
  /**
   * Validate adapter configuration
   */
  validateConfig(config: UnifiedModelConfig): Promise<AIValidationResult>;
  
  /**
   * Create adapter from legacy configuration
   */
  createFromLegacyConfig(legacyConfig: any): Promise<UnifiedAIModelAdapter>;
  
  /**
   * Register custom adapter type
   */
  registerAdapterType(
    type: string,
    factory: (config: UnifiedModelConfig) => Promise<UnifiedAIModelAdapter>
  ): void;
}

// ========================================
// UTILITY FUNCTIONS FOR MIGRATION
// ========================================

/**
 * Convert legacy completion options to generation parameters
 */
export function convertLegacyOptions(
  options: LegacyCompletionOptions
): AIGenerationParameters {
  return {
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    topP: options.topP,
    topK: options.topK,
    stopSequences: options.stopSequences,
    presencePenalty: options.presencePenalty,
    frequencyPenalty: options.frequencyPenalty,
    seed: options.seed,
    stream: options.stream
  };
}

/**
 * Convert string prompt to AI message format
 */
export function convertPromptToMessage(
  prompt: string,
  role: 'system' | 'user' | 'assistant' = 'user'
): AIMessage {
  return {
    role,
    content: prompt,
    metadata: {
      timestamp: new Date(),
      source: 'legacy-conversion'
    }
  };
}

/**
 * Convert AI response to legacy analysis result
 */
export function convertToLegacyAnalysis(
  response: AIModelResponse,
  patterns: DetectedPattern[] = []
): LegacyAnalysisResult {
  const choice = response.choices[0];
  const content = typeof choice?.message.content === 'string' 
    ? choice.message.content 
    : '';
    
  return {
    success: !response.error,
    patterns,
    summary: content,
    insights: [], // Would need to parse from content
    recommendations: [], // Would need to parse from content
    confidence: choice?.metadata?.confidence || 0.8,
    processingTime: response.processingTime || 0,
    modelUsed: response.model,
    tokensUsed: response.usage?.totalTokens,
    error: response.error?.message
  };
}

/**
 * Type guard to check if adapter supports embeddings
 */
export function supportsEmbeddings(
  adapter: UnifiedAIModelAdapter
): adapter is UnifiedAIModelAdapter & Required<Pick<UnifiedAIModelAdapter, 'createEmbeddings'>> {
  return typeof adapter.createEmbeddings === 'function';
}

/**
 * Type guard to check if adapter supports fine-tuning
 */
export function supportsFineTuning(
  adapter: UnifiedAIModelAdapter
): adapter is UnifiedAIModelAdapter & Required<Pick<UnifiedAIModelAdapter, 'fineTune'>> {
  return typeof adapter.fineTune === 'function';
} 