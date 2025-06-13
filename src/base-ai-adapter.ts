import { Logger } from './logger';
import {
  AIModelAdapter,
  AIModelConfig,
  AIModelType,
  PrivacyLevel,
  AICapability,
  CompletionOptions,
  DetectedPattern,
  AIAnalysisResult,
  ModelHealth,
  AIError,
  AIErrorType
} from './ai-interfaces';

/**
 * Base implementation for AI model adapters
 * Provides common functionality and error handling
 */
export abstract class BaseAIAdapter implements AIModelAdapter {
  protected initialized = false;
  protected lastHealthCheck: Date = new Date(0);
  protected healthCheckInterval: number = 5 * 60 * 1000; // 5 minutes
  protected cachedHealth?: ModelHealth;

  constructor(
    protected logger: Logger,
    protected _config: AIModelConfig
  ) {}

  // Abstract properties that must be implemented by subclasses
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly type: AIModelType;
  abstract readonly privacyLevel: PrivacyLevel;
  abstract readonly capabilities: AICapability[];

  get config(): AIModelConfig {
    return { ...this._config };
  }

  /**
   * Initialize the AI model adapter
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info(`Initializing AI adapter: ${this.name}`);
      
      // Validate configuration
      this.validateConfig();
      
      // Perform adapter-specific initialization
      const success = await this.doInitialize();
      
      if (success) {
        this.initialized = true;
        this.logger.info(`AI adapter initialized successfully: ${this.name}`);
      } else {
        this.logger.error(`Failed to initialize AI adapter: ${this.name}`);
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Error initializing AI adapter: ${this.name}`, error);
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        `Failed to initialize ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
        error,
        false
      );
    }
  }

  /**
   * Check if the model is available and healthy
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return false;
      }

      // Use cached health if recent
      const now = new Date();
      if (this.cachedHealth && (now.getTime() - this.lastHealthCheck.getTime()) < this.healthCheckInterval) {
        return this.cachedHealth.isAvailable;
      }

      // Perform health check
      const health = await this.getHealth();
      return health.isAvailable;
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.name}`, error);
      return false;
    }
  }

  /**
   * Get detailed health status
   */
  async getHealth(): Promise<ModelHealth> {
    try {
      const startTime = Date.now();
      
      // Perform adapter-specific health check
      const isHealthy = await this.doHealthCheck();
      
      const responseTime = Date.now() - startTime;
      const health: ModelHealth = {
        isAvailable: isHealthy,
        responseTime,
        lastChecked: new Date(),
        capabilities: this.capabilities,
        version: await this.getVersion().catch(() => undefined)
      };

      // Cache the result
      this.cachedHealth = health;
      this.lastHealthCheck = new Date();

      return health;
    } catch (error) {
      const health: ModelHealth = {
        isAvailable: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
        capabilities: this.capabilities
      };

      this.cachedHealth = health;
      this.lastHealthCheck = new Date();

      return health;
    }
  }

  /**
   * Generate text completion
   */
  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    this.validatePrompt(prompt);

