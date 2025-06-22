import { Logger } from './logger';
import { BaseAIAdapter } from './base-ai-adapter';
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
  PerformanceMetrics
} from './ai-interfaces';
import {
  AIModelRequest,
  AIMessage,
  AIStreamChunk,
  AIStreamCallback,
  AIPrivacyLevel,
  HealthCheckResponse
} from './unified-ai-interfaces';

/**
 * OpenAI API response interfaces
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface OpenAICompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  functions?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;
  function_call?: 'none' | 'auto' | { name: string };
  user?: string;
  seed?: number;
  logprobs?: boolean;
  top_logprobs?: number;
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
    logprobs?: {
      content: Array<{
        token: string;
        logprob: number;
        bytes: number[];
        top_logprobs: Array<{ token: string; logprob: number; bytes: number[] }>;
      }>;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      function_call?: {
        name?: string;
        arguments?: string;
      };
    };
    finish_reason?: string;
  }>;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * OpenAI model configurations with enhanced metadata
 */
const OPENAI_MODELS = {
  'gpt-4': {
    maxTokens: 8192,
    contextWindow: 8192,
    inputCostPer1K: 0.03,
    outputCostPer1K: 0.06,
    capabilities: [
      'text-completion', 'text-generation', 'pattern-extraction', 
      'summarization', 'sentiment-analysis', 'classification', 
      'question-answering', 'function-calling', 'streaming'
    ] as AICapability[]
  },
  'gpt-4-turbo': {
    maxTokens: 4096,
    contextWindow: 128000,
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    capabilities: [
      'text-completion', 'text-generation', 'pattern-extraction', 
      'summarization', 'sentiment-analysis', 'classification', 
      'question-answering', 'function-calling', 'streaming'
    ] as AICapability[]
  },
  'gpt-4-turbo-preview': {
    maxTokens: 4096,
    contextWindow: 128000,
    inputCostPer1K: 0.01,
    outputCostPer1K: 0.03,
    capabilities: [
      'text-completion', 'text-generation', 'pattern-extraction', 
      'summarization', 'sentiment-analysis', 'classification', 
      'question-answering', 'function-calling', 'streaming'
    ] as AICapability[]
  },
  'gpt-3.5-turbo': {
    maxTokens: 4096,
    contextWindow: 16385,
    inputCostPer1K: 0.0015,
    outputCostPer1K: 0.002,
    capabilities: [
      'text-completion', 'text-generation', 'pattern-extraction', 
      'summarization', 'sentiment-analysis', 'classification', 
      'question-answering', 'function-calling', 'streaming'
    ] as AICapability[]
  },
  'gpt-3.5-turbo-16k': {
    maxTokens: 16384,
    contextWindow: 16385,
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.004,
    capabilities: [
      'text-completion', 'text-generation', 'pattern-extraction', 
      'summarization', 'sentiment-analysis', 'classification', 
      'question-answering', 'function-calling', 'streaming'
    ] as AICapability[]
  }
};

/**
 * Enhanced OpenAI adapter for cloud-based AI services
 * Implements both legacy AIModelAdapter and UnifiedAIModelAdapter interfaces
 */
export class OpenAIAdapter extends BaseAIAdapter {
  readonly name = 'OpenAI Adapter';
  readonly description = 'OpenAI GPT models for cloud-based AI processing with streaming and function calling support';
  readonly type: AIModelType = 'cloud';
  readonly privacyLevel: PrivacyLevel = 'cloud';
  readonly capabilities: AICapability[];

  private apiKey: string;
  private baseURL: string;
  private model: string;
  private organization?: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private rateLimitDelay = 1000; // 1 second between requests
  private retryCount = 0;
  private maxRetries = 3;
  
  // Cloud-specific optimizations
  private requestCache = new Map<string, { response: any; timestamp: number; ttl: number }>();
  private performanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    totalTokens: 0,
    cacheHits: 0
  };

  constructor(logger: Logger, config: AIModelConfig) {
    super(logger, config);
    
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = config.endpoint || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-3.5-turbo';
    this.organization = config.customParameters?.organization as string;
    
    // Enhanced configuration validation
    this.maxRetries = config.retryAttempts || 3;
    this.rateLimitDelay = config.retryDelay || 1000;
    
    // Log configuration (without API key)
    this.logger.debug('OpenAI adapter configuration', {
      baseURL: this.baseURL,
      model: this.model,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      organization: this.organization,
      maxRetries: this.maxRetries
    });
    
    // Set capabilities based on model
    const modelConfig = OPENAI_MODELS[this.model as keyof typeof OPENAI_MODELS];
    this.capabilities = modelConfig?.capabilities || [
      'text-completion',
      'pattern-extraction', 
      'summarization',
      'sentiment-analysis',
      'classification'
    ];
  }

  // Enhanced privacy level support for unified interface
  getUnifiedPrivacyLevel(): AIPrivacyLevel {
    return 'private'; // OpenAI doesn't use data for training by default
  }

  protected async doInitialize(): Promise<boolean> {
    this.logger.info('Initializing OpenAI adapter with enhanced features');
    
    if (!this.apiKey) {
      const errorMsg = 'OpenAI API key is required but not provided. Please configure your API key in the plugin settings.';
      this.logger.error(errorMsg);
      throw new AIError(
        AIErrorType.AUTHENTICATION_FAILED,
        errorMsg
      );
    }

    if (this.apiKey.length < 20) {
      const errorMsg = 'OpenAI API key appears to be invalid (too short). Please check your API key configuration.';
      this.logger.error(errorMsg);
      throw new AIError(
        AIErrorType.AUTHENTICATION_FAILED,
        errorMsg
      );
    }

    if (!this.apiKey.startsWith('sk-')) {
      const errorMsg = 'OpenAI API key appears to be invalid (should start with "sk-"). Please check your API key configuration.';
      this.logger.error(errorMsg);
      throw new AIError(
        AIErrorType.AUTHENTICATION_FAILED,
        errorMsg
      );
    }

    // Test API connection with enhanced error handling
    try {
      this.logger.info('Testing OpenAI API connection...');
      await this.testConnection();
      this.logger.info(`OpenAI adapter initialized successfully with model: ${this.model}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI adapter', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      this.logger.warn('OpenAI health check failed', error);
      return false;
    }
  }

  protected async getVersion(): Promise<string> {
    return `openai-${this.model}-v1.0.0`;
  }

  // Enhanced unified interface implementation
  async getHealthStatus(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    
         try {
       const isHealthy = await this.doHealthCheck();
       const responseTime = Date.now() - startTime;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        responseTime,
        version: await this.getVersion(),
        details: {
          models: [{
            name: this.model,
            status: isHealthy ? 'available' : 'unavailable',
            responseTime: isHealthy ? responseTime : undefined,
            error: isHealthy ? undefined : 'Connection test failed'
          }],
          resources: {
            memory: { 
              used: process.memoryUsage().heapUsed / (1024 * 1024), 
              available: process.memoryUsage().heapTotal / (1024 * 1024) 
            },
            cpu: { usage: 0 } // Would need process monitoring
          },
          dependencies: [{
            name: 'OpenAI API',
            status: isHealthy ? 'healthy' : 'unhealthy',
            responseTime: isHealthy ? responseTime : undefined
          }]
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        version: await this.getVersion(),
        details: {
          models: [{
            name: this.model,
            status: 'unavailable',
            error: error instanceof Error ? error.message : String(error)
          }]
        }
      };
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const totalRequests = this.performanceMetrics.totalRequests;
    const successRate = totalRequests > 0 ? this.performanceMetrics.successfulRequests / totalRequests : 0;
    const avgLatency = totalRequests > 0 ? this.performanceMetrics.totalLatency / totalRequests : 0;
    const cacheHitRate = totalRequests > 0 ? this.performanceMetrics.cacheHits / totalRequests : 0;
    
    return {
      requestsPerSecond: 0, // Would need time-based calculation
      averageLatency: avgLatency,
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
      cpuUsage: 0, // Would need process monitoring
      cacheHitRate,
      batchEfficiency: 0, // Not applicable for OpenAI
      throughput: this.performanceMetrics.totalTokens / Math.max(avgLatency / 1000, 1),
      errorRate: 1 - successRate,
      lastUpdated: new Date()
    };
  }

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
    const modelConfig = OPENAI_MODELS[this.model as keyof typeof OPENAI_MODELS];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${this.model}`);
    }

    // Estimate input tokens
    const prompt = this.extractPromptFromMessages(request.messages);
    const inputTokens = Math.ceil(prompt.length / 4); // Rough estimate: 4 chars per token
    
    // Estimate output tokens
    const maxTokens = request.parameters?.maxTokens || modelConfig.maxTokens || 1000;
    const outputTokens = Math.min(maxTokens, 1000); // Conservative estimate
    
    const inputCost = (inputTokens / 1000) * modelConfig.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * modelConfig.outputCostPer1K;
    
    return {
      estimatedCost: inputCost + outputCost,
      currency: 'USD',
      breakdown: {
        inputTokens,
        outputTokens,
        inputCost,
        outputCost
      }
    };
  }

  async getModelInfo(): Promise<{
    modelId: string;
    version: string;
    contextWindow: number;
    maxOutputTokens: number;
    supportedFormats: string[];
    trainingCutoff?: Date;
  }> {
    const modelConfig = OPENAI_MODELS[this.model as keyof typeof OPENAI_MODELS];
    
    return {
      modelId: this.model,
      version: await this.getVersion(),
      contextWindow: modelConfig?.contextWindow || 4096,
      maxOutputTokens: modelConfig?.maxTokens || 1000,
      supportedFormats: ['text', 'json'],
      trainingCutoff: new Date('2023-04-01') // Approximate for most models
    };
  }

  protected async doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    try {
      await this.enforceRateLimit();

      // Check cache first
      const cacheKey = this.generateCacheKey(prompt, options);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        this.performanceMetrics.successfulRequests++;
        return cached;
      }

      const request: OpenAICompletionRequest = {
        model: this.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
        temperature: options?.temperature || this.config.temperature || 0.7,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stopSequences,
        stream: false,
        user: 'retrospect-ai-plugin'
      };

      const response = await this.makeRequest<OpenAICompletionResponse>('/chat/completions', request);
      
      if (!response.choices || response.choices.length === 0) {
        throw new AIError(
          AIErrorType.INVALID_RESPONSE,
          'No completion choices returned from OpenAI'
        );
      }

      const completion = response.choices[0].message.content;
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.performanceMetrics.totalLatency += latency;
      this.performanceMetrics.totalTokens += response.usage.total_tokens;
      this.performanceMetrics.successfulRequests++;
      
      // Cache the result
      this.setCache(cacheKey, completion, 3600000); // 1 hour TTL
      
      return completion;
    } catch (error) {
      this.performanceMetrics.failedRequests++;
      throw error;
    }
  }

  // Enhanced streaming support for unified interface
  async processStream(request: AIModelRequest, callback: AIStreamCallback): Promise<void> {
    const startTime = Date.now();
    
    try {
      const openaiRequest: OpenAICompletionRequest = {
        model: this.model,
        messages: this.convertToOpenAIMessages(request.messages),
        max_tokens: request.parameters?.maxTokens || 1000,
        temperature: request.parameters?.temperature || 0.7,
        top_p: request.parameters?.topP,
        frequency_penalty: request.parameters?.frequencyPenalty,
        presence_penalty: request.parameters?.presencePenalty,
        stop: request.parameters?.stopSequences,
        stream: true,
        user: 'retrospect-ai-plugin'
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'RetrospectAI-Plugin/1.0',
          ...(this.organization && { 'OpenAI-Organization': this.organization })
        },
        body: JSON.stringify(openaiRequest)
      });

      if (!response.ok) {
        const errorData = await response.json() as OpenAIErrorResponse;
        throw this.mapOpenAIError(response.status, errorData);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

             let buffer = '';
       let chunkIndex = 0;

       // Send start event
       callback({
         type: 'start',
         timestamp: new Date()
       });

       try {
         let reading = true;
         while (reading) {
           const { done, value } = await reader.read();
           
           if (done) break;

           buffer += new TextDecoder().decode(value);
           const lines = buffer.split('\n');
           buffer = lines.pop() || '';

           for (const line of lines) {
             if (line.startsWith('data: ')) {
               const data = line.slice(6);
               
               if (data === '[DONE]') {
                 // Send complete event
                 callback({
                   type: 'complete',
                   timestamp: new Date(),
                   chunk: {
                     id: request.id,
                     requestId: request.id,
                     index: chunkIndex++,
                     done: true,
                     delta: { content: '' }
                   }
                 });
                 reading = false;
                 break;
               }

               try {
                 const chunk = JSON.parse(data) as OpenAIStreamChunk;
                 const delta = chunk.choices[0]?.delta;
                 
                 if (delta?.content) {
                   const streamChunk: AIStreamChunk = {
                     id: chunk.id,
                     requestId: request.id,
                     index: chunkIndex++,
                     delta: {
                       content: delta.content
                     },
                     done: false,
                     metadata: {
                       timestamp: new Date(),
                       latency: Date.now() - startTime
                     }
                   };

                   callback({
                     type: 'chunk',
                     timestamp: new Date(),
                     chunk: streamChunk
                   });
                 }
               } catch (parseError) {
                 this.logger.warn('Failed to parse streaming chunk', parseError);
               }
             }
           }
         }
       } finally {
         reader.releaseLock();
       }
    } catch (error) {
      callback({
        type: 'error',
        timestamp: new Date(),
        error: this.convertToErrorDetails(error)
      });
    }
  }

  protected async doExtractPatterns(content: string, context?: unknown): Promise<DetectedPattern[]> {
    const prompt = `Analyze the following content and extract meaningful patterns related to habits, goals, challenges, insights, and trends. Return the results as a JSON array of patterns.

Content to analyze:
${content}

Please identify patterns and return them in this JSON format:
[
  {
    "id": "unique-id",
    "type": "habit|goal|challenge|insight|trend|relationship|other",
    "title": "Pattern Title",
    "description": "Detailed description",
    "confidence": 0.8,
    "evidence": ["evidence 1", "evidence 2"],
    "metadata": {
      "keywords": ["keyword1", "keyword2"],
      "sentiment": "positive|negative|neutral",
      "importance": "low|medium|high",
      "category": "category name"
    }
  }
]`;

    const response = await this.doGenerateCompletion(prompt);
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      
      const patterns = JSON.parse(jsonMatch[0]) as DetectedPattern[];
      
      // Validate and enhance patterns
      return patterns.map((pattern, index) => ({
        ...pattern,
        id: pattern.id || `openai-pattern-${Date.now()}-${index}`,
        metadata: {
          ...pattern.metadata,
          sourceFiles: pattern.metadata?.sourceFiles || []
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to parse patterns from OpenAI response', error);
      // Return a default pattern if parsing fails
      return [{
        id: `openai-pattern-${Date.now()}`,
        type: 'insight',
        title: 'Content Analysis',
        description: response.substring(0, 200) + '...',
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
  }

  protected async doGenerateSummary(patterns: DetectedPattern[], context?: unknown): Promise<string> {
    const patternSummary = patterns.map(p => 
      `- ${p.title} (${p.type}): ${p.description} [confidence: ${p.confidence}]`
    ).join('\n');

    const prompt = `Create a concise summary of the following patterns extracted from personal content:

${patternSummary}

Please provide a coherent summary that highlights the key insights, trends, and actionable items. Focus on personal growth, habits, and goal achievement.`;

    return await this.doGenerateCompletion(prompt);
  }

  protected async doAnalyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Extract patterns first
      const patterns = await this.doExtractPatterns(content);
      
      // Generate summary
      const summary = await this.doGenerateSummary(patterns);
      
      // Generate insights
      const insightsPrompt = `Based on this content analysis, provide 3-5 key insights about personal growth, habits, and patterns:

Content: ${content.substring(0, 500)}...
Patterns found: ${patterns.length}

Provide insights as a JSON array of strings.`;

      const insightsResponse = await this.doGenerateCompletion(insightsPrompt);
      let insights: string[] = [];
      
      try {
        const insightsMatch = insightsResponse.match(/\[[\s\S]*\]/);
        if (insightsMatch) {
          insights = JSON.parse(insightsMatch[0]);
        }
      } catch {
        insights = [
          'Content shows patterns of personal development',
          'Regular activities indicate habit formation',
          'Goals and challenges are clearly identified'
        ];
      }

      // Generate recommendations
      const recommendationsPrompt = `Based on the patterns and insights, provide 3-5 actionable recommendations for improvement:

Patterns: ${patterns.map(p => p.title).join(', ')}
Insights: ${insights.join(', ')}

Provide recommendations as a JSON array of strings.`;

      const recommendationsResponse = await this.doGenerateCompletion(recommendationsPrompt);
      let recommendations: string[] = [];
      
      try {
        const recMatch = recommendationsResponse.match(/\[[\s\S]*\]/);
        if (recMatch) {
          recommendations = JSON.parse(recMatch[0]);
        }
      } catch {
        recommendations = [
          'Continue building on positive patterns identified',
          'Address challenges with specific action plans',
          'Track progress regularly to maintain momentum'
        ];
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        patterns,
        summary,
        insights,
        recommendations,
        confidence: 0.8,
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
    const prompt = `Classify the following content into one of these categories: ${categories.join(', ')}

Content: ${content}

Respond with a JSON object containing the category and confidence score (0-1):
{"category": "selected_category", "confidence": 0.85}`;

    const response = await this.doGenerateCompletion(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          category: result.category || categories[0],
          confidence: result.confidence || 0.7
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse classification from OpenAI response', error);
    }

    // Fallback classification
    return {
      category: categories[0],
      confidence: 0.6
    };
  }

  protected async doAnalyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    const prompt = `Analyze the sentiment of the following content and respond with a JSON object:

Content: ${content}

Respond with:
{"sentiment": "positive|negative|neutral", "confidence": 0.85}`;

    const response = await this.doGenerateCompletion(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          sentiment: result.sentiment || 'neutral',
          confidence: result.confidence || 0.7
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse sentiment from OpenAI response', error);
    }

    // Fallback sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'success', 'achieve'];
    const negativeWords = ['bad', 'terrible', 'sad', 'fail', 'problem', 'difficult'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount > negativeCount) {
      return { sentiment: 'positive', confidence: 0.6 };
    } else if (negativeCount > positiveCount) {
      return { sentiment: 'negative', confidence: 0.6 };
    } else {
      return { sentiment: 'neutral', confidence: 0.6 };
    }
  }

  protected async doDispose(): Promise<void> {
    // Clear caches and reset metrics
    this.requestCache.clear();
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      totalTokens: 0,
      cacheHits: 0
    };
    this.logger.info('OpenAI adapter disposed');
  }

  // Private helper methods

  private async testConnection(): Promise<void> {
    try {
      this.logger.debug('Testing OpenAI connection', {
        baseURL: this.baseURL,
        model: this.model
      });
      
      const request: OpenAICompletionRequest = {
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
        user: 'retrospect-ai-plugin'
      };

      const response = await this.makeRequest<OpenAICompletionResponse>('/chat/completions', request);
      
      this.logger.debug('OpenAI connection test successful', {
        model: response.model,
        tokensUsed: response.usage?.total_tokens
      });
      
    } catch (error) {
      this.logger.error('OpenAI connection test failed', error);
      
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `Failed to connect to OpenAI API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private async makeRequest<T>(endpoint: string, data: any): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'RetrospectAI-Plugin/1.0'
      };

      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json() as OpenAIErrorResponse;
        throw this.mapOpenAIError(response.status, errorData);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `OpenAI API request failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
        true
      );
    }
  }

  private mapOpenAIError(status: number, errorData: OpenAIErrorResponse): AIError {
    const message = errorData.error?.message || 'Unknown OpenAI error';
    
    switch (status) {
      case 401:
        return new AIError(AIErrorType.AUTHENTICATION_FAILED, `Authentication failed: ${message}`, errorData, false);
      case 429:
        return new AIError(AIErrorType.RATE_LIMITED, `Rate limit exceeded: ${message}`, errorData, true);
      case 400:
        return new AIError(AIErrorType.INVALID_RESPONSE, `Bad request: ${message}`, errorData, false);
      case 500:
      case 502:
      case 503:
        return new AIError(AIErrorType.REQUEST_FAILED, `Server error: ${message}`, errorData, true);
      default:
        return new AIError(AIErrorType.UNKNOWN_ERROR, `OpenAI error (${status}): ${message}`, errorData, true);
    }
  }

  // Cloud-specific optimization methods

  private generateCacheKey(prompt: string, options?: CompletionOptions): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${this.model}:${prompt.slice(0, 100)}:${optionsStr}`;
  }

  private getFromCache(key: string): string | null {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.requestCache.delete(key);
      return null;
    }
    
    return cached.response;
  }

  private setCache(key: string, response: string, ttl: number): void {
    // Limit cache size to prevent memory issues
    if (this.requestCache.size > 100) {
      const firstKey = this.requestCache.keys().next().value;
      this.requestCache.delete(firstKey);
    }
    
    this.requestCache.set(key, {
      response,
      timestamp: Date.now(),
      ttl
    });
  }

  private convertToOpenAIMessages(messages: AIMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'function',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      name: msg.name,
      function_call: msg.function_call
    }));
  }
} 