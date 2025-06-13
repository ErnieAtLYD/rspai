import { Logger } from './logger';
import {
  AIModelAdapter,
  AIModelConfig,
  AIModelFactory,
  AIError,
  AIErrorType
} from './ai-interfaces';

// Import concrete adapter implementations
import { OpenAIAdapter } from './openai-adapter';
import { OllamaAdapter } from './ollama-adapter';
import { MockAIAdapter } from './mock-ai-adapter';

/**
 * Registry of available AI model adapters
 */
interface AdapterConstructor {
  new (logger: Logger, config: AIModelConfig): AIModelAdapter;
}

/**
 * Factory for creating AI model adapters
 */
export class DefaultAIModelFactory implements AIModelFactory {
  private adapters: Map<string, AdapterConstructor> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.registerBuiltInAdapters();
  }

  /**
   * Register built-in adapters
   */
  private registerBuiltInAdapters(): void {
    // Register adapters as they become available
    this.registerAdapter('openai', OpenAIAdapter);
    this.registerAdapter('ollama', OllamaAdapter);
    this.registerAdapter('mock', MockAIAdapter);
    
    this.logger.debug('Built-in AI adapters registered');
  }

  /**
   * Register a new adapter type
   */
  registerAdapter(name: string, adapterClass: AdapterConstructor): void {
    this.adapters.set(name.toLowerCase(), adapterClass);
    this.logger.debug(`Registered AI adapter: ${name}`);
  }

  /**
   * Unregister an adapter type
   */
  unregisterAdapter(name: string): boolean {
    const removed = this.adapters.delete(name.toLowerCase());
    if (removed) {
      this.logger.debug(`Unregistered AI adapter: ${name}`);
    }
    return removed;
  }

  /**
   * Create a model adapter instance
   */
  async createModel(config: AIModelConfig): Promise<AIModelAdapter> {
    try {
      this.logger.debug(`Creating AI model adapter`, { 
        name: config.name, 
        type: config.type 
      });

      // Validate configuration
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        throw new AIError(
          AIErrorType.INVALID_CONFIG,
          `Invalid configuration: ${validation.errors.join(', ')}`
        );
      }

      // Determine adapter type
      const adapterType = this.determineAdapterType(config);
      
      // Get adapter constructor
      const AdapterClass = this.adapters.get(adapterType);
      if (!AdapterClass) {
        throw new AIError(
          AIErrorType.INVALID_CONFIG,
          `No adapter available for type: ${adapterType}`
        );
      }

      // Create adapter instance
      const adapter = new AdapterClass(this.logger, config);

      this.logger.info(`Created AI model adapter: ${config.name} (${adapterType})`);
      return adapter;

    } catch (error) {
      this.logger.error(`Failed to create AI model adapter`, error);
      
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        `Failed to create model adapter: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Get available model types
   */
  async getAvailableModels(): Promise<string[]> {
    return Array.from(this.adapters.keys());
  }

  /**
   * Validate model configuration
   */
  async validateConfig(config: AIModelConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Required fields
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Model name is required');
    }

    if (!config.type) {
      errors.push('Model type is required');
    }

    // Type-specific validation
    if (config.type === 'cloud') {
      if (!config.endpoint && !this.hasBuiltInEndpoint(config)) {
        errors.push('Cloud models require an endpoint or built-in service configuration');
      }
    }

    if (config.type === 'local') {
      if (!config.endpoint) {
        errors.push('Local models require an endpoint');
      }
    }

    // Numeric validations
    if (config.maxTokens !== undefined && (config.maxTokens <= 0 || config.maxTokens > 100000)) {
      errors.push('maxTokens must be between 1 and 100000');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push('timeout must be positive');
    }

    if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
      errors.push('retryAttempts must be non-negative');
    }

    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      errors.push('retryDelay must be non-negative');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Determine the appropriate adapter type for a configuration
   */
  private determineAdapterType(config: AIModelConfig): string {
    // If model is specified, use it as adapter type
    if (config.model) {
      return config.model.toLowerCase();
    }

    // Fallback to type-based determination
    if (config.type === 'local') {
      // Default local adapter (could be ollama, llama.cpp, etc.)
      return 'ollama'; // Default to ollama for local
    }

    if (config.type === 'cloud') {
      // Determine cloud provider from endpoint or name
      if (config.endpoint) {
        const endpoint = config.endpoint.toLowerCase();
        if (endpoint.includes('openai')) return 'openai';
        if (endpoint.includes('anthropic')) return 'anthropic';
        if (endpoint.includes('google')) return 'google';
        if (endpoint.includes('azure')) return 'azure';
      }
      
      // Default cloud adapter
      return 'openai';
    }

    // Fallback
    return 'mock';
  }

  /**
   * Check if a configuration has built-in endpoint support
   */
  private hasBuiltInEndpoint(config: AIModelConfig): boolean {
    if (!config.model) return false;
    
    const model = config.model.toLowerCase();
    
    // Known cloud services with built-in endpoints
    const builtInServices = [
      'openai',
      'anthropic',
      'google',
      'azure-openai',
      'cohere',
      'huggingface'
    ];

    return builtInServices.includes(model);
  }

  /**
   * Create a configuration template for a specific adapter type
   */
  createConfigTemplate(adapterType: string): Partial<AIModelConfig> {
    const baseTemplate: Partial<AIModelConfig> = {
      name: `${adapterType}-model`,
      type: adapterType === 'ollama' ? 'local' : 'cloud',
      model: adapterType,
      maxTokens: 1000,
      temperature: 0.7,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    };

    switch (adapterType.toLowerCase()) {
      case 'openai':
        return {
          ...baseTemplate,
          endpoint: 'https://api.openai.com/v1',
          model: 'gpt-3.5-turbo'
        };

      case 'anthropic':
        return {
          ...baseTemplate,
          endpoint: 'https://api.anthropic.com/v1',
          model: 'claude-3-sonnet-20240229'
        };

      case 'ollama':
        return {
          ...baseTemplate,
          type: 'local',
          endpoint: 'http://localhost:11434',
          model: 'llama2'
        };

      case 'azure':
        return {
          ...baseTemplate,
          endpoint: 'https://your-resource.openai.azure.com',
          model: 'gpt-35-turbo'
        };

      case 'mock':
        return {
          ...baseTemplate,
          type: 'local',
          endpoint: 'mock://localhost',
          model: 'mock-model'
        };

      default:
        return baseTemplate;
    }
  }

  /**
   * Get detailed information about an adapter type
   */
  getAdapterInfo(adapterType: string): {
    name: string;
    description: string;
    type: 'local' | 'cloud';
    requiresApiKey: boolean;
    defaultEndpoint?: string;
    supportedCapabilities: string[];
  } | null {
    switch (adapterType.toLowerCase()) {
      case 'openai':
        return {
          name: 'OpenAI',
          description: 'OpenAI GPT models via API',
          type: 'cloud',
          requiresApiKey: true,
          defaultEndpoint: 'https://api.openai.com/v1',
          supportedCapabilities: [
            'text-completion',
            'pattern-extraction',
            'summarization',
            'sentiment-analysis',
            'classification',
            'question-answering'
          ]
        };

      case 'anthropic':
        return {
          name: 'Anthropic',
          description: 'Anthropic Claude models via API',
          type: 'cloud',
          requiresApiKey: true,
          defaultEndpoint: 'https://api.anthropic.com/v1',
          supportedCapabilities: [
            'text-completion',
            'pattern-extraction',
            'summarization',
            'sentiment-analysis',
            'classification',
            'question-answering'
          ]
        };

      case 'ollama':
        return {
          name: 'Ollama',
          description: 'Local models via Ollama',
          type: 'local',
          requiresApiKey: false,
          defaultEndpoint: 'http://localhost:11434',
          supportedCapabilities: [
            'text-completion',
            'pattern-extraction',
            'summarization',
            'classification'
          ]
        };

      case 'mock':
        return {
          name: 'Mock',
          description: 'Mock adapter for testing',
          type: 'local',
          requiresApiKey: false,
          defaultEndpoint: 'mock://localhost',
          supportedCapabilities: [
            'text-completion',
            'pattern-extraction',
            'summarization',
            'sentiment-analysis',
            'classification',
            'question-answering'
          ]
        };

      default:
        return null;
    }
  }

  /**
   * Test if an adapter type is available
   */
  isAdapterAvailable(adapterType: string): boolean {
    return this.adapters.has(adapterType.toLowerCase());
  }

  /**
   * Get factory statistics
   */
  getStatistics(): {
    registeredAdapters: number;
    availableTypes: string[];
    lastActivity: Date;
  } {
    return {
      registeredAdapters: this.adapters.size,
      availableTypes: Array.from(this.adapters.keys()),
      lastActivity: new Date()
    };
  }
}

/**
 * Singleton factory instance
 */
let factoryInstance: DefaultAIModelFactory | null = null;

/**
 * Get the singleton factory instance
 */
export function getAIModelFactory(logger?: Logger): DefaultAIModelFactory {
  if (!factoryInstance) {
    if (!logger) {
      throw new Error('Logger is required for first factory initialization');
    }
    factoryInstance = new DefaultAIModelFactory(logger);
  }
  return factoryInstance;
}

/**
 * Reset the factory instance (useful for testing)
 */
export function resetAIModelFactory(): void {
  factoryInstance = null;
} 