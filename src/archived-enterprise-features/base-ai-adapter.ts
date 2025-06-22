import * as os from 'os';
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
  AIErrorType,
  PerformanceOptimized,
  PerformanceConfig,
  PerformanceMetrics,
  ResourceUsage
} from './ai-interfaces';
import {
  UnifiedAIModelAdapter,
  UnifiedModelConfig,
  AIModelRequest,
  AIModelResponse,
  AIBatchRequest,
  AIBatchResponse,
  AIStreamCallback,
  AIValidationResult,
  AIValidationError,
  HealthCheckResponse,
  AIMessage,
  AITokenUsage,
  AIErrorDetails,
  AIGenerationParameters,
  AIPrivacyLevel,
  AIErrorType as UnifiedAIErrorType
} from './unified-ai-interfaces';

/**
 * Base implementation for AI model adapters
 * Provides common functionality and error handling
 * Now implements both legacy AIModelAdapter and new UnifiedAIModelAdapter interfaces
 */
export abstract class BaseAIAdapter implements AIModelAdapter, UnifiedAIModelAdapter, PerformanceOptimized {
  protected initialized = false;
  protected lastHealthCheck: Date = new Date(0);
  protected healthCheckInterval: number = 5 * 60 * 1000; // 5 minutes
  protected cachedHealth?: ModelHealth;
  protected cachedUnifiedHealth?: HealthCheckResponse;
  protected performanceConfig?: PerformanceConfig;
  protected requestIdCounter = 0;

  constructor(
    protected logger: Logger,
    protected _config: AIModelConfig
  ) {}

  // Abstract properties that must be implemented by subclasses
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly type: AIModelType;
  
  // Handle privacy level type conversion - implement legacy interface requirement
  abstract readonly privacyLevel: PrivacyLevel;
  
  // Provide unified privacy level through getter
  get unifiedPrivacyLevel(): AIPrivacyLevel {
    // Convert legacy privacy level to unified privacy level
    switch (this.privacyLevel) {
      case 'local':
        return 'confidential';
      case 'cloud':
        return 'private';
      case 'hybrid':
        return 'encrypted';
      default:
        return 'private';
    }
  }

  abstract readonly capabilities: AICapability[];

  get config(): UnifiedModelConfig {
    // Convert legacy config to unified config
    return {
      // Basic configuration (from ai-interfaces.ts)
      name: this._config.name,
      type: this._config.type,
      endpoint: this._config.endpoint,
      apiKey: this._config.apiKey,
      model: this._config.model,
      maxTokens: this._config.maxTokens,
      temperature: this._config.temperature,
      timeout: this._config.timeout,
      retryAttempts: this._config.retryAttempts,
      retryDelay: this._config.retryDelay,
      customHeaders: this._config.customHeaders,
      customParameters: this._config.customParameters,
      
      // Enhanced configuration
      privacyLevel: this.unifiedPrivacyLevel,
      capabilities: this.capabilities,
      
      // Performance defaults
      enableCaching: true,
      cacheTTL: 3600,
      enableBatching: false,
      maxBatchSize: 5,
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info'
    };
  }

  /**
   * Get default performance configuration
   */
  protected getDefaultPerformanceConfig(): PerformanceConfig {
    return {
      batching: {
        enabled: true,
        maxBatchSize: 5,
        maxWaitTime: 100, // 100ms
        similarityThreshold: 0.7
      },
      memory: {
        maxMemoryUsage: 512, // 512MB
        enableGarbageCollection: true,
        memoryPoolSize: 128, // 128MB
        contextWindowOptimization: true
      },
      caching: {
        enabled: true,
        maxCacheSize: 256, // 256MB
        ttl: 3600, // 1 hour
        enablePartialMatching: true,
        compressionEnabled: false
      },
      hardware: {
        autoDetectResources: true,
        memoryLock: true,
        memoryMap: true
      },
      enableMetrics: true,
      enableProfiling: false
    };
  }

