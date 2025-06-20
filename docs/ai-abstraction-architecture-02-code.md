// ============================================================================
// Core Interfaces and Types
// ============================================================================

export interface ModelCapabilities {
  textGeneration: boolean;
  chatCompletion: boolean;
  embedding: boolean;
  codeGeneration: boolean;
  imageGeneration: boolean;
  streamingSupport: boolean;
}

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  provider: string;
  description?: string;
  capabilities: ModelCapabilities;
  contextLength: number;
  parameters?: Record<string, any>;
  tags: string[];
}

export interface InferenceRequest {
  model: string;
  prompt?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  parameters?: Record<string, any>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface InferenceResponse {
  id: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface StreamChunk {
  id: string;
  content: string;
  isComplete: boolean;
  metadata?: Record<string, any>;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  timestamp: Date;
  requestLatency: number;
  tokensPerSecond: number;
  errorRate: number;
  memoryUsage?: number;
  requestCount: number;
}

// ============================================================================
// Abstract Base Classes
// ============================================================================

export abstract class BaseModelAdapter {
  protected metadata: ModelMetadata;
  protected config: Record<string, any>;

  constructor(metadata: ModelMetadata, config: Record<string, any> = {}) {
    this.metadata = metadata;
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract inference(request: InferenceRequest): Promise<InferenceResponse>;
  abstract streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk>;
  abstract isAvailable(): Promise<boolean>;
  abstract getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: string }>;
  abstract shutdown(): Promise<void>;

  getMetadata(): ModelMetadata {
    return { ...this.metadata };
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<Record<string, any>>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// ============================================================================
// Model Adapters Implementation
// ============================================================================

export class OllamaAdapter extends BaseModelAdapter {
  private baseUrl: string;
  private httpClient: fetch;

  constructor(metadata: ModelMetadata, config: { baseUrl?: string } = {}) {
    super(metadata, config);
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.httpClient = fetch;
  }

  async initialize(): Promise<void> {
    try {
      const response = await this.httpClient(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama server not available: ${response.statusText}`);
      }
      
      const data = await response.json();
      const modelExists = data.models?.some((m: any) => m.name === this.metadata.id);
      
      if (!modelExists) {
        throw new Error(`Model ${this.metadata.id} not found in Ollama`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize Ollama adapter: ${error}`);
    }
  }

  async inference(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    
    try {
      const payload = {
        model: this.metadata.id,
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature,
          top_p: request.topP,
          num_predict: request.maxTokens,
          ...request.parameters
        }
      };

      const response = await this.httpClient(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        id: `ollama-${Date.now()}`,
        model: this.metadata.id,
        content: data.response || '',
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        metadata: { latency, ollamaData: data }
      };
    } catch (error) {
      throw new Error(`Ollama inference failed: ${error}`);
    }
  }

  async* streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk> {
    const payload = {
      model: this.metadata.id,
      prompt: request.prompt,
      stream: true,
      options: {
        temperature: request.temperature,
        top_p: request.topP,
        num_predict: request.maxTokens,
        ...request.parameters
      }
    };

    const response = await this.httpClient(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ollama streaming API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body reader available');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              yield {
                id: `ollama-stream-${Date.now()}`,
                content: data.response || '',
                isComplete: data.done || false,
                metadata: { ollamaData: data }
              };
            } catch (e) {
              console.warn('Failed to parse streaming response:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.httpClient(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: string }> {
    try {
      const available = await this.isAvailable();
      return available 
        ? { status: 'healthy' }
        : { status: 'unhealthy', details: 'Ollama server not responding' };
    } catch (error) {
      return { status: 'unhealthy', details: `Health check failed: ${error}` };
    }
  }

  async shutdown(): Promise<void> {
    // Ollama doesn't require explicit shutdown
  }
}

export class LlamaCppAdapter extends BaseModelAdapter {
  private baseUrl: string;
  private httpClient: fetch;

  constructor(metadata: ModelMetadata, config: { baseUrl?: string } = {}) {
    super(metadata, config);
    this.baseUrl = config.baseUrl || 'http://localhost:8080';
    this.httpClient = fetch;
  }

  async initialize(): Promise<void> {
    try {
      const response = await this.httpClient(`${this.baseUrl}/health`);
      if (!response.ok) {
        throw new Error(`Llama.cpp server not available: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize Llama.cpp adapter: ${error}`);
    }
  }

  async inference(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    
    try {
      const payload = {
        prompt: request.prompt,
        n_predict: request.maxTokens || 128,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 0.95,
        stream: false,
        ...request.parameters
      };

      const response = await this.httpClient(`${this.baseUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Llama.cpp API error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        id: `llamacpp-${Date.now()}`,
        model: this.metadata.id,
        content: data.content || '',
        finishReason: data.stop ? 'stop' : 'length',
        usage: {
          promptTokens: data.tokens_evaluated || 0,
          completionTokens: data.tokens_predicted || 0,
          totalTokens: (data.tokens_evaluated || 0) + (data.tokens_predicted || 0)
        },
        metadata: { latency, llamaCppData: data }
      };
    } catch (error) {
      throw new Error(`Llama.cpp inference failed: ${error}`);
    }
  }

  async* streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk> {
    const payload = {
      prompt: request.prompt,
      n_predict: request.maxTokens || 128,
      temperature: request.temperature || 0.7,
      top_p: request.topP || 0.95,
      stream: true,
      ...request.parameters
    };

    const response = await this.httpClient(`${this.baseUrl}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Llama.cpp streaming API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body reader available');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              if (jsonStr.trim() === '[DONE]') {
                yield {
                  id: `llamacpp-stream-${Date.now()}`,
                  content: '',
                  isComplete: true
                };
                return;
              }
              
              const data = JSON.parse(jsonStr);
              yield {
                id: `llamacpp-stream-${Date.now()}`,
                content: data.content || '',
                isComplete: data.stop || false,
                metadata: { llamaCppData: data }
              };
            } catch (e) {
              console.warn('Failed to parse streaming response:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.httpClient(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: string }> {
    try {
      const available = await this.isAvailable();
      return available 
        ? { status: 'healthy' }
        : { status: 'unhealthy', details: 'Llama.cpp server not responding' };
    } catch (error) {
      return { status: 'unhealthy', details: `Health check failed: ${error}` };
    }
  }

  async shutdown(): Promise<void> {
    // Llama.cpp doesn't require explicit shutdown
  }
}

// ============================================================================
// Plugin Architecture
// ============================================================================

export interface ModelPlugin {
  name: string;
  version: string;
  supportedProviders: string[];
  createAdapter(metadata: ModelMetadata, config: Record<string, any>): BaseModelAdapter;
  validateConfig(config: Record<string, any>): boolean;
  getDefaultConfig(): Record<string, any>;
}

export class PluginRegistry {
  private plugins = new Map<string, ModelPlugin>();

  registerPlugin(plugin: ModelPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  unregisterPlugin(name: string): void {
    this.plugins.delete(name);
  }

  getPlugin(name: string): ModelPlugin | undefined {
    return this.plugins.get(name);
  }

  getAvailablePlugins(): ModelPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginsForProvider(provider: string): ModelPlugin[] {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.supportedProviders.includes(provider));
  }
}

// Built-in plugins
export const OllamaPlugin: ModelPlugin = {
  name: 'ollama',
  version: '1.0.0',
  supportedProviders: ['ollama'],
  createAdapter: (metadata, config) => new OllamaAdapter(metadata, config),
  validateConfig: (config) => {
    if (config.baseUrl && typeof config.baseUrl !== 'string') return false;
    return true;
  },
  getDefaultConfig: () => ({ baseUrl: 'http://localhost:11434' })
};

export const LlamaCppPlugin: ModelPlugin = {
  name: 'llamacpp',
  version: '1.0.0',
  supportedProviders: ['llamacpp', 'llama.cpp'],
  createAdapter: (metadata, config) => new LlamaCppAdapter(metadata, config),
  validateConfig: (config) => {
    if (config.baseUrl && typeof config.baseUrl !== 'string') return false;
    return true;
  },
  getDefaultConfig: () => ({ baseUrl: 'http://localhost:8080' })
};

// ============================================================================
// Model Selection and Configuration System
// ============================================================================

export interface ModelConfiguration {
  modelId: string;
  provider: string;
  config: Record<string, any>;
  fallbackModels?: string[];
  priority: number;
  enabled: boolean;
}

export class ModelRegistry {
  private models = new Map<string, ModelMetadata>();
  private configurations = new Map<string, ModelConfiguration>();

  registerModel(metadata: ModelMetadata, configuration: ModelConfiguration): void {
    this.models.set(metadata.id, metadata);
    this.configurations.set(metadata.id, configuration);
  }

  unregisterModel(modelId: string): void {
    this.models.delete(modelId);
    this.configurations.delete(modelId);
  }

  getModel(modelId: string): ModelMetadata | undefined {
    return this.models.get(modelId);
  }

  getConfiguration(modelId: string): ModelConfiguration | undefined {
    return this.configurations.get(modelId);
  }

  getAllModels(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  getModelsByProvider(provider: string): ModelMetadata[] {
    return Array.from(this.models.values())
      .filter(model => model.provider === provider);
  }

  getModelsByCapability(capability: keyof ModelCapabilities): ModelMetadata[] {
    return Array.from(this.models.values())
      .filter(model => model.capabilities[capability]);
  }

  updateConfiguration(modelId: string, updates: Partial<ModelConfiguration>): void {
    const existing = this.configurations.get(modelId);
    if (existing) {
      this.configurations.set(modelId, { ...existing, ...updates });
    }
  }
}

// ============================================================================
// Performance Metrics and Logging
// ============================================================================

export interface MetricsCollector {
  recordRequest(modelId: string, latency: number, tokensPerSecond: number): void;
  recordError(modelId: string, error: Error): void;
  getMetrics(modelId: string, timeRange?: { start: Date; end: Date }): ModelPerformanceMetrics[];
  getAggregatedMetrics(modelId: string): {
    averageLatency: number;
    averageTokensPerSecond: number;
    errorRate: number;
    totalRequests: number;
  };
}

export class InMemoryMetricsCollector implements MetricsCollector {
  private metrics: ModelPerformanceMetrics[] = [];
  private requestCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();

  recordRequest(modelId: string, latency: number, tokensPerSecond: number): void {
    const currentCount = this.requestCounts.get(modelId) || 0;
    this.requestCounts.set(modelId, currentCount + 1);

    this.metrics.push({
      modelId,
      timestamp: new Date(),
      requestLatency: latency,
      tokensPerSecond,
      errorRate: this.calculateErrorRate(modelId),
      requestCount: currentCount + 1
    });

    // Keep only last 1000 metrics per model to prevent memory issues
    this.metrics = this.metrics.slice(-1000);
  }

  recordError(modelId: string, error: Error): void {
    const currentErrors = this.errorCounts.get(modelId) || 0;
    this.errorCounts.set(modelId, currentErrors + 1);
  }

  getMetrics(modelId: string, timeRange?: { start: Date; end: Date }): ModelPerformanceMetrics[] {
    let filtered = this.metrics.filter(m => m.modelId === modelId);
    
    if (timeRange) {
      filtered = filtered.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    return filtered;
  }

  getAggregatedMetrics(modelId: string) {
    const modelMetrics = this.metrics.filter(m => m.modelId === modelId);
    
    if (modelMetrics.length === 0) {
      return {
        averageLatency: 0,
        averageTokensPerSecond: 0,
        errorRate: 0,
        totalRequests: 0
      };
    }

    const averageLatency = modelMetrics.reduce((sum, m) => sum + m.requestLatency, 0) / modelMetrics.length;
    const averageTokensPerSecond = modelMetrics.reduce((sum, m) => sum + m.tokensPerSecond, 0) / modelMetrics.length;
    const totalRequests = this.requestCounts.get(modelId) || 0;
    const errorRate = this.calculateErrorRate(modelId);

    return {
      averageLatency,
      averageTokensPerSecond,
      errorRate,
      totalRequests
    };
  }

  private calculateErrorRate(modelId: string): number {
    const errors = this.errorCounts.get(modelId) || 0;
    const requests = this.requestCounts.get(modelId) || 0;
    return requests > 0 ? (errors / requests) * 100 : 0;
  }
}

// ============================================================================
// Unified API Manager
// ============================================================================

export class AIModelManager {
  private pluginRegistry: PluginRegistry;
  private modelRegistry: ModelRegistry;
  private adapters = new Map<string, BaseModelAdapter>();
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector?: MetricsCollector) {
    this.pluginRegistry = new PluginRegistry();
    this.modelRegistry = new ModelRegistry();
    this.metricsCollector = metricsCollector || new InMemoryMetricsCollector();

    // Register built-in plugins
    this.pluginRegistry.registerPlugin(OllamaPlugin);
    this.pluginRegistry.registerPlugin(LlamaCppPlugin);
  }

  async initializeModel(modelId: string): Promise<void> {
    const metadata = this.modelRegistry.getModel(modelId);
    const config = this.modelRegistry.getConfiguration(modelId);

    if (!metadata || !config) {
      throw new Error(`Model ${modelId} not found in registry`);
    }

    const plugin = this.pluginRegistry.getPlugin(config.provider);
    if (!plugin) {
      throw new Error(`No plugin found for provider: ${config.provider}`);
    }

    if (!plugin.validateConfig(config.config)) {
      throw new Error(`Invalid configuration for model ${modelId}`);
    }

    const adapter = plugin.createAdapter(metadata, config.config);
    await adapter.initialize();
    
    this.adapters.set(modelId, adapter);
  }

  async inference(request: InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();
    
    try {
      const adapter = await this.getAdapter(request.model);
      const response = await adapter.inference(request);
      
      // Record metrics
      const latency = Date.now() - startTime;
      const tokensPerSecond = response.usage.completionTokens / (latency / 1000);
      this.metricsCollector.recordRequest(request.model, latency, tokensPerSecond);
      
      return response;
    } catch (error) {
      this.metricsCollector.recordError(request.model, error as Error);
      
      // Try fallback models
      const config = this.modelRegistry.getConfiguration(request.model);
      if (config?.fallbackModels && config.fallbackModels.length > 0) {
        for (const fallbackModel of config.fallbackModels) {
          try {
            const fallbackRequest = { ...request, model: fallbackModel };
            return await this.inference(fallbackRequest);
          } catch (fallbackError) {
            console.warn(`Fallback model ${fallbackModel} also failed:`, fallbackError);
          }
        }
      }
      
      throw error;
    }
  }

  async* streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk> {
    try {
      const adapter = await this.getAdapter(request.model);
      yield* adapter.streamInference(request);
    } catch (error) {
      this.metricsCollector.recordError(request.model, error as Error);
      
      // Try fallback models for streaming
      const config = this.modelRegistry.getConfiguration(request.model);
      if (config?.fallbackModels && config.fallbackModels.length > 0) {
        for (const fallbackModel of config.fallbackModels) {
          try {
            const fallbackRequest = { ...request, model: fallbackModel };
            yield* this.streamInference(fallbackRequest);
            return;
          } catch (fallbackError) {
            console.warn(`Fallback model ${fallbackModel} also failed:`, fallbackError);
          }
        }
      }
      
      throw error;
    }
  }

  private async getAdapter(modelId: string): Promise<BaseModelAdapter> {
    let adapter = this.adapters.get(modelId);
    
    if (!adapter) {
      await this.initializeModel(modelId);
      adapter = this.adapters.get(modelId);
    }
    
    if (!adapter) {
      throw new Error(`Failed to initialize adapter for model: ${modelId}`);
    }

    const isAvailable = await adapter.isAvailable();
    if (!isAvailable) {
      throw new Error(`Model ${modelId} is not available`);
    }

    return adapter;
  }

  async getModelHealth(modelId: string): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details?: string }> {
    try {
      const adapter = await this.getAdapter(modelId);
      return await adapter.getHealth();
    } catch (error) {
      return { status: 'unhealthy', details: `Failed to get health: ${error}` };
    }
  }

  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.adapters.values()).map(adapter => 
      adapter.shutdown().catch(error => console.warn('Error during adapter shutdown:', error))
    );
    
    await Promise.all(shutdownPromises);
    this.adapters.clear();
  }

  // Registry access methods
  registerModel(metadata: ModelMetadata, configuration: ModelConfiguration): void {
    this.modelRegistry.registerModel(metadata, configuration);
  }

  registerPlugin(plugin: ModelPlugin): void {
    this.pluginRegistry.registerPlugin(plugin);
  }

  getAvailableModels(): ModelMetadata[] {
    return this.modelRegistry.getAllModels().filter(model => {
      const config = this.modelRegistry.getConfiguration(model.id);
      return config?.enabled !== false;
    });
  }

  getModelMetrics(modelId: string) {
    return this.metricsCollector.getAggregatedMetrics(modelId);
  }
}

// ============================================================================
// Example Usage and Setup
// ============================================================================

export async function createExampleSetup(): Promise<AIModelManager> {
  const manager = new AIModelManager();

  // Register some example models
  const llamaModel: ModelMetadata = {
    id: 'llama2:7b',
    name: 'Llama 2 7B',
    version: '1.0',
    provider: 'ollama',
    capabilities: {
      textGeneration: true,
      chatCompletion: true,
      embedding: false,
      codeGeneration: false,
      imageGeneration: false,
      streamingSupport: true
    },
    contextLength: 4096,
    tags: ['chat', 'instruct']
  };

  const llamaCppModel: ModelMetadata = {
    id: 'codellama:13b',
    name: 'CodeLlama 13B',
    version: '1.0',
    provider: 'llamacpp',
    capabilities: {
      textGeneration: true,
      chatCompletion: true,
      embedding: false,
      codeGeneration: true,
      imageGeneration: false,
      streamingSupport: true
    },
    contextLength: 16384,
    tags: ['code', 'programming']
  };

  manager.registerModel(llamaModel, {
    modelId: 'llama2:7b',
    provider: 'ollama',
    config: { baseUrl: 'http://localhost:11434' },
    fallbackModels: ['codellama:13b'],
    priority: 1,
    enabled: true
  });

  manager.registerModel(llamaCppModel, {
    modelId: 'codellama:13b',
    provider: 'llamacpp',
    config: { baseUrl: 'http://localhost:8080' },
    priority: 2,
    enabled: true
  });

  return manager;
}

// Example usage:
/*
const manager = await createExampleSetup();

// Simple text generation
const response = await manager.inference({
  model: 'llama2:7b',
  prompt: 'Write a short story about AI',
  maxTokens: 200,
  temperature: 0.7
});

console.log(response.content);

// Streaming inference
for await (const chunk of manager.streamInference({
  model: 'llama2:7b',
  prompt: 'Explain quantum computing',
  maxTokens: 500,
  stream: true
})) {
  process.stdout.write(chunk.content);
  if (chunk.isComplete) break;
}

// Get model performance metrics
const metrics = manager.getModelMetrics('llama2:7b');
console.log('Average latency:', metrics.averageLatency, 'ms');
console.log('Tokens per second:', metrics.averageTokensPerSecond);
console.log('Error rate:', metrics.errorRate, '%');
*/