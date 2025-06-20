/**
 * Unified AI Data Structures - Validation and Utilities
 * Companion module for unified-ai-interfaces.ts providing validation, factories, and utilities
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

import {
  AIMessage,
  AIModelRequest,
  AIBatchRequest,
  AIErrorDetails,
  AITokenUsage,
  AIGenerationParameters,
  AIRequestConfig,
  AIValidationResult,
  AIValidationError,
  AIValidationWarning,
  AIErrorType,
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_REQUEST_CONFIG,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_STREAM_CONFIG,
  AI_LIMITS,
  SUPPORTED_MESSAGE_ROLES,
  ERROR_CODES,
  isErrorResponse,
  isRetryableError,
  isFinalStreamChunk,
  hasToolCalls,
  hasFunctionCall
} from './unified-ai-interfaces';

// ========================================
// DATA STRUCTURE FACTORIES
// ========================================

/**
 * Factory for creating standardized AI messages
 */
export class AIMessageFactory {
  /**
   * Create a system message
   */
  static createSystemMessage(content: string, metadata?: Partial<AIMessage['metadata']>): AIMessage {
    return {
      role: 'system',
      content,
      metadata: {
        id: this.generateMessageId(),
        timestamp: new Date(),
        source: 'system',
        priority: 'normal',
        ...metadata
      }
    };
  }

  /**
   * Create a user message
   */
  static createUserMessage(content: string, metadata?: Partial<AIMessage['metadata']>): AIMessage {
    return {
      role: 'user',
      content,
      metadata: {
        id: this.generateMessageId(),
        timestamp: new Date(),
        source: 'user',
        priority: 'normal',
        ...metadata
      }
    };
  }

  /**
   * Create an assistant message
   */
  static createAssistantMessage(content: string, metadata?: Partial<AIMessage['metadata']>): AIMessage {
    return {
      role: 'assistant',
      content,
      metadata: {
        id: this.generateMessageId(),
        timestamp: new Date(),
        source: 'assistant',
        priority: 'normal',
        ...metadata
      }
    };
  }

  /**
   * Create a function call message
   */
  static createFunctionCallMessage(
    functionName: string,
    functionArgs: string,
    metadata?: Partial<AIMessage['metadata']>
  ): AIMessage {
    return {
      role: 'assistant',
      content: '',
      function_call: {
        name: functionName,
        arguments: functionArgs
      },
      metadata: {
        id: this.generateMessageId(),
        timestamp: new Date(),
        source: 'assistant',
        priority: 'normal',
        ...metadata
      }
    };
  }

  /**
   * Create a tool call response message
   */
  static createToolResponseMessage(
    toolCallId: string,
    content: string,
    metadata?: Partial<AIMessage['metadata']>
  ): AIMessage {
    return {
      role: 'tool',
      content,
      tool_call_id: toolCallId,
      metadata: {
        id: this.generateMessageId(),
        timestamp: new Date(),
        source: 'tool',
        priority: 'normal',
        ...metadata
      }
    };
  }

  /**
   * Generate a unique message ID
   */
  private static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory for creating AI model requests
 */
export class AIRequestFactory {
  /**
   * Create a basic text completion request
   */
  static createTextCompletionRequest(
    model: string,
    prompt: string,
    parameters?: Partial<AIGenerationParameters>,
    config?: Partial<AIRequestConfig>
  ): AIModelRequest {
    return {
      id: this.generateRequestId(),
      model,
      messages: [AIMessageFactory.createUserMessage(prompt)],
      parameters: { ...DEFAULT_GENERATION_PARAMETERS, ...parameters },
      config: { ...DEFAULT_REQUEST_CONFIG, ...config },
      metadata: {
        source: 'api',
        priority: 'normal',
        expectedResponseType: 'text',
        tags: ['text-completion']
      }
    };
  }

  /**
   * Create a conversation request
   */
  static createConversationRequest(
    model: string,
    messages: AIMessage[],
    parameters?: Partial<AIGenerationParameters>,
    config?: Partial<AIRequestConfig>
  ): AIModelRequest {
    return {
      id: this.generateRequestId(),
      model,
      messages,
      parameters: { ...DEFAULT_GENERATION_PARAMETERS, ...parameters },
      config: { ...DEFAULT_REQUEST_CONFIG, ...config },
      metadata: {
        source: 'api',
        priority: 'normal',
        expectedResponseType: 'conversation',
        tags: ['conversation']
      }
    };
  }

