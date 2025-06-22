/**
 * Request/Response Translation Layer
 * 
 * This module provides utilities for converting between unified format and 
 * provider-specific formats for requests, responses, and configurations.
 * 
 * Extracted from common patterns found in OpenAI, Ollama, LlamaCpp, and Mock adapters.
 */

import { Logger } from './logger';
import {
  AIModelConfig,
  AIError,
  AIErrorType,
  CompletionOptions,
  PrivacyLevel
} from './ai-interfaces';
import {
  UnifiedModelConfig,
  AIModelRequest,
  AIModelResponse,
  AIMessage,
  AIGenerationParameters,
  AITokenUsage,
  AIErrorDetails,
  AIPrivacyLevel,
  AIErrorType as UnifiedAIErrorType
} from './unified-ai-interfaces';

// ========================================
// CORE TRANSLATION UTILITIES
// ========================================

/**
 * Core message conversion utilities
 */
export class MessageTranslator {
  /**
   * Extract a simple string prompt from AI messages array
   * Used when providers only support string prompts
   */
  static extractPromptFromMessages(messages: AIMessage[]): string {
    return messages
      .map(msg => {
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content);
        
        switch (msg.role) {
          case 'system':
            return `System: ${content}`;
          case 'user':
            return `User: ${content}`;
          case 'assistant':
            return `Assistant: ${content}`;
          case 'function':
          case 'tool':
            return `${msg.role}: ${content}`;
          default:
            return content;
        }
      })
      .join('\n\n');
  }

  /**
   * Convert string prompt to AI message format
   */
  static convertPromptToMessages(
    prompt: string,
    role: 'system' | 'user' | 'assistant' = 'user'
  ): AIMessage[] {
    return [{
      role,
      content: prompt,
      metadata: {
        timestamp: new Date(),
        source: 'prompt-conversion'
      }
    }];
  }

  /**
   * Validate message content and ensure proper format
   */
  static validateMessages(messages: AIMessage[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(messages) || messages.length === 0) {
      errors.push('Messages array is required and must not be empty');
      return { valid: false, errors };
    }

    messages.forEach((message, index) => {
      if (!message.role || typeof message.role !== 'string') {
        errors.push(`Message ${index}: role is required and must be a string`);
      }
      
      if (!message.content) {
        errors.push(`Message ${index}: content is required`);
      }
      
      if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
        errors.push(`Message ${index}: content must be string or array`);
      }
    });

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Parameter conversion utilities
 */
export class ParameterTranslator {
  /**
   * Convert unified generation parameters to legacy completion options
   */
  static toLegacyOptions(params?: AIGenerationParameters): CompletionOptions | undefined {
    if (!params) return undefined;
    
    return {
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      topP: params.topP,
      topK: params.topK,
      stopSequences: params.stopSequences,
      presencePenalty: params.presencePenalty,
      frequencyPenalty: params.frequencyPenalty,
      seed: params.seed,
      stream: params.stream
    };
  }

  /**
   * Convert legacy completion options to unified generation parameters
   */
  static fromLegacyOptions(options?: CompletionOptions): AIGenerationParameters | undefined {
    if (!options) return undefined;
    
    return {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      topP: options.topP,
      topK: options.topK,
      stopSequences: options.stopSequences,
      presencePenalty: options.presencePenalty,
      frequencyPenalty: options.frequencyPenalty,
      seed: options.seed,
      stream: options.stream
    };
  }

  /**
   * Apply default parameters with fallbacks
   */
  static applyDefaults(params?: AIGenerationParameters): AIGenerationParameters {
    return {
      maxTokens: params?.maxTokens || 1000,
      temperature: params?.temperature ?? 0.7,
      topP: params?.topP,
      topK: params?.topK,
      stopSequences: params?.stopSequences,
      presencePenalty: params?.presencePenalty,
      frequencyPenalty: params?.frequencyPenalty,
      seed: params?.seed,
      stream: params?.stream || false,
      n: params?.n || 1,
      logprobs: params?.logprobs || false,
      topLogprobs: params?.topLogprobs
    };
  }
}

/**
 * Error conversion utilities
 */
export class ErrorTranslator {
  /**
   * Convert legacy AI error to unified error details
   */
  static toUnifiedError(error: AIError, provider: string): AIErrorDetails {
    return {
      code: error.type,
      message: error.message,
      type: this.convertLegacyErrorType(error.type),
      severity: this.determineSeverity(error.type),
      retryable: error.retryable,
      providerError: {
        originalCode: error.type,
        originalMessage: error.message,
        details: error.details
      },
      context: {
        provider,
        timestamp: new Date(),
        stackTrace: error.stack
      },
      recoveryActions: this.getRecoveryActions(error.type)
    };
  }

