# AI Model Integration Architecture

A comprehensive TypeScript framework for integrating and managing multiple AI models through a unified interface with plugin architecture, error handling, and performance monitoring.

## Table of Contents

- [Overview](#overview)
- [Core Architecture](#core-architecture)
- [Component Details](#component-details)
- [Plugin System](#plugin-system)
- [Error Handling & Fallbacks](#error-handling--fallbacks)
- [Performance Monitoring](#performance-monitoring)
- [Usage Examples](#usage-examples)
- [Extending the System](#extending-the-system)

## Overview

This architecture provides a unified interface for working with various AI models (Ollama, Llama.cpp, OpenAI, etc.) while maintaining type safety, error resilience, and performance monitoring. The system is built around several key principles:

- **Abstraction**: Common interface for all model providers
- **Extensibility**: Plugin architecture for easy addition of new models
- **Reliability**: Comprehensive error handling and fallback mechanisms
- **Observability**: Built-in performance metrics and logging
- **Type Safety**: Full TypeScript support with comprehensive interfaces

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AIModelManager                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Unified API Layer                       │    │
│  │  • inference()                                          │    │
│  │  • streamInference()                                    │    │
│  │  • getModelHealth()                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ PluginRegistry  │  │  ModelRegistry  │  │MetricsCollector │  │
│  │                 │  │                 │  │                 │  │
│  │ • Plugin Mgmt   │  │ • Model Metadata│  │ • Performance   │  │
│  │ • Validation    │  │ • Configuration │  │ • Error Tracking│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Plugin Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  OllamaPlugin   │  │ LlamaCppPlugin  │  │   CustomPlugin  │  │
│  │                 │  │                 │  │                 │  │
│  │ • createAdapter │  │ • createAdapter │  │ • createAdapter │  │
│  │ • validateConfig│  │ • validateConfig│  │ • validateConfig│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Adapter Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ OllamaAdapter   │  │LlamaCppAdapter  │  │  CustomAdapter  │  │
│  │                 │  │                 │  │                 │  │
│  │ • initialize()  │  │ • initialize()  │  │ • initialize()  │  │
│  │ • inference()   │  │ • inference()   │  │ • inference()   │  │
│  │ • stream*()     │  │ • stream*()     │  │ • stream*()     │  │
│  │ • getHealth()   │  │ • getHealth()   │  │ • getHealth()   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Model Provider APIs                          │
│     Ollama API          Llama.cpp API        Custom APIs        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Core Interfaces

#### ModelMetadata
Defines the essential information about each AI model:

```typescript
interface ModelMetadata {
  id: string;              // Unique identifier
  name: string;            // Human-readable name
  version: string;         // Model version
  provider: string;        // Provider (ollama, llamacpp, etc.)
  capabilities: ModelCapabilities;
  contextLength: number;   // Maximum context size
  parameters?: Record<string, any>;
  tags: string[];         // Categorization tags
}
```

#### ModelCapabilities
Describes what the model can do:

```typescript
interface ModelCapabilities {
  textGeneration: boolean;
  chatCompletion: boolean;
  embedding: boolean;
  codeGeneration: boolean;
  imageGeneration: boolean;
  streamingSupport: boolean;
}
```

#### InferenceRequest & Response
Standardized request/response format:

```typescript
interface InferenceRequest {
  model: string;
  prompt?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  parameters?: Record<string, any>;
}

interface InferenceResponse {
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
```

### BaseModelAdapter Abstract Class

The foundation for all model adapters:

```typescript
abstract class BaseModelAdapter {
  abstract initialize(): Promise<void>;
  abstract inference(request: InferenceRequest): Promise<InferenceResponse>;
  abstract streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk>;
  abstract isAvailable(): Promise<boolean>;
  abstract getHealth(): Promise<HealthStatus>;
  abstract shutdown(): Promise<void>;
}
```

**Key Methods:**
- `initialize()`: Set up the adapter and verify model availability
- `inference()`: Perform synchronous inference
- `streamInference()`: Perform streaming inference using async generators
- `isAvailable()`: Check if the model is currently accessible
- `getHealth()`: Get detailed health status
- `shutdown()`: Clean up resources

### Async Generators Explained

The `streamInference()` method uses async generators (`async function*`) to handle streaming responses:

```typescript
async function* streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk> {
  // Make streaming request
  const response = await fetch('/api/stream', options);
  const reader = response.body?.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Process chunk and yield immediately
    const chunk = processChunk(value);
    yield chunk; // Sends data to caller right away
  }
}
```

This allows real-time processing of AI responses as they're generated, rather than waiting for the complete response.

## Plugin System

### ModelPlugin Interface

Plugins encapsulate the logic for creating and configuring adapters:

```typescript
interface ModelPlugin {
  name: string;
  version: string;
  supportedProviders: string[];
  createAdapter(metadata: ModelMetadata, config: Record<string, any>): BaseModelAdapter;
  validateConfig(config: Record<string, any>): boolean;
  getDefaultConfig(): Record<string, any>;
}
```

### PluginRegistry

Manages plugin lifecycle and discovery:

```typescript
class PluginRegistry {
  registerPlugin(plugin: ModelPlugin): void;
  unregisterPlugin(name: string): void;
  getPlugin(name: string): ModelPlugin | undefined;
  getPluginsForProvider(provider: string): ModelPlugin[];
}
```

### Built-in Plugins

#### OllamaPlugin
Handles integration with Ollama models:
- Connects to Ollama API (default: `http://localhost:11434`)
- Supports both streaming and non-streaming inference
- Validates model availability through `/api/tags` endpoint

#### LlamaCppPlugin
Handles integration with Llama.cpp server:
- Connects to Llama.cpp API (default: `http://localhost:8080`)
- Supports streaming via Server-Sent Events
- Health checks through `/health` endpoint

## Error Handling & Fallbacks

### Multi-Layer Error Handling

1. **Adapter Level**: Each adapter handles provider-specific errors
2. **Manager Level**: Automatic fallback to alternative models
3. **Request Level**: Retry mechanisms and graceful degradation

### Fallback Configuration

```typescript
interface ModelConfiguration {
  modelId: string;
  provider: string;
  config: Record<string, any>;
  fallbackModels?: string[];  // Automatic fallbacks
  priority: number;           // Selection priority
  enabled: boolean;
}
```

### Error Flow

```
Request → Primary Model → [Error] → Fallback Model 1 → [Error] → Fallback Model 2 → Success/Failure
```

## Performance Monitoring

### MetricsCollector Interface

Tracks performance and reliability metrics:

```typescript
interface MetricsCollector {
  recordRequest(modelId: string, latency: number, tokensPerSecond: number): void;
  recordError(modelId: string, error: Error): void;
  getMetrics(modelId: string, timeRange?: TimeRange): ModelPerformanceMetrics[];
  getAggregatedMetrics(modelId: string): AggregatedMetrics;
}
```

### Tracked Metrics

- **Latency**: Request response time
- **Throughput**: Tokens generated per second
- **Error Rate**: Percentage of failed requests
- **Availability**: Model uptime statistics
- **Resource Usage**: Memory and CPU utilization (when available)

### InMemoryMetricsCollector

Default implementation that stores metrics in memory:
- Automatically records metrics for all requests
- Provides aggregated statistics
- Memory-efficient with rolling window storage

## Usage Examples

### Basic Setup

```typescript
import { AIModelManager, createExampleSetup } from './ai-model-system';

// Create manager with pre-configured models
const manager = await createExampleSetup();

// Or create custom setup
const customManager = new AIModelManager();
customManager.registerModel(modelMetadata, configuration);
```

### Simple Inference

```typescript
const response = await manager.inference({
  model: 'llama2:7b',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 200,
  temperature: 0.7
});

console.log(response.content);
console.log('Tokens used:', response.usage.totalTokens);
```

### Streaming Inference

```typescript
// Real-time streaming like ChatGPT
for await (const chunk of manager.streamInference({
  model: 'llama2:7b',
  prompt: 'Write a short story about space exploration',
  maxTokens: 500
})) {
  process.stdout.write(chunk.content);
  if (chunk.isComplete) {
    console.log('\n[Stream complete]');
    break;
  }
}
```

### Chat Completion

```typescript
const chatResponse = await manager.inference({
  model: 'llama2:7b',
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'How do I sort an array in JavaScript?' }
  ],
  maxTokens: 300
});
```

### Health Monitoring

```typescript
// Check individual model health
const health = await manager.getModelHealth('llama2:7b');
console.log('Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy'

// Get performance metrics
const metrics = manager.getModelMetrics('llama2:7b');
console.log('Average latency:', metrics.averageLatency, 'ms');
console.log('Tokens per second:', metrics.averageTokensPerSecond);
console.log('Error rate:', metrics.errorRate, '%');
```

### Model Discovery

```typescript
// Get all available models
const models = manager.getAvailableModels();

// Filter by capability
const chatModels = manager.getModelRegistry()
  .getModelsByCapability('chatCompletion');

// Filter by provider
const ollamaModels = manager.getModelRegistry()
  .getModelsByProvider('ollama');
```

## Extending the System

### Adding a New Model Provider

1. **Create Adapter Class**:

```typescript
class OpenAIAdapter extends BaseModelAdapter {
  private apiKey: string;
  
  constructor(metadata: ModelMetadata, config: { apiKey: string }) {
    super(metadata, config);
    this.apiKey = config.apiKey;
  }

  async initialize(): Promise<void> {
    // Verify API key and model availability
  }

  async inference(request: InferenceRequest): Promise<InferenceResponse> {
    // Implement OpenAI API integration
  }

  async* streamInference(request: InferenceRequest): AsyncGenerator<StreamChunk> {
    // Implement streaming via OpenAI's stream API
  }

  // Implement other required methods...
}
```

2. **Create Plugin**:

```typescript
const OpenAIPlugin: ModelPlugin = {
  name: 'openai',
  version: '1.0.0',
  supportedProviders: ['openai'],
  createAdapter: (metadata, config) => new OpenAIAdapter(metadata, config),
  validateConfig: (config) => typeof config.apiKey === 'string',
  getDefaultConfig: () => ({ apiKey: '' })
};
```

3. **Register Plugin**:

```typescript
manager.registerPlugin(OpenAIPlugin);

// Register models using the new plugin
manager.registerModel(gpt4Metadata, {
  modelId: 'gpt-4',
  provider: 'openai',
  config: { apiKey: 'your-api-key' },
  priority: 1,
  enabled: true
});
```

### Custom Metrics Collector

```typescript
class DatabaseMetricsCollector implements MetricsCollector {
  constructor(private db: Database) {}

  recordRequest(modelId: string, latency: number, tokensPerSecond: number): void {
    this.db.insert('metrics', {
      model_id: modelId,
      timestamp: new Date(),
      latency,
      tokens_per_second: tokensPerSecond
    });
  }

  // Implement other methods...
}

// Use custom collector
const manager = new AIModelManager(new DatabaseMetricsCollector(db));
```

### Advanced Configuration

```typescript
// Register models with complex fallback chains
manager.registerModel(primaryModel, {
  modelId: 'primary-model',
  provider: 'ollama',
  config: { baseUrl: 'http://localhost:11434' },
  fallbackModels: ['secondary-model', 'tertiary-model'],
  priority: 1,
  enabled: true
});

// Dynamic model switching based on load
const modelToUse = await selectOptimalModel(availableModels, currentLoad);
const response = await manager.inference({
  model: modelToUse,
  prompt: userPrompt
});
```

## Best Practices

### Model Configuration
- Always define fallback models for critical applications
- Use appropriate priority ordering for model selection
- Implement proper health checks for all models

### Error Handling
- Design for graceful degradation when models are unavailable
- Log errors comprehensively for debugging
- Implement circuit breaker patterns for unstable models

### Performance Optimization
- Monitor metrics regularly to identify bottlenecks
- Use streaming for long-form content generation
- Implement caching for repeated requests when appropriate

### Security Considerations
- Validate all configuration inputs
- Secure API keys and authentication tokens
- Implement rate limiting and request validation

This architecture provides a robust foundation for building AI applications that can work with multiple model providers while maintaining reliability, performance, and extensibility.

# Unified AI Model Interface Design

**Document Version:** 1.0  
**Design Date:** 2025-06-20  
**Task:** 7.4.2 - Design Unified AI Model Interface  
**Status:** ✅ Complete

## Executive Summary

The Unified AI Model Interface successfully bridges the existing dual interface systems in the RetrospectAI plugin, providing backward compatibility while enabling advanced AI capabilities. This design consolidates the simple `ai-interfaces.ts` system with the comprehensive `unified-ai-interfaces.ts` system into a single, extensible interface.

## Design Objectives

### Primary Goals
- **Backward Compatibility**: Maintain all existing functionality from the simple interface system
- **Advanced Features**: Enable comprehensive AI capabilities from the unified system
- **Extensibility**: Support future AI model types and capabilities
- **Migration Path**: Provide smooth transition from legacy to unified system
- **Type Safety**: Ensure comprehensive TypeScript support

### Key Design Principles
- **Interface Segregation**: Separate legacy and modern methods clearly
- **Provider Agnostic**: Support multiple AI providers through unified interface
- **Capability Detection**: Dynamic capability discovery and validation
- **Performance Optimization**: Built-in caching, batching, and streaming support

## Interface Architecture

### Core Interface Hierarchy

```typescript
UnifiedAIModelAdapter (Main Interface)
├── Basic Properties (name, description, type, etc.)
├── Lifecycle Methods (initialize, dispose, health checks)
├── Legacy Compatibility Methods (deprecated but functional)
├── Unified Processing Methods (new standard)
├── Enhanced Capabilities (validation, cost estimation)
└── Advanced Features (embeddings, fine-tuning - optional)
```

### Configuration System

**UnifiedModelConfig** bridges both configuration systems:
- **Basic Configuration**: Simple settings from `ai-interfaces.ts`
- **Advanced Configuration**: Comprehensive settings from `unified-ai-interfaces.ts`
- **Performance Settings**: Caching, batching, resilience configuration
- **Monitoring**: Metrics, logging, observability settings

## Key Interface Components

### 1. UnifiedAIModelAdapter Interface

**Core Properties:**
- `name`, `description`, `type` - Basic adapter identification
- `privacyLevel` - Privacy classification (local, cloud, hybrid)
- `capabilities` - Supported AI capabilities array
- `config` - Unified configuration object

**Lifecycle Methods:**
- `initialize()` - Adapter initialization
- `isAvailable()` - Health check
- `getHealth()` - Detailed health status
- `dispose()` - Resource cleanup

**Legacy Compatibility Methods (Deprecated):**
- `generateCompletion()` - Simple text completion
- `extractPatterns()` - Pattern detection
- `generateSummary()` - Content summarization
- `analyzeContent()` - General content analysis
- `classifyContent()` - Content classification
- `analyzeSentiment()` - Sentiment analysis

**Unified Processing Methods (New Standard):**
- `processRequest()` - Primary structured request processing
- `processBatch()` - Batch request processing
- `processStream()` - Streaming response processing

**Enhanced Capabilities:**
- `getCapabilities()` - Dynamic capability discovery
- `validateRequest()` - Request validation
- `estimateCost()` - Cost estimation
- `getModelInfo()` - Model metadata
- `updateConfig()` - Configuration updates

**Advanced Features (Optional):**
- `createEmbeddings()` - Text embedding generation
- `fineTune()` - Model fine-tuning
- `getFineTuningStatus()` - Fine-tuning job status
- `cancelFineTuning()` - Fine-tuning cancellation

### 2. UnifiedModelConfig Interface

**Basic Configuration (ai-interfaces.ts compatibility):**
```typescript
{
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
}
```

**Advanced Configuration (unified-ai-interfaces.ts features):**
```typescript
{
  provider?: AIProviderType;
  deploymentType?: AIDeploymentType;
  privacyLevel?: AIPrivacyLevel;
  capabilities?: AICapability[];
  defaultRequestConfig?: AIRequestConfig;
  defaultGenerationParams?: AIGenerationParameters;
}
```

**Performance & Resilience Settings:**
```typescript
{
  enableCaching?: boolean;
  cacheTTL?: number;
  enableBatching?: boolean;
  maxBatchSize?: number;
  circuitBreakerConfig?: CircuitBreakerConfig;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

### 3. Legacy Compatibility System

**LegacyCompletionOptions**: Maps old completion options to new generation parameters
**LegacyAnalysisResult**: Maintains backward compatibility for analysis results
**DetectedPattern**: Preserves existing pattern detection structure

**Migration Utilities:**
- `convertLegacyOptions()` - Options conversion
- `convertPromptToMessage()` - Prompt to message format
- `convertToLegacyAnalysis()` - Response format conversion

### 4. Advanced Feature Interfaces

**Embedding Support:**
- `EmbeddingOptions` - Embedding generation configuration
- `EmbeddingResponse` - Structured embedding results

**Fine-Tuning Support:**
- `FineTuningData` - Training data specification
- `FineTuningOptions` - Fine-tuning configuration
- `FineTuningJob` - Job status and metadata

**Type Guards:**
- `supportsEmbeddings()` - Check embedding capability
- `supportsFineTuning()` - Check fine-tuning capability

## Implementation Benefits

### 1. Backward Compatibility
- **Zero Breaking Changes**: All existing code continues to work
- **Gradual Migration**: Developers can migrate incrementally
- **Legacy Support**: Deprecated methods remain functional

### 2. Advanced Capabilities
- **Structured Processing**: Rich request/response objects
- **Batch Operations**: Efficient multi-request processing
- **Streaming Support**: Real-time response handling
- **Cost Management**: Built-in cost estimation and tracking

### 3. Extensibility
- **Provider Agnostic**: Support for any AI provider
- **Capability Detection**: Dynamic feature discovery
- **Plugin Architecture**: Custom adapter registration
- **Future-Proof**: Easy addition of new capabilities

### 4. Developer Experience
- **Type Safety**: Comprehensive TypeScript support
- **Clear Migration Path**: Utilities for legacy conversion
- **Rich Metadata**: Detailed model and capability information
- **Performance Monitoring**: Built-in metrics and observability

## Integration with Existing Systems

### Current Architecture Compatibility
- **AI Service Orchestrator**: Can use both legacy and unified methods
- **Existing Adapters**: Maintain current functionality
- **Plugin Registry**: Enhanced with unified adapter support
- **Resilience Manager**: Integrated with unified processing

### Migration Strategy
1. **Phase 1**: Deploy unified interface alongside existing interfaces
2. **Phase 2**: Update orchestrator to use unified methods for new features
3. **Phase 3**: Gradually migrate existing adapters to unified interface
4. **Phase 4**: Deprecate legacy methods (maintain for compatibility)

## Future Enhancements

### Planned Extensions
- **Multi-Modal Support**: Vision, audio, document processing
- **Custom Tool Integration**: Function calling and tool use
- **Advanced Streaming**: Server-sent events, WebSocket support
- **Distributed Processing**: Multi-node adapter coordination

### Extensibility Points
- **Custom Capabilities**: Plugin-defined AI capabilities
- **Provider Extensions**: Custom provider implementations
- **Middleware System**: Request/response transformation pipeline
- **Observability Hooks**: Custom metrics and monitoring integration

## Conclusion

The Unified AI Model Interface successfully addresses the dual interface system challenge by providing a comprehensive, backward-compatible solution that enables advanced AI capabilities while maintaining existing functionality. The design supports seamless migration, extensive customization, and future extensibility, making it a robust foundation for the RetrospectAI plugin's AI abstraction layer.

**Key Achievements:**
- ✅ Backward compatibility maintained
- ✅ Advanced features enabled
- ✅ Extensible architecture implemented
- ✅ Type-safe interface design
- ✅ Migration utilities provided
- ✅ Performance optimizations included
- ✅ Future-proof extensibility points defined

This interface design provides the foundation for the next phases of the AI Model Abstraction Layer implementation.