  /**
   * Create a function calling request
   */
  static createFunctionCallRequest(
    model: string,
    messages: AIMessage[],
    tools: Array<{ type: 'function'; function: { name: string; description?: string; parameters?: Record<string, unknown> } }>,
    parameters?: Partial<AIGenerationParameters>,
    config?: Partial<AIRequestConfig>
  ): AIModelRequest {
    return {
      id: this.generateRequestId(),
      model,
      messages,
      parameters: {
        ...DEFAULT_GENERATION_PARAMETERS,
        tools,
        toolChoice: 'auto',
        ...parameters
      },
      config: { ...DEFAULT_REQUEST_CONFIG, ...config },
      metadata: {
        source: 'api',
        priority: 'normal',
        expectedResponseType: 'function-call',
        tags: ['function-calling']
      }
    };
  }

  /**
   * Create a streaming request
   */
  static createStreamingRequest(
    model: string,
    messages: AIMessage[],
    parameters?: Partial<AIGenerationParameters>,
    config?: Partial<AIRequestConfig>
  ): AIModelRequest {
    return {
      id: this.generateRequestId(),
      model,
      messages,
      parameters: {
        ...DEFAULT_GENERATION_PARAMETERS,
        stream: true,
        ...parameters
      },
      config: { ...DEFAULT_REQUEST_CONFIG, ...config },
      metadata: {
        source: 'api',
        priority: 'normal',
        expectedResponseType: 'stream',
        tags: ['streaming']
      }
    };
  }

  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory for creating AI batch requests
 */
export class AIBatchFactory {
  /**
   * Create a batch request from multiple individual requests
   */
  static createBatchRequest(
    requests: AIModelRequest[],
    config?: Partial<typeof DEFAULT_BATCH_CONFIG>
  ): AIBatchRequest {
    return {
      id: this.generateBatchId(),
      requests,
      config: { ...DEFAULT_BATCH_CONFIG, ...config },
      metadata: {
        priority: 'normal',
        expectedProcessingTime: this.estimateProcessingTime(requests),
        resourceRequirements: this.estimateResourceRequirements(requests)
      }
    };
  }

  /**
   * Create a batch request for similar prompts
   */
  static createSimilarPromptsBatch(
    model: string,
    prompts: string[],
    parameters?: Partial<AIGenerationParameters>,
    config?: Partial<typeof DEFAULT_BATCH_CONFIG>
  ): AIBatchRequest {
    const requests = prompts.map(prompt => 
      AIRequestFactory.createTextCompletionRequest(model, prompt, parameters)
    );

    return this.createBatchRequest(requests, {
      ...config,
      parallelism: { enabled: true, maxConcurrency: Math.min(5, prompts.length) }
    });
  }

  /**
   * Estimate processing time for a batch
   */
  private static estimateProcessingTime(requests: AIModelRequest[]): number {
    // Simple estimation: 2 seconds per request + 1 second overhead
    return (requests.length * 2000) + 1000;
  }

  /**
   * Estimate resource requirements for a batch
   */
  private static estimateResourceRequirements(requests: AIModelRequest[]): {
    memoryMB: number;
    cpuCores: number;
    gpuMemoryMB?: number;
  } {
    const baseMemoryPerRequest = 50; // MB
    const baseCpuCores = Math.min(4, Math.max(1, Math.ceil(requests.length / 5)));

    return {
      memoryMB: requests.length * baseMemoryPerRequest,
      cpuCores: baseCpuCores,
      gpuMemoryMB: requests.length * 100 // Optional GPU memory estimate
    };
  }

  /**
   * Generate a unique batch ID
   */
  private static generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Comprehensive validation utilities for AI data structures
 */
export class AIDataValidator {
  /**
   * Validate an AI message
   */
  static validateMessage(message: AIMessage): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    // Validate role
    if (!message.role || typeof message.role !== 'string') {
      errors.push({
        code: 'INVALID_ROLE',
        message: 'Message role is required and must be a string',
        path: 'role',
        expected: 'string',
        actual: typeof message.role
      });
    } else if (!SUPPORTED_MESSAGE_ROLES.includes(message.role as any) && !message.role.startsWith('custom_')) {
      warnings.push({
        code: 'UNSUPPORTED_ROLE',
        message: `Role '${message.role}' is not in the standard supported roles`,
        path: 'role',
        suggestion: `Use one of: ${SUPPORTED_MESSAGE_ROLES.join(', ')} or prefix with 'custom_'`
      });
    }