  /**
   * Configure performance optimizations
   */
  async configurePerformance(config: PerformanceConfig): Promise<void> {
    this.performanceConfig = { ...this.getDefaultPerformanceConfig(), ...config };
    this.logger.info(`Performance configuration updated for ${this.name}`);
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Default implementation - subclasses should override for specific metrics
    return {
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

  /**
   * Get resource usage statistics
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    return {
      memory: {
        used: process.memoryUsage().heapUsed / (1024 * 1024), // MB
        available: (os.totalmem() - process.memoryUsage().heapUsed) / (1024 * 1024), // MB
        peak: process.memoryUsage().heapTotal / (1024 * 1024) // MB
      },
      cpu: {
        usage: 0, // Would need process monitoring to calculate
        cores: os.cpus().length,
        threads: this.performanceConfig?.hardware.maxThreads || os.cpus().length
      }
    };
  }

  /**
   * Clear performance caches
   */
  async clearCaches(): Promise<void> {
    // Clear health check cache
    this.cachedHealth = undefined;
    this.cachedUnifiedHealth = undefined;
    this.lastHealthCheck = new Date(0);
    this.logger.info(`Caches cleared for ${this.name}`);
  }

  /**
   * Optimize for current hardware
   */
  async optimizeForHardware(): Promise<void> {
    if (!this.performanceConfig) {
      this.performanceConfig = this.getDefaultPerformanceConfig();
    }

    if (this.performanceConfig.hardware.autoDetectResources) {
      const cpus = os.cpus().length;
      const totalMemory = os.totalmem() / (1024 * 1024 * 1024); // GB

      // Adjust configuration based on hardware
      this.performanceConfig.hardware.maxThreads = Math.max(1, Math.floor(cpus * 0.8));
      this.performanceConfig.memory.maxMemoryUsage = Math.floor(totalMemory * 0.3 * 1024); // 30% of RAM in MB
      this.performanceConfig.batching.maxBatchSize = Math.min(10, Math.max(2, Math.floor(cpus / 2)));

      this.logger.info(`${this.name} optimized for hardware: ${cpus} CPUs, ${totalMemory.toFixed(1)}GB RAM`);
    }
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
        
        // Configure performance optimizations
        await this.optimizeForHardware();
      } else {
        this.logger.error(`Failed to initialize AI adapter: ${this.name}`);
      }
      
      return success;
    } catch (error) {
      this.logger.error(`Error initializing AI adapter ${this.name}:`, error);
      throw this.wrapError(error, 'initialize');
    }
  }

  /**
   * Check if the adapter is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return false;
      }
      
      // Check if we need to refresh health status
      const now = new Date();
      if (now.getTime() - this.lastHealthCheck.getTime() > this.healthCheckInterval) {
        this.cachedHealth = undefined;
        this.cachedUnifiedHealth = undefined;
      }
      
      return await this.doHealthCheck();
    } catch (error) {
      this.logger.warn(`Health check failed for ${this.name}:`, error);
      return false;
    }
  }

  /**
   * Get health status (legacy interface)
   */
  async getHealth(): Promise<ModelHealth> {
    try {
      // Use cached health if available and fresh
      const now = new Date();
      if (this.cachedHealth && (now.getTime() - this.lastHealthCheck.getTime()) < this.healthCheckInterval) {
        return this.cachedHealth;
      }

      const isAvailable = await this.doHealthCheck();
      const version = await this.getVersion();
      
      this.cachedHealth = {
        isAvailable,
        responseTime: undefined, // Could be measured in doHealthCheck
        lastChecked: now,
        error: undefined,
        version,
        capabilities: this.capabilities
      };
      
      this.lastHealthCheck = now;
      return this.cachedHealth;
    } catch (error) {
      const errorHealth: ModelHealth = {
        isAvailable: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
        capabilities: this.capabilities
      };
      
      this.cachedHealth = errorHealth;
      return errorHealth;
    }
  }

  /**
   * Generate text completion (legacy method)
   */
  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    this.validatePrompt(prompt);
    
