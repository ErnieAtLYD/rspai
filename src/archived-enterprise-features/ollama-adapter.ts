import { Logger } from './logger';
import { BaseAIAdapter } from './base-ai-adapter';
import { PerformanceOptimizer } from './performance-optimizer';
import {
  AIModelType,
  PrivacyLevel,
  AICapability,
  CompletionOptions,
  DetectedPattern,
  AIAnalysisResult,
  AIModelConfig,
  AIError,
  AIErrorType,
  PerformanceConfig,
  PerformanceMetrics,
  ResourceUsage,
  RequestBatch
} from './ai-interfaces';
// Add only the unified interface imports that are actually used
import {
  HealthCheckResponse
} from './unified-ai-interfaces';

/**
 * Ollama API interfaces
 */
interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    // Local processing optimizations
    num_ctx?: number;          // Context window size
    num_batch?: number;        // Batch size for parallel processing
    num_gqa?: number;          // Group query attention
    num_gpu?: number;          // GPU layers
    main_gpu?: number;         // Main GPU ID
    low_vram?: boolean;        // Low VRAM mode
    f16_kv?: boolean;          // Use FP16 for KV cache
    logits_all?: boolean;      // Return logits for all tokens
    vocab_only?: boolean;      // Only load vocabulary
    use_mmap?: boolean;        // Use memory mapping
    use_mlock?: boolean;       // Use memory locking
    embedding_only?: boolean;  // Only compute embeddings
    numa?: boolean;            // NUMA support
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaListResponse {
  models: OllamaModelInfo[];
}

interface OllamaErrorResponse {
  error: string;
}

/**
 * Extended Ollama API interfaces for model management
 */
interface OllamaPullRequest {
  name: string;
  stream?: boolean;
}

interface OllamaPullResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

interface OllamaDeleteRequest {
  name: string;
}

interface OllamaShowRequest {
  name: string;
}

interface OllamaShowResponse {
  license: string;
  modelfile: string;
  parameters: string;
  template: string;
  details: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaModelStatus {
  name: string;
  isAvailable: boolean;
  isLoaded: boolean;
  size: number;
  lastModified: string;
  details?: OllamaModelInfo['details'];
}

/**
 * Local processing optimization configuration
 */
interface LocalProcessingConfig {
  // Memory optimizations
  enableMemoryMapping: boolean;
  enableMemoryLocking: boolean;
  lowVRAMMode: boolean;
  contextWindowSize?: number;
  
  // GPU optimizations
  useGPU: boolean;
  gpuLayers?: number;
  mainGPU?: number;
  
  // Performance optimizations
  batchSize?: number;
  numThreads?: number;
  enableNUMA: boolean;
  
  // Model loading optimizations
  preloadModels: string[];
  keepModelLoaded: boolean;
  modelSwapThreshold: number; // MB
}

/**
 * Resource monitoring interface
 */
interface ResourceMonitor {
  memoryUsage: number;     // MB
  cpuUsage: number;        // Percentage
  gpuUsage?: number;       // Percentage
  diskUsage: number;       // MB
  temperature?: number;    // Celsius
  powerUsage?: number;     // Watts
}

/**
 * Ollama model configurations with enhanced local processing capabilities
 */
const OLLAMA_MODEL_CAPABILITIES: Record<string, AICapability[]> = {
  'llama2': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'llama2:13b': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'llama2:70b': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'codellama': ['text-completion', 'code-analysis', 'pattern-extraction'],
  'mistral': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'neural-chat': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'starling-lm': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  // Enhanced models for local processing - removed 'streaming' as it's not a valid AICapability
  'llama2:7b-q4_0': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'llama2:7b-q8_0': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'mistral:7b-instruct': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'phi': ['text-completion', 'pattern-extraction', 'classification'],
  'orca-mini': ['text-completion', 'pattern-extraction', 'summarization', 'question-answering'],
  'vicuna': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering']
};

/**
 * Enhanced Ollama adapter for local AI models with unified interface support
 * Optimized for local processing, resource management, and model loading
 */
export class OllamaAdapter extends BaseAIAdapter {
  readonly name = 'Ollama Adapter';
  readonly description = 'Ollama local AI models for privacy-focused processing with unified interface support';
  readonly type: AIModelType = 'local';
  readonly privacyLevel: PrivacyLevel = 'local';
  readonly capabilities: AICapability[];

  private baseURL: string;
  private model: string;
  private availableModels: string[] = [];
  private requestTimeout: number;
  private modelCache: Map<string, OllamaModelStatus> = new Map();
  private lastModelListUpdate = 0;
  private readonly MODEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private performanceOptimizer?: PerformanceOptimizer;
  