  /**
   * Convert unknown error to unified error details
   */
  static fromUnknownError(error: unknown, provider: string): AIErrorDetails {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    return {
      code: 'UNKNOWN_ERROR',
      message,
      type: UnifiedAIErrorType.UNKNOWN_ERROR,
      severity: 'medium',
      retryable: false,
      context: {
        provider,
        timestamp: new Date(),
        stackTrace: stack
      }
    };
  }

  /**
   * Convert legacy error type to unified error type
   */
  private static convertLegacyErrorType(legacyType: AIErrorType): UnifiedAIErrorType {
    const mapping: Record<AIErrorType, UnifiedAIErrorType> = {
      [AIErrorType.INITIALIZATION_FAILED]: UnifiedAIErrorType.INITIALIZATION_FAILED,
      [AIErrorType.MODEL_UNAVAILABLE]: UnifiedAIErrorType.MODEL_UNAVAILABLE,
      [AIErrorType.INVALID_CONFIG]: UnifiedAIErrorType.INVALID_CONFIG,
      [AIErrorType.REQUEST_FAILED]: UnifiedAIErrorType.REQUEST_FAILED,
      [AIErrorType.TIMEOUT]: UnifiedAIErrorType.TIMEOUT,
      [AIErrorType.RATE_LIMITED]: UnifiedAIErrorType.RATE_LIMITED,
      [AIErrorType.INVALID_RESPONSE]: UnifiedAIErrorType.RESPONSE_INVALID,
      [AIErrorType.QUOTA_EXCEEDED]: UnifiedAIErrorType.QUOTA_EXCEEDED,
      [AIErrorType.AUTHENTICATION_FAILED]: UnifiedAIErrorType.AUTHENTICATION_FAILED,
      [AIErrorType.NETWORK_ERROR]: UnifiedAIErrorType.NETWORK_ERROR,
      [AIErrorType.UNKNOWN_ERROR]: UnifiedAIErrorType.UNKNOWN_ERROR
    };
    
    return mapping[legacyType] || UnifiedAIErrorType.UNKNOWN_ERROR;
  }

  /**
   * Determine error severity based on type
   */
  private static determineSeverity(errorType: AIErrorType): 'low' | 'medium' | 'high' | 'critical' {
    const criticalErrors = [AIErrorType.AUTHENTICATION_FAILED, AIErrorType.QUOTA_EXCEEDED];
    const highErrors = [AIErrorType.INITIALIZATION_FAILED, AIErrorType.MODEL_UNAVAILABLE];
    const mediumErrors = [AIErrorType.REQUEST_FAILED, AIErrorType.TIMEOUT, AIErrorType.RATE_LIMITED];
    
    if (criticalErrors.includes(errorType)) return 'critical';
    if (highErrors.includes(errorType)) return 'high';
    if (mediumErrors.includes(errorType)) return 'medium';
    return 'low';
  }

  /**
   * Get suggested recovery actions for error types
   */
  private static getRecoveryActions(errorType: AIErrorType): string[] {
    const actions: Record<AIErrorType, string[]> = {
      [AIErrorType.AUTHENTICATION_FAILED]: ['Check API key', 'Verify credentials', 'Contact provider'],
      [AIErrorType.RATE_LIMITED]: ['Wait and retry', 'Reduce request frequency', 'Implement backoff'],
      [AIErrorType.QUOTA_EXCEEDED]: ['Check usage limits', 'Upgrade plan', 'Wait for quota reset'],
      [AIErrorType.NETWORK_ERROR]: ['Check internet connection', 'Verify endpoint URL', 'Retry request'],
      [AIErrorType.TIMEOUT]: ['Increase timeout', 'Reduce request size', 'Retry with smaller payload'],
      [AIErrorType.MODEL_UNAVAILABLE]: ['Check model name', 'Try alternative model', 'Contact provider'],
      [AIErrorType.INVALID_CONFIG]: ['Validate configuration', 'Check required fields', 'Review documentation'],
      [AIErrorType.REQUEST_FAILED]: ['Check request format', 'Validate parameters', 'Review error details'],
      [AIErrorType.INVALID_RESPONSE]: ['Retry request', 'Check model status', 'Contact support'],
      [AIErrorType.INITIALIZATION_FAILED]: ['Check configuration', 'Verify dependencies', 'Restart service'],
      [AIErrorType.UNKNOWN_ERROR]: ['Check logs', 'Retry request', 'Contact support']
    };
    
    return actions[errorType] || ['Check logs', 'Retry request', 'Contact support'];
  }
}

