import { Logger } from './logger';
import {
  AIModelAdapter,
  AIModelType,
  PrivacyLevel,
  AICapability,
  CompletionOptions,
  DetectedPattern,
  AIAnalysisResult,
  AIModelConfig,
  ModelHealth,
  AIError,
  AIErrorType,
} from './ai-interfaces';

/**
 * OpenAI API response interfaces
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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
 * Simplified OpenAI adapter for MVP
 */
export class OpenAIAdapter implements AIModelAdapter {
  readonly name = 'OpenAI Adapter';
  readonly description = 'OpenAI GPT models for cloud-based AI processing';
  readonly type: AIModelType = 'cloud';
  readonly privacyLevel: PrivacyLevel = 'cloud';
  readonly capabilities: AICapability[] = [
    'text-completion', 
    'pattern-extraction', 
    'summarization', 
    'sentiment-analysis', 
    'classification', 
    'question-answering'
  ];
  readonly config: AIModelConfig;

  private logger: Logger;
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private isInitialized = false;

  constructor(logger: Logger, config: AIModelConfig) {
    this.logger = logger;
    this.config = config;
    this.apiKey = config.apiKey || '';
    this.baseURL = config.endpoint || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-3.5-turbo';
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key is required');
      }

      // Test connection
      await this.testConnection();
      this.isInitialized = true;
      this.logger.info('OpenAI adapter initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI adapter', error);
      return false;
    }
  }

  /**
   * Check if the model is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health.isAvailable;
    } catch {
      return false;
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<ModelHealth> {
    const startTime = Date.now();
    try {
      await this.testConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        isAvailable: true,
        responseTime,
        lastChecked: new Date(),
        capabilities: this.capabilities,
      };
    } catch (error) {
      return {
        isAvailable: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : String(error),
        capabilities: this.capabilities,
      };
    }
  }

  /**
   * Generate text completion
   */
  async generateCompletion(
    prompt: string,
    options?: CompletionOptions
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }

    try {
      const request: OpenAICompletionRequest = {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
        temperature: options?.temperature || this.config.temperature || 0.7,
      };

      if (options?.topP) request.top_p = options.topP;
      if (options?.frequencyPenalty) request.frequency_penalty = options.frequencyPenalty;
      if (options?.presencePenalty) request.presence_penalty = options.presencePenalty;
      if (options?.stopSequences) request.stop = options.stopSequences;

      const response = await this.makeRequest<OpenAICompletionResponse>(
        '/chat/completions',
        request
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content received');
      }

      return content;
    } catch (error) {
      this.logger.error('Failed to generate completion', error);
      throw error;
    }
  }

  /**
   * Extract patterns from content (simplified)
   */
  async extractPatterns(content: string): Promise<DetectedPattern[]> {
    const prompt = `Analyze the following text and identify key patterns, habits, goals, or insights. 
    Return a JSON array of patterns with fields: type, title, description, confidence.
    
    Text: ${content.substring(0, 2000)}`;

    try {
      const response = await this.generateCompletion(prompt);
      
      // Try to parse JSON response
      try {
        const patterns = JSON.parse(response);
        return Array.isArray(patterns) ? patterns.map((p, index) => ({
          id: `pattern-${index}`,
          type: p.type || 'insight',
          title: p.title || 'Untitled Pattern',
          description: p.description || '',
          confidence: p.confidence || 0.5,
          evidence: [],
          metadata: {
            sourceFiles: [],
            keywords: [],
          }
        })) : [];
      } catch {
        // Fallback to simple pattern
        return [{
          id: 'pattern-1',
          type: 'insight',
          title: 'Analysis Result',
          description: response.substring(0, 200),
          confidence: 0.7,
          evidence: [],
          metadata: {
            sourceFiles: [],
            keywords: [],
          }
        }];
      }
    } catch (error) {
      this.logger.error('Failed to extract patterns', error);
      return [];
    }
  }

  /**
   * Generate summary from patterns
   */
  async generateSummary(patterns: DetectedPattern[]): Promise<string> {
    if (patterns.length === 0) {
      return 'No patterns found to summarize.';
    }

    const patternDescriptions = patterns.map(p => `- ${p.title}: ${p.description}`).join('\n');
    const prompt = `Create a concise summary of these patterns:\n${patternDescriptions}`;

    try {
      return await this.generateCompletion(prompt);
    } catch (error) {
      this.logger.error('Failed to generate summary', error);
      return 'Failed to generate summary.';
    }
  }

  /**
   * Analyze content for insights
   */
  async analyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    
    try {
      const patterns = await this.extractPatterns(content);
      const summary = await this.generateSummary(patterns);
      
      return {
        success: true,
        patterns,
        summary,
        insights: patterns.map(p => p.description),
        recommendations: [`Based on ${patterns.length} patterns found, consider reviewing these insights regularly.`],
        confidence: patterns.length > 0 ? patterns.reduce((acc, p) => acc + p.confidence, 0) / patterns.length : 0,
        processingTime: Date.now() - startTime,
        modelUsed: this.model,
      };
    } catch (error) {
      return {
        success: false,
        patterns: [],
        summary: '',
        insights: [],
        recommendations: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
        modelUsed: this.model,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Classify content into categories
   */
  async classifyContent(
    content: string,
    categories: string[]
  ): Promise<{ category: string; confidence: number }> {
    const prompt = `Classify this text into one of these categories: ${categories.join(', ')}
    
    Text: ${content.substring(0, 1000)}
    
    Respond with just the category name.`;

    try {
      const response = await this.generateCompletion(prompt);
      const category = categories.find(cat => 
        response.toLowerCase().includes(cat.toLowerCase())
      ) || categories[0] || 'unknown';

      return { category, confidence: 0.8 };
    } catch (error) {
      this.logger.error('Failed to classify content', error);
      return { category: categories[0] || 'unknown', confidence: 0.1 };
    }
  }

  /**
   * Extract sentiment from content
   */
  async analyzeSentiment(content: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }> {
    const prompt = `Analyze the sentiment of this text. Respond with just: positive, negative, or neutral.
    
    Text: ${content.substring(0, 1000)}`;

    try {
      const response = await this.generateCompletion(prompt);
      const sentiment = response.toLowerCase().includes('positive') ? 'positive' :
                       response.toLowerCase().includes('negative') ? 'negative' : 'neutral';

      return { sentiment, confidence: 0.8 };
    } catch (error) {
      this.logger.error('Failed to analyze sentiment', error);
      return { sentiment: 'neutral', confidence: 0.1 };
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<AIModelConfig>): Promise<void> {
    Object.assign(this.config, config);
    
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.endpoint) this.baseURL = config.endpoint;
    if (config.model) this.model = config.model;
    
    // Reinitialize if key properties changed
    if (config.apiKey || config.endpoint) {
      this.isInitialized = false;
      await this.initialize();
    }
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.isInitialized = false;
    this.logger.info('OpenAI adapter disposed');
  }

  /**
   * Test connection to OpenAI API
   */
  private async testConnection(): Promise<void> {
    const testRequest: OpenAICompletionRequest = {
      model: this.model,
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5,
    };

    await this.makeRequest<OpenAICompletionResponse>('/chat/completions', testRequest);
  }

  /**
   * Make HTTP request to OpenAI API
   */
  private async makeRequest<T>(endpoint: string, data: any): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData: OpenAIErrorResponse = await response.json();
      throw new AIError(
        this.mapErrorType(response.status),
        errorData.error.message,
        errorData,
        response.status >= 500 || response.status === 429
      );
    }

    return response.json();
  }

  /**
   * Map HTTP status to AIErrorType
   */
  private mapErrorType(status: number): AIErrorType {
    switch (status) {
      case 401: return AIErrorType.AUTHENTICATION_FAILED;
      case 429: return AIErrorType.RATE_LIMITED;
      case 400: return AIErrorType.INVALID_CONFIG;
      case 500: return AIErrorType.REQUEST_FAILED;
      default: return AIErrorType.UNKNOWN_ERROR;
    }
  }
} 