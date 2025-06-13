import { Logger } from './logger';
import { DefaultAIModelFactory } from './ai-model-factory';
import {
  AIModelAdapter,
  AIModelConfig,
  AICapability,
  CompletionOptions,
  DetectedPattern,
  AIAnalysisResult,
  AIError,
  AIErrorType,
  PrivacyLevel
} from './ai-interfaces';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorConfig {
  // Adapter management
  primaryAdapter?: string;
  fallbackAdapters?: string[];
  
  // Retry configuration
  maxRetries?: number;
  retryDelay?: number;
  retryBackoffMultiplier?: number;
  
  // Performance settings
  requestTimeout?: number;
  parallelRequests?: boolean;
  
  // Privacy and routing
  privacyLevel?: PrivacyLevel;
  preferLocalModels?: boolean;
  
  // Quality settings
  minimumConfidence?: number;
  requireConsensus?: boolean;
  consensusThreshold?: number;
}

/**
 * Request context for intelligent routing
 */
export interface RequestContext {
  contentType?: 'daily-reflection' | 'goal-review' | 'habit-tracking' | 'general';
  privacyLevel?: PrivacyLevel;
  urgency?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'medium' | 'complex';
  requiredCapabilities?: AICapability[];
  maxCost?: number;
  preferredAdapter?: string;
}

/**
 * Orchestrator performance metrics
 */
export interface OrchestratorMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  adapterUsageStats: Map<string, number>;
  fallbackUsageCount: number;
  retryCount: number;
  lastActivity: Date;
}

/**
 * Enhanced analysis result with orchestrator metadata
 */
export interface EnhancedAnalysisResult extends AIAnalysisResult {
  orchestratorMetadata: {
    adaptersUsed: string[];
    fallbacksTriggered: number;
    retriesAttempted: number;
    totalProcessingTime: number;
    confidenceScore: number;
    routingDecision: string;
  };
}

/**
 * RetrospectAI-specific analysis options
 */
export interface RetrospectAnalysisOptions {
  extractPatterns?: boolean;
  generateSummary?: boolean;
  identifyGoals?: boolean;
  trackHabits?: boolean;
  analyzeMood?: boolean;
  suggestActions?: boolean;
  compareWithHistory?: boolean;
  privacyLevel?: PrivacyLevel;
  analysisDepth?: 'quick' | 'standard' | 'comprehensive';
}

/**
 * AI Service Orchestrator
 * 
 * Manages multiple AI adapters with intelligent routing, fallback handling,
 * and RetrospectAI-specific analysis workflows.
 */
export class AIServiceOrchestrator {
  private logger: Logger;
  private factory: DefaultAIModelFactory;
  private adapters: Map<string, AIModelAdapter> = new Map();
  private config: OrchestratorConfig;
  private metrics: OrchestratorMetrics;
  private isInitialized = false;

  constructor(logger: Logger, config: OrchestratorConfig = {}) {
    this.logger = logger;
    this.factory = new DefaultAIModelFactory(logger);
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      requestTimeout: 30000,
      parallelRequests: false,
      privacyLevel: 'hybrid',
      preferLocalModels: false,
      minimumConfidence: 0.6,
      requireConsensus: false,
      consensusThreshold: 0.8,
      ...config
    };
    
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      adapterUsageStats: new Map(),
      fallbackUsageCount: 0,
      retryCount: 0,
      lastActivity: new Date()
    };
  }

  /**
   * Initialize the orchestrator with configured adapters
   */
  async initialize(adapterConfigs: Map<string, AIModelConfig>): Promise<void> {
    this.logger.info('Initializing AI Service Orchestrator');
    
    try {
      // Create and initialize all configured adapters
      for (const [name, config] of adapterConfigs) {
        try {
          const adapter = await this.factory.createModel(config);
          await adapter.initialize();
          this.adapters.set(name, adapter);
          this.metrics.adapterUsageStats.set(name, 0);
          this.logger.info(`Initialized adapter: ${name}`);
        } catch (error) {
          this.logger.warn(`Failed to initialize adapter ${name}:`, error);
        }
      }

      if (this.adapters.size === 0) {
        throw new AIError(
          AIErrorType.INITIALIZATION_FAILED,
          'No adapters were successfully initialized'
        );
      }

      // Set default primary adapter if not specified
      if (!this.config.primaryAdapter && this.adapters.size > 0) {
        this.config.primaryAdapter = Array.from(this.adapters.keys())[0];
      }

      this.isInitialized = true;
      this.logger.info(`Orchestrator initialized with ${this.adapters.size} adapters`);
    } catch (error) {
      this.logger.error('Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  /**
   * Analyze personal content with RetrospectAI-specific intelligence
   */
  async analyzePersonalContent(
    content: string,
    options: RetrospectAnalysisOptions = {},
    context?: RequestContext
  ): Promise<EnhancedAnalysisResult> {
    this.ensureInitialized();
    const startTime = Date.now();
    
    try {
      this.metrics.totalRequests++;
      this.metrics.lastActivity = new Date();

      // Determine the best adapter for this request
      const selectedAdapter = await this.selectAdapter(context);
      const orchestratorMetadata = {
        adaptersUsed: [selectedAdapter.name],
        fallbacksTriggered: 0,
        retriesAttempted: 0,
        totalProcessingTime: 0,
        confidenceScore: 0,
        routingDecision: `Selected ${selectedAdapter.name} based on context`
      };

      // Perform the analysis with retry logic
      const result = await this.executeWithRetry(async () => {
        return await this.performRetrospectAnalysis(selectedAdapter, content, options);
      }, orchestratorMetadata);

      orchestratorMetadata.totalProcessingTime = Date.now() - startTime;
      orchestratorMetadata.confidenceScore = result.confidence || 0;

      this.metrics.successfulRequests++;
      this.updateAdapterUsage(selectedAdapter.name);

      return {
        ...result,
        orchestratorMetadata
      };

    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.error('Personal content analysis failed:', error);
      
      // Return a fallback result
      return {
        success: false,
        patterns: [],
        summary: 'Analysis failed due to technical issues. Please try again.',
        insights: ['Unable to analyze content at this time'],
        recommendations: ['Please check your AI service configuration'],
        confidence: 0,
        processingTime: Date.now() - startTime,
        modelUsed: 'orchestrator-fallback',
        error: error instanceof Error ? error.message : String(error),
        orchestratorMetadata: {
          adaptersUsed: [],
          fallbacksTriggered: 1,
          retriesAttempted: 0,
          totalProcessingTime: Date.now() - startTime,
          confidenceScore: 0,
          routingDecision: 'Fallback due to error'
        }
      };
    }
  }

  /**
   * Extract patterns with intelligent adapter selection
   */
  async extractPatterns(
    content: string,
    context?: RequestContext
  ): Promise<DetectedPattern[]> {
    this.ensureInitialized();
    
    const adapter = await this.selectAdapter(context);
    
    return await this.executeWithRetry(async () => {
      return await adapter.extractPatterns(content);
    });
  }

  /**
   * Generate completion with fallback support
   */
  async generateCompletion(
    prompt: string,
    options?: CompletionOptions,
    context?: RequestContext
  ): Promise<string> {
    this.ensureInitialized();
    
    const adapter = await this.selectAdapter(context);
    
    return await this.executeWithRetry(async () => {
      return await adapter.generateCompletion(prompt, options);
    });
  }

  /**
   * Analyze sentiment with consensus support
   */
  async analyzeSentiment(
    content: string,
    context?: RequestContext
  ): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    this.ensureInitialized();
    
    if (this.config.requireConsensus && this.adapters.size > 1) {
      return await this.getSentimentConsensus(content, context);
    }
    
    const adapter = await this.selectAdapter(context);
    
    return await this.executeWithRetry(async () => {
      return await adapter.analyzeSentiment(content);
    });
  }

  /**
   * Classify content with multiple adapters if needed
   */
  async classifyContent(
    content: string,
    categories: string[],
    context?: RequestContext
  ): Promise<{ category: string; confidence: number }> {
    this.ensureInitialized();
    
    const adapter = await this.selectAdapter(context);
    
    return await this.executeWithRetry(async () => {
      return await adapter.classifyContent(content, categories);
    });
  }

  /**
   * Get orchestrator performance metrics
   */
  getMetrics(): OrchestratorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get available adapters and their status
   */
  async getAdapterStatus(): Promise<Map<string, { healthy: boolean; capabilities: AICapability[] }>> {
    const status = new Map();
    
    for (const [name, adapter] of this.adapters) {
      try {
        const healthy = await adapter.isAvailable();
        status.set(name, {
          healthy,
          capabilities: adapter.capabilities
        });
      } catch (error) {
        status.set(name, {
          healthy: false,
          capabilities: []
        });
      }
    }
    
    return status;
  }

  /**
   * Dispose of all adapters and clean up resources
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing AI Service Orchestrator');
    
    for (const [name, adapter] of this.adapters) {
      try {
        await adapter.dispose();
        this.logger.debug(`Disposed adapter: ${name}`);
      } catch (error) {
        this.logger.warn(`Error disposing adapter ${name}:`, error);
      }
    }
    
    this.adapters.clear();
    this.isInitialized = false;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        'Orchestrator must be initialized before use'
      );
    }
  }

  private async selectAdapter(context?: RequestContext): Promise<AIModelAdapter> {
    // Privacy-based routing
    if (context?.privacyLevel === 'local' || this.config.preferLocalModels) {
      const localAdapter = this.findAdapterByPrivacyLevel('local');
      if (localAdapter) {
        return localAdapter;
      }
    }

    // Capability-based routing
    if (context?.requiredCapabilities) {
      const capableAdapter = this.findAdapterWithCapabilities(context.requiredCapabilities);
      if (capableAdapter) {
        return capableAdapter;
      }
    }

    // Preferred adapter
    if (context?.preferredAdapter && this.adapters.has(context.preferredAdapter)) {
      const adapter = this.adapters.get(context.preferredAdapter)!;
      if (await adapter.isAvailable()) {
        return adapter;
      }
    }

    // Primary adapter
    if (this.config.primaryAdapter && this.adapters.has(this.config.primaryAdapter)) {
      const adapter = this.adapters.get(this.config.primaryAdapter)!;
      if (await adapter.isAvailable()) {
        return adapter;
      }
    }

    // Fallback to any healthy adapter
    for (const adapter of this.adapters.values()) {
      if (await adapter.isAvailable()) {
        return adapter;
      }
    }

    throw new AIError(
      AIErrorType.MODEL_UNAVAILABLE,
      'No healthy adapters available'
    );
  }

  private findAdapterByPrivacyLevel(privacyLevel: PrivacyLevel): AIModelAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.privacyLevel === privacyLevel) {
        return adapter;
      }
    }
    return null;
  }

  private findAdapterWithCapabilities(requiredCapabilities: AICapability[]): AIModelAdapter | null {
    for (const adapter of this.adapters.values()) {
      const hasAllCapabilities = requiredCapabilities.every(cap => 
        adapter.capabilities.includes(cap)
      );
      if (hasAllCapabilities) {
        return adapter;
      }
    }
    return null;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        if (attempt > 0) {
          this.metrics.retryCount++;
          if (metadata) {
            metadata.retriesAttempted = attempt;
          }
          
          // Exponential backoff
          const delay = this.config.retryDelay! * Math.pow(this.config.retryBackoffMultiplier!, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Operation attempt ${attempt + 1} failed:`, error);
        
        // Don't retry on certain error types
        if (error instanceof AIError && !error.retryable) {
          break;
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  private async performRetrospectAnalysis(
    adapter: AIModelAdapter,
    content: string,
    options: RetrospectAnalysisOptions
  ): Promise<AIAnalysisResult> {
    // Determine analysis type based on content and options
    let analysisType = 'general';
    if (content.toLowerCase().includes('daily') || content.toLowerCase().includes('today')) {
      analysisType = 'daily-reflection';
    } else if (content.toLowerCase().includes('goal') || content.toLowerCase().includes('objective')) {
      analysisType = 'goal-review';
    } else if (content.toLowerCase().includes('habit') || content.toLowerCase().includes('routine')) {
      analysisType = 'habit-tracking';
    }

    // Use the adapter's comprehensive analysis
    return await adapter.analyzeContent(content, analysisType);
  }

  private async getSentimentConsensus(
    content: string,
    context?: RequestContext
  ): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    const results: Array<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> = [];
    
    // Get sentiment from multiple adapters
    for (const adapter of this.adapters.values()) {
      try {
        if (await adapter.isAvailable()) {
          const result = await adapter.analyzeSentiment(content);
          results.push(result);
        }
      } catch (error) {
        this.logger.warn('Adapter failed during consensus:', error);
      }
    }

    if (results.length === 0) {
      throw new AIError(AIErrorType.MODEL_UNAVAILABLE, 'No adapters available for consensus');
    }

    // Calculate consensus
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    let totalConfidence = 0;

    for (const result of results) {
      sentimentCounts[result.sentiment]++;
      totalConfidence += result.confidence;
    }

    // Find the most common sentiment
    const maxCount = Math.max(...Object.values(sentimentCounts));
    const consensusSentiment = Object.entries(sentimentCounts)
      .find(([, count]) => count === maxCount)?.[0] as 'positive' | 'negative' | 'neutral';

    const consensusConfidence = totalConfidence / results.length;
    const consensusStrength = maxCount / results.length;

    // Check if consensus meets threshold
    if (consensusStrength < this.config.consensusThreshold!) {
      this.logger.warn(`Weak consensus: ${consensusStrength} < ${this.config.consensusThreshold}`);
    }

    return {
      sentiment: consensusSentiment || 'neutral',
      confidence: consensusConfidence * consensusStrength
    };
  }

  private updateAdapterUsage(adapterName: string): void {
    const currentCount = this.metrics.adapterUsageStats.get(adapterName) || 0;
    this.metrics.adapterUsageStats.set(adapterName, currentCount + 1);
  }
} 