    try {
      this.logger.debug(`Generating completion with ${this.name}`, { 
        promptLength: prompt.length,
        options 
      });

      const result = await this.doGenerateCompletion(prompt, options);
      
      this.logger.debug(`Completion generated successfully`, { 
        resultLength: result.length 
      });

      return result;
    } catch (error) {
      this.logger.error(`Completion generation failed with ${this.name}`, error);
      throw this.wrapError(error, 'generateCompletion');
    }
  }

  /**
   * Extract patterns from content
   */
  async extractPatterns(content: string, context?: any): Promise<DetectedPattern[]> {
    this.ensureInitialized();
    this.validateContent(content);

    if (!this.capabilities.includes('pattern-extraction')) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `${this.name} does not support pattern extraction`,
        undefined,
        false
      );
    }

    try {
      this.logger.debug(`Extracting patterns with ${this.name}`, { 
        contentLength: content.length 
      });

      const patterns = await this.doExtractPatterns(content, context);
      
      this.logger.debug(`Extracted ${patterns.length} patterns`);

      return patterns;
    } catch (error) {
      this.logger.error(`Pattern extraction failed with ${this.name}`, error);
      throw this.wrapError(error, 'extractPatterns');
    }
  }

  /**
   * Generate summary from patterns
   */
  async generateSummary(patterns: DetectedPattern[], context?: any): Promise<string> {
    this.ensureInitialized();

    if (!this.capabilities.includes('summarization')) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `${this.name} does not support summarization`,
        undefined,
        false
      );
    }

    try {
      this.logger.debug(`Generating summary with ${this.name}`, { 
        patternCount: patterns.length 
      });

      const summary = await this.doGenerateSummary(patterns, context);
      
      this.logger.debug(`Summary generated successfully`, { 
        summaryLength: summary.length 
      });

      return summary;
    } catch (error) {
      this.logger.error(`Summary generation failed with ${this.name}`, error);
      throw this.wrapError(error, 'generateSummary');
    }
  }

  /**
   * Analyze content for insights
   */
  async analyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
    this.ensureInitialized();
    this.validateContent(content);

    try {
      const startTime = Date.now();
      
      this.logger.debug(`Analyzing content with ${this.name}`, { 
        contentLength: content.length,
        analysisType 
      });

      const result = await this.doAnalyzeContent(content, analysisType);
      
      result.processingTime = Date.now() - startTime;
      result.modelUsed = this.name;

      this.logger.debug(`Content analysis completed`, { 
        success: result.success,
        patternCount: result.patterns.length,
        processingTime: result.processingTime
      });

      return result;
    } catch (error) {
      this.logger.error(`Content analysis failed with ${this.name}`, error);
      
      return {
        success: false,
        patterns: [],
        summary: '',
        insights: [],
        recommendations: [],
        confidence: 0,
        processingTime: Date.now() - Date.now(),
        modelUsed: this.name,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Classify content into categories
   */
  async classifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }> {
    this.ensureInitialized();
    this.validateContent(content);

    if (!this.capabilities.includes('classification')) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `${this.name} does not support classification`,
        undefined,
        false
      );
    }

    try {
      this.logger.debug(`Classifying content with ${this.name}`, { 
        contentLength: content.length,
        categoryCount: categories.length 
      });

      const result = await this.doClassifyContent(content, categories);
      
      this.logger.debug(`Content classified as: ${result.category} (${result.confidence})`);

      return result;
    } catch (error) {
      this.logger.error(`Content classification failed with ${this.name}`, error);
      throw this.wrapError(error, 'classifyContent');
    }
  }

  /**
   * Extract sentiment from content
   */
  async analyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    this.ensureInitialized();
    this.validateContent(content);

    if (!this.capabilities.includes('sentiment-analysis')) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `${this.name} does not support sentiment analysis`,
        undefined,
        false
      );
    }

    try {
      this.logger.debug(`Analyzing sentiment with ${this.name}`, { 
        contentLength: content.length 
      });

      const result = await this.doAnalyzeSentiment(content);
      
      this.logger.debug(`Sentiment analyzed as: ${result.sentiment} (${result.confidence})`);

      return result;
    } catch (error) {
      this.logger.error(`Sentiment analysis failed with ${this.name}`, error);
      throw this.wrapError(error, 'analyzeSentiment');
    }
  }

  /**
   * Update model configuration
   */
  async updateConfig(config: Partial<AIModelConfig>): Promise<void> {
    try {
      this.logger.debug(`Updating configuration for ${this.name}`, config);

      const newConfig = { ...this._config, ...config };
      this.validateConfigObject(newConfig);

      this._config = newConfig;
      
      // Clear cached health to force recheck
      this.cachedHealth = undefined;
      this.lastHealthCheck = new Date(0);

      this.logger.info(`Configuration updated for ${this.name}`);
    } catch (error) {
      this.logger.error(`Failed to update configuration for ${this.name}`, error);
      throw this.wrapError(error, 'updateConfig');
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    try {
      this.logger.info(`Disposing AI adapter: ${this.name}`);
      
      await this.doDispose();
      
      this.initialized = false;
      this.cachedHealth = undefined;
      
      this.logger.info(`AI adapter disposed: ${this.name}`);
    } catch (error) {
      this.logger.error(`Error disposing AI adapter: ${this.name}`, error);
      throw this.wrapError(error, 'dispose');
    }
  }

  // Abstract methods that must be implemented by subclasses

  /**
   * Perform adapter-specific initialization
   */
  protected abstract doInitialize(): Promise<boolean>;

  /**
   * Perform adapter-specific health check
   */
  protected abstract doHealthCheck(): Promise<boolean>;

  /**
   * Get adapter version
   */
  protected abstract getVersion(): Promise<string>;

  /**
   * Perform actual completion generation
   */
  protected abstract doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;

  /**
   * Perform actual pattern extraction
   */
  protected abstract doExtractPatterns(content: string, context?: any): Promise<DetectedPattern[]>;

  /**
   * Perform actual summary generation
   */
  protected abstract doGenerateSummary(patterns: DetectedPattern[], context?: any): Promise<string>;

  /**
   * Perform actual content analysis
   */
  protected abstract doAnalyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult>;

  /**
   * Perform actual content classification
   */
  protected abstract doClassifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }>;

  /**
   * Perform actual sentiment analysis
   */
  protected abstract doAnalyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>;

  /**
   * Perform adapter-specific cleanup
   */
  protected abstract doDispose(): Promise<void>;

  // Helper methods

  /**
   * Ensure the adapter is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        `${this.name} is not initialized`,
        undefined,
        false
      );
    }
  }

  /**
   * Validate configuration
   */
  protected validateConfig(): void {
    this.validateConfigObject(this._config);
  }

  /**
   * Validate configuration object
   */
  protected validateConfigObject(config: AIModelConfig): void {
    if (!config.name) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Model name is required');
    }
    if (!config.type) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Model type is required');
    }
  }

  /**
   * Validate prompt input
   */
  protected validatePrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Prompt cannot be empty');
    }
  }

  /**
   * Validate content input
   */
  protected validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Content cannot be empty');
    }
  }

  /**
   * Wrap errors with appropriate AI error types
   */
  protected wrapError(error: any, operation: string): AIError {
    if (error instanceof AIError) {
      return error;
    }

    // Determine error type based on error message/type
    let errorType = AIErrorType.UNKNOWN_ERROR;
    let retryable = false;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout') || message.includes('timed out')) {
        errorType = AIErrorType.TIMEOUT;
        retryable = true;
      } else if (message.includes('network') || message.includes('connection')) {
        errorType = AIErrorType.NETWORK_ERROR;
        retryable = true;
      } else if (message.includes('rate limit') || message.includes('too many requests')) {
        errorType = AIErrorType.RATE_LIMITED;
        retryable = true;
      } else if (message.includes('quota') || message.includes('limit exceeded')) {
        errorType = AIErrorType.QUOTA_EXCEEDED;
        retryable = false;
      } else if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
        errorType = AIErrorType.AUTHENTICATION_FAILED;
        retryable = false;
      } else if (message.includes('invalid') || message.includes('bad request')) {
        errorType = AIErrorType.INVALID_RESPONSE;
        retryable = false;
      } else {
        errorType = AIErrorType.REQUEST_FAILED;
        retryable = true;
      }
    }

    return new AIError(
      errorType,
      `${operation} failed in ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
      error,
      retryable
    );
  }

  /**
   * Apply default completion options
   */
  protected applyDefaultOptions(options?: CompletionOptions): CompletionOptions {
    return {
      maxTokens: this._config.maxTokens || 1000,
      temperature: this._config.temperature || 0.7,
      timeout: this._config.timeout || 30000,
      ...options
    };
  }

  /**
   * Generate a unique request ID for tracking
   */
  protected generateRequestId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
} 