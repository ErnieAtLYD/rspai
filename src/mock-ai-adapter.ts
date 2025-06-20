// src/mock-ai-adapter.ts
/**
 * Mock AI Adapter for testing purposes
 * Provides configurable responses and error simulation with unified interface support
 */

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
// Add unified interface imports
import {
  HealthCheckResponse,
  AIPrivacyLevel,
  AIModelResponse,
  AIBatchResponse,
  AIValidationResult
} from './unified-ai-interfaces';

/**
 * Mock response configuration for testing
 */
export interface MockResponse {
  content: string;
  delay?: number; // Simulated response delay in ms
  error?: AIError; // Error to throw instead of returning content
  tokensUsed?: number;
}

/**
 * Enhanced mock adapter configuration for testing scenarios
 */
export interface MockAdapterConfig {
  // Response configurations
  completionResponses?: MockResponse[];
  patternResponses?: DetectedPattern[][];
  summaryResponses?: MockResponse[];
  analysisResponses?: AIAnalysisResult[];
  classificationResponses?: Array<{ category: string; confidence: number }>;
  sentimentResponses?: Array<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>;

  // Unified interface response configurations
  unifiedResponses?: AIModelResponse[];
  batchResponses?: AIBatchResponse[];
  validationResponses?: AIValidationResult[];
  healthResponses?: HealthCheckResponse[];

  // Behavior configurations
  simulateLatency?: boolean;
  baseLatency?: number; // Base latency in ms
  latencyVariation?: number; // Random variation in ms
  
  // Error simulation
  errorRate?: number; // 0-1, probability of throwing errors
  errorTypes?: AIErrorType[];
  
  // Health simulation
  isHealthy?: boolean;
  healthCheckDelay?: number;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
  
  // Capability simulation
  enabledCapabilities?: AICapability[];
  
  // State tracking
  trackRequests?: boolean;
  maxRequestHistory?: number;
  
  // Unified interface testing
  enableUnifiedInterface?: boolean;
  simulateStreamingChunks?: number; // Number of chunks for streaming simulation
  streamingDelay?: number; // Delay between streaming chunks
}

/**
 * Request tracking for testing
 */
export interface MockRequest {
  id: string;
  timestamp: Date;
  method: string;
  input: unknown;
  output?: unknown;
  error?: AIError;
  duration: number;
}

/**
 * Enhanced Mock AI adapter for testing purposes
 * Provides configurable responses and error simulation with unified interface support
 */
export class MockAIAdapter extends BaseAIAdapter {
  readonly name = 'Mock AI Adapter';
  readonly description = 'Mock adapter for testing AI abstraction layer with unified interface support';
  readonly type: AIModelType = 'local';
  readonly privacyLevel: PrivacyLevel = 'local';
  readonly capabilities: AICapability[] = [
    'text-completion',
    'pattern-extraction',
    'summarization',
    'sentiment-analysis',
    'topic-modeling',
    'question-answering',
    'classification'
  ];

  // Enhanced unified privacy level
  get unifiedPrivacyLevel(): AIPrivacyLevel {
    return 'private'; // Mock adapter for testing
  }

  private mockConfig: MockAdapterConfig;
  private requestHistory: MockRequest[] = [];
  private responseIndex = 0;
  private patternIndex = 0;
  private summaryIndex = 0;
  private analysisIndex = 0;
  private classificationIndex = 0;
  private sentimentIndex = 0;
  private unifiedResponseIndex = 0;
  private batchResponseIndex = 0;
  private validationResponseIndex = 0;
  private healthResponseIndex = 0;

  constructor(logger: Logger, config: AIModelConfig, mockConfig: MockAdapterConfig = {}) {
    super(logger, config);
    this.mockConfig = {
      simulateLatency: true,
      baseLatency: 100,
      latencyVariation: 50,
      errorRate: 0,
      errorTypes: [AIErrorType.REQUEST_FAILED],
      isHealthy: true,
      healthStatus: 'healthy',
      healthCheckDelay: 10,
      enabledCapabilities: this.capabilities,
      trackRequests: true,
      maxRequestHistory: 100,
      enableUnifiedInterface: true,
      simulateStreamingChunks: 3,
      streamingDelay: 100,
      ...mockConfig
    };
  }

