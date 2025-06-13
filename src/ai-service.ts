import { Logger } from './logger';
import { ErrorHandler } from './error-handler';
import { AIServiceOrchestrator, OrchestratorConfig, RequestContext, RetrospectAnalysisOptions, EnhancedAnalysisResult } from './ai-service-orchestrator';
import { AIModelConfig, AIModelType, PrivacyLevel, AICapability, DetectedPattern, CompletionOptions } from './ai-interfaces';

/**
 * AI model provider types
 */
export type AIProvider = 'openai' | 'ollama' | 'mock';

/**
 * AI service configuration for plugin settings
 */
export interface AIServiceSettings {
  // General AI settings
  enableAI: boolean;
  primaryProvider: AIProvider;
  fallbackProviders: AIProvider[];
  
  // Privacy and routing
  privacyLevel: PrivacyLevel;
  preferLocalModels: boolean;
  
  // Performance settings
  maxRetries: number;
  requestTimeout: number;
  parallelRequests: boolean;
  
  // Quality settings
  minimumConfidence: number;
  requireConsensus: boolean;
  
  // Provider-specific configurations
  openaiConfig: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    endpoint?: string;
  };
  
  ollamaConfig: {
    endpoint: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  
  mockConfig: {
    enabled: boolean;
    simulateDelay: boolean;
    averageDelay: number;
  };
  
  // Analysis preferences
  defaultAnalysisOptions: {
    extractPatterns: boolean;
    generateSummary: boolean;
    identifyGoals: boolean;
    trackHabits: boolean;
    analyzeMood: boolean;
    suggestActions: boolean;
    analysisDepth: 'quick' | 'standard' | 'comprehensive';
  };
}

/**
 * Default AI service settings
 */
export const DEFAULT_AI_SETTINGS: AIServiceSettings = {
  enableAI: false,
  primaryProvider: 'mock',
  fallbackProviders: [],
  privacyLevel: 'hybrid',
  preferLocalModels: true,
  maxRetries: 3,
  requestTimeout: 30000,
  parallelRequests: false,
  minimumConfidence: 0.6,
  requireConsensus: false,
  
  openaiConfig: {
    apiKey: '',
    model: 'gpt-3.5-turbo',
    maxTokens: 2000,
    temperature: 0.7,
  },
  
  ollamaConfig: {
    endpoint: 'http://localhost:11434',
    model: 'llama2',
    maxTokens: 2000,
    temperature: 0.7,
  },
  
  mockConfig: {
    enabled: true,
    simulateDelay: true,
    averageDelay: 1000,
  },
  
  defaultAnalysisOptions: {
    extractPatterns: true,
    generateSummary: true,
    identifyGoals: true,
    trackHabits: true,
    analyzeMood: true,
    suggestActions: true,
    analysisDepth: 'standard',
  },
};

/**
 * AI service status information
 */
export interface AIServiceStatus {
  initialized: boolean;
  enabled: boolean;
  availableProviders: string[];
  activeProvider: string | null;
  capabilities: AICapability[];
  lastError?: string;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
  };
}

/**
 * Main AI service class that integrates the orchestrator with plugin settings
 * and provides a clean interface for the rest of the application.
 */