/**
 * Configuration conversion utilities
 */
export class ConfigTranslator {
  /**
   * Convert legacy config to unified config
   */
  static toUnifiedConfig(legacyConfig: AIModelConfig): UnifiedModelConfig {
    return {
      // Basic configuration
      name: legacyConfig.name,
      type: legacyConfig.type,
      endpoint: legacyConfig.endpoint,
      apiKey: legacyConfig.apiKey,
      model: legacyConfig.model,
      maxTokens: legacyConfig.maxTokens,
      temperature: legacyConfig.temperature,
      timeout: legacyConfig.timeout,
      retryAttempts: legacyConfig.retryAttempts,
      retryDelay: legacyConfig.retryDelay,
      customHeaders: legacyConfig.customHeaders,
      customParameters: legacyConfig.customParameters,
      
      // Enhanced configuration defaults
      privacyLevel: this.convertPrivacyLevel('local'), // Default fallback
      capabilities: [],
      enableCaching: true,
      cacheTTL: 3600,
      enableBatching: false,
      maxBatchSize: 5,
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info'
    };
  }

  /**
   * Convert unified config to legacy config
   */
  static toLegacyConfig(unifiedConfig: UnifiedModelConfig): AIModelConfig {
    return {
      name: unifiedConfig.name,
      type: unifiedConfig.type,
      endpoint: unifiedConfig.endpoint,
      apiKey: unifiedConfig.apiKey,
      model: unifiedConfig.model,
      maxTokens: unifiedConfig.maxTokens,
      temperature: unifiedConfig.temperature,
      timeout: unifiedConfig.timeout,
      retryAttempts: unifiedConfig.retryAttempts,
      retryDelay: unifiedConfig.retryDelay,
      customHeaders: unifiedConfig.customHeaders,
      customParameters: unifiedConfig.customParameters
    };
  }

  /**
   * Convert between privacy level types
   */
  static convertPrivacyLevel(privacyLevel: PrivacyLevel | AIPrivacyLevel): AIPrivacyLevel {
    if (typeof privacyLevel === 'string' && 
        ['public', 'private', 'confidential', 'encrypted', 'air-gapped'].includes(privacyLevel)) {
      return privacyLevel as AIPrivacyLevel;
    }
    
    // Convert legacy privacy levels
    switch (privacyLevel) {
      case 'local':
        return 'confidential';
      case 'cloud':
        return 'private';
      case 'hybrid':
        return 'encrypted';
      default:
        return 'private';
    }
  }
}

/**
 * Response conversion utilities
 */
export class ResponseTranslator {
  /**
   * Create a basic AI model response from completion text
   */
  static createBasicResponse(
    requestId: string,
    model: string,
    content: string,
    usage?: AITokenUsage,
    processingTime?: number
  ): AIModelResponse {
    return {
      id: this.generateResponseId(),
      requestId,
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
          metadata: {
            timestamp: new Date()
          }
        },
        finishReason: 'stop'
      }],
      usage,
      createdAt: new Date(),
      processingTime: processingTime || 0
    };
  }

  /**
   * Create error response for failed requests
   */
  static createErrorResponse(
    requestId: string,
    model: string,
    error: AIErrorDetails
  ): AIModelResponse {
    return {
      id: this.generateResponseId(),
      requestId,
      model,
      choices: [],
      error,
      createdAt: new Date(),
      processingTime: 0
    };
  }

  /**
   * Estimate token usage for text content
   */
  static estimateTokenUsage(prompt: string, completion: string): AITokenUsage {
    // Rough estimation: ~4 characters per token for English text
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(completion.length / 4);
    
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    };
  }

  /**
   * Generate unique response ID
   */
  private static generateResponseId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ========================================
// PROVIDER-SPECIFIC TRANSLATION FACTORIES
// ========================================

/**
 * OpenAI-specific translation utilities
 */