  /**
   * Update mock configuration
   */
  updateMockConfig(config: Partial<MockAdapterConfig>): void {
    this.mockConfig = { ...this.mockConfig, ...config };
    this.logger.debug('Updated mock adapter configuration', config);
  }

  /**
   * Get request history for testing verification
   */
  getRequestHistory(): MockRequest[] {
    return [...this.requestHistory];
  }

  /**
   * Clear request history
   */
  clearRequestHistory(): void {
    this.requestHistory = [];
    this.logger.debug('Cleared mock adapter request history');
  }

  /**
   * Reset response indices to start from beginning
   */
  resetResponseIndices(): void {
    this.responseIndex = 0;
    this.patternIndex = 0;
    this.summaryIndex = 0;
    this.analysisIndex = 0;
    this.classificationIndex = 0;
    this.sentimentIndex = 0;
    this.unifiedResponseIndex = 0;
    this.batchResponseIndex = 0;
    this.validationResponseIndex = 0;
    this.healthResponseIndex = 0;
    this.logger.debug('Reset mock adapter response indices');
  }

  /**
   * Set predefined completion responses
   */
  setCompletionResponses(responses: MockResponse[]): void {
    this.mockConfig.completionResponses = responses;
    this.responseIndex = 0;
  }

  /**
   * Set predefined pattern responses
   */
  setPatternResponses(responses: DetectedPattern[][]): void {
    this.mockConfig.patternResponses = responses;
    this.patternIndex = 0;
  }

  /**
   * Set predefined summary responses
   */
  setSummaryResponses(responses: MockResponse[]): void {
    this.mockConfig.summaryResponses = responses;
    this.summaryIndex = 0;
  }

  /**
   * Set predefined unified responses
   */
  setUnifiedResponses(responses: AIModelResponse[]): void {
    this.mockConfig.unifiedResponses = responses;
    this.unifiedResponseIndex = 0;
  }

  /**
   * Set predefined batch responses
   */
  setBatchResponses(responses: AIBatchResponse[]): void {
    this.mockConfig.batchResponses = responses;
    this.batchResponseIndex = 0;
  }

  /**
   * Set predefined validation responses
   */
  setValidationResponses(responses: AIValidationResult[]): void {
    this.mockConfig.validationResponses = responses;
    this.validationResponseIndex = 0;
  }

  /**
   * Set predefined health responses
   */
  setHealthResponses(responses: HealthCheckResponse[]): void {
    this.mockConfig.healthResponses = responses;
    this.healthResponseIndex = 0;
  }

  /**
   * Simulate specific error for next request
   */
  simulateError(error: AIError): void {
    this.mockConfig.errorRate = 1.0;
    this.mockConfig.errorTypes = [error.type];
    this.mockConfig.completionResponses = [{ content: '', error }];
    this.responseIndex = 0;
  }

  /**
   * Enable/disable specific capabilities for testing
   */
  setEnabledCapabilities(capabilities: AICapability[]): void {
    this.mockConfig.enabledCapabilities = capabilities;
    // Update the capabilities property
    (this as { capabilities: AICapability[] }).capabilities = capabilities;
  }

  /**
   * Set health status for testing
   */
  setHealthStatus(status: 'healthy' | 'degraded' | 'unhealthy', isHealthy = true): void {
    this.mockConfig.healthStatus = status;
    this.mockConfig.isHealthy = isHealthy;
  }

  // Protected abstract method implementations

  protected async doInitialize(): Promise<boolean> {
    await this.simulateDelay(50);
    
    if (this.mockConfig.errorRate && Math.random() < this.mockConfig.errorRate) {
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        'Mock initialization failure'
      );
    }
    