export class AIService {
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private orchestrator: AIServiceOrchestrator | null = null;
  private settings: AIServiceSettings;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    logger: Logger,
    errorHandler: ErrorHandler,
    settings: AIServiceSettings = DEFAULT_AI_SETTINGS
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.settings = { ...settings };
  }

  /**
   * Initialize the AI service with current settings
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    this.logger.info('Initializing AI Service');

    try {
      if (!this.settings.enableAI) {
        this.logger.info('AI service disabled in settings');
        return;
      }

      // Create orchestrator configuration
      const orchestratorConfig: OrchestratorConfig = {
        primaryAdapter: this.settings.primaryProvider,
        fallbackAdapters: this.settings.fallbackProviders,
        maxRetries: this.settings.maxRetries,
        requestTimeout: this.settings.requestTimeout,
        parallelRequests: this.settings.parallelRequests,
        privacyLevel: this.settings.privacyLevel,
        preferLocalModels: this.settings.preferLocalModels,
        minimumConfidence: this.settings.minimumConfidence,
        requireConsensus: this.settings.requireConsensus,
      };

      // Create orchestrator
      this.orchestrator = new AIServiceOrchestrator(this.logger, orchestratorConfig);

      // Build adapter configurations
      const adapterConfigs = new Map<string, AIModelConfig>();

      // Add configured providers
      if (this.shouldIncludeProvider('openai')) {
        adapterConfigs.set('openai', this.createOpenAIConfig());
      }

      if (this.shouldIncludeProvider('ollama')) {
        adapterConfigs.set('ollama', this.createOllamaConfig());
      }

      if (this.shouldIncludeProvider('mock') || adapterConfigs.size === 0) {
        adapterConfigs.set('mock', this.createMockConfig());
      }

      // Initialize orchestrator with adapters
      await this.orchestrator.initialize(adapterConfigs);

      this.isInitialized = true;
      this.logger.info('AI Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AI Service:', error);
      throw error;
    }
  }

  /**
   * Update AI service settings and reinitialize if necessary
   */
  async updateSettings(newSettings: Partial<AIServiceSettings>): Promise<void> {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    // Check if reinitialization is needed
    const needsReinit = this.settingsRequireReinitialization(oldSettings, this.settings);

    if (needsReinit && this.isInitialized) {
      this.logger.info('Settings changed, reinitializing AI Service');
      await this.dispose();
      this.initializationPromise = null;
      this.isInitialized = false;
      await this.initialize();
    }
  }

  /**
   * Analyze personal content using RetrospectAI-specific intelligence
   */
  async analyzePersonalContent(
    content: string,
    options?: Partial<RetrospectAnalysisOptions>,
    context?: RequestContext
  ): Promise<EnhancedAnalysisResult> {
    await this.ensureInitialized();

    if (!this.orchestrator) {
      throw new Error('AI Service not properly initialized');
    }

    // Merge with default analysis options
    const analysisOptions: RetrospectAnalysisOptions = {
      ...this.settings.defaultAnalysisOptions,
      ...options,
    };

    return this.orchestrator.analyzePersonalContent(content, analysisOptions, context);
  }

  /**
   * Extract patterns from content
   */
  async extractPatterns(
    content: string,
    context?: RequestContext
  ): Promise<DetectedPattern[]> {
    await this.ensureInitialized();

    if (!this.orchestrator) {
      throw new Error('AI Service not properly initialized');
    }

    return this.orchestrator.extractPatterns(content, context);
  }

  /**
   * Generate text completion
   */
  async generateCompletion(
    prompt: string,
    options?: CompletionOptions,
    context?: RequestContext
  ): Promise<string> {
    await this.ensureInitialized();

    if (!this.orchestrator) {
      throw new Error('AI Service not properly initialized');
    }

    return this.orchestrator.generateCompletion(prompt, options, context);
  }

  /**
   * Analyze sentiment of content
   */
  async analyzeSentiment(
    content: string,
    context?: RequestContext
  ): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    await this.ensureInitialized();

    if (!this.orchestrator) {
      throw new Error('AI Service not properly initialized');
    }

    return this.orchestrator.analyzeSentiment(content, context);
  }

  /**
   * Classify content into categories
   */
  async classifyContent(
    content: string,
    categories: string[],
    context?: RequestContext
  ): Promise<{ category: string; confidence: number }> {
    await this.ensureInitialized();

    if (!this.orchestrator) {
      throw new Error('AI Service not properly initialized');
    }

    return this.orchestrator.classifyContent(content, categories, context);
  }

  /**
   * Get current AI service status
   */
  async getStatus(): Promise<AIServiceStatus> {
    const status: AIServiceStatus = {
      initialized: this.isInitialized,
      enabled: this.settings.enableAI,
      availableProviders: [],
      activeProvider: null,
      capabilities: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
      },
    };

    if (this.orchestrator && this.isInitialized) {
      try {
        const adapterStatus = await this.orchestrator.getAdapterStatus();
        status.availableProviders = Array.from(adapterStatus.keys()).filter(
          name => adapterStatus.get(name)?.healthy
        );
        status.activeProvider = this.settings.primaryProvider;
        
        // Aggregate capabilities from all healthy adapters
        const allCapabilities = new Set<AICapability>();
        for (const [, info] of adapterStatus) {
          if (info.healthy) {
            info.capabilities.forEach(cap => allCapabilities.add(cap));
          }
        }
        status.capabilities = Array.from(allCapabilities);

        // Get metrics
        const metrics = this.orchestrator.getMetrics();
        status.metrics = {
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          averageResponseTime: metrics.averageResponseTime,
        };
      } catch (error) {
        status.lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    return status;
  }

  /**
   * Test connection to a specific provider
   */
  async testProvider(provider: AIProvider): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a temporary config for testing
      let testConfig: AIModelConfig;
      
      switch (provider) {
        case 'openai':
          testConfig = this.createOpenAIConfig();
          break;
        case 'ollama':
          testConfig = this.createOllamaConfig();
          break;
        case 'mock':
          testConfig = this.createMockConfig();
          break;
        default:
          return { success: false, error: `Unknown provider: ${provider}` };
      }

      // Create a temporary orchestrator for testing
      const testOrchestrator = new AIServiceOrchestrator(this.logger);
      const testConfigs = new Map([[provider, testConfig]]);
      
      await testOrchestrator.initialize(testConfigs);
      
      // Test with a simple completion
      await testOrchestrator.generateCompletion('Test', { maxTokens: 10 });
      
      await testOrchestrator.dispose();
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get current settings
   */
  getSettings(): AIServiceSettings {
    return { ...this.settings };
  }

  /**
   * Dispose of the AI service and cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.dispose();
      this.orchestrator = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  // Private helper methods

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private shouldIncludeProvider(provider: AIProvider): boolean {
    if (provider === this.settings.primaryProvider) {
      return true;
    }
    
    if (this.settings.fallbackProviders.includes(provider)) {
      return true;
    }

    // Include mock if it's enabled and no other providers are configured
    if (provider === 'mock' && this.settings.mockConfig.enabled) {
      const hasOtherProviders = this.settings.primaryProvider !== 'mock' || 
                               this.settings.fallbackProviders.some(p => p !== 'mock');
      return !hasOtherProviders;
    }

    return false;
  }

  private createOpenAIConfig(): AIModelConfig {
    return {
      name: 'openai',
      type: 'cloud' as AIModelType,
      endpoint: this.settings.openaiConfig.endpoint,
      apiKey: this.settings.openaiConfig.apiKey,
      model: this.settings.openaiConfig.model,
      maxTokens: this.settings.openaiConfig.maxTokens,
      temperature: this.settings.openaiConfig.temperature,
      timeout: this.settings.requestTimeout,
      retryAttempts: this.settings.maxRetries,
    };
  }

  private createOllamaConfig(): AIModelConfig {
    return {
      name: 'ollama',
      type: 'local' as AIModelType,
      endpoint: this.settings.ollamaConfig.endpoint,
      model: this.settings.ollamaConfig.model,
      maxTokens: this.settings.ollamaConfig.maxTokens,
      temperature: this.settings.ollamaConfig.temperature,
      timeout: this.settings.requestTimeout,
      retryAttempts: this.settings.maxRetries,
    };
  }

  private createMockConfig(): AIModelConfig {
    return {
      name: 'mock',
      type: 'local' as AIModelType,
      model: 'mock-model',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: this.settings.requestTimeout,
      retryAttempts: this.settings.maxRetries,
      customParameters: {
        simulateDelay: this.settings.mockConfig.simulateDelay,
        averageDelay: this.settings.mockConfig.averageDelay,
      },
    };
  }

  private settingsRequireReinitialization(
    oldSettings: AIServiceSettings,
    newSettings: AIServiceSettings
  ): boolean {
    // Check if any critical settings changed that require reinitialization
    const criticalFields = [
      'enableAI',
      'primaryProvider',
      'fallbackProviders',
      'privacyLevel',
      'preferLocalModels',
      'openaiConfig',
      'ollamaConfig',
      'mockConfig',
    ];

    for (const field of criticalFields) {
      if (JSON.stringify(oldSettings[field as keyof AIServiceSettings]) !== 
          JSON.stringify(newSettings[field as keyof AIServiceSettings])) {
        return true;
      }
    }

    return false;
  }
} 