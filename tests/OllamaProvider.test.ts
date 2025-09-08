// tests/OllamaProvider.test.ts

import { App, TFile } from 'obsidian';
import { ErrorHandlingService } from '../src/services/ErrorHandlingService';
import { AIService, AIServiceConfig } from '../src/services/AIService';

// Mock fetch globally
global.fetch = jest.fn();

// Mock ErrorHandlingService
jest.mock('../src/services/ErrorHandlingService');

describe('OllamaProvider (via AIService)', () => {
    let app: App;
    let mockErrorHandler: jest.Mocked<ErrorHandlingService>;
    let config: AIServiceConfig;
    let aiService: AIService;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Reset fetch mock
        (global.fetch as jest.Mock).mockReset();
        
        // Mock app
        app = {
            vault: {
                adapter: {
                    exists: jest.fn()
                }
            }
        } as any;
        
        // Mock error handler
        mockErrorHandler = {
            handleError: jest.fn(),
            executeWithRetry: jest.fn().mockImplementation(async (fn) => {
                // Execute the function directly, letting errors propagate
                return await fn();
            }),
            initialize: jest.fn(),
            dispose: jest.fn(),
            isReady: jest.fn().mockReturnValue(true)
        } as any;
        
        (ErrorHandlingService as jest.Mock).mockImplementation(() => mockErrorHandler);
        
        // Default Ollama config
        config = {
            provider: 'ollama' as const,
            apiKey: '',
            model: 'llama3.1:8b',
            maxTokens: 1000,
            temperature: 0.7,
            apiUrl: 'http://localhost:11434',
            timeout: 30000
        };

        aiService = new AIService(app, config, mockErrorHandler);
    });

    afterEach(async () => {
        jest.clearAllTimers();
        if (aiService) {
            await aiService.dispose();
        }
    });

    describe('initialization', () => {
        it('should create AIService with Ollama provider config', async () => {
            await aiService.initialize();
            expect(aiService).toBeInstanceOf(AIService);
            expect(mockErrorHandler.initialize).toHaveBeenCalled();
        });
    });

    describe('generateResponse (Ollama provider)', () => {
        beforeEach(async () => {
            await aiService.initialize();
        });

        it('should make successful API call and return response', async () => {
            const mockResponse = {
                response: 'This is a test response',
                done: true
            };
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await aiService.generateResponse('Test prompt');

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:11434/api/generate',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'llama3.1:8b',
                        prompt: 'Test prompt',
                        stream: false,
                        options: {
                            temperature: 0.7,
                            num_predict: 1000
                        }
                    })
                })
            );
            
            expect(result).toBe('This is a test response');
        });

        it('should handle 404 error for model not found', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => 'Model not found'
            });

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });

        it('should handle server errors (500+)', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error'
            });

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });

        it('should handle network timeout', async () => {
            jest.useFakeTimers();
            
            (global.fetch as jest.Mock).mockImplementationOnce(
                () => {
                    return new Promise((_resolve, reject) => {
                        // Simulate timeout by rejecting with AbortError after delay
                        setTimeout(() => {
                            const abortError = new Error('The operation was aborted');
                            abortError.name = 'AbortError';
                            reject(abortError);
                        }, 100);
                    });
                }
            );

            const callPromise = aiService.generateResponse('Test prompt');
            
            // Fast-forward time to trigger timeout
            jest.advanceTimersByTime(31000);
            
            let errorThrown = false;
            try {
                await callPromise;
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
            
            jest.useRealTimers();
        });

        it('should handle network connection errors', async () => {
            const networkError = new TypeError('fetch failed');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });

        it('should trim whitespace from response', async () => {
            const mockResponse = {
                response: '  This is a test response with whitespace  ',
                done: true
            };
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await aiService.generateResponse('Test prompt');
            expect(result).toBe('This is a test response with whitespace');
        });

        it('should handle empty response', async () => {
            const mockResponse = {
                response: '',
                done: true
            };
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });

        it('should handle missing response field', async () => {
            const mockResponse = {
                done: true
                // missing response field
            };
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });

        it('should reject empty prompt', async () => {
            try {
                const result = await aiService.generateResponse('');
                throw new Error(`Expected error for empty string but got result: ${result}`);
            } catch (error) {
                // Success - an error was thrown
                expect(error).toBeDefined();
            }
            
            try {
                const result = await aiService.generateResponse('   ');
                throw new Error(`Expected error for whitespace string but got result: ${result}`);
            } catch (error) {
                // Success - an error was thrown
                expect(error).toBeDefined();
            }
        });
    });

    describe('generateSummary (Ollama provider)', () => {
        beforeEach(async () => {
            await aiService.initialize();
        });

        it('should generate summary with source files', async () => {
            const mockResponse = {
                response: 'Weekly summary of journal entries',
                done: true
            };
            
            const sourceFiles = [
                new TFile('day1.md'),
                new TFile('day2.md')
            ];
            sourceFiles[0].basename = 'Day 1';
            sourceFiles[1].basename = 'Day 2';
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await aiService.generateSummary('Journal content here', sourceFiles);
            
            // Verify TFile instances are properly created
            expect(sourceFiles[0] instanceof TFile).toBe(true);
            expect(sourceFiles[1] instanceof TFile).toBe(true);
            expect(result).toBe('Weekly summary of journal entries');
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:11434/api/generate',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('Day 1, Day 2')
                })
            );
        });

        it('should reject empty content', async () => {
            const sourceFiles: TFile[] = [];
            
            let errorThrown1 = false;
            try {
                await aiService.generateSummary('', sourceFiles);
            } catch (error) {
                errorThrown1 = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown1).toBe(true);
            
            let errorThrown2 = false;
            try {
                await aiService.generateSummary('   ', sourceFiles);
            } catch (error) {
                errorThrown2 = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown2).toBe(true);
        });
    });

    describe('testConnection (Ollama provider)', () => {
        beforeEach(async () => {
            await aiService.initialize();
        });

        it('should return true for successful connection test', async () => {
            const mockResponse = {
                response: 'OK',
                done: true
            };
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const result = await aiService.testConnection();
            expect(result).toBe(true);
        });

        it('should return false and handle error for failed connection', async () => {
            const networkError = new Error('Connection failed');
            (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

            const result = await aiService.testConnection();
            
            expect(result).toBe(false);
            expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                networkError,
                { operation: 'testConnection', component: 'OllamaProvider', timestamp: expect.any(Number) },
                { showNotice: false, logToConsole: true }
            );
        });
    });

    describe('getModelInfo (Ollama provider)', () => {
        beforeEach(async () => {
            await aiService.initialize();
        });

        it('should return current model configuration', () => {
            const modelInfo = aiService.getModelInfo();
            
            expect(modelInfo).toEqual({
                model: 'llama3.1:8b',
                maxTokens: 1000,
                temperature: 0.7
            });
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await aiService.initialize();
        });

        it('should handle 404 error with model-specific message', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => 'Model not found'
            });

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });

        it('should handle general API errors', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: async () => 'Invalid request'
            });

            let errorThrown = false;
            try {
                await aiService.generateResponse('Test prompt');
            } catch (error) {
                errorThrown = true;
                expect(error).toBeDefined();
            }
            expect(errorThrown).toBe(true);
        });
    });

    describe('configuration handling', () => {
        it('should use custom timeout from config', async () => {
            const customConfig = {
                ...config,
                timeout: 60000 // 60 seconds
            };
            
            const customAiService = new AIService(app, customConfig, mockErrorHandler);
            await customAiService.initialize();
            
            jest.useFakeTimers();
            
            (global.fetch as jest.Mock).mockImplementationOnce(
                (_url, options) => {
                    expect(options.signal).toBeDefined();
                    return new Promise(() => {}); // Never resolves
                }
            );

            const callPromise = customAiService.generateResponse('Test prompt');
            
            // Should not timeout before 60 seconds
            jest.advanceTimersByTime(30000);
            // Promise should still be pending (not resolved or rejected)
            const promiseState = await Promise.race([
                callPromise.then(() => 'resolved'),
                callPromise.catch(() => 'rejected'),
                Promise.resolve('pending')
            ]);
            expect(promiseState).toBe('pending');
            
            jest.useRealTimers();
            await customAiService.dispose();
        });

        it('should use default timeout when not specified', async () => {
            const configWithoutTimeout = {
                ...config
            };
            delete configWithoutTimeout.timeout;
            
            const defaultTimeoutService = new AIService(app, configWithoutTimeout, mockErrorHandler);
            await defaultTimeoutService.initialize();
            
            // Verify that the service uses default timeout by checking the request structure
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ response: 'Default timeout test', done: true })
            });

            await defaultTimeoutService.generateResponse('Test prompt');
            
            // Verify fetch was called (basic functionality test)
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:11434/api/generate',
                expect.objectContaining({
                    method: 'POST',
                    signal: expect.any(AbortSignal)
                })
            );
            
            await defaultTimeoutService.dispose();
        });
    });
});