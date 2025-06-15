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
  AIErrorType
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
  stream?: boolean;
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
 * OpenAI model configurations
 */
const OPENAI_MODELS = {
  'gpt-4': {
    maxTokens: 8192,
    capabilities: ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'] as AICapability[]
  },
  'gpt-4-turbo': {
    maxTokens: 128000,
    capabilities: ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'] as AICapability[]
  },
  'gpt-3.5-turbo': {
    maxTokens: 4096,
    capabilities: ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'] as AICapability[]
  }
};

/**
 * OpenAI adapter for cloud-based AI services
 */
export class OpenAIAdapter extends BaseAIAdapter {
  readonly name = 'OpenAI Adapter';
  readonly description = 'OpenAI GPT models for cloud-based AI processing';
  readonly type: AIModelType = 'cloud';
  readonly privacyLevel: PrivacyLevel = 'cloud';
  readonly capabilities: AICapability[];

  private apiKey: string;
  private baseURL: string;
  private model: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private rateLimitDelay = 1000; // 1 second between requests

  constructor(logger: Logger, config: AIModelConfig) {
    super(logger, config);
    
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = config.endpoint || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-3.5-turbo';
    
    // Log configuration (without API key)
    this.logger.debug('OpenAI adapter configuration', {
      baseURL: this.baseURL,
      model: this.model,
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey.length
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

  protected async doInitialize(): Promise<boolean> {
    this.logger.info('Initializing OpenAI adapter');
    
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

    // Test API connection
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
    return `openai-${this.model}`;
  }

  protected async doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    await this.enforceRateLimit();

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
      stream: false
    };

    const response = await this.makeRequest<OpenAICompletionResponse>('/chat/completions', request);
    
    if (!response.choices || response.choices.length === 0) {
      throw new AIError(
        AIErrorType.INVALID_RESPONSE,
        'No completion choices returned from OpenAI'
      );
    }

    return response.choices[0].message.content;
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
    // Clean up any resources
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
        max_tokens: 5
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'RetrospectAI-Plugin/1.0'
        },
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
} 