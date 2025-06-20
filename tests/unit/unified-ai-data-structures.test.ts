/**
 * Test suite for Unified AI Data Structures
 * Tests validation, factories, utilities, and error handling
 */

import {
  AIMessage,
  AIModelRequest,
  AIBatchRequest,
  AIGenerationParameters,
  AIRequestConfig,
  AIErrorType,
  AIProviderType,
  AIPrivacyLevel,
  DEFAULT_GENERATION_PARAMETERS,
  DEFAULT_REQUEST_CONFIG,
  AI_LIMITS
} from '../../src/unified-ai-interfaces';

import {
  AIMessageFactory,
  AIRequestFactory,
  AIBatchFactory,
  AIDataValidator,
  AIDataUtils,
  AIErrorUtils
} from '../../src/unified-ai-data-structures';

describe('Unified AI Data Structures', () => {

  // ========================================
  // MESSAGE FACTORY TESTS
  // ========================================

  describe('AIMessageFactory', () => {
    test('should create system message with correct structure', () => {
      const content = 'You are a helpful assistant.';
      const message = AIMessageFactory.createSystemMessage(content);

      expect(message.role).toBe('system');
      expect(message.content).toBe(content);
      expect(message.metadata?.source).toBe('system');
      expect(message.metadata?.priority).toBe('normal');
      expect(message.metadata?.id).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(message.metadata?.timestamp).toBeInstanceOf(Date);
    });

    test('should create user message with custom metadata', () => {
      const content = 'Hello, how are you?';
      const customMetadata = {
        priority: 'high' as const,
        privacyLevel: 'confidential' as AIPrivacyLevel,
        custom: { userId: 'user123' }
      };
      
      const message = AIMessageFactory.createUserMessage(content, customMetadata);

      expect(message.role).toBe('user');
      expect(message.content).toBe(content);
      expect(message.metadata?.priority).toBe('high');
      expect(message.metadata?.privacyLevel).toBe('confidential');
      expect(message.metadata?.custom?.userId).toBe('user123');
    });

    test('should create function call message', () => {
      const functionName = 'get_weather';
      const functionArgs = JSON.stringify({ location: 'New York' });
      
      const message = AIMessageFactory.createFunctionCallMessage(functionName, functionArgs);

      expect(message.role).toBe('assistant');
      expect(message.function_call?.name).toBe(functionName);
      expect(message.function_call?.arguments).toBe(functionArgs);
      expect(message.content).toBe('');
    });

    test('should create tool response message', () => {
      const toolCallId = 'call_123';
      const content = 'The weather in New York is sunny, 72°F';
      
      const message = AIMessageFactory.createToolResponseMessage(toolCallId, content);

      expect(message.role).toBe('tool');
      expect(message.tool_call_id).toBe(toolCallId);
      expect(message.content).toBe(content);
      expect(message.metadata?.source).toBe('tool');
    });
  });

  // ========================================
  // REQUEST FACTORY TESTS
  // ========================================

  describe('AIRequestFactory', () => {
    test('should create text completion request', () => {
      const model = 'gpt-4';
      const prompt = 'Explain quantum computing';
      
      const request = AIRequestFactory.createTextCompletionRequest(model, prompt);

      expect(request.model).toBe(model);
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[0].content).toBe(prompt);
      expect(request.parameters).toEqual(expect.objectContaining(DEFAULT_GENERATION_PARAMETERS));
      expect(request.config).toEqual(expect.objectContaining(DEFAULT_REQUEST_CONFIG));
      expect(request.metadata?.tags).toContain('text-completion');
    });

    test('should create conversation request with custom parameters', () => {
      const model = 'claude-3-sonnet';
      const messages = [
        AIMessageFactory.createSystemMessage('You are a helpful assistant.'),
        AIMessageFactory.createUserMessage('What is AI?')
      ];
      const customParams: Partial<AIGenerationParameters> = {
        temperature: 0.8,
        maxTokens: 2048,
        topP: 0.9
      };
      
      const request = AIRequestFactory.createConversationRequest(model, messages, customParams);

      expect(request.model).toBe(model);
      expect(request.messages).toHaveLength(2);
      expect(request.parameters?.temperature).toBe(0.8);
      expect(request.parameters?.maxTokens).toBe(2048);
      expect(request.parameters?.topP).toBe(0.9);
    });

    test('should create function calling request', () => {
      const model = 'gpt-4';
      const messages = [AIMessageFactory.createUserMessage('What\'s the weather like?')];
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get current weather',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            }
          }
        }
      }];
      
      const request = AIRequestFactory.createFunctionCallRequest(model, messages, tools);

      expect(request.parameters?.tools).toEqual(tools);
      expect(request.parameters?.toolChoice).toBe('auto');
      expect(request.metadata?.expectedResponseType).toBe('function-call');
    });

    test('should create streaming request', () => {
      const model = 'gpt-3.5-turbo';
      const messages = [AIMessageFactory.createUserMessage('Tell me a story')];
      
      const request = AIRequestFactory.createStreamingRequest(model, messages);

      expect(request.parameters?.stream).toBe(true);
      expect(request.metadata?.expectedResponseType).toBe('stream');
      expect(request.metadata?.tags).toContain('streaming');
    });
  });

  // ========================================
  // BATCH FACTORY TESTS
  // ========================================

  describe('AIBatchFactory', () => {
    test('should create batch request from multiple requests', () => {
      const requests = [
        AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 1'),
        AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 2'),
        AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 3')
      ];
      
      const batchRequest = AIBatchFactory.createBatchRequest(requests);

      expect(batchRequest.requests).toHaveLength(3);
      expect(batchRequest.config?.maxBatchSize).toBeDefined();
      expect(batchRequest.metadata?.expectedProcessingTime).toBeGreaterThan(0);
      expect(batchRequest.metadata?.resourceRequirements?.memoryMB).toBeGreaterThan(0);
    });

    test('should create batch for similar prompts', () => {
      const model = 'claude-3-haiku';
      const prompts = [
        'Summarize this article about AI',
        'Summarize this article about ML',
        'Summarize this article about DL'
      ];
      
      const batchRequest = AIBatchFactory.createSimilarPromptsBatch(model, prompts);

      expect(batchRequest.requests).toHaveLength(3);
      expect(batchRequest.requests.every(req => req.model === model)).toBe(true);
      expect(batchRequest.config?.parallelism?.enabled).toBe(true);
      expect(batchRequest.config?.parallelism?.maxConcurrency).toBeLessThanOrEqual(5);
    });
  });

  // ========================================
  // VALIDATION TESTS
  // ========================================

  describe('AIDataValidator', () => {
    test('should validate correct message', () => {
      const message = AIMessageFactory.createUserMessage('Valid message');
      const result = AIDataValidator.validateMessage(message);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid message role', () => {
      const invalidMessage = {
        role: '',
        content: 'Test content'
      } as AIMessage;
      
      const result = AIDataValidator.validateMessage(invalidMessage);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ROLE')).toBe(true);
    });

    test('should detect missing message content', () => {
      const invalidMessage = {
        role: 'user',
        content: ''
      } as AIMessage;
      
      const result = AIDataValidator.validateMessage(invalidMessage);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_CONTENT')).toBe(true);
    });

    test('should validate correct request', () => {
      const request = AIRequestFactory.createTextCompletionRequest('gpt-4', 'Test prompt');
      const result = AIDataValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing request fields', () => {
      const invalidRequest = {
        id: '',
        model: '',
        messages: []
      } as AIModelRequest;
      
      const result = AIDataValidator.validateRequest(invalidRequest);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_REQUEST_ID')).toBe(true);
      expect(result.errors.some(e => e.code === 'MISSING_MODEL')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_MESSAGES')).toBe(true);
    });

    test('should validate generation parameters', () => {
      const validParams: AIGenerationParameters = {
        maxTokens: 1024,
        temperature: 0.7,
        topP: 0.9,
        topK: 50
      };
      
      const result = AIDataValidator.validateGenerationParameters(validParams);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid generation parameters', () => {
      const invalidParams: AIGenerationParameters = {
        maxTokens: -100,
        temperature: 5.0,
        topP: 2.0,
        topK: -1
      };
      
      const result = AIDataValidator.validateGenerationParameters(invalidParams);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_MAX_TOKENS')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_TEMPERATURE')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_TOP_P')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_TOP_K')).toBe(true);
    });

    test('should validate batch request', () => {
      const requests = [
        AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 1'),
        AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 2')
      ];
      const batchRequest = AIBatchFactory.createBatchRequest(requests);
      
      const result = AIDataValidator.validateBatchRequest(batchRequest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect empty batch', () => {
      const emptyBatch: AIBatchRequest = {
        id: 'batch_123',
        requests: []
      };
      
      const result = AIDataValidator.validateBatchRequest(emptyBatch);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_BATCH')).toBe(true);
    });
  });

  // ========================================
  // UTILITY TESTS
  // ========================================

  describe('AIDataUtils', () => {
    test('should estimate token count for text message', () => {
      const message = AIMessageFactory.createUserMessage('This is a test message with some words');
      const tokenCount = AIDataUtils.estimateTokenCount(message);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(20); // Rough estimate
    });

    test('should estimate request tokens', () => {
      const request = AIRequestFactory.createConversationRequest('gpt-4', [
        AIMessageFactory.createSystemMessage('You are helpful'),
        AIMessageFactory.createUserMessage('Hello there')
      ]);
      
      const totalTokens = AIDataUtils.estimateRequestTokens(request);

      expect(totalTokens).toBeGreaterThan(0);
    });

    test('should clone message correctly', () => {
      const original = AIMessageFactory.createUserMessage('Original message', {
        priority: 'high',
        custom: { data: 'test' }
      });
      
      const cloned = AIDataUtils.cloneMessage(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original); // Different object reference
      expect(cloned.metadata).not.toBe(original.metadata); // Deep clone
    });

    test('should merge token usage correctly', () => {
      const usage1 = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: { inputCost: 0.01, outputCost: 0.02, totalCost: 0.03, currency: 'USD' }
      };
      
      const usage2 = {
        promptTokens: 200,
        completionTokens: 75,
        totalTokens: 275,
        cost: { inputCost: 0.02, outputCost: 0.03, totalCost: 0.05, currency: 'USD' }
      };
      
      const merged = AIDataUtils.mergeTokenUsage(usage1, usage2);

      expect(merged.promptTokens).toBe(300);
      expect(merged.completionTokens).toBe(125);
      expect(merged.totalTokens).toBe(425);
      expect(merged.cost?.totalCost).toBe(0.08);
    });

    test('should check message equality', () => {
      const msg1 = AIMessageFactory.createUserMessage('Test message');
      const msg2 = AIMessageFactory.createUserMessage('Test message');
      const msg3 = AIMessageFactory.createUserMessage('Different message');

      expect(AIDataUtils.messagesEqual(msg1, msg2)).toBe(true);
      expect(AIDataUtils.messagesEqual(msg1, msg3)).toBe(false);
    });

    test('should extract text content from message', () => {
      const textMessage = AIMessageFactory.createUserMessage('Simple text');
      const extractedText = AIDataUtils.extractTextContent(textMessage);

      expect(extractedText).toBe('Simple text');
    });

    test('should generate message summary', () => {
      const message = AIMessageFactory.createUserMessage('This is a test message for summary generation');
      const summary = AIDataUtils.getMessageSummary(message);

      expect(summary).toContain('[user]');
      expect(summary).toContain('This is a test message');
    });

    test('should check batch compatibility', () => {
      const req1 = AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 1');
      const req2 = AIRequestFactory.createTextCompletionRequest('gpt-4', 'Question 2');
      const req3 = AIRequestFactory.createTextCompletionRequest('claude-3', 'Question 3');

      expect(AIDataUtils.canBatchTogether(req1, req2)).toBe(true);
      expect(AIDataUtils.canBatchTogether(req1, req3)).toBe(false);
    });

    test('should generate request hash', () => {
      const request = AIRequestFactory.createTextCompletionRequest('gpt-4', 'Test prompt');
      const hash = AIDataUtils.generateRequestHash(request);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // ERROR UTILITY TESTS
  // ========================================

  describe('AIErrorUtils', () => {
    test('should create standard error from Error object', () => {
      const originalError = new Error('Network timeout occurred');
      const context = {
        requestId: 'req_123',
        model: 'gpt-4',
        provider: 'openai',
        operation: 'completion'
      };
      
      const standardError = AIErrorUtils.createStandardError(originalError, context);

      expect(standardError.type).toBe(AIErrorType.TIMEOUT);
      expect(standardError.message).toBe('Network timeout occurred');
      expect(standardError.retryable).toBe(true);
      expect(standardError.context?.requestId).toBe('req_123');
      expect(standardError.recoveryActions).toContain('Retry with shorter timeout');
    });

    test('should classify rate limit errors correctly', () => {
      const rateLimitError = new Error('Rate limit exceeded. Please try again later.');
      const standardError = AIErrorUtils.createStandardError(rateLimitError, {});

      expect(standardError.type).toBe(AIErrorType.RATE_LIMITED);
      expect(standardError.retryable).toBe(true);
      expect(standardError.retryDelay).toBe(5000); // 5 seconds
    });

    test('should classify authentication errors correctly', () => {
      const authError = new Error('Invalid API key provided');
      const standardError = AIErrorUtils.createStandardError(authError, {});

      expect(standardError.type).toBe(AIErrorType.AUTHENTICATION_FAILED);
      expect(standardError.retryable).toBe(false);
      expect(standardError.severity).toBe('high');
    });

    test('should calculate appropriate retry delays', () => {
      expect(AIErrorUtils.calculateRetryDelay(AIErrorType.RATE_LIMITED)).toBe(5000);
      expect(AIErrorUtils.calculateRetryDelay(AIErrorType.TIMEOUT)).toBe(2000);
      expect(AIErrorUtils.calculateRetryDelay(AIErrorType.NETWORK_ERROR)).toBe(1000);
      expect(AIErrorUtils.calculateRetryDelay(AIErrorType.SYSTEM_OVERLOAD)).toBe(10000);
    });

    test('should provide recovery actions', () => {
      const rateActions = AIErrorUtils.getRecoveryActions(AIErrorType.RATE_LIMITED);
      const authActions = AIErrorUtils.getRecoveryActions(AIErrorType.AUTHENTICATION_FAILED);

      expect(rateActions).toContain('Wait before retrying');
      expect(authActions).toContain('Check API key');
    });

    test('should identify fallback scenarios', () => {
      const modelUnavailableError = {
        type: AIErrorType.MODEL_UNAVAILABLE,
        retryable: false
      } as any;
      
      const authError = {
        type: AIErrorType.AUTHENTICATION_FAILED,
        retryable: false
      } as any;

      expect(AIErrorUtils.shouldUseFallback(modelUnavailableError)).toBe(true);
      expect(AIErrorUtils.shouldUseFallback(authError)).toBe(false);
    });

    test('should identify permanent failures', () => {
      const authError = {
        type: AIErrorType.AUTHENTICATION_FAILED,
        retryable: false
      } as any;
      
      const timeoutError = {
        type: AIErrorType.TIMEOUT,
        retryable: true
      } as any;

      expect(AIErrorUtils.isPermanentFailure(authError)).toBe(true);
      expect(AIErrorUtils.isPermanentFailure(timeoutError)).toBe(false);
    });
  });

  // ========================================
  // INTEGRATION TESTS
  // ========================================

  describe('Integration Tests', () => {
    test('should create, validate, and process a complete workflow', () => {
      // 1. Create messages
      const systemMessage = AIMessageFactory.createSystemMessage('You are a helpful assistant.');
      const userMessage = AIMessageFactory.createUserMessage('Explain machine learning');

      // 2. Create request
      const request = AIRequestFactory.createConversationRequest(
        'gpt-4',
        [systemMessage, userMessage],
        { temperature: 0.7, maxTokens: 1024 }
      );

      // 3. Validate request
      const validation = AIDataValidator.validateRequest(request);
      expect(validation.valid).toBe(true);

      // 4. Estimate tokens
      const estimatedTokens = AIDataUtils.estimateRequestTokens(request);
      expect(estimatedTokens).toBeGreaterThan(0);

      // 5. Generate hash for caching
      const requestHash = AIDataUtils.generateRequestHash(request);
      expect(requestHash).toBeDefined();

      // 6. Create batch with similar requests
      const similarRequests = [
        request,
        AIRequestFactory.createConversationRequest('gpt-4', [userMessage])
      ];
      const batchRequest = AIBatchFactory.createBatchRequest(similarRequests);

      // 7. Validate batch
      const batchValidation = AIDataValidator.validateBatchRequest(batchRequest);
      expect(batchValidation.valid).toBe(true);
    });

    test('should handle error scenarios gracefully', () => {
      // Create invalid request
      const invalidRequest = {
        id: '',
        model: '',
        messages: []
      } as AIModelRequest;

      // Validate and expect errors
      const validation = AIDataValidator.validateRequest(invalidRequest);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Create and classify error
      const networkError = new Error('Connection refused');
      const standardError = AIErrorUtils.createStandardError(networkError, {
        requestId: 'req_failed',
        operation: 'completion'
      });

      expect(standardError.type).toBe(AIErrorType.NETWORK_ERROR);
      expect(standardError.retryable).toBe(true);
      expect(standardError.recoveryActions).toContain('Check internet connection');
    });

    test('should support different AI providers', () => {
      const providers: { name: string; model: string }[] = [
        { name: 'OpenAI', model: 'gpt-4' },
        { name: 'Anthropic', model: 'claude-3-sonnet' },
        { name: 'Google', model: 'gemini-pro' },
        { name: 'Cohere', model: 'command-r' },
        { name: 'Ollama', model: 'llama2' }
      ];

      providers.forEach(provider => {
        const request = AIRequestFactory.createTextCompletionRequest(
          provider.model,
          'Test prompt for ' + provider.name
        );

        const validation = AIDataValidator.validateRequest(request);
        expect(validation.valid).toBe(true);
        expect(request.model).toBe(provider.model);
      });
    });

    test('should handle multimodal content', () => {
      const multimodalMessage: AIMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          { 
            type: 'image', 
            image_url: { 
              url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...',
              detail: 'high'
            }
          }
        ],
        metadata: {
          id: 'msg_multimodal',
          timestamp: new Date(),
          source: 'user',
          priority: 'normal'
        }
      };

      const validation = AIDataValidator.validateMessage(multimodalMessage);
      expect(validation.valid).toBe(true);

      const textContent = AIDataUtils.extractTextContent(multimodalMessage);
      expect(textContent).toBe('What is in this image?');
    });
  });
}); 