  // Enhanced local processing features
  private localProcessingConfig: LocalProcessingConfig;
  private resourceMonitor: ResourceMonitor;
  private loadedModels: Set<string> = new Set();
  private modelLoadingQueue: Map<string, Promise<void>> = new Map();
  private responseCache: Map<string, { response: string; timestamp: number }> = new Map();
  private readonly RESPONSE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private streamingConnections: Map<string, AbortController> = new Map();

  constructor(logger: Logger, config: AIModelConfig) {
    super(logger, config);
    
    this.baseURL = config.endpoint || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.requestTimeout = config.timeout || 60000; // 60 seconds default
    
    // Set capabilities based on model
    this.capabilities = this.getModelCapabilities(this.model);
    
    // Initialize local processing configuration
    this.localProcessingConfig = this.initializeLocalProcessingConfig(config);
    
    // Initialize resource monitor
    this.resourceMonitor = {
      memoryUsage: 0,
      cpuUsage: 0,
      diskUsage: 0
    };
  }

  /**
   * Initialize local processing configuration with hardware detection
   */
  private initializeLocalProcessingConfig(config: AIModelConfig): LocalProcessingConfig {
    const customParams = config.customParameters || {};
    
    return {
      // Memory optimizations (default to enabled for local processing)
      enableMemoryMapping: customParams.enableMemoryMapping !== false,
      enableMemoryLocking: customParams.enableMemoryLocking !== false,
      lowVRAMMode: customParams.lowVRAMMode === true,
      contextWindowSize: typeof customParams.contextWindowSize === 'number' ? customParams.contextWindowSize : 2048,
      
      // GPU optimizations (auto-detect if not specified)
      useGPU: customParams.useGPU !== false,
      gpuLayers: typeof customParams.gpuLayers === 'number' ? customParams.gpuLayers : undefined,
      mainGPU: typeof customParams.mainGPU === 'number' ? customParams.mainGPU : 0,
      
      // Performance optimizations
      batchSize: typeof customParams.batchSize === 'number' ? customParams.batchSize : 512,
      numThreads: typeof customParams.numThreads === 'number' ? customParams.numThreads : undefined,
      enableNUMA: customParams.enableNUMA !== false,
      
      // Model loading optimizations
      preloadModels: Array.isArray(customParams.preloadModels) ? customParams.preloadModels : [],
      keepModelLoaded: customParams.keepModelLoaded !== false,
      modelSwapThreshold: typeof customParams.modelSwapThreshold === 'number' ? customParams.modelSwapThreshold : 1024 // 1GB
    };
  }