    // Validate content
    if (!message.content || (typeof message.content !== 'string' && !Array.isArray(message.content))) {
      errors.push({
        code: 'INVALID_CONTENT',
        message: 'Message content is required and must be a string or array',
        path: 'content',
        expected: 'string | AIMessageContent[]',
        actual: typeof message.content
      });
    }

    // Validate content length for string content
    if (typeof message.content === 'string' && message.content.length > 100000) {
      warnings.push({
        code: 'CONTENT_TOO_LONG',
        message: 'Message content is very long and may cause performance issues',
        path: 'content',
        suggestion: 'Consider breaking into smaller messages or using file attachments'
      });
    }

    // Validate function call format
    if (message.function_call) {
      if (!message.function_call.name || typeof message.function_call.name !== 'string') {
        errors.push({
          code: 'INVALID_FUNCTION_NAME',
          message: 'Function call name is required and must be a string',
          path: 'function_call.name',
          expected: 'string',
          actual: typeof message.function_call.name
        });
      }

      if (!message.function_call.arguments || typeof message.function_call.arguments !== 'string') {
        errors.push({
          code: 'INVALID_FUNCTION_ARGUMENTS',
          message: 'Function call arguments must be a string',
          path: 'function_call.arguments',
          expected: 'string',
          actual: typeof message.function_call.arguments
        });
      }
    }

    // Validate tool calls
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach((toolCall, index) => {
        if (!toolCall.id || typeof toolCall.id !== 'string') {
          errors.push({
            code: 'INVALID_TOOL_CALL_ID',
            message: 'Tool call ID is required and must be a string',
            path: `tool_calls[${index}].id`,
            expected: 'string',
            actual: typeof toolCall.id
          });
        }

        if (!toolCall.function?.name) {
          errors.push({
            code: 'INVALID_TOOL_CALL_FUNCTION',
            message: 'Tool call function name is required',
            path: `tool_calls[${index}].function.name`,
            expected: 'string',
            actual: typeof toolCall.function?.name
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '2.0.0',
        validationTime: Date.now()
      }
    };
  }

  /**
   * Validate an AI model request
   */
  static validateRequest(request: AIModelRequest): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    // Validate basic fields
    if (!request.id || typeof request.id !== 'string') {
      errors.push({
        code: 'MISSING_REQUEST_ID',
        message: 'Request ID is required and must be a string',
        path: 'id',
        expected: 'string',
        actual: typeof request.id
      });
    }

    if (!request.model || typeof request.model !== 'string') {
      errors.push({
        code: 'MISSING_MODEL',
        message: 'Model is required and must be a string',
        path: 'model',
        expected: 'string',
        actual: typeof request.model
      });
    }

    if (!request.messages || !Array.isArray(request.messages) || request.messages.length === 0) {
      errors.push({
        code: 'INVALID_MESSAGES',
        message: 'Messages array is required and must contain at least one message',
        path: 'messages',
        expected: 'AIMessage[]',
        actual: typeof request.messages
      });
    } else {
      // Validate each message
      request.messages.forEach((message, index) => {
        const messageValidation = this.validateMessage(message);
        messageValidation.errors.forEach(error => {
          errors.push({
            ...error,
            path: `messages[${index}].${error.path}`
          });
        });
        messageValidation.warnings?.forEach(warning => {
          warnings.push({
            ...warning,
            path: `messages[${index}].${warning.path}`
          });
        });
      });

      // Check message count limit
      if (request.messages.length > AI_LIMITS.MAX_MESSAGES) {
        errors.push({
          code: 'TOO_MANY_MESSAGES',
          message: `Too many messages: ${request.messages.length} (max: ${AI_LIMITS.MAX_MESSAGES})`,
          path: 'messages',
          expected: `<= ${AI_LIMITS.MAX_MESSAGES}`,
          actual: request.messages.length
        });
      }
    }

    // Validate parameters
    if (request.parameters) {
      const paramValidation = this.validateGenerationParameters(request.parameters);
      errors.push(...paramValidation.errors);
      warnings.push(...(paramValidation.warnings || []));
    }

    // Validate configuration
    if (request.config) {
      const configValidation = this.validateRequestConfig(request.config);
      errors.push(...configValidation.errors);
      warnings.push(...(configValidation.warnings || []));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '2.0.0',
        validationTime: Date.now()
      }
    };
  }

  /**
   * Validate generation parameters
   */
  static validateGenerationParameters(params: AIGenerationParameters): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    // Validate maxTokens
    if (params.maxTokens !== undefined) {
      if (typeof params.maxTokens !== 'number' || params.maxTokens <= 0) {
        errors.push({
          code: 'INVALID_MAX_TOKENS',
          message: 'maxTokens must be a positive number',
          path: 'maxTokens',
          expected: 'positive number',
          actual: params.maxTokens
        });
      } else if (params.maxTokens > AI_LIMITS.MAX_TOKENS) {
        errors.push({
          code: 'MAX_TOKENS_EXCEEDED',
          message: `maxTokens exceeds limit: ${params.maxTokens} (max: ${AI_LIMITS.MAX_TOKENS})`,
          path: 'maxTokens',
          expected: `<= ${AI_LIMITS.MAX_TOKENS}`,
          actual: params.maxTokens
        });
      }
    }

    // Validate temperature
    if (params.temperature !== undefined) {
      if (typeof params.temperature !== 'number' || params.temperature < 0 || params.temperature > 2) {
        errors.push({
          code: 'INVALID_TEMPERATURE',
          message: 'temperature must be a number between 0 and 2',
          path: 'temperature',
          expected: '0 <= number <= 2',
          actual: params.temperature
        });
      }
    }

    // Validate topP
    if (params.topP !== undefined) {
      if (typeof params.topP !== 'number' || params.topP <= 0 || params.topP > 1) {
        errors.push({
          code: 'INVALID_TOP_P',
          message: 'topP must be a number between 0 and 1',
          path: 'topP',
          expected: '0 < number <= 1',
          actual: params.topP
        });
      }
    }

    // Validate topK
    if (params.topK !== undefined) {
      if (typeof params.topK !== 'number' || params.topK <= 0 || !Number.isInteger(params.topK)) {
        errors.push({
          code: 'INVALID_TOP_K',
          message: 'topK must be a positive integer',
          path: 'topK',
          expected: 'positive integer',
          actual: params.topK
        });
      }
    }

    // Validate n (number of choices)
    if (params.n !== undefined) {
      if (typeof params.n !== 'number' || params.n <= 0 || !Number.isInteger(params.n)) {
        errors.push({
          code: 'INVALID_N',
          message: 'n must be a positive integer',
          path: 'n',
          expected: 'positive integer',
          actual: params.n
        });
      } else if (params.n > AI_LIMITS.MAX_CHOICES) {
        errors.push({
          code: 'TOO_MANY_CHOICES',
          message: `n exceeds limit: ${params.n} (max: ${AI_LIMITS.MAX_CHOICES})`,
          path: 'n',
          expected: `<= ${AI_LIMITS.MAX_CHOICES}`,
          actual: params.n
        });
      }
    }

    // Validate tools
    if (params.tools && Array.isArray(params.tools)) {
      if (params.tools.length > AI_LIMITS.MAX_TOOLS) {
        errors.push({
          code: 'TOO_MANY_TOOLS',
          message: `Too many tools: ${params.tools.length} (max: ${AI_LIMITS.MAX_TOOLS})`,
          path: 'tools',
          expected: `<= ${AI_LIMITS.MAX_TOOLS}`,
          actual: params.tools.length
        });
      }

      params.tools.forEach((tool, index) => {
        if (!tool.function?.name) {
          errors.push({
            code: 'INVALID_TOOL_FUNCTION',
            message: 'Tool function name is required',
            path: `tools[${index}].function.name`,
            expected: 'string',
            actual: typeof tool.function?.name
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '2.0.0',
        validationTime: Date.now()
      }
    };
  }

  /**
   * Validate request configuration
   */
  static validateRequestConfig(config: AIRequestConfig): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    // Validate timeout
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout <= 0) {
        errors.push({
          code: 'INVALID_TIMEOUT',
          message: 'timeout must be a positive number',
          path: 'timeout',
          expected: 'positive number',
          actual: config.timeout
        });
      } else if (config.timeout > AI_LIMITS.MAX_TIMEOUT) {
        warnings.push({
          code: 'VERY_LONG_TIMEOUT',
          message: `Timeout is very long: ${config.timeout}ms`,
          path: 'timeout',
          suggestion: 'Consider using a shorter timeout for better user experience'
        });
      }
    }

    // Validate retry attempts
    if (config.retryAttempts !== undefined) {
      if (typeof config.retryAttempts !== 'number' || config.retryAttempts < 0 || !Number.isInteger(config.retryAttempts)) {
        errors.push({
          code: 'INVALID_RETRY_ATTEMPTS',
          message: 'retryAttempts must be a non-negative integer',
          path: 'retryAttempts',
          expected: 'non-negative integer',
          actual: config.retryAttempts
        });
      } else if (config.retryAttempts > AI_LIMITS.MAX_RETRY_ATTEMPTS) {
        warnings.push({
          code: 'TOO_MANY_RETRIES',
          message: `Very high retry attempts: ${config.retryAttempts}`,
          path: 'retryAttempts',
          suggestion: 'Consider using fewer retry attempts to avoid long delays'
        });
      }
    }

    // Validate cache TTL
    if (config.cacheTTL !== undefined) {
      if (typeof config.cacheTTL !== 'number' || config.cacheTTL <= 0) {
        errors.push({
          code: 'INVALID_CACHE_TTL',
          message: 'cacheTTL must be a positive number',
          path: 'cacheTTL',
          expected: 'positive number',
          actual: config.cacheTTL
        });
      } else if (config.cacheTTL > AI_LIMITS.MAX_CACHE_TTL) {
        warnings.push({
          code: 'VERY_LONG_CACHE_TTL',
          message: `Cache TTL is very long: ${config.cacheTTL} seconds`,
          path: 'cacheTTL',
          suggestion: 'Consider using a shorter TTL for more up-to-date responses'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '2.0.0',
        validationTime: Date.now()
      }
    };
  }

  /**
   * Validate a batch request
   */
  static validateBatchRequest(batchRequest: AIBatchRequest): AIValidationResult {
    const errors: AIValidationError[] = [];
    const warnings: AIValidationWarning[] = [];

    // Validate batch ID
    if (!batchRequest.id || typeof batchRequest.id !== 'string') {
      errors.push({
        code: 'MISSING_BATCH_ID',
        message: 'Batch ID is required and must be a string',
        path: 'id',
        expected: 'string',
        actual: typeof batchRequest.id
      });
    }

    // Validate requests array
    if (!batchRequest.requests || !Array.isArray(batchRequest.requests)) {
      errors.push({
        code: 'INVALID_REQUESTS',
        message: 'Requests must be an array',
        path: 'requests',
        expected: 'AIModelRequest[]',
        actual: typeof batchRequest.requests
      });
    } else {
      if (batchRequest.requests.length === 0) {
        errors.push({
          code: 'EMPTY_BATCH',
          message: 'Batch must contain at least one request',
          path: 'requests',
          expected: 'non-empty array',
          actual: 'empty array'
        });
      }

      if (batchRequest.requests.length > AI_LIMITS.MAX_BATCH_SIZE) {
        errors.push({
          code: 'BATCH_TOO_LARGE',
          message: `Batch size exceeds limit: ${batchRequest.requests.length} (max: ${AI_LIMITS.MAX_BATCH_SIZE})`,
          path: 'requests',
          expected: `<= ${AI_LIMITS.MAX_BATCH_SIZE}`,
          actual: batchRequest.requests.length
        });
      }

      // Validate each request in the batch
      batchRequest.requests.forEach((request, index) => {
        const requestValidation = this.validateRequest(request);
        requestValidation.errors.forEach(error => {
          errors.push({
            ...error,
            path: `requests[${index}].${error.path}`
          });
        });
        requestValidation.warnings?.forEach(warning => {
          warnings.push({
            ...warning,
            path: `requests[${index}].${warning.path}`
          });
        });
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatorVersion: '2.0.0',
        validationTime: Date.now()
      }
    };
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Utility functions for working with AI data structures
 */
export class AIDataUtils {
  /**
   * Calculate estimated token count for a message
   */
  static estimateTokenCount(message: AIMessage): number {
    if (typeof message.content === 'string') {
      // Rough estimation: ~4 characters per token
      return Math.ceil(message.content.length / 4);
    } else if (Array.isArray(message.content)) {
      return message.content.reduce((total, content) => {
        if (content.text) {
          return total + Math.ceil(content.text.length / 4);
        }
        return total + 10; // Estimate for non-text content
      }, 0);
    }
    return 0;
  }

  /**
   * Calculate total token usage for a request
   */
  static estimateRequestTokens(request: AIModelRequest): number {
    return request.messages.reduce((total, message) => {
      return total + this.estimateTokenCount(message);
    }, 0);
  }

  /**
   * Create a deep copy of an AI message
   */
  static cloneMessage(message: AIMessage): AIMessage {
    return JSON.parse(JSON.stringify(message));
  }

  /**
   * Merge multiple token usage objects
   */
  static mergeTokenUsage(...usages: AITokenUsage[]): AITokenUsage {
    const result: AITokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };

    for (const usage of usages) {
      result.promptTokens += usage.promptTokens;
      result.completionTokens += usage.completionTokens;
      result.totalTokens += usage.totalTokens;

      if (usage.breakdown) {
        if (!result.breakdown) {
          result.breakdown = {};
        }
        result.breakdown.systemTokens = (result.breakdown.systemTokens || 0) + (usage.breakdown.systemTokens || 0);
        result.breakdown.userTokens = (result.breakdown.userTokens || 0) + (usage.breakdown.userTokens || 0);
        result.breakdown.assistantTokens = (result.breakdown.assistantTokens || 0) + (usage.breakdown.assistantTokens || 0);
        result.breakdown.functionTokens = (result.breakdown.functionTokens || 0) + (usage.breakdown.functionTokens || 0);
        result.breakdown.toolTokens = (result.breakdown.toolTokens || 0) + (usage.breakdown.toolTokens || 0);
      }

      if (usage.cost) {
        if (!result.cost) {
          result.cost = {
            inputCost: 0,
            outputCost: 0,
            totalCost: 0,
            currency: usage.cost.currency
          };
        }
        result.cost.inputCost += usage.cost.inputCost;
        result.cost.outputCost += usage.cost.outputCost;
        result.cost.totalCost += usage.cost.totalCost;
      }
    }

    return result;
  }

  /**
   * Check if two messages are functionally equivalent
   */
  static messagesEqual(msg1: AIMessage, msg2: AIMessage): boolean {
    return (
      msg1.role === msg2.role &&
      msg1.content === msg2.content &&
      JSON.stringify(msg1.function_call) === JSON.stringify(msg2.function_call) &&
      JSON.stringify(msg1.tool_calls) === JSON.stringify(msg2.tool_calls)
    );
  }

  /**
   * Extract all text content from a message
   */
  static extractTextContent(message: AIMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    } else if (Array.isArray(message.content)) {
      return message.content
        .filter(content => content.type === 'text' && content.text)
        .map(content => content.text)
        .join(' ');
    }
    return '';
  }

  /**
   * Get message summary for logging/debugging
   */
  static getMessageSummary(message: AIMessage): string {
    const content = this.extractTextContent(message);
    const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;
    return `[${message.role}] ${truncatedContent}`;
  }

  /**
   * Check if a request is suitable for batching with another request
   */
  static canBatchTogether(req1: AIModelRequest, req2: AIModelRequest): boolean {
    return (
      req1.model === req2.model &&
      JSON.stringify(req1.parameters) === JSON.stringify(req2.parameters) &&
      req1.config?.timeout === req2.config?.timeout
    );
  }

  /**
   * Generate a hash for a request (for caching purposes)
   */
  static generateRequestHash(request: AIModelRequest): string {
    const hashData = {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      parameters: request.parameters
    };
    
    // Simple hash function
    const str = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}

// ========================================
// ERROR HANDLING UTILITIES
// ========================================

/**
 * Error handling utilities for AI operations
 */
export class AIErrorUtils {
  /**
   * Create a standardized error from various error sources
   */
  static createStandardError(
    error: unknown,
    context: {
      requestId?: string;
      model?: string;
      provider?: string;
      operation?: string;
    }
  ): AIErrorDetails {
    let type = AIErrorType.UNKNOWN_ERROR;
    let message = 'An unknown error occurred';
    let retryable = false;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (error instanceof Error) {
      message = error.message;
      
      // Classify error based on message content
      if (error.message.includes('timeout')) {
        type = AIErrorType.TIMEOUT;
        retryable = true;
        severity = 'medium';
      } else if (error.message.includes('rate limit')) {
        type = AIErrorType.RATE_LIMITED;
        retryable = true;
        severity = 'low';
      } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        type = AIErrorType.AUTHENTICATION_FAILED;
        retryable = false;
        severity = 'high';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        type = AIErrorType.NETWORK_ERROR;
        retryable = true;
        severity = 'medium';
      } else if (error.message.includes('quota') || error.message.includes('limit exceeded')) {
        type = AIErrorType.QUOTA_EXCEEDED;
        retryable = false;
        severity = 'high';
      }
    }

    return {
      code: ERROR_CODES[type as unknown as keyof typeof ERROR_CODES] || 'UNKNOWN_ERROR',
      message,
      type,
      severity,
      retryable,
      retryDelay: retryable ? this.calculateRetryDelay(type) : undefined,
      context: {
        ...context,
        timestamp: new Date(),
        stackTrace: error instanceof Error ? error.stack : undefined
      },
      recoveryActions: this.getRecoveryActions(type)
    };
  }

  /**
   * Calculate appropriate retry delay based on error type
   */
  static calculateRetryDelay(errorType: AIErrorType): number {
    switch (errorType) {
      case AIErrorType.RATE_LIMITED:
        return 5000; // 5 seconds
      case AIErrorType.TIMEOUT:
        return 2000; // 2 seconds
      case AIErrorType.NETWORK_ERROR:
        return 1000; // 1 second
      case AIErrorType.SYSTEM_OVERLOAD:
        return 10000; // 10 seconds
      default:
        return 1000; // 1 second default
    }
  }

  /**
   * Get recovery actions for an error type
   */
  static getRecoveryActions(errorType: AIErrorType): string[] {
    switch (errorType) {
      case AIErrorType.RATE_LIMITED:
        return ['Wait before retrying', 'Reduce request frequency', 'Use batch processing'];
      case AIErrorType.TIMEOUT:
        return ['Retry with shorter timeout', 'Reduce request complexity', 'Check network connection'];
      case AIErrorType.AUTHENTICATION_FAILED:
        return ['Check API key', 'Verify credentials', 'Check account status'];
      case AIErrorType.QUOTA_EXCEEDED:
        return ['Check usage limits', 'Upgrade plan', 'Wait for quota reset'];
      case AIErrorType.NETWORK_ERROR:
        return ['Check internet connection', 'Retry request', 'Use different endpoint'];
      case AIErrorType.MODEL_UNAVAILABLE:
        return ['Try different model', 'Check model status', 'Use fallback model'];
      default:
        return ['Retry request', 'Check configuration', 'Contact support'];
    }
  }

  /**
   * Determine if an error should trigger a fallback
   */
  static shouldUseFallback(error: AIErrorDetails): boolean {
    return [
      AIErrorType.MODEL_UNAVAILABLE,
      AIErrorType.TIMEOUT,
      AIErrorType.SYSTEM_OVERLOAD,
      AIErrorType.QUOTA_EXCEEDED
    ].includes(error.type);
  }

  /**
   * Check if an error indicates a permanent failure
   */
  static isPermanentFailure(error: AIErrorDetails): boolean {
    return [
      AIErrorType.AUTHENTICATION_FAILED,
      AIErrorType.AUTHORIZATION_FAILED,
      AIErrorType.INVALID_CONFIG,
      AIErrorType.UNSUPPORTED_OPERATION,
      AIErrorType.CONTENT_FILTERED,
      AIErrorType.SAFETY_VIOLATION
    ].includes(error.type);
  }
}

// ========================================
// EXPORTS
// ========================================

export {
  // Re-export commonly used types and utilities from unified-ai-interfaces
  isErrorResponse,
  isRetryableError,
  isFinalStreamChunk,
  hasToolCalls,
  hasFunctionCall,
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_REQUEST_CONFIG,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_STREAM_CONFIG,
  AI_LIMITS,
  SUPPORTED_MESSAGE_ROLES,
  ERROR_CODES
}; 