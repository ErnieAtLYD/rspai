// src/llamacpp-adapter.ts
/**
 * Llama.cpp adapter for local AI models using node-llama-cpp
 */

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

/**
 * Llama.cpp model configurations and capabilities
 */
const LLAMACPP_MODEL_CAPABILITIES: Record<string, AICapability[]> = {
  'llama-2': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'llama-3': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'mistral': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification'],
  'codellama': ['text-completion', 'code-analysis', 'pattern-extraction'],
  'neural-chat': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification', 'question-answering'],
  'phi': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis'],
  'gemma': ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis', 'classification']
};

/**
 * Llama.cpp model status interface
 */
interface LlamaCppModelStatus {
  name: string;
  path: string;
  isLoaded: boolean;
  size?: number;
  parameters?: string;
  quantization?: string;
  architecture?: string;
}

/**
 * Llama.cpp adapter configuration
 */
interface LlamaCppConfig extends AIModelConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
  batchSize?: number;
  useMemoryLock?: boolean;
  useMemoryMap?: boolean;
  logitsAll?: boolean;
  vocabOnly?: boolean;
  embedding?: boolean;
}

/**
 * Llama.cpp adapter for local AI models using node-llama-cpp
 */
export class LlamaCppAdapter extends BaseAIAdapter {
  readonly name = 'Llama.cpp Adapter';
  readonly description = 'Llama.cpp local AI models for maximum privacy and performance';
  readonly type: AIModelType = 'local';
  readonly privacyLevel: PrivacyLevel = 'local';
  readonly capabilities: AICapability[];

  private modelPath: string;
  private contextSize: number;
  private gpuLayers: number;
  private threads: number;
  private batchSize: number;
  private useMemoryLock: boolean;
  private useMemoryMap: boolean;
  
  // Llama.cpp instances (will be dynamically imported)
  private llama: any = null;
  private model: any = null;
  private context: any = null;
  private session: any = null;
  
  private isModelLoaded = false;
  private modelInfo: LlamaCppModelStatus | null = null;
  private performanceOptimizer?: PerformanceOptimizer;

  constructor(logger: Logger, config: LlamaCppConfig) {
    super(logger, config);
    
    this.modelPath = config.modelPath;
    this.contextSize = config.contextSize || 2048;
    this.gpuLayers = config.gpuLayers || 0;
    this.threads = config.threads || 4;
    this.batchSize = config.batchSize || 512;
    this.useMemoryLock = config.useMemoryLock || true;
    this.useMemoryMap = config.useMemoryMap || true;
    
    // Determine capabilities based on model path
    this.capabilities = this.getModelCapabilities(this.modelPath);
  }

  protected async doInitialize(): Promise<boolean> {
    try {
      // Dynamic import to handle optional dependency
      const { getLlama, LlamaChatSession } = await this.importLlamaCpp();
      
      this.logger.info('Initializing Llama.cpp adapter...');
      
      // Initialize Llama.cpp
      this.llama = await getLlama();
      
      // Load the model
      this.model = await this.llama.loadModel({
        modelPath: this.modelPath,
        gpuLayers: this.gpuLayers,
        contextSize: this.contextSize,
        threads: this.threads,
        batchSize: this.batchSize,
        useMemoryLock: this.useMemoryLock,
        useMemoryMap: this.useMemoryMap
      });
      
      // Create context
      this.context = await this.model.createContext({
        contextSize: this.contextSize,
        batchSize: this.batchSize
      });
      
      // Create chat session
      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });
      
      this.isModelLoaded = true;
      
      // Get model information
      this.modelInfo = {
        name: this.extractModelName(this.modelPath),
        path: this.modelPath,
        isLoaded: true,
        size: await this.getModelSize(),
        parameters: await this.getModelParameters(),
        quantization: this.extractQuantization(this.modelPath),
        architecture: await this.getModelArchitecture()
      };
      
      // Initialize performance optimizer
      await this.initializePerformanceOptimizer();
      
      this.logger.info(`Llama.cpp adapter initialized successfully with model: ${this.modelInfo.name}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Llama.cpp adapter', error);
      
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        throw new AIError(
          AIErrorType.INITIALIZATION_FAILED,
          'node-llama-cpp is not installed. Please install it with: npm install node-llama-cpp'
        );
      }
      
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        `Failed to initialize Llama.cpp: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    try {
      if (!this.isModelLoaded || !this.session) {
        return false;
      }
      
      // Test with a simple prompt
      const testResponse = await this.session.prompt('Hi', {
        maxTokens: 5,
        temperature: 0.1
      });
      
      return typeof testResponse === 'string' && testResponse.length > 0;
    } catch (error) {
      this.logger.warn('Llama.cpp health check failed', error);
      return false;
    }
  }

  protected async getVersion(): Promise<string> {
    try {
      if (this.llama && this.llama.version) {
        return `llamacpp-${this.llama.version}-${this.modelInfo?.name || 'unknown'}`;
      }
      return `llamacpp-unknown-${this.modelInfo?.name || 'unknown'}`;
    } catch {
      return `llamacpp-unknown-${this.modelInfo?.name || 'unknown'}`;
    }
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
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const patterns = JSON.parse(jsonMatch[0]) as DetectedPattern[];
        
        // Validate and clean patterns
        return patterns.filter(pattern => 
          pattern.id && 
          pattern.type && 
          pattern.title && 
          pattern.description &&
          typeof pattern.confidence === 'number'
        ).map(pattern => ({
          ...pattern,
          confidence: Math.min(Math.max(pattern.confidence, 0), 1)
        }));
      }
    } catch (error) {
      this.logger.warn('Failed to parse patterns from Llama.cpp response', error);
    }

    // Fallback pattern extraction using keyword analysis
    return this.extractPatternsFromKeywords(content);
  }

  protected async doGenerateSummary(patterns: DetectedPattern[], context?: any): Promise<string> {
    const prompt = `Based on the following detected patterns from personal content analysis, generate a comprehensive summary:

Patterns:
${patterns.map(p => `- ${p.title}: ${p.description} (confidence: ${p.confidence})`).join('\n')}

Please provide a thoughtful summary that:
1. Highlights the most significant patterns
2. Identifies potential connections between patterns
3. Offers insights about personal growth or areas of focus
4. Maintains a supportive and constructive tone

Summary:`;

    return await this.doGenerateCompletion(prompt, { maxTokens: 500 });
  }

     protected async doAnalyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
     const patterns = await this.doExtractPatterns(content);
     const summary = await this.doGenerateSummary(patterns);

         return {
       success: true,
       summary,
       patterns,
       insights: patterns.filter(p => p.type === 'insight').slice(0, 5).map(p => p.description),
       recommendations: await this.generateRecommendations(patterns),
       confidence: patterns.reduce((acc, p) => acc + p.confidence, 0) / patterns.length || 0,
       processingTime: 0, // Will be calculated by caller
       modelUsed: this.name
     };
  }

  protected async doClassifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }> {
    const prompt = `Classify the following content into one of these categories: ${categories.join(', ')}.

Content: ${content}

Respond with only a JSON object:
{"category": "selected_category", "confidence": 0.85}`;

    const response = await this.doGenerateCompletion(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (categories.includes(result.category)) {
          return {
            category: result.category,
            confidence: Math.min(Math.max(result.confidence || 0.7, 0), 1)
          };
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse classification from Llama.cpp response', error);
    }

    // Fallback classification
    return { category: categories[0] || 'general', confidence: 0.5 };
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
      this.logger.warn('Failed to parse sentiment from Llama.cpp response', error);
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
    try {
      if (this.session) {
        // Dispose session if it has a dispose method
        if (typeof this.session.dispose === 'function') {
          await this.session.dispose();
        }
        this.session = null;
      }
      
      if (this.context) {
        // Dispose context if it has a dispose method
        if (typeof this.context.dispose === 'function') {
          await this.context.dispose();
        }
        this.context = null;
      }
      
      if (this.model) {
        // Dispose model if it has a dispose method
        if (typeof this.model.dispose === 'function') {
          await this.model.dispose();
        }
        this.model = null;
      }
      
      this.isModelLoaded = false;
      this.modelInfo = null;
      this.performanceOptimizer = undefined;
      
      this.logger.info('Llama.cpp adapter disposed');
    } catch (error) {
      this.logger.warn('Error during Llama.cpp adapter disposal', error);
    }
  }

  /**
   * Initialize performance optimizer
   */
  private async initializePerformanceOptimizer(): Promise<void> {
    if (!this.performanceConfig) {
      this.performanceConfig = this.getDefaultPerformanceConfig();
      
      // Optimize for Llama.cpp specific settings
      this.performanceConfig.hardware.maxThreads = this.threads;
      this.performanceConfig.memory.contextWindowOptimization = true;
    }

    this.performanceOptimizer = new PerformanceOptimizer(
      this.logger,
      this.performanceConfig,
      this.processBatch.bind(this)
    );

    await this.optimizeForHardware();
    this.logger.info('Performance optimizer initialized for Llama.cpp adapter');
  }

  /**
   * Process a batch of requests for Llama.cpp
   */
  private async processBatch(batch: RequestBatch): Promise<string[]> {
    const results: string[] = [];
    
    for (const request of batch.requests) {
      try {
        const result = await this.generateCompletionDirect(request.prompt, request.options);
        results.push(result);
      } catch (error) {
        this.logger.error(`Batch request failed: ${request.id}`, error);
        results.push(''); // Empty result for failed request
      }
    }
    
    return results;
  }

  /**
   * Direct completion generation without performance optimization
   */
  private async generateCompletionDirect(prompt: string, options?: CompletionOptions): Promise<string> {
    if (!this.session) {
      throw new AIError(
        AIErrorType.MODEL_UNAVAILABLE,
        'Llama.cpp model is not loaded'
      );
    }

    try {
      const response = await this.session.prompt(prompt, {
        maxTokens: options?.maxTokens || this.config.maxTokens || 1000,
        temperature: options?.temperature || this.config.temperature || 0.7,
        topP: options?.topP,
        topK: options?.topK,
        stopSequences: options?.stopSequences
      });

      if (typeof response !== 'string' || response.length === 0) {
        throw new AIError(
          AIErrorType.INVALID_RESPONSE,
          'No response content returned from Llama.cpp'
        );
      }

      return response.trim();
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        AIErrorType.REQUEST_FAILED,
        `Llama.cpp completion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Override doGenerateCompletion to use performance optimizer
   */
  protected async doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    // Use performance optimizer if available
    if (this.performanceOptimizer) {
      return this.performanceOptimizer.processRequest(prompt, options);
    }

    return this.generateCompletionDirect(prompt, options);
  }

  /**
   * Override performance configuration
   */
  async configurePerformance(config: PerformanceConfig): Promise<void> {
    await super.configurePerformance(config);
    
    if (this.performanceOptimizer) {
      // Reinitialize optimizer with new config
      await this.initializePerformanceOptimizer();
    }
  }

  /**
   * Get performance metrics from optimizer
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    if (this.performanceOptimizer) {
      return this.performanceOptimizer.getPerformanceMetrics();
    }
    
    return super.getPerformanceMetrics();
  }

  /**
   * Get resource usage from optimizer
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    if (this.performanceOptimizer) {
      return this.performanceOptimizer.getResourceUsage();
    }
    
    return super.getResourceUsage();
  }

  /**
   * Clear caches including performance caches
   */
  async clearCaches(): Promise<void> {
    await super.clearCaches();
    
    if (this.performanceOptimizer) {
      await this.performanceOptimizer.clearCaches();
    }
  }

  // Public methods for model management

  /**
   * Get current model information
   */
  getModelInfo(): LlamaCppModelStatus | null {
    return this.modelInfo;
  }

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return this.isModelLoaded && this.session !== null;
  }

  /**
   * Get model capabilities based on model name/path
   */
  getModelCapabilities(modelPath: string): AICapability[] {
    const modelName = this.extractModelName(modelPath).toLowerCase();
    
    // Check for exact matches first
    for (const [key, capabilities] of Object.entries(LLAMACPP_MODEL_CAPABILITIES)) {
      if (modelName.includes(key)) {
        return capabilities;
      }
    }
    
    // Default capabilities for unknown models
    return ['text-completion', 'pattern-extraction', 'summarization', 'sentiment-analysis'];
  }

  // Private helper methods

       private async importLlamaCpp(): Promise<{ getLlama: any; LlamaChatSession: any }> {
    try {
      // Dynamic import to handle optional dependency
      // @ts-ignore - Optional dependency, may not be installed
      return await import('node-llama-cpp');
    } catch (error) {
      throw new Error('node-llama-cpp is not installed. Please install it with: npm install node-llama-cpp');
    }
  }

  private extractModelName(modelPath: string): string {
    const fileName = modelPath.split('/').pop() || modelPath;
    return fileName.replace(/\.(gguf|ggml|bin)$/i, '');
  }

  private extractQuantization(modelPath: string): string {
    const quantMatch = modelPath.match(/\.(Q\d+_[KM]|F16|F32)\./i);
    return quantMatch ? quantMatch[1] : 'unknown';
  }

  private async getModelSize(): Promise<number> {
    try {
      // This would need to be implemented based on node-llama-cpp API
      // For now, return 0 as placeholder
      return 0;
    } catch {
      return 0;
    }
  }

  private async getModelParameters(): Promise<string> {
    try {
      // Extract parameter count from model name/path
      const paramMatch = this.modelPath.match(/(\d+)B/i);
      return paramMatch ? `${paramMatch[1]}B` : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async getModelArchitecture(): Promise<string> {
    try {
      // Extract architecture from model name
      const modelName = this.extractModelName(this.modelPath).toLowerCase();
      if (modelName.includes('llama')) return 'llama';
      if (modelName.includes('mistral')) return 'mistral';
      if (modelName.includes('phi')) return 'phi';
      if (modelName.includes('gemma')) return 'gemma';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private extractPatternsFromKeywords(content: string): DetectedPattern[] {
    // Fallback pattern extraction using simple keyword analysis
    const patterns: DetectedPattern[] = [];
    const lowerContent = content.toLowerCase();
    
    // Goal patterns
    if (lowerContent.includes('goal') || lowerContent.includes('want to') || lowerContent.includes('plan to')) {
      patterns.push({
        id: 'goal-1',
        type: 'goal',
        title: 'Goal Setting',
        description: 'Content mentions goals or future plans',
        confidence: 0.7,
        evidence: ['Contains goal-related keywords'],
                 metadata: {
           sourceFiles: [],
           keywords: ['goal', 'plan', 'want'],
           sentiment: 'positive',
           importance: 'medium',
           category: 'planning'
         }
      });
    }
    
    // Habit patterns
    if (lowerContent.includes('every day') || lowerContent.includes('routine') || lowerContent.includes('habit')) {
      patterns.push({
        id: 'habit-1',
        type: 'habit',
        title: 'Routine Behavior',
        description: 'Content mentions daily routines or habits',
        confidence: 0.7,
        evidence: ['Contains habit-related keywords'],
                 metadata: {
           sourceFiles: [],
           keywords: ['routine', 'habit', 'daily'],
           sentiment: 'neutral',
           importance: 'medium',
           category: 'behavior'
         }
      });
    }
    
    return patterns;
  }

  private async generateRecommendations(patterns: DetectedPattern[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Generate basic recommendations based on pattern types
    const goalPatterns = patterns.filter(p => p.type === 'goal');
    const habitPatterns = patterns.filter(p => p.type === 'habit');
    const challengePatterns = patterns.filter(p => p.type === 'challenge');
    
    if (goalPatterns.length > 0) {
      recommendations.push('Consider breaking down your goals into smaller, actionable steps');
    }
    
    if (habitPatterns.length > 0) {
      recommendations.push('Track your habits to identify patterns and areas for improvement');
    }
    
    if (challengePatterns.length > 0) {
      recommendations.push('Reflect on challenges as opportunities for growth and learning');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Continue documenting your thoughts and experiences for better self-awareness');
    }
    
    return recommendations;
  }
} 