    return true;
  }

  protected async doHealthCheck(): Promise<boolean> {
    if (this.mockConfig.healthCheckDelay) {
      await this.simulateDelay(this.mockConfig.healthCheckDelay);
    }
    
    return this.mockConfig.isHealthy ?? true;
  }

  protected async getVersion(): Promise<string> {
    return 'mock-1.0.0';
  }

  protected async doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    const request = this.createRequest('generateCompletion', { prompt, options });
    
    try {
      await this.simulateLatency();
      this.checkForError();

      let response: MockResponse;
      
      if (this.mockConfig.completionResponses && this.mockConfig.completionResponses.length > 0) {
        response = this.mockConfig.completionResponses[this.responseIndex % this.mockConfig.completionResponses.length];
        this.responseIndex++;
      } else {
        // Default response
        response = {
          content: `Mock completion for prompt: "${prompt.substring(0, 50)}..."`,
          tokensUsed: Math.floor(prompt.length / 4) + Math.floor(Math.random() * 100)
        };
      }

      if (response.error) {
        throw response.error;
      }

      if (response.delay) {
        await this.simulateDelay(response.delay);
      }

      this.completeRequest(request, response.content);
      return response.content;

    } catch (error) {
      this.completeRequest(request, undefined, error as AIError);
      throw error;
    }
  }

  protected async doExtractPatterns(content: string, context?: unknown): Promise<DetectedPattern[]> {
    const request = this.createRequest('extractPatterns', { content, context });
    
    try {
      await this.simulateLatency();
      this.checkForError();

      let patterns: DetectedPattern[];
      
      if (this.mockConfig.patternResponses && this.mockConfig.patternResponses.length > 0) {
        patterns = this.mockConfig.patternResponses[this.patternIndex % this.mockConfig.patternResponses.length];
        this.patternIndex++;
      } else {
        // Default patterns
        patterns = this.generateDefaultPatterns(content);
      }

      this.completeRequest(request, patterns);
      return patterns;

    } catch (error) {
      this.completeRequest(request, undefined, error as AIError);
      throw error;
    }
  }

  protected async doGenerateSummary(patterns: DetectedPattern[], context?: unknown): Promise<string> {
    const request = this.createRequest('generateSummary', { patterns, context });
    
    try {
      await this.simulateLatency();
      this.checkForError();

      let response: MockResponse;
      
      if (this.mockConfig.summaryResponses && this.mockConfig.summaryResponses.length > 0) {
        response = this.mockConfig.summaryResponses[this.summaryIndex % this.mockConfig.summaryResponses.length];
        this.summaryIndex++;
      } else {
        // Default summary
        response = {
          content: `Mock summary of ${patterns.length} patterns: ${patterns.map(p => p.title).join(', ')}`
        };
      }

      if (response.error) {
        throw response.error;
      }

      if (response.delay) {
        await this.simulateDelay(response.delay);
      }

      this.completeRequest(request, response.content);
      return response.content;

    } catch (error) {
      this.completeRequest(request, undefined, error as AIError);
      throw error;
    }
  }

  protected async doAnalyzeContent(content: string, analysisType?: string): Promise<AIAnalysisResult> {
    const request = this.createRequest('analyzeContent', { content, analysisType });
    
    try {
      await this.simulateLatency();
      this.checkForError();

      let result: AIAnalysisResult;
      
      if (this.mockConfig.analysisResponses && this.mockConfig.analysisResponses.length > 0) {
        result = this.mockConfig.analysisResponses[this.analysisIndex % this.mockConfig.analysisResponses.length];
        this.analysisIndex++;
      } else {
        // Default analysis
        result = this.generateDefaultAnalysis(content, analysisType);
      }

      this.completeRequest(request, result);
      return result;

    } catch (error) {
      this.completeRequest(request, undefined, error as AIError);
      throw error;
    }
  }

  protected async doClassifyContent(content: string, categories: string[]): Promise<{ category: string; confidence: number }> {
    const request = this.createRequest('classifyContent', { content, categories });
    
    try {
      await this.simulateLatency();
      this.checkForError();

      let result: { category: string; confidence: number };
      
      if (this.mockConfig.classificationResponses && this.mockConfig.classificationResponses.length > 0) {
        result = this.mockConfig.classificationResponses[this.classificationIndex % this.mockConfig.classificationResponses.length];
        this.classificationIndex++;
      } else {
        // Default classification
        result = {
          category: categories[Math.floor(Math.random() * categories.length)],
          confidence: 0.7 + Math.random() * 0.3
        };
      }

      this.completeRequest(request, result);
      return result;

    } catch (error) {
      this.completeRequest(request, undefined, error as AIError);
      throw error;
    }
  }

  protected async doAnalyzeSentiment(content: string): Promise<{ sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }> {
    const request = this.createRequest('analyzeSentiment', { content });
    
    try {
      await this.simulateLatency();
      this.checkForError();

      let result: { sentiment: 'positive' | 'negative' | 'neutral'; confidence: number };
      
      if (this.mockConfig.sentimentResponses && this.mockConfig.sentimentResponses.length > 0) {
        result = this.mockConfig.sentimentResponses[this.sentimentIndex % this.mockConfig.sentimentResponses.length];
        this.sentimentIndex++;
      } else {
        // Default sentiment analysis
        const sentiments: Array<'positive' | 'negative' | 'neutral'> = ['positive', 'negative', 'neutral'];
        result = {
          sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
          confidence: 0.6 + Math.random() * 0.4
        };
      }

      this.completeRequest(request, result);
      return result;

    } catch (error) {
      this.completeRequest(request, undefined, error as AIError);
      throw error;
    }
  }

  protected async doDispose(): Promise<void> {
    await this.simulateDelay(10);
    this.clearRequestHistory();
    this.logger.debug('Mock adapter disposed');
  }

  // Private helper methods

  private async simulateLatency(): Promise<void> {
    if (!this.mockConfig.simulateLatency) return;
    
    const baseLatency = this.mockConfig.baseLatency ?? 100;
    const variation = this.mockConfig.latencyVariation ?? 50;
    const delay = baseLatency + (Math.random() * variation * 2 - variation);
    
    await this.simulateDelay(Math.max(0, delay));
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private checkForError(): void {
    const errorRate = this.mockConfig.errorRate ?? 0;
    if (errorRate > 0 && Math.random() < errorRate) {
      const errorTypes = this.mockConfig.errorTypes ?? [AIErrorType.REQUEST_FAILED];
      const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      throw new AIError(
        errorType,
        `Mock error simulation: ${errorType}`,
        undefined,
        true
      );
    }
  }

  private createRequest(method: string, input: unknown): MockRequest {
    const request: MockRequest = {
      id: this.generateRequestId(),
      timestamp: new Date(),
      method,
      input,
      duration: 0
    };

    if (this.mockConfig.trackRequests) {
      this.requestHistory.push(request);
      
      // Limit history size
      const maxHistory = this.mockConfig.maxRequestHistory ?? 100;
      if (this.requestHistory.length > maxHistory) {
        this.requestHistory = this.requestHistory.slice(-maxHistory);
      }
    }

    return request;
  }

  private completeRequest(request: MockRequest, output?: unknown, error?: AIError): void {
    request.duration = Date.now() - request.timestamp.getTime();
    request.output = output;
    request.error = error;
  }

  private generateDefaultPatterns(content: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const words = content.split(/\s+/);
    const patternCount = Math.min(3, Math.floor(words.length / 50) + 1);

    for (let i = 0; i < patternCount; i++) {
      patterns.push({
        id: `mock-pattern-${i + 1}`,
        type: ['habit', 'goal', 'challenge', 'insight'][Math.floor(Math.random() * 4)] as DetectedPattern['type'],
        title: `Mock Pattern ${i + 1}`,
        description: `This is a mock pattern extracted from the content.`,
        confidence: 0.6 + Math.random() * 0.4,
        evidence: [`Evidence from content: "${words.slice(i * 10, (i + 1) * 10).join(' ')}"`],
        metadata: {
          sourceFiles: ['mock-file.md'],
          keywords: words.slice(i * 5, (i + 1) * 5),
          sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)] as 'positive' | 'negative' | 'neutral',
          importance: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
          category: 'mock-category'
        }
      });
    }

    return patterns;
  }

  private generateDefaultAnalysis(content: string, analysisType?: string): AIAnalysisResult {
    const patterns = this.generateDefaultPatterns(content);
    
    return {
      success: true,
      patterns,
      summary: `Mock analysis summary for ${analysisType || 'general'} analysis of ${content.length} characters.`,
      insights: [
        'Mock insight 1: Content shows interesting patterns',
        'Mock insight 2: Several themes emerge from the analysis',
        'Mock insight 3: The content demonstrates clear structure'
      ],
      recommendations: [
        'Mock recommendation 1: Consider expanding on key themes',
        'Mock recommendation 2: Look for additional patterns',
        'Mock recommendation 3: Review insights for actionable items'
      ],
      confidence: 0.75,
      processingTime: 150 + Math.random() * 100,
      modelUsed: this.name,
      tokensUsed: Math.floor(content.length / 4) + Math.floor(Math.random() * 200)
    };
  }

  protected generateRequestId(): string {
    return `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create a mock adapter with predefined test scenarios
 */
export class MockAdapterFactory {
  /**
   * Create a mock adapter for successful operations
   */
  static createSuccessfulAdapter(logger: Logger, config: AIModelConfig): MockAIAdapter {
    return new MockAIAdapter(logger, config, {
      simulateLatency: false,
      errorRate: 0,
      isHealthy: true,
      trackRequests: true
    });
  }

  /**
   * Create a mock adapter that simulates errors
   */
  static createErrorAdapter(logger: Logger, config: AIModelConfig, errorRate = 0.5): MockAIAdapter {
    return new MockAIAdapter(logger, config, {
      simulateLatency: true,
      errorRate,
      errorTypes: [AIErrorType.REQUEST_FAILED, AIErrorType.TIMEOUT, AIErrorType.RATE_LIMITED],
      isHealthy: false,
      trackRequests: true
    });
  }

  /**
   * Create a mock adapter with high latency for performance testing
   */
  static createSlowAdapter(logger: Logger, config: AIModelConfig): MockAIAdapter {
    return new MockAIAdapter(logger, config, {
      simulateLatency: true,
      baseLatency: 2000,
      latencyVariation: 1000,
      errorRate: 0,
      isHealthy: true,
      trackRequests: true
    });
  }

  /**
   * Create a mock adapter with limited capabilities
   */
  static createLimitedAdapter(logger: Logger, config: AIModelConfig, capabilities: AICapability[]): MockAIAdapter {
    const adapter = new MockAIAdapter(logger, config, {
      simulateLatency: false,
      errorRate: 0,
      isHealthy: true,
      enabledCapabilities: capabilities,
      trackRequests: true
    });
    adapter.setEnabledCapabilities(capabilities);
    return adapter;
  }

  /**
   * Create a mock adapter with predefined responses
   */
  static createScriptedAdapter(
    logger: Logger, 
    config: AIModelConfig,
    responses: {
      completions?: MockResponse[];
      patterns?: DetectedPattern[][];
      summaries?: MockResponse[];
      analyses?: AIAnalysisResult[];
    }
  ): MockAIAdapter {
    return new MockAIAdapter(logger, config, {
      simulateLatency: false,
      errorRate: 0,
      isHealthy: true,
      completionResponses: responses.completions,
      patternResponses: responses.patterns,
      summaryResponses: responses.summaries,
      analysisResponses: responses.analyses,
      trackRequests: true
    });
  }
} 