  protected async doInitialize(): Promise<boolean> {
    try {
      this.logger.info(`Initializing Ollama adapter with enhanced local processing for model: ${this.model}`);
      
      // Check if Ollama is running and get available models
      await this.loadAvailableModels();
      
      // Verify the specified model is available
      if (!this.availableModels.includes(this.model)) {
        this.logger.warn(`Model ${this.model} not found locally. Available models: ${this.availableModels.join(', ')}`);
        
        // Try to pull the model if it's not available
        await this.pullModel(this.model);
      }
      
      // Initialize resource monitoring
      await this.initializeResourceMonitoring();
      
      // Pre-load models if configured
      await this.preloadConfiguredModels();
      
      // Test the model with a simple request
      await this.testModel();
      
      // Initialize performance optimizer with local processing settings
      await this.initializePerformanceOptimizer();
      
      // Optimize for local hardware
      await this.optimizeForLocalHardware();
      
      this.logger.info(`Ollama adapter initialized successfully with model: ${this.model}`);
      this.logger.info(`Local processing optimizations: ${JSON.stringify(this.localProcessingConfig, null, 2)}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Ollama adapter', error);
      throw error;
    }
  }

  /**
   * Initialize resource monitoring for local processing optimization
   */
  private async initializeResourceMonitoring(): Promise<void> {
    try {
      // Get initial resource usage
      const resourceUsage = await this.getResourceUsage();
      this.resourceMonitor = {
        memoryUsage: resourceUsage.memory.used,
        cpuUsage: resourceUsage.cpu.usage,
        diskUsage: 0 // Will be updated by monitoring
      };
      
      // Start periodic resource monitoring
      this.startResourceMonitoring();
      
      this.logger.info('Resource monitoring initialized for local processing optimization');
    } catch (error) {
      this.logger.warn('Failed to initialize resource monitoring', error);
    }
  }

  /**
   * Start periodic resource monitoring
   */
  private startResourceMonitoring(): void {
    setInterval(async () => {
      try {
        const resourceUsage = await this.getResourceUsage();
        this.resourceMonitor.memoryUsage = resourceUsage.memory.used;
        this.resourceMonitor.cpuUsage = resourceUsage.cpu.usage;
        
        // Adjust processing based on resource usage
        await this.adjustProcessingBasedOnResources();
      } catch (error) {
        this.logger.debug('Resource monitoring update failed', error);
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Adjust processing parameters based on current resource usage
   */
  private async adjustProcessingBasedOnResources(): Promise<void> {
    const { memoryUsage, cpuUsage } = this.resourceMonitor;
    
    // Adjust based on memory usage
    if (memoryUsage > 80) { // Over 80% memory usage
      if (!this.localProcessingConfig.lowVRAMMode) {
        this.logger.info('High memory usage detected, enabling low VRAM mode');
        this.localProcessingConfig.lowVRAMMode = true;
      }
    } else if (memoryUsage < 60 && this.localProcessingConfig.lowVRAMMode) {
      this.logger.info('Memory usage normalized, disabling low VRAM mode');
      this.localProcessingConfig.lowVRAMMode = false;
    }
    
    // Adjust batch size based on CPU usage
    if (cpuUsage > 90) { // Over 90% CPU usage
      this.localProcessingConfig.batchSize = Math.max(256, (this.localProcessingConfig.batchSize || 512) / 2);
    } else if (cpuUsage < 50) { // Under 50% CPU usage
      this.localProcessingConfig.batchSize = Math.min(1024, (this.localProcessingConfig.batchSize || 512) * 1.5);
    }
  }

  /**
   * Pre-load configured models for faster access
   */
  private async preloadConfiguredModels(): Promise<void> {
    const modelsToPreload = this.localProcessingConfig.preloadModels;
    
    if (modelsToPreload.length === 0) {
      return;
    }
    
    this.logger.info(`Pre-loading ${modelsToPreload.length} models for faster access`);
    
    for (const modelName of modelsToPreload) {
      try {
        await this.preloadModel(modelName);
        this.loadedModels.add(modelName);
        this.logger.debug(`Pre-loaded model: ${modelName}`);
      } catch (error) {
        this.logger.warn(`Failed to pre-load model ${modelName}`, error);
      }
    }
  }

  /**
   * Pre-load a specific model
   */
  private async preloadModel(modelName: string): Promise<void> {
    // Check if model is already being loaded
    const existingLoad = this.modelLoadingQueue.get(modelName);
    if (existingLoad) {
      await existingLoad;
      return;
    }
    
    // Start loading the model
    const loadPromise = this.loadModelIntoMemory(modelName);
    this.modelLoadingQueue.set(modelName, loadPromise);
    
    try {
      await loadPromise;
    } finally {
      this.modelLoadingQueue.delete(modelName);
    }
  }

  /**
   * Load model into memory for faster access
   */
  private async loadModelIntoMemory(modelName: string): Promise<void> {
    try {
      // Make a small test request to load the model
      const request: OllamaGenerateRequest = {
        model: modelName,
        prompt: 'test',
        options: {
          num_predict: 1,
          temperature: 0.1
        }
      };
      
      await this.makeRequest<OllamaGenerateResponse>('/api/generate', 'POST', request);
      this.logger.debug(`Model ${modelName} loaded into memory`);
    } catch (error) {
      this.logger.warn(`Failed to load model ${modelName} into memory`, error);
      throw error;
    }
  }

  /**
   * Optimize adapter for local hardware capabilities
   */
  private async optimizeForLocalHardware(): Promise<void> {
    try {
      const resourceUsage = await this.getResourceUsage();
      
      // Auto-detect optimal thread count if not specified
      if (!this.localProcessingConfig.numThreads) {
        this.localProcessingConfig.numThreads = Math.max(1, Math.floor(resourceUsage.cpu.cores * 0.8));
      }
      
      // Adjust context window based on available memory
      const availableMemoryGB = resourceUsage.memory.available / 1024;
      if (availableMemoryGB < 4) {
        this.localProcessingConfig.contextWindowSize = Math.min(1024, this.localProcessingConfig.contextWindowSize || 2048);
        this.localProcessingConfig.lowVRAMMode = true;
      } else if (availableMemoryGB > 16) {
        this.localProcessingConfig.contextWindowSize = Math.max(4096, this.localProcessingConfig.contextWindowSize || 2048);
      }
      
      this.logger.info(`Hardware optimization complete: ${resourceUsage.cpu.cores} cores, ${availableMemoryGB.toFixed(1)}GB RAM`);
      this.logger.debug(`Optimized settings: threads=${this.localProcessingConfig.numThreads}, context=${this.localProcessingConfig.contextWindowSize}`);
    } catch (error) {
      this.logger.warn('Failed to optimize for local hardware', error);
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      // Check if Ollama service is running
      const response = await this.makeRequest('/api/tags', 'GET');
      
      // Additional health checks for local processing
      if (response) {
        // Check resource usage
        const resourceUsage = await this.getResourceUsage();
        const memoryUsagePercent = (resourceUsage.memory.used / (resourceUsage.memory.used + resourceUsage.memory.available)) * 100;
        
        // Consider unhealthy if memory usage is too high
        if (memoryUsagePercent > 95) {
          this.logger.warn(`High memory usage detected: ${memoryUsagePercent.toFixed(1)}%`);
          return false;
        }
        
        // Check if primary model is loaded and accessible
        if (this.localProcessingConfig.keepModelLoaded) {
          try {
            await this.testModel();
          } catch (error) {
            this.logger.warn('Primary model health check failed', error);
            return false;
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.warn('Ollama health check failed', error);
      return false;
    }
  }

  /**
   * Enhanced health status with local processing metrics
   */
  async getHealthStatus(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.doHealthCheck();
      const responseTime = Date.now() - startTime;
      const resourceUsage = await this.getResourceUsage();
      const version = await this.getVersion();
      
      const status: HealthCheckResponse['status'] = isHealthy ? 'healthy' : 'unhealthy';
      
      // Get model status
      const modelStatuses = await Promise.all(
        this.availableModels.slice(0, 5).map(async (modelName) => {
          try {
            const isAvailable = await this.isModelAvailable(modelName);
            const isLoaded = this.loadedModels.has(modelName);
            return {
              name: modelName,
              status: isAvailable ? 'available' as const : 'unavailable' as const,
              responseTime: isLoaded ? responseTime : undefined,
              error: isAvailable ? undefined : 'Model not available'
            };
          } catch (error) {
            return {
              name: modelName,
              status: 'unavailable' as const,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );
      
      return {
        status,
        timestamp: new Date(),
        responseTime,
        version,
        details: {
          models: modelStatuses,
          resources: {
            memory: {
              used: resourceUsage.memory.used,
              available: resourceUsage.memory.available
            },
            cpu: {
              usage: resourceUsage.cpu.usage
            }
          },
          dependencies: [
            {
              name: 'Ollama Service',
              status: isHealthy ? 'healthy' : 'unhealthy',
              responseTime
            }
          ]
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          models: [],
          resources: {
            memory: { used: 0, available: 0 },
            cpu: { usage: 0 }
          },
          dependencies: [
            {
              name: 'Ollama Service',
              status: 'unhealthy',
              responseTime: Date.now() - startTime
            }
          ]
        }
      };
    }
  }

  protected async getVersion(): Promise<string> {
    try {
      // Ollama doesn't have a version endpoint, so we'll use a placeholder
      return 'ollama-local';
    } catch (error) {
      return 'unknown';
    }
  }

  protected async doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    return this.generateCompletionDirect(prompt, options);
  }

  /**
   * Enhanced completion generation with local processing optimizations
   */
  private async generateCompletionDirect(prompt: string, options?: CompletionOptions): Promise<string> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(prompt, options);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Ensure model is loaded
      await this.ensureModelLoaded(this.model);
      
      const request: OllamaGenerateRequest = {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature,
          top_p: options?.topP,
          top_k: options?.topK,
          num_predict: options?.maxTokens,
          stop: options?.stopSequences,
          // Local processing optimizations
          num_ctx: this.localProcessingConfig.contextWindowSize,
          num_batch: this.localProcessingConfig.batchSize,
          num_gpu: this.localProcessingConfig.gpuLayers,
          main_gpu: this.localProcessingConfig.mainGPU,
          low_vram: this.localProcessingConfig.lowVRAMMode,
          use_mmap: this.localProcessingConfig.enableMemoryMapping,
          use_mlock: this.localProcessingConfig.enableMemoryLocking,
          numa: this.localProcessingConfig.enableNUMA
        }
      };

      const response = await this.makeRequest<OllamaGenerateResponse>('/api/generate', 'POST', request);
      
      if (!response || !response.response) {
        throw new AIError(
          AIErrorType.INVALID_RESPONSE,
          'Invalid response from Ollama API'
        );
      }

      // Cache the response
      this.setCachedResponse(cacheKey, response.response);
      
      return response.response;
    } catch (error) {
      throw this.wrapError(error, 'generateCompletion');
    }
  }

  /**
   * Ensure model is loaded in memory for faster processing
   */
  private async ensureModelLoaded(modelName: string): Promise<void> {
    if (this.loadedModels.has(modelName)) {
      return; // Already loaded
    }
    
    try {
      await this.preloadModel(modelName);
      this.loadedModels.add(modelName);
    } catch (error) {
      this.logger.warn(`Failed to ensure model ${modelName} is loaded`, error);
      // Continue anyway - Ollama will load it on demand
    }
  }

  /**
   * Generate cache key for response caching
   */
  private generateCacheKey(prompt: string, options?: CompletionOptions): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${this.model}:${prompt.slice(0, 100)}:${optionsStr}`;
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse(cacheKey: string): string | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.RESPONSE_CACHE_TTL) {
      this.responseCache.delete(cacheKey);
      return null;
    }
    
    return cached.response;
  }

  /**
   * Cache response for future use
   */
  private setCachedResponse(cacheKey: string, response: string): void {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
    
    // Clean old entries periodically
    if (this.responseCache.size > 100) {
      this.cleanResponseCache();
    }
  }

  /**
   * Clean expired entries from response cache
   */
  private cleanResponseCache(): void {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.RESPONSE_CACHE_TTL) {
        this.responseCache.delete(key);
      }
    }
  }

  protected async doExtractPatterns(content: string, context?: any): Promise<DetectedPattern[]> {
    this.ensureInitialized();
    
    const prompt = `Analyze the following content and extract meaningful patterns, themes, and insights. Return the results in a structured format:

Content:
${content}

Please identify:
1. Key themes and topics
2. Recurring patterns
3. Important insights
4. Emotional tone
5. Actionable items

Format your response as a JSON array of pattern objects.`;

    try {
      const response = await this.generateCompletionDirect(prompt);
      
      // Try to parse JSON response
      try {
        const patterns = JSON.parse(response);
        if (Array.isArray(patterns)) {
          return patterns.map((pattern, index) => ({
            id: `pattern-${index}`,
            type: pattern.type && ['habit', 'goal', 'challenge', 'insight', 'trend', 'relationship', 'other'].includes(pattern.type) 
              ? pattern.type : 'other',
            title: pattern.title || pattern.content || `Pattern ${index + 1}`,
            description: pattern.description || pattern.content || '',
            confidence: pattern.confidence || 0.7,
            evidence: Array.isArray(pattern.evidence) ? pattern.evidence : [pattern.content || ''],
            metadata: {
              sourceFiles: [],
              keywords: Array.isArray(pattern.keywords) ? pattern.keywords : [],
              sentiment: pattern.sentiment && ['positive', 'negative', 'neutral'].includes(pattern.sentiment) 
                ? pattern.sentiment : undefined,
              importance: pattern.importance && ['low', 'medium', 'high'].includes(pattern.importance) 
                ? pattern.importance : undefined,
              category: pattern.category || undefined
            }
          }));
        }
      } catch (parseError) {
        // If JSON parsing fails, create a single pattern from the response
        return [{
          id: 'pattern-0',
          type: 'insight',
          title: 'Content Analysis',
          description: response,
          confidence: 0.6,
          evidence: [content.substring(0, 100) + '...'],
          metadata: {
            sourceFiles: [],
            keywords: [],
            sentiment: 'neutral',
            importance: 'medium'
          }
        }];
      }
    } catch (error) {
      throw this.wrapError(error, 'extractPatterns');
    }

    return [];
  }

  protected async doGenerateSummary(patterns: DetectedPattern[], context?: any): Promise<string> {
    this.ensureInitialized();
    
    const patternsText = patterns.map(p => `- ${p.type}: ${p.description}`).join('\n');
    
    const prompt = `Based on the following patterns and insights, generate a comprehensive summary:

Patterns:
${patternsText}

Context: ${context ? JSON.stringify(context) : 'None'}

Please create a well-structured summary that:
1. Highlights the key findings
2. Identifies the most important patterns
3. Provides actionable insights
4. Maintains a clear and engaging narrative`;

    try {
      return await this.generateCompletionDirect(prompt);
    } catch (error) {
      throw this.wrapError(error, 'generateSummary');
    }
  }

  protected async doAnalyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
    this.ensureInitialized();
    const startTime = Date.now();
    
    try {
      // Extract patterns first
      const patterns = await this.doExtractPatterns(content);
      
      // Generate summary
      const summary = await this.doGenerateSummary(patterns);
      
      // Generate insights
      const insightsPrompt = `Based on this content analysis, provide 3-5 key insights:

Content length: ${content.length} characters
Patterns found: ${patterns.length}
Analysis type: ${analysisType || 'general'}

Focus on actionable insights and key findings.`;

      const insightsResponse = await this.generateCompletionDirect(insightsPrompt);
      const insights = [insightsResponse]; // Simple implementation
      
      // Generate recommendations
      const recommendationsPrompt = `Based on the patterns and insights, provide 3-5 specific recommendations:

Patterns: ${patterns.map(p => p.title).join(', ')}
Key insights: ${insights.join('; ')}

Provide practical recommendations.`;

      const recommendationsResponse = await this.generateCompletionDirect(recommendationsPrompt);
      const recommendations = [recommendationsResponse]; // Simple implementation
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        patterns,
        summary,
        insights,
        recommendations,
        confidence: 0.75,
        processingTime,
        modelUsed: this.name,
        tokensUsed: Math.floor((content.length + summary.length) / 4) // Rough estimate
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        patterns: [],
        summary: '',
        insights: [],
        recommendations: [],
        confidence: 0,
        processingTime,
        modelUsed: this.name,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  protected async doClassifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }> {
    this.ensureInitialized();
    
    const categoriesText = categories.join(', ');
    const prompt = `Classify the following content into one of these categories: ${categoriesText}

Content:
${content}

Please respond with just the category name that best fits the content. Choose from: ${categoriesText}`;

    try {
      const response = await this.generateCompletionDirect(prompt);
      const classification = response.trim().toLowerCase();
      
      // Find the best matching category
      const matchedCategory = categories.find(cat => 
        classification.includes(cat.toLowerCase()) || 
        cat.toLowerCase().includes(classification)
      );
      
      return {
        category: matchedCategory || categories[0] || 'unknown',
        confidence: matchedCategory ? 0.8 : 0.5
      };
    } catch (error) {
      throw this.wrapError(error, 'classifyContent');
    }
  }

  protected async doAnalyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    this.ensureInitialized();
    
    const prompt = `Analyze the sentiment of the following content. Respond with only one word: "positive", "negative", or "neutral".

Content:
${content}

Sentiment:`;

    try {
      const response = await this.generateCompletionDirect(prompt);
      const sentiment = response.trim().toLowerCase();
      
      if (sentiment.includes('positive')) {
        return { sentiment: 'positive', confidence: 0.8 };
      } else if (sentiment.includes('negative')) {
        return { sentiment: 'negative', confidence: 0.8 };
      } else {
        return { sentiment: 'neutral', confidence: 0.7 };
      }
    } catch (error) {
      throw this.wrapError(error, 'analyzeSentiment');
    }
  }

  protected async doDispose(): Promise<void> {
    try {
      // Clear caches
      this.responseCache.clear();
      this.modelCache.clear();
      this.loadedModels.clear();
      
      // Cancel any ongoing streaming connections
      for (const [, controller] of this.streamingConnections) {
        controller.abort();
      }
      this.streamingConnections.clear();
      
      // Clear model loading queue
      this.modelLoadingQueue.clear();
      
      // Dispose performance optimizer if it exists
      this.performanceOptimizer = undefined;
      
      this.logger.info('Ollama adapter disposed successfully');
    } catch (error) {
      this.logger.error('Error during Ollama adapter disposal', error);
      throw error;
    }
  }

  // Enhanced performance and resource management methods
  
  private async initializePerformanceOptimizer(): Promise<void> {
    try {
      const config = this.getDefaultPerformanceConfig();
      
      // Adjust configuration for local processing
      config.memory.maxMemoryUsage = Math.min(1024, this.resourceMonitor.memoryUsage * 2); // Double current usage as max
      config.caching.maxCacheSize = Math.min(512, this.resourceMonitor.memoryUsage); // Use current memory for cache
      
      this.performanceOptimizer = new PerformanceOptimizer(this.logger, config, this.processBatchLegacy.bind(this));
      
      this.logger.info('Performance optimizer initialized for local processing');
    } catch (error) {
      this.logger.warn('Failed to initialize performance optimizer', error);
    }
  }

  private async processBatchLegacy(batch: RequestBatch): Promise<string[]> {
    // Fallback: process requests sequentially
    const results: string[] = [];
    for (const request of batch.requests) {
      try {
        const result = await this.generateCompletionDirect(request.prompt, request.options);
        results.push(result);
      } catch (error) {
        results.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return results;
  }

  async configurePerformance(config: PerformanceConfig): Promise<void> {
    await super.configurePerformance(config);
    
    // Apply local processing specific optimizations
    if (config.hardware) {
      this.localProcessingConfig.numThreads = config.hardware.maxThreads;
    }
    
    if (config.memory) {
      this.localProcessingConfig.lowVRAMMode = config.memory.maxMemoryUsage < 512;
      this.localProcessingConfig.contextWindowSize = Math.min(4096, 
        Math.floor(config.memory.maxMemoryUsage / 128) * 512
      );
    }
    
    if (config.caching) {
      (this as any).responseCacheTTL = (config.caching.ttl || 600) * 1000; // Convert to milliseconds
    }
    
    this.logger.info('Local processing configuration updated');
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const baseMetrics = await super.getPerformanceMetrics();
    
    // Add local processing specific metrics
    const localMetrics: PerformanceMetrics = {
      ...baseMetrics,
      memoryUsage: this.resourceMonitor.memoryUsage,
      cpuUsage: this.resourceMonitor.cpuUsage,
      cacheHitRate: this.responseCache.size > 0 ? 0.7 : 0, // Estimate
      throughput: this.loadedModels.size, // Models loaded as throughput indicator
      lastUpdated: new Date()
    };
    
    return localMetrics;
  }

  async getResourceUsage(): Promise<ResourceUsage> {
    const baseUsage = await super.getResourceUsage();
    
    // Enhanced with local processing metrics
    return {
      memory: {
        ...baseUsage.memory
      },
      cpu: {
        ...baseUsage.cpu
      }
    };
  }

  async clearCaches(): Promise<void> {
    await super.clearCaches();
    
    // Clear local processing caches
    this.responseCache.clear();
    this.cleanResponseCache();
    
    // Clear model cache but keep loaded models if configured
    if (!this.localProcessingConfig.keepModelLoaded) {
      this.loadedModels.clear();
    }
    
    this.logger.info('Local processing caches cleared');
  }

  // Private helper methods

  private getModelCapabilities(modelName: string): AICapability[] {
    // Check for exact match first
    if (OLLAMA_MODEL_CAPABILITIES[modelName]) {
      return OLLAMA_MODEL_CAPABILITIES[modelName];
    }
    
    // Check for partial matches (e.g., "llama2:7b" matches "llama2")
    for (const [pattern, capabilities] of Object.entries(OLLAMA_MODEL_CAPABILITIES)) {
      if (modelName.startsWith(pattern) || pattern.startsWith(modelName.split(':')[0])) {
        return capabilities;
      }
    }
    
    // Default capabilities for unknown models
    return ['text-completion', 'pattern-extraction'];
  }

  private async loadAvailableModels(): Promise<void> {
    try {
      await this.refreshModelCache(true);
    } catch (error) {
      this.logger.warn('Failed to load available models', error);
      throw error;
    }
  }

  private async pullModel(modelName: string): Promise<void> {
    this.logger.info(`Pulling model: ${modelName}`);
    
    try {
      const request: OllamaPullRequest = {
        name: modelName,
        stream: false
      };

      await this.makeRequest('/api/pull', 'POST', request);
      this.logger.info(`Successfully pulled model: ${modelName}`);
      
      // Refresh model cache
      await this.refreshModelCache(true);
    } catch (error) {
      throw new AIError(
        AIErrorType.REQUEST_FAILED,
        `Failed to pull model ${modelName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async testModel(): Promise<void> {
    try {
      const testPrompt = 'Hello';
      await this.generateCompletionDirect(testPrompt, { maxTokens: 10 });
      this.logger.debug(`Model ${this.model} test successful`);
    } catch (error) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        `Model test failed for ${this.model}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async makeRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'DELETE', data?: any): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RetrospectAI-Plugin/1.0'
        },
        signal: controller.signal
      };

      if (data && (method === 'POST' || method === 'DELETE')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        
        try {
          const errorJson = JSON.parse(errorText) as OllamaErrorResponse;
          errorMessage = errorJson.error || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw this.mapOllamaError(response.status, errorMessage);
      }

      // Handle empty responses for DELETE requests
      if (method === 'DELETE' && response.status === 200) {
        return {} as T;
      }

      const result = await response.json();
      return result as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError(
          AIErrorType.TIMEOUT,
          `Request timed out after ${this.requestTimeout}ms`,
          error,
          true
        );
      }
      
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
        true
      );
    }
  }

  private mapOllamaError(status: number, message: string): AIError {
    switch (status) {
      case 400:
        return new AIError(AIErrorType.REQUEST_FAILED, `Bad request: ${message}`);
      case 401:
        return new AIError(AIErrorType.AUTHENTICATION_FAILED, `Authentication failed: ${message}`);
      case 404:
        return new AIError(AIErrorType.MODEL_UNAVAILABLE, `Model not found: ${message}`);
      case 429:
        return new AIError(AIErrorType.RATE_LIMITED, `Rate limited: ${message}`, undefined, true);
      case 500:
      case 502:
      case 503:
        return new AIError(AIErrorType.REQUEST_FAILED, `Server error: ${message}`, undefined, true);
      default:
        return new AIError(AIErrorType.UNKNOWN_ERROR, `Unknown error: ${message}`);
    }
  }

  /**
   * Get detailed information about available models
   */
  async getAvailableModels(): Promise<OllamaModelStatus[]> {
    await this.refreshModelCache();
    return Array.from(this.modelCache.values());
  }

  /**
   * Get detailed information about a specific model
   */
  async getOllamaModelInfo(modelName: string): Promise<OllamaModelStatus | null> {
    await this.refreshModelCache();
    return this.modelCache.get(modelName) || null;
  }

  /**
   * Check if a specific model is available and loaded
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    await this.refreshModelCache();
    return this.modelCache.has(modelName);
  }

  /**
   * Download/pull a model with progress tracking
   */
  async downloadModel(modelName: string, onProgress?: (progress: { completed: number; total: number; status: string }) => void): Promise<void> {
    this.logger.info(`Starting download of model: ${modelName}`);
    
    try {
      const request: OllamaPullRequest = {
        name: modelName,
        stream: !!onProgress
      };

      if (onProgress) {
        // Handle streaming response for progress tracking
        await this.streamModelPull(modelName, onProgress);
      } else {
        // Simple non-streaming pull
        await this.makeRequest('/api/pull', 'POST', request);
      }

      this.logger.info(`Successfully downloaded model: ${modelName}`);
      
      // Refresh model cache
      await this.refreshModelCache(true);
    } catch (error) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        `Failed to download model ${modelName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Delete a model from local storage
   */
  async deleteModel(modelName: string): Promise<void> {
    this.logger.info(`Deleting model: ${modelName}`);
    
    try {
      const request: OllamaDeleteRequest = {
        name: modelName
      };

      await this.makeRequest('/api/delete', 'DELETE', request);
      this.logger.info(`Successfully deleted model: ${modelName}`);
      
      // Remove from cache and refresh
      this.modelCache.delete(modelName);
      await this.refreshModelCache(true);
    } catch (error) {
      throw new AIError(
        AIErrorType.REQUEST_FAILED,
        `Failed to delete model ${modelName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get detailed model information including modelfile and parameters
   */
  async getDetailedModelInfo(modelName: string): Promise<OllamaShowResponse | null> {
    try {
      const request: OllamaShowRequest = {
        name: modelName
      };

      const response = await this.makeRequest<OllamaShowResponse>('/api/show', 'POST', request);
      return response;
    } catch (error) {
      this.logger.warn(`Failed to get detailed info for model ${modelName}`, error);
      return null;
    }
  }

  /**
   * Update a model to the latest version
   */
  async updateModel(modelName: string, onProgress?: (progress: { completed: number; total: number; status: string }) => void): Promise<void> {
    this.logger.info(`Updating model: ${modelName}`);
    
    // Check if model exists first
    const modelInfo = await this.getOllamaModelInfo(modelName);
    if (!modelInfo) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        `Model ${modelName} not found locally`
      );
    }

    // Re-download the model (Ollama will update if newer version available)
    await this.downloadModel(modelName, onProgress);
  }

  /**
   * List all models with their current status
   */
  async listModelsWithStatus(): Promise<{ available: string[]; loaded: string[]; total: number }> {
    const models = await this.getAvailableModels();
    
    return {
      available: models.filter(m => m.isAvailable).map(m => m.name),
      loaded: models.filter(m => m.isLoaded).map(m => m.name),
      total: models.length
    };
  }

  /**
   * Get recommended models for different use cases
   */
  getRecommendedModels(): { [useCase: string]: string[] } {
    return {
      'general': ['llama2', 'mistral', 'neural-chat'],
      'coding': ['codellama', 'starling-lm'],
      'fast': ['mistral', 'llama2:7b'],
      'accurate': ['llama2:13b', 'llama2:70b', 'starling-lm'],
      'lightweight': ['llama2:7b', 'mistral']
    };
  }

  // Enhanced private methods

  private async refreshModelCache(force = false): Promise<void> {
    const now = Date.now();
    
    if (!force && (now - this.lastModelListUpdate) < this.MODEL_CACHE_TTL) {
      return; // Cache is still fresh
    }

    try {
      const response = await this.makeRequest<OllamaListResponse>('/api/tags', 'GET');
      
      if (response && response.models) {
        this.modelCache.clear();
        
        for (const model of response.models) {
          const status: OllamaModelStatus = {
            name: model.name,
            isAvailable: true,
            isLoaded: true, // Assume loaded if in the list
            size: model.size,
            lastModified: model.modified_at,
            details: model.details
          };
          
          this.modelCache.set(model.name, status);
        }
        
        this.availableModels = response.models.map(model => model.name);
        this.lastModelListUpdate = now;
        
        this.logger.debug(`Refreshed model cache with ${this.modelCache.size} models`);
      }
    } catch (error) {
      this.logger.error('Failed to refresh model cache', error);
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `Failed to refresh model list: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async streamModelPull(modelName: string, onProgress: (progress: { completed: number; total: number; status: string }) => void): Promise<void> {
    const url = `${this.baseURL}/api/pull`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout * 10); // Longer timeout for downloads
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RetrospectAI-Plugin/1.0'
        },
        body: JSON.stringify({ name: modelName, stream: true }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

             try {
         // eslint-disable-next-line no-constant-condition
         while (true) {
           const { done, value } = await reader.read();
           
           if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line) as OllamaPullResponse;
                
                if (data.total && data.completed !== undefined) {
                  onProgress({
                    completed: data.completed,
                    total: data.total,
                    status: data.status || 'downloading'
                  });
                }
              } catch (parseError) {
                // Ignore malformed JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError(
          AIErrorType.TIMEOUT,
          `Model download timed out: ${modelName}`,
          error,
          true
        );
      }
      
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `Failed to download model ${modelName}: ${error instanceof Error ? error.message : String(error)}`,
        error,
        true
      );
    }
  }
} 