    try {
      const appliedOptions = this.applyDefaultOptions(options);
      const result = await this.doGenerateCompletion(prompt, appliedOptions);
      
      this.logger.debug(`Generated completion for prompt: ${prompt.substring(0, 50)}...`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate completion for ${this.name}:`, error);
      throw this.wrapError(error, 'generateCompletion');
    }
  }

  /**
   * Extract patterns from content (legacy method)
   */
  async extractPatterns(content: string, context?: unknown): Promise<DetectedPattern[]> {
    this.ensureInitialized();
    this.validateContent(content);
    
    try {
      const patterns = await this.doExtractPatterns(content, context);
      
      this.logger.debug(`Extracted ${patterns.length} patterns from content`);
      return patterns;
    } catch (error) {
      this.logger.error(`Failed to extract patterns for ${this.name}:`, error);
      throw this.wrapError(error, 'extractPatterns');
    }
  }

  /**
   * Generate summary from patterns (legacy method)
   */
  async generateSummary(patterns: DetectedPattern[], context?: unknown): Promise<string> {
    this.ensureInitialized();
    
    if (!patterns || patterns.length === 0) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'No patterns provided for summary generation');
    }
    
    try {
      const summary = await this.doGenerateSummary(patterns, context);
      
      this.logger.debug(`Generated summary from ${patterns.length} patterns`);
      return summary;
    } catch (error) {
      this.logger.error(`Failed to generate summary for ${this.name}:`, error);
      throw this.wrapError(error, 'generateSummary');
    }
  }

  /**
   * Analyze content for insights (legacy method)
   */
  async analyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
    this.ensureInitialized();
    this.validateContent(content);
    
    try {
      const result = await this.doAnalyzeContent(content, analysisType);
      
      this.logger.debug(`Analyzed content with type: ${analysisType || 'general'}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze content for ${this.name}:`, error);
      throw this.wrapError(error, 'analyzeContent');
    }
  }

  /**
   * Classify content into categories (legacy method)
   */
  async classifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }> {
    this.ensureInitialized();
    this.validateContent(content);
    
    if (!categories || categories.length === 0) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'No categories provided for classification');
    }
    
    try {
      const result = await this.doClassifyContent(content, categories);
      
      this.logger.debug(`Classified content into category: ${result.category}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to classify content for ${this.name}:`, error);
      throw this.wrapError(error, 'classifyContent');
    }
  }

  /**
   * Analyze sentiment from content (legacy method)
   */
  async analyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    this.ensureInitialized();
    this.validateContent(content);
    
    try {
      const result = await this.doAnalyzeSentiment(content);
      
      this.logger.debug(`Analyzed sentiment: ${result.sentiment} (${result.confidence})`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze sentiment for ${this.name}:`, error);
      throw this.wrapError(error, 'analyzeSentiment');
    }
  }

  /**
   * Update model configuration (legacy method)
   */
  async updateConfig(config: Partial<AIModelConfig>): Promise<void>;
  /**
   * Update adapter configuration (unified method)
   */
  async updateConfig(config: Partial<UnifiedModelConfig>): Promise<void>;
  async updateConfig(config: Partial<AIModelConfig> | Partial<UnifiedModelConfig>): Promise<void> {
    try {
      // Check if this is a unified config by looking for unified-specific properties
      const isUnifiedConfig = 'privacyLevel' in config && typeof config.privacyLevel === 'string' && 
                              ['public', 'private', 'confidential', 'encrypted'].includes(config.privacyLevel);
      
      if (isUnifiedConfig) {
        // Convert unified config back to legacy config for compatibility
        const unifiedConfig = config as Partial<UnifiedModelConfig>;
        const legacyConfig: Partial<AIModelConfig> = {
          name: unifiedConfig.name,
          type: unifiedConfig.type,
          endpoint: unifiedConfig.endpoint,
          apiKey: unifiedConfig.apiKey,
          model: unifiedConfig.model,
          maxTokens: unifiedConfig.maxTokens,
          temperature: unifiedConfig.temperature,
          timeout: unifiedConfig.timeout,
          retryAttempts: unifiedConfig.retryAttempts,
          retryDelay: unifiedConfig.retryDelay,
          customHeaders: unifiedConfig.customHeaders,
          customParameters: unifiedConfig.customParameters
        };
        
        // Update legacy config
        this._config = { ...this._config, ...legacyConfig };
        this.logger.info(`Unified configuration updated for ${this.name}`);
      } else {
        // Handle as legacy config
        const legacyConfig = config as Partial<AIModelConfig>;
        this._config = { ...this._config, ...legacyConfig };
        this.logger.info(`Configuration updated for ${this.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update configuration for ${this.name}:`, error);
      throw this.wrapError(error, 'updateConfig');
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    try {
      await this.doDispose();
      this.initialized = false;
      this.cachedHealth = undefined;
      this.cachedUnifiedHealth = undefined;
      this.logger.info(`AI adapter disposed: ${this.name}`);
    } catch (error) {
      this.logger.error(`Error disposing AI adapter ${this.name}:`, error);
      throw this.wrapError(error, 'dispose');
    }
  }

  // ========================================
  // ABSTRACT METHODS FOR SUBCLASSES
  // ========================================

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
   * Perform actual text completion
   * @param prompt The text prompt
   * @param options Completion options
   */
  protected abstract doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string>;

  /**
   * Perform actual pattern extraction
   * @param content Content to analyze
   * @param context Optional context
   */
  protected abstract doExtractPatterns(content: string, context?: unknown): Promise<DetectedPattern[]>;

  /**
   * Perform actual summary generation
   * @param patterns Detected patterns
   * @param context Optional context
   */
  protected abstract doGenerateSummary(patterns: DetectedPattern[], context?: unknown): Promise<string>;

  /**
   * Perform actual content analysis
   * @param content Content to analyze
   * @param analysisType Type of analysis
   */
  protected abstract doAnalyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult>;

  /**
   * Perform actual content classification
   * @param content Content to classify
   * @param categories Available categories
   */
  protected abstract doClassifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }>;

  /**
   * Perform actual sentiment analysis
   * @param content Content to analyze
   */
  protected abstract doAnalyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>;

  /**
   * Perform adapter-specific cleanup
   */
  protected abstract doDispose(): Promise<void>;

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Ensure the adapter is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        `Adapter ${this.name} is not initialized. Call initialize() first.`
      );
    }
  }

  /**
   * Validate adapter configuration
   */
  protected validateConfig(): void {
    if (!this._config) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Adapter configuration is missing');
    }
    
    this.validateConfigObject(this._config);
  }

  /**
   * Validate configuration object
   */
  protected validateConfigObject(config: AIModelConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Adapter name is required and must be a string');
    }
    
    if (!config.type || !['local', 'cloud'].includes(config.type)) {
      throw new AIError(AIErrorType.INVALID_CONFIG, 'Adapter type must be "local" or "cloud"');
    }
  }

  /**
   * Validate prompt input
   */
  protected validatePrompt(prompt: string): void {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new AIError(AIErrorType.REQUEST_FAILED, 'Prompt must be a non-empty string');
    }
  }

  /**
   * Validate content input
   */
  protected validateContent(content: string): void {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new AIError(AIErrorType.REQUEST_FAILED, 'Content must be a non-empty string');
    }
  }

  /**
   * Wrap errors with consistent error handling
   */
  protected wrapError(error: unknown, operation: string): AIError {
    if (error instanceof AIError) {
      return error;
    }
    
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
      } else if (message.includes('rate limit') || message.includes('throttle')) {
        errorType = AIErrorType.RATE_LIMITED;
        retryable = true;
      } else if (message.includes('quota') || message.includes('limit exceeded')) {
        errorType = AIErrorType.QUOTA_EXCEEDED;
        retryable = false;
      } else if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
        errorType = AIErrorType.AUTHENTICATION_FAILED;
        retryable = false;
      } else if (message.includes('invalid') || message.includes('bad request')) {
        errorType = AIErrorType.REQUEST_FAILED;
        retryable = false;
      }
    }
    
    return new AIError(
      errorType,
      `${operation} failed for ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
      error,
      retryable
    );
  }

  /**
   * Apply default options to completion options
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
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `${this.name}-${Date.now()}-${++this.requestIdCounter}`;
  }

  // ========================================
  // UNIFIED AI MODEL ADAPTER METHODS
  // ========================================

  /**
   * Process a single AI request (primary unified method)
   */
  async processRequest(request: AIModelRequest): Promise<AIModelResponse> {
    this.ensureInitialized();
    
    try {
      // Validate request
      const validation = await this.validateRequest(request);
      if (!validation.valid) {
        throw new Error(`Request validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Extract prompt from messages
      const prompt = this.extractPromptFromMessages(request.messages);
      
      // Convert generation parameters to legacy options
      const legacyOptions = this.convertGenerationParameters(request.parameters);
      
      // Call legacy completion method
      const content = await this.doGenerateCompletion(prompt, legacyOptions);
      
      // Estimate token usage
      const usage = await this.estimateTokenUsage(prompt, content);
      
      // Create response
      const response: AIModelResponse = {
        id: this.generateResponseId(),
        requestId: request.id,
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content
          },
          finishReason: 'stop'
        }],
        usage,
        createdAt: new Date(),
        processingTime: 0 // Could be measured
      };
      
      return response;
    } catch (error) {
      return this.createErrorResponse(request, error);
    }
  }

  /**
   * Process multiple requests in batch
   */
  async processBatch(batchRequest: AIBatchRequest): Promise<AIBatchResponse> {
    this.ensureInitialized();
    
    const responses: AIModelResponse[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;
    const startTime = Date.now();
    
    // Process each request individually (could be optimized for true batching)
    for (const request of batchRequest.requests) {
      try {
        const response = await this.processRequest(request);
        responses.push(response);
        
        if (!response.error) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
      } catch (error) {
        const errorResponse = this.createErrorResponse(request, error);
        responses.push(errorResponse);
        failedRequests++;
      }
    }
    
    const totalProcessingTime = Date.now() - startTime;
    
    return {
      id: this.generateResponseId(),
      batchRequestId: batchRequest.id,
      responses,
      statistics: {
        totalRequests: batchRequest.requests.length,
        successfulRequests,
        failedRequests,
        averageProcessingTime: totalProcessingTime / batchRequest.requests.length,
        totalTokensUsed: responses.reduce((sum, r) => sum + (r.usage?.totalTokens || 0), 0),
        throughput: batchRequest.requests.length / (totalProcessingTime / 1000)
      },
      createdAt: new Date(),
      totalProcessingTime
    };
  }

  /**
   * Process request with streaming response
   */
  async processStream(request: AIModelRequest, callback: AIStreamCallback): Promise<void> {
    this.ensureInitialized();
    
    try {
      // For now, simulate streaming by processing normally and sending in chunks
      const response = await this.processRequest(request);
      
      if (response.error) {
        callback({
          type: 'error',
          timestamp: new Date(),
          error: response.error
        });
        return;
      }
      
      const content = response.choices[0]?.message.content || '';
      const words = typeof content === 'string' ? content.split(' ') : [];
      
      callback({
        type: 'start',
        timestamp: new Date()
      });
      
      // Send content in chunks
      for (let i = 0; i < words.length; i += 5) {
        const chunk = words.slice(i, i + 5).join(' ');
        
        callback({
          type: 'chunk',
          timestamp: new Date(),
          chunk: {
            id: `${response.id}-chunk-${i}`,
            requestId: request.id,
            index: Math.floor(i / 5),
            delta: {
              content: chunk + (i + 5 < words.length ? ' ' : '')
            },
            done: i + 5 >= words.length
          }
        });
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      callback({
        type: 'complete',
        timestamp: new Date()
      });
    } catch (error) {
      callback({
        type: 'error',
        timestamp: new Date(),
        error: this.convertToErrorDetails(error)
      });
    }
  }

  /**
   * Get supported capabilities dynamically
   */
  async getCapabilities(): Promise<AICapability[]> {
    return [...this.capabilities];
  }

  /**
   * Validate a request before processing
   */
  async validateRequest(request: AIModelRequest): Promise<AIValidationResult> {
    const errors: AIValidationError[] = [];
    const warnings: any[] = [];
    
    // Validate request ID
    if (!request.id || typeof request.id !== 'string') {
      errors.push({
        code: 'MISSING_REQUEST_ID',
        message: 'Request ID is required and must be a string',
        path: 'id'
      });
    }
    
    // Validate model
    if (!request.model || typeof request.model !== 'string') {
      errors.push({
        code: 'MISSING_MODEL',
        message: 'Model is required and must be a string',
        path: 'model'
      });
    }
    
    // Validate messages
    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      errors.push({
        code: 'MISSING_MESSAGES',
        message: 'Messages array is required and must not be empty',
        path: 'messages'
      });
    } else {
      // Validate each message
      request.messages.forEach((message, index) => {
        if (!message.role || typeof message.role !== 'string') {
          errors.push({
            code: 'INVALID_MESSAGE_ROLE',
            message: 'Message role is required and must be a string',
            path: `messages[${index}].role`
          });
        }
        
        if (!message.content) {
          errors.push({
            code: 'MISSING_MESSAGE_CONTENT',
            message: 'Message content is required',
            path: `messages[${index}].content`
          });
        }
      });
    }
    
    // Validate parameters
    if (request.parameters) {
      if (request.parameters.maxTokens && (typeof request.parameters.maxTokens !== 'number' || request.parameters.maxTokens <= 0)) {
        errors.push({
          code: 'INVALID_MAX_TOKENS',
          message: 'maxTokens must be a positive number',
          path: 'parameters.maxTokens'
        });
      }
      
      if (request.parameters.temperature && (typeof request.parameters.temperature !== 'number' || request.parameters.temperature < 0 || request.parameters.temperature > 2)) {
        errors.push({
          code: 'INVALID_TEMPERATURE',
          message: 'temperature must be a number between 0 and 2',
          path: 'parameters.temperature'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '1.0.0',
        validationTime: 0
      }
    };
  }

  /**
   * Estimate cost for a request
   */
  async estimateCost(request: AIModelRequest): Promise<{
    estimatedCost: number;
    currency: string;
    breakdown: {
      inputTokens: number;
      outputTokens: number;
      inputCost: number;
      outputCost: number;
    };
  }> {
    // Basic estimation - subclasses should override for accurate pricing
    const prompt = this.extractPromptFromMessages(request.messages);
    const estimatedInputTokens = Math.ceil(prompt.length / 4); // Rough estimate
    const estimatedOutputTokens = request.parameters?.maxTokens || 100;
    
    // Default pricing (should be overridden by specific adapters)
    const inputCostPerToken = 0.00001; // $0.01 per 1K tokens
    const outputCostPerToken = 0.00002; // $0.02 per 1K tokens
    
    const inputCost = estimatedInputTokens * inputCostPerToken;
    const outputCost = estimatedOutputTokens * outputCostPerToken;
    
    return {
      estimatedCost: inputCost + outputCost,
      currency: 'USD',
      breakdown: {
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        inputCost,
        outputCost
      }
    };
  }

  /**
   * Get model metadata and information
   */
  async getModelInfo(): Promise<{
    modelId: string;
    version: string;
    contextWindow: number;
    maxOutputTokens: number;
    supportedFormats: string[];
    trainingCutoff?: Date;
  }> {
    const version = await this.getVersion();
    
    return {
      modelId: this._config.model || this.name,
      version,
      contextWindow: 4096, // Default, should be overridden
      maxOutputTokens: this._config.maxTokens || 1000,
      supportedFormats: ['text'],
      trainingCutoff: undefined
    };
  }

  /**
   * Get detailed health status (unified method)
   */
  async getHealthStatus(): Promise<HealthCheckResponse> {
    try {
      // Use cached unified health if available and fresh
      const now = new Date();
      if (this.cachedUnifiedHealth && (now.getTime() - this.lastHealthCheck.getTime()) < this.healthCheckInterval) {
        return this.cachedUnifiedHealth;
      }

      const isAvailable = await this.doHealthCheck();
      const version = await this.getVersion();
      const resourceUsage = await this.getResourceUsage();
      
      this.cachedUnifiedHealth = {
        status: isAvailable ? 'healthy' : 'unhealthy',
        timestamp: now,
        responseTime: 0, // Could be measured
        version,
        details: {
          models: [{
            name: this.name,
            status: isAvailable ? 'available' : 'unavailable'
          }],
          resources: {
            memory: resourceUsage.memory,
            cpu: resourceUsage.cpu
          }
        }
      };
      
      this.lastHealthCheck = now;
      return this.cachedUnifiedHealth;
    } catch (error) {
      const errorHealth: HealthCheckResponse = {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: 0,
        details: {
          models: [{
            name: this.name,
            status: 'unavailable',
            error: error instanceof Error ? error.message : String(error)
          }]
        }
      };
      
      this.cachedUnifiedHealth = errorHealth;
      return errorHealth;
    }
  }

  // ========================================
  // HELPER METHODS FOR UNIFIED INTERFACE
  // ========================================

  /**
   * Extract prompt from messages array
   */
  protected extractPromptFromMessages(messages: AIMessage[]): string {
    if (!messages || messages.length === 0) {
      return '';
    }
    
    // Simple extraction - combine all message content
    return messages
      .map(msg => {
        if (typeof msg.content === 'string') {
          return `${msg.role}: ${msg.content}`;
        } else if (Array.isArray(msg.content)) {
          // Handle structured content
          return `${msg.role}: ${msg.content.map(c => c.text || '').join(' ')}`;
        }
        return '';
      })
      .join('\n');
  }

  /**
   * Convert unified generation parameters to legacy completion options
   */
  protected convertGenerationParameters(params?: AIGenerationParameters): CompletionOptions | undefined {
    if (!params) return undefined;
    
    return {
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      topP: params.topP,
      topK: params.topK,
      stopSequences: params.stopSequences,
      presencePenalty: params.presencePenalty,
      frequencyPenalty: params.frequencyPenalty,
      seed: params.seed,
      stream: params.stream
    };
  }

  /**
   * Estimate token usage for request/response
   */
  protected async estimateTokenUsage(prompt: string, completion: string): Promise<AITokenUsage> {
    // Simple estimation - 1 token ≈ 4 characters
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(completion.length / 4);
    
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    };
  }

  /**
   * Generate unique response ID
   */
  protected generateResponseId(): string {
    return `resp-${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create error response for failed requests
   */
  protected createErrorResponse(request: AIModelRequest, error: unknown): AIModelResponse {
    return {
      id: this.generateResponseId(),
      requestId: request.id,
      model: request.model,
      choices: [],
      error: this.convertToErrorDetails(error),
      createdAt: new Date(),
      processingTime: 0
    };
  }

  /**
   * Convert error to unified error details
   */
  protected convertToErrorDetails(error: unknown): AIErrorDetails {
    if (error instanceof AIError) {
      return {
        code: error.type,
        message: error.message,
        type: this.convertLegacyErrorType(error.type),
        severity: 'medium',
        retryable: error.retryable,
        context: {
          timestamp: new Date(),
          provider: this.name
        }
      };
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
      type: UnifiedAIErrorType.UNKNOWN_ERROR,
      severity: 'medium',
      retryable: false,
      context: {
        timestamp: new Date(),
        provider: this.name
      }
    };
  }

  /**
   * Convert legacy error type to unified error type
   */
  protected convertLegacyErrorType(legacyType: AIErrorType): UnifiedAIErrorType {
    switch (legacyType) {
      case AIErrorType.INITIALIZATION_FAILED:
        return UnifiedAIErrorType.INITIALIZATION_FAILED;
      case AIErrorType.MODEL_UNAVAILABLE:
        return UnifiedAIErrorType.MODEL_UNAVAILABLE;
      case AIErrorType.INVALID_CONFIG:
        return UnifiedAIErrorType.INVALID_CONFIG;
      case AIErrorType.REQUEST_FAILED:
        return UnifiedAIErrorType.REQUEST_FAILED;
      case AIErrorType.TIMEOUT:
        return UnifiedAIErrorType.TIMEOUT;
      case AIErrorType.RATE_LIMITED:
        return UnifiedAIErrorType.RATE_LIMITED;
      case AIErrorType.INVALID_RESPONSE:
        return UnifiedAIErrorType.RESPONSE_INVALID;
      case AIErrorType.QUOTA_EXCEEDED:
        return UnifiedAIErrorType.QUOTA_EXCEEDED;
      case AIErrorType.AUTHENTICATION_FAILED:
        return UnifiedAIErrorType.AUTHENTICATION_FAILED;
      case AIErrorType.NETWORK_ERROR:
        return UnifiedAIErrorType.NETWORK_ERROR;
      case AIErrorType.UNKNOWN_ERROR:
      default:
        return UnifiedAIErrorType.UNKNOWN_ERROR;
    }
  }
} 