export class OpenAITranslator {
  /**
   * Convert AI messages to OpenAI message format
   */
  static convertMessages(messages: AIMessage[]): Array<{
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
    function_call?: { name: string; arguments: string };
  }> {
    return messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant' | 'function',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      name: msg.name,
      function_call: msg.function_call
    }));
  }

  /**
   * Map OpenAI error status codes to AI errors
   */
  static mapError(status: number, errorData: any): AIError {
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

/**
 * Ollama-specific translation utilities
 */
export class OllamaTranslator {
  /**
   * Convert generation parameters to Ollama options
   */
  static convertParameters(params?: AIGenerationParameters): any {
    if (!params) return {};
    
    return {
      temperature: params.temperature,
      top_p: params.topP,
      top_k: params.topK,
      num_predict: params.maxTokens,
      stop: params.stopSequences
    };
  }

  /**
   * Map Ollama errors to AI errors
   */
  static mapError(error: any): AIError {
    const message = error.message || String(error);
    
    if (message.includes('model not found')) {
      return new AIError(AIErrorType.MODEL_UNAVAILABLE, `Model not found: ${message}`, error, false);
    }
    
    if (message.includes('connection')) {
      return new AIError(AIErrorType.NETWORK_ERROR, `Connection error: ${message}`, error, true);
    }
    
    return new AIError(AIErrorType.REQUEST_FAILED, `Ollama error: ${message}`, error, true);
  }
}

/**
 * Validation utilities for translations
 */
export class TranslationValidator {
  /**
   * Validate that a translation preserves essential information
   */
  static validateMessageTranslation(
    original: AIMessage[],
    translated: any,
    translatorName: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!Array.isArray(translated)) {
      errors.push(`${translatorName}: Translated messages must be an array`);
      return { valid: false, errors };
    }
    
    if (original.length !== translated.length) {
      errors.push(`${translatorName}: Message count mismatch (${original.length} -> ${translated.length})`);
    }
    
    original.forEach((msg, index) => {
      const translatedMsg = translated[index];
      if (!translatedMsg) {
        errors.push(`${translatorName}: Missing translated message at index ${index}`);
        return;
      }
      
      if (!translatedMsg.role) {
        errors.push(`${translatorName}: Missing role in translated message ${index}`);
      }
      
      if (!translatedMsg.content) {
        errors.push(`${translatorName}: Missing content in translated message ${index}`);
      }
    });
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate parameter translation
   */
  static validateParameterTranslation(
    original: AIGenerationParameters | undefined,
    translated: any,
    translatorName: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!original && !translated) {
      return { valid: true, errors: [] };
    }
    
    if (original && !translated) {
      errors.push(`${translatorName}: Parameters were lost in translation`);
      return { valid: false, errors };
    }
    
    // Check key parameters are preserved
    const keyParams = ['temperature', 'maxTokens', 'topP', 'topK'];
    keyParams.forEach(param => {
      const originalKey = param as keyof AIGenerationParameters;
      if (original?.[originalKey] !== undefined && translated[param] === undefined) {
        errors.push(`${translatorName}: Parameter ${param} was lost in translation`);
      }
    });
    
    return { valid: errors.length === 0, errors };
  }
}

// ========================================
// TRANSLATION LAYER ORCHESTRATOR
// ========================================

/**
 * Main translation layer orchestrator
 * Coordinates all translation utilities and provides a unified interface
 */
export class AITranslationLayer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Get message translator
   */
  get messages(): typeof MessageTranslator {
    return MessageTranslator;
  }

  /**
   * Get parameter translator
   */
  get parameters(): typeof ParameterTranslator {
    return ParameterTranslator;
  }

  /**
   * Get error translator
   */
  get errors(): typeof ErrorTranslator {
    return ErrorTranslator;
  }

  /**
   * Get configuration translator
   */
  get config(): typeof ConfigTranslator {
    return ConfigTranslator;
  }

  /**
   * Get response translator
   */
  get responses(): typeof ResponseTranslator {
    return ResponseTranslator;
  }

  /**
   * Get provider-specific translators
   */
  get providers() {
    return {
      openai: OpenAITranslator,
      ollama: OllamaTranslator
    };
  }

  /**
   * Get validation utilities
   */
  get validator(): typeof TranslationValidator {
    return TranslationValidator;
  }

  /**
   * Create a request translator for a specific provider
   */
  createRequestTranslator(provider: string) {
    return {
      translateRequest: (request: AIModelRequest) => {
        this.logger.debug(`Translating request for ${provider}`, { requestId: request.id });
        
        // Common validation
        const messageValidation = MessageTranslator.validateMessages(request.messages);
        if (!messageValidation.valid) {
          throw new Error(`Message validation failed: ${messageValidation.errors.join(', ')}`);
        }
        
        // Provider-specific translation would go here
        // This is where adapters can plug in their specific translation logic
        
        return request;
      },
      
      translateResponse: (response: any, requestId: string, model: string) => {
        this.logger.debug(`Translating response for ${provider}`, { requestId });
        
        // Provider-specific response translation would go here
        // This provides a framework for adapters to implement their specific logic
        
        return response;
      }
    };
  }
} 