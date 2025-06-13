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
 * Ollama model configurations
 */
const OLLAMA_MODEL_CAPABILITIES: Record<string, AICapability[]> = {
  'llama2': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'llama2:13b': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'llama2:70b': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'codellama': ['text-completion', 'code-analysis', 'pattern-extraction'],
  'mistral': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'neural-chat': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'starling-lm': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering']
};

/**
 * Ollama adapter for local AI models
 */
export class OllamaAdapter extends BaseAIAdapter {
  readonly name = 'Ollama Adapter';
  readonly description = 'Ollama local AI models for privacy-focused processing';
  readonly type: AIModelType = 'local';
  readonly privacyLevel: PrivacyLevel = 'local';
  readonly capabilities: AICapability[];

  private baseURL: string;
  private model: string;
  private availableModels: string[] = [];
  private requestTimeout: number;

  constructor(logger: Logger, config: AIModelConfig) {
    super(logger, config);
    
    this.baseURL = config.endpoint || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.requestTimeout = config.timeout || 60000; // 60 seconds default
    
    // Set capabilities based on model
    this.capabilities = this.getModelCapabilities(this.model);
  }

  protected async doInitialize(): Promise<boolean> {
    try {
      // Check if Ollama is running and get available models
      await this.loadAvailableModels();
      
      // Verify the specified model is available
      if (!this.availableModels.includes(this.model)) {
        this.logger.warn(`Model ${this.model} not found locally. Available models: ${this.availableModels.join(', ')}`);
        
        // Try to pull the model if it's not available
        await this.pullModel(this.model);
      }
      
      // Test the model with a simple request
      await this.testModel();
      
      this.logger.info(`Ollama adapter initialized with model: ${this.model}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Ollama adapter', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      // Check if Ollama service is running
      const response = await this.makeRequest('/api/tags', 'GET');
      return response !== null;
    } catch (error) {
      this.logger.warn('Ollama health check failed', error);
      return false;
    }
  }

  protected async getVersion(): Promise<string> {
    try {
      const response = await this.makeRequest<{ version?: string }>('/api/version', 'GET');
      return `ollama-${response?.version || 'unknown'}-${this.model}`;
    } catch {
      return `ollama-unknown-${this.model}`;
    }
  }

  protected async doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    const request: OllamaGenerateRequest = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature || this.config.temperature || 0.7,
        top_p: options?.topP,
        top_k: options?.topK,
        num_predict: options?.maxTokens || this.config.maxTokens || 1000,
        stop: options?.stopSequences
      }
    };

    const response = await this.makeRequest<OllamaGenerateResponse>('/api/generate', 'POST', request);
    
    if (!response || !response.response) {
      throw new AIError(
        AIErrorType.INVALID_RESPONSE,
        'No response content returned from Ollama'
      );
    }

    return response.response.trim();
  }

  protected async doExtractPatterns(content: string, context?: any): Promise<DetectedPattern[]> {
    const prompt = `Analyze the following personal content and extract meaningful patterns. Focus on habits, goals, challenges, insights, and trends.

Content:
${content}

Please identify patterns and format your response as a JSON array with this structure:
[
  {
    "id": "unique-id",
    "type": "habit|goal|challenge|insight|trend|relationship|other",
    "title": "Pattern Title",
    "description": "Detailed description of the pattern",
    "confidence": 0.8,
    "evidence": ["specific evidence from content"],
    "metadata": {
      "keywords": ["relevant", "keywords"],
      "sentiment": "positive|negative|neutral",
      "importance": "low|medium|high",
      "category": "category name"
    }
  }
]

Respond only with the JSON array, no additional text.`;

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
        id: pattern.id || `ollama-pattern-${Date.now()}-${index}`,
        metadata: {
          ...pattern.metadata,
          sourceFiles: pattern.metadata?.sourceFiles || []
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to parse patterns from Ollama response', error);
      
      // Return a default pattern if parsing fails
      return [{
        id: `ollama-pattern-${Date.now()}`,
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

  protected async doGenerateSummary(patterns: DetectedPattern[], context?: any): Promise<string> {
    const patternSummary = patterns.map(p => 
      `- ${p.title} (${p.type}): ${p.description} [confidence: ${p.confidence}]`
    ).join('\n');

    const prompt = `Create a concise and insightful summary of these patterns from personal content analysis:

${patternSummary}

Provide a coherent summary that:
1. Highlights key insights and trends
2. Identifies actionable items for personal growth
3. Notes any significant habits or goal patterns
4. Suggests areas for improvement

Keep the summary focused and practical.`;

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
      const insightsPrompt = `Based on this content analysis, provide 3-5 key insights about personal development and patterns:

Content length: ${content.length} characters
Patterns found: ${patterns.length}
Analysis type: ${analysisType || 'general'}

Focus on insights about:
- Personal growth opportunities
- Habit formation patterns
- Goal achievement strategies
- Challenge areas to address

Respond with a JSON array of insight strings:
["insight 1", "insight 2", "insight 3"]`;

      const insightsResponse = await this.doGenerateCompletion(insightsPrompt);
      let insights: string[] = [];
      
      try {
        const insightsMatch = insightsResponse.match(/\[[\s\S]*\]/);
        if (insightsMatch) {
          insights = JSON.parse(insightsMatch[0]);
        }
      } catch {
        insights = [
          'Content demonstrates ongoing personal development efforts',
          'Patterns suggest consistent engagement with self-improvement',
          'Multiple areas of focus indicate well-rounded growth approach'
        ];
      }

      // Generate recommendations
      const recommendationsPrompt = `Based on the patterns and insights, provide 3-5 specific, actionable recommendations:

Patterns: ${patterns.map(p => p.title).join(', ')}
Key insights: ${insights.join('; ')}

Provide practical recommendations as a JSON array:
["recommendation 1", "recommendation 2", "recommendation 3"]`;

      const recommendationsResponse = await this.doGenerateCompletion(recommendationsPrompt);
      let recommendations: string[] = [];
      
      try {
        const recMatch = recommendationsResponse.match(/\[[\s\S]*\]/);
        if (recMatch) {
          recommendations = JSON.parse(recMatch[0]);
        }
      } catch {
        recommendations = [
          'Continue building on identified positive patterns',
          'Create specific action plans for addressing challenges',
          'Establish regular review cycles to track progress'
        ];
      }

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
    const prompt = `Classify the following content into one of these categories: ${categories.join(', ')}

Content: ${content}

Analyze the content and determine which category it best fits into. Consider the main themes, topics, and purpose of the content.

Respond with only a JSON object:
{"category": "selected_category", "confidence": 0.85}`;

    const response = await this.doGenerateCompletion(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          category: result.category || categories[0],
          confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1)
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse classification from Ollama response', error);
    }

    // Fallback classification using simple keyword matching
    const lowerContent = content.toLowerCase();
    let bestCategory = categories[0];
    let bestScore = 0;

    for (const category of categories) {
      const categoryWords = category.toLowerCase().split(/\s+/);
      const score = categoryWords.reduce((acc, word) => {
        return acc + (lowerContent.includes(word) ? 1 : 0);
      }, 0) / categoryWords.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return {
      category: bestCategory,
      confidence: Math.max(bestScore, 0.5)
    };
  }

  protected async doAnalyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    const prompt = `Analyze the sentiment of the following content:

Content: ${content}

Determine if the overall sentiment is positive, negative, or neutral. Consider the emotional tone, word choice, and overall message.

Respond with only a JSON object:
{"sentiment": "positive|negative|neutral", "confidence": 0.85}`;

    const response = await this.doGenerateCompletion(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        const sentiment = result.sentiment;
        if (['positive', 'negative', 'neutral'].includes(sentiment)) {
          return {
            sentiment: sentiment as 'positive' | 'negative' | 'neutral',
            confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1)
          };
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse sentiment from Ollama response', error);
    }

    // Fallback sentiment analysis using keyword matching
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'success', 'achieve', 'wonderful', 'amazing', 'love', 'enjoy'];
    const negativeWords = ['bad', 'terrible', 'sad', 'fail', 'problem', 'difficult', 'hate', 'awful', 'disappointed', 'frustrated'];
    
    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount > negativeCount) {
      return { sentiment: 'positive', confidence: 0.6 + (positiveCount - negativeCount) * 0.1 };
    } else if (negativeCount > positiveCount) {
      return { sentiment: 'negative', confidence: 0.6 + (negativeCount - positiveCount) * 0.1 };
    } else {
      return { sentiment: 'neutral', confidence: 0.6 };
    }
  }

  protected async doDispose(): Promise<void> {
    // Clean up any resources
    this.logger.info('Ollama adapter disposed');
  }

  // Private helper methods

  private getModelCapabilities(modelName: string): AICapability[] {
    // Check for exact match first
    if (OLLAMA_MODEL_CAPABILITIES[modelName]) {
      return OLLAMA_MODEL_CAPABILITIES[modelName];
    }
    
    // Check for partial matches (e.g., "llama2:7b" matches "llama2")
    for (const [key, capabilities] of Object.entries(OLLAMA_MODEL_CAPABILITIES)) {
      if (modelName.startsWith(key)) {
        return capabilities;
      }
    }
    
    // Default capabilities for unknown models
    return ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis'];
  }

  private async loadAvailableModels(): Promise<void> {
    try {
      const response = await this.makeRequest<OllamaListResponse>('/api/tags', 'GET');
      if (response && response.models) {
        this.availableModels = response.models.map(model => model.name);
        this.logger.debug(`Found ${this.availableModels.length} available Ollama models`);
      }
    } catch (error) {
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `Failed to connect to Ollama service: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async pullModel(modelName: string): Promise<void> {
    this.logger.info(`Attempting to pull model: ${modelName}`);
    
    try {
      // Note: This is a simplified version. In practice, you might want to handle streaming responses
      await this.makeRequest('/api/pull', 'POST', { name: modelName });
      this.logger.info(`Successfully pulled model: ${modelName}`);
      
      // Refresh available models list
      await this.loadAvailableModels();
    } catch (error) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        `Failed to pull model ${modelName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async testModel(): Promise<void> {
    try {
      const testPrompt = 'Hello';
      const request: OllamaGenerateRequest = {
        model: this.model,
        prompt: testPrompt,
        stream: false,
        options: {
          num_predict: 5
        }
      };

      await this.makeRequest<OllamaGenerateResponse>('/api/generate', 'POST', request);
    } catch (error) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        `Model ${this.model} is not responding: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async makeRequest<T>(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
      
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RetrospectAI-Plugin/1.0'
        },
        signal: controller.signal
      };

      if (method === 'POST' && data) {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json() as OllamaErrorResponse;
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Use the default error message if we can't parse the response
        }
        
        throw this.mapOllamaError(response.status, errorMessage);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError(
          AIErrorType.TIMEOUT,
          `Ollama request timed out after ${this.requestTimeout}ms`,
          error,
          true
        );
      }
      
      throw new AIError(
        AIErrorType.NETWORK_ERROR,
        `Ollama API request failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
        true
      );
    }
  }

  private mapOllamaError(status: number, message: string): AIError {
    switch (status) {
      case 404:
        return new AIError(AIErrorType.MODEL_UNAVAILABLE, `Model not found: ${message}`, undefined, false);
      case 400:
        return new AIError(AIErrorType.INVALID_RESPONSE, `Bad request: ${message}`, undefined, false);
      case 500:
      case 502:
      case 503:
        return new AIError(AIErrorType.REQUEST_FAILED, `Server error: ${message}`, undefined, true);
      default:
        return new AIError(AIErrorType.UNKNOWN_ERROR, `Ollama error (${status}): ${message}`, undefined, true);
    }
  }
} 