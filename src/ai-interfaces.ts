/**
 * AI Model Abstraction Layer - Core Interfaces
 * Provides a unified interface for different AI backends
 */

/**
 * Supported AI model types
 */
export type AIModelType = 'local' | 'cloud';

/**
 * Privacy levels for AI models
 */
export type PrivacyLevel = 'local' | 'cloud' | 'hybrid';

/**
 * AI model capabilities
 */
export type AICapability = 
  | 'text-completion'
  | 'pattern-extraction'
  | 'summarization'
  | 'sentiment-analysis'
  | 'topic-modeling'
  | 'question-answering'
  | 'code-analysis'
  | 'translation'
  | 'classification';

/**
 * Completion options for AI models
 */
export interface CompletionOptions {
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
 * AI model configuration
 */
export interface AIModelConfig {
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
  customParameters?: Record<string, any>;
}

/**
 * Detected pattern from content analysis
 */
export interface DetectedPattern {
  id: string;
  type: 'habit' | 'goal' | 'challenge' | 'insight' | 'trend' | 'relationship' | 'other';
  title: string;
  description: string;
  confidence: number; // 0-1 scale
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

/**
 * AI analysis result
 */
export interface AIAnalysisResult {
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
 * Model health status
 */
export interface ModelHealth {
  isAvailable: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
  version?: string;
  capabilities: AICapability[];
}

/**
 * Abstract interface for AI model adapters
 */
export interface AIModelAdapter {
  readonly name: string;
  readonly description: string;
  readonly type: AIModelType;
  readonly privacyLevel: PrivacyLevel;
  readonly capabilities: AICapability[];
  readonly config: AIModelConfig;

  /**
   * Initialize the AI model adapter
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the model is available and healthy
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get detailed health status
   */
  getHealth(): Promise<ModelHealth>;

  /**
   * Generate text completion
   */
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;

  /**
   * Extract patterns from content
   */
  extractPatterns(content: string, context?: any): Promise<DetectedPattern[]>;

  /**
   * Generate summary from patterns
   */
  generateSummary(patterns: DetectedPattern[], context?: any): Promise<string>;

  /**
   * Analyze content for insights
   */
  analyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult>;

  /**
   * Classify content into categories
   */
  classifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }>;

  /**
   * Extract sentiment from content
   */
  analyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>;

  /**
   * Update model configuration
   */
  updateConfig(config: Partial<AIModelConfig>): Promise<void>;

  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}

/**
 * AI model factory interface
 */
export interface AIModelFactory {
  /**
   * Create a model adapter instance
   */
  createModel(config: AIModelConfig): Promise<AIModelAdapter>;

  /**
   * Get available model types
   */
  getAvailableModels(): Promise<string[]>;

  /**
   * Validate model configuration
   */
  validateConfig(config: AIModelConfig): Promise<{ valid: boolean; errors: string[] }>;
}

/**
 * Prompt template variable
 */
export interface PromptVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: PromptVariable[];
  category: string;
  version: string;
  author?: string;
  tags: string[];
}

/**
 * Rendered prompt result
 */
export interface RenderedPrompt {
  content: string;
  variables: Record<string, any>;
  templateId: string;
  renderedAt: Date;
}

/**
 * AI service configuration
 */
export interface AIServiceConfig {
  primaryModel: AIModelConfig;
  fallbackModel?: AIModelConfig;
  enableFallback: boolean;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableCaching: boolean;
  cacheSize: number;
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * AI service metrics
 */
export interface AIServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  cacheHitRate: number;
  modelUsage: Record<string, number>;
  lastUpdated: Date;
}

/**
 * Error types for AI operations
 */
export enum AIErrorType {
  INITIALIZATION_FAILED = 'initialization_failed',
  MODEL_UNAVAILABLE = 'model_unavailable',
  INVALID_CONFIG = 'invalid_config',
  REQUEST_FAILED = 'request_failed',
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  INVALID_RESPONSE = 'invalid_response',
  QUOTA_EXCEEDED = 'quota_exceeded',
  AUTHENTICATION_FAILED = 'authentication_failed',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * AI operation error
 */
export class AIError extends Error {
  constructor(
    public readonly type: AIErrorType,
    message: string,
    public readonly details?: any,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/**
 * Event types for AI service
 */
export enum AIEventType {
  MODEL_INITIALIZED = 'model_initialized',
  MODEL_FAILED = 'model_failed',
  REQUEST_STARTED = 'request_started',
  REQUEST_COMPLETED = 'request_completed',
  REQUEST_FAILED = 'request_failed',
  FALLBACK_TRIGGERED = 'fallback_triggered',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss'
}

/**
 * AI service event
 */
export interface AIEvent {
  type: AIEventType;
  timestamp: Date;
  modelName?: string;
  requestId?: string;
  duration?: number;
  error?: AIError;
  metadata?: Record<string, any>;
}

/**
 * AI service event listener
 */
export type AIEventListener = (event: AIEvent) => void; 