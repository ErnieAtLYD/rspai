// tests/ErrorHandlingService.test.ts

import { App } from "obsidian";
import { ErrorHandlingService, ErrorType, ErrorCode, RetrospectError, ErrorContext, ErrorHandlingConfig } from "../src/services/ErrorHandlingService";

// Test interface to access private methods safely
interface TestableErrorHandlingService extends ErrorHandlingService {
    classifyError(error: Error, context: ErrorContext): RetrospectError;
    calculateBackoffDelay(attempt: number, baseDelay: number): number;
}

// Mock Obsidian's Notice to prevent issues in testing
jest.mock("obsidian", () => ({
    App: jest.fn(),
    Notice: jest.fn()
}));

describe("ErrorHandlingService", () => {
    let service: ErrorHandlingService;
    let mockApp: App;
    let defaultContext: ErrorContext;
    let defaultConfig: ErrorHandlingConfig;

    beforeEach(() => {
        mockApp = {} as App;
        defaultContext = {
            operation: "test-operation",
            component: "test-component",
            timestamp: Date.now()
        };
        defaultConfig = {
            maxRetries: 3,
            baseRetryDelay: 10, // Reduce delay for faster tests
            enableLogging: false, // Disable logging in tests
            enableNotifications: false // Disable notifications in tests
        };
        service = new ErrorHandlingService(mockApp, defaultConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("Error Classification", () => {
        describe("API Key Errors", () => {
            it("should classify invalid API key errors", () => {
                const error = new Error("API key is invalid");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result).toBeInstanceOf(RetrospectError);
                expect(result.type).toBe(ErrorType.USER);
                expect(result.code).toBe(ErrorCode.API_KEY_INVALID);
                expect(result.userMessage).toBe("Invalid API key. Please check your OpenAI API key");
            });

            it("should classify missing API key errors", () => {
                const error = new Error("API key is missing");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.USER);
                expect(result.code).toBe(ErrorCode.API_KEY_MISSING);
                expect(result.userMessage).toBe("Please configure your OpenAI API key in settings");
            });

            it("should classify not configured API key errors", () => {
                const error = new Error("API key not configured");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.USER);
                expect(result.code).toBe(ErrorCode.API_KEY_MISSING);
            });
        });

        describe("Rate Limiting Errors", () => {
            it("should classify rate limit errors", () => {
                const error = new Error("Rate limit exceeded");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.API);
                expect(result.code).toBe(ErrorCode.API_RATE_LIMITED);
                expect(result.userMessage).toBe("API rate limit exceeded. Please try again later");
                expect(result.retryable).toBe(true);
            });

            it("should classify HTTP 429 errors", () => {
                const error = new Error("HTTP 429 Too Many Requests");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.API);
                expect(result.code).toBe(ErrorCode.API_RATE_LIMITED);
                expect(result.retryable).toBe(true);
            });
        });

        describe("Network Errors", () => {
            it("should classify network errors", () => {
                const error = new Error("Network error occurred");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.NETWORK);
                expect(result.code).toBe(ErrorCode.API_NETWORK_ERROR);
                expect(result.userMessage).toBe("Network error. Please check your internet connection");
                expect(result.retryable).toBe(true);
            });

            it("should classify fetch errors", () => {
                const error = new Error("Fetch failed");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.NETWORK);
                expect(result.code).toBe(ErrorCode.API_NETWORK_ERROR);
            });

            it("should classify connection errors", () => {
                const error = new Error("Connection refused");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.NETWORK);
                expect(result.code).toBe(ErrorCode.API_NETWORK_ERROR);
            });
        });

        describe("Filesystem Errors", () => {
            it("should classify file not found errors", () => {
                const error = new Error("File not found");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.FILESYSTEM);
                expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
                expect(result.userMessage).toBe("Required file not found. Please check your configuration");
            });

            it("should classify ENOENT errors", () => {
                const error = new Error("ENOENT: no such file or directory");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.FILESYSTEM);
                expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
            });

            it("should classify folder not found errors", () => {
                const error = new Error("Folder not found");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.FILESYSTEM);
                expect(result.code).toBe(ErrorCode.FOLDER_NOT_FOUND);
                expect(result.userMessage).toBe("Folder not found. Please verify the path in settings");
            });

            it("should classify directory errors", () => {
                const error = new Error("Directory does not exist");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.FILESYSTEM);
                expect(result.code).toBe(ErrorCode.FOLDER_NOT_FOUND);
            });

            it("should classify permission errors", () => {
                const error = new Error("Permission denied");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.FILESYSTEM);
                expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
                expect(result.userMessage).toBe("Permission denied. Please check file permissions");
            });

            it("should classify access denied errors", () => {
                const error = new Error("Access denied to file");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.FILESYSTEM);
                expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
            });
        });

        describe("Encryption/Decryption Errors", () => {
            it("should classify encryption failed errors", () => {
                const error = new Error("Encryption failed");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.VALIDATION);
                expect(result.code).toBe(ErrorCode.ENCRYPTION_FAILED);
                expect(result.userMessage).toBe("Encryption failed. Please try again");
            });

            it("should classify decryption failed errors", () => {
                const error = new Error("Decryption failed");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.VALIDATION);
                expect(result.code).toBe(ErrorCode.DECRYPTION_FAILED);
                expect(result.userMessage).toBe("Decryption failed. Please check your master password");
            });
        });

        describe("Default Classification", () => {
            it("should default to INVALID_CONFIG for unmatched errors", () => {
                const error = new Error("Some random error");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.USER);
                expect(result.code).toBe(ErrorCode.INVALID_CONFIG);
                expect(result.userMessage).toBe("Invalid configuration. Please check your settings");
            });

            it("should handle empty error messages", () => {
                const error = new Error("");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.USER);
                expect(result.code).toBe(ErrorCode.INVALID_CONFIG);
            });
        });

        describe("Case Insensitivity", () => {
            it("should classify errors case-insensitively", () => {
                const error = new Error("API KEY IS INVALID");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.USER);
                expect(result.code).toBe(ErrorCode.API_KEY_INVALID);
            });

            it("should handle mixed case error messages", () => {
                const error = new Error("Network Error Occurred");
                const result = (service as TestableErrorHandlingService).classifyError(error, defaultContext);

                expect(result.type).toBe(ErrorType.NETWORK);
                expect(result.code).toBe(ErrorCode.API_NETWORK_ERROR);
            });
        });

        describe("Context Preservation", () => {
            it("should preserve error context in classified errors", () => {
                const error = new Error("Test error");
                const context: ErrorContext = {
                    operation: "test-op",
                    component: "test-comp",
                    metadata: { key: "value" },
                    timestamp: 123456789
                };

                const result = (service as TestableErrorHandlingService).classifyError(error, context);

                expect(result.context.operation).toBe("test-op");
                expect(result.context.component).toBe("test-comp");
                expect(result.context.metadata).toEqual({ key: "value" });
                expect(result.context.timestamp).toBe(123456789);
                expect(result.context.stack).toBe(error.stack);
            });
        });
    });

    describe("RetrospectError.fromError", () => {
        it("should create RetrospectError from regular Error", () => {
            const originalError = new Error("Test error");
            originalError.stack = "Test stack trace";

            const result = RetrospectError.fromError(
                originalError,
                ErrorType.API,
                ErrorCode.API_KEY_INVALID,
                defaultContext,
                "Custom user message"
            );

            expect(result).toBeInstanceOf(RetrospectError);
            expect(result.type).toBe(ErrorType.API);
            expect(result.code).toBe(ErrorCode.API_KEY_INVALID);
            expect(result.message).toBe("Test error");
            expect(result.userMessage).toBe("Custom user message");
            expect(result.context.stack).toBe("Test stack trace");
            expect(result.recoverable).toBe(true);
        });

        it("should use default user message when none provided", () => {
            const originalError = new Error("Test error");

            const result = RetrospectError.fromError(
                originalError,
                ErrorType.USER,
                ErrorCode.API_KEY_MISSING,
                defaultContext
            );

            expect(result.userMessage).toBe("Please configure your OpenAI API key in settings");
        });

        it("should set retryable flag based on error code", () => {
            const originalError = new Error("Test error");

            const retryableResult = RetrospectError.fromError(
                originalError,
                ErrorType.API,
                ErrorCode.API_RATE_LIMITED,
                defaultContext
            );

            const nonRetryableResult = RetrospectError.fromError(
                originalError,
                ErrorType.USER,
                ErrorCode.API_KEY_INVALID,
                defaultContext
            );

            expect(retryableResult.retryable).toBe(true);
            expect(nonRetryableResult.retryable).toBe(false);
        });
    });

    describe("Default User Messages", () => {
        it("should return correct default messages for all error codes", () => {
            const testCases = [
                { code: ErrorCode.API_KEY_MISSING, expected: "Please configure your OpenAI API key in settings" },
                { code: ErrorCode.API_KEY_INVALID, expected: "Invalid API key. Please check your OpenAI API key" },
                { code: ErrorCode.API_RATE_LIMITED, expected: "API rate limit exceeded. Please try again later" },
                { code: ErrorCode.API_NETWORK_ERROR, expected: "Network error. Please check your internet connection" },
                { code: ErrorCode.FILE_NOT_FOUND, expected: "Required file not found. Please check your configuration" },
                { code: ErrorCode.FOLDER_NOT_FOUND, expected: "Folder not found. Please verify the path in settings" },
                { code: ErrorCode.PERMISSION_DENIED, expected: "Permission denied. Please check file permissions" },
                { code: ErrorCode.INVALID_CONFIG, expected: "Invalid configuration. Please check your settings" },
                { code: ErrorCode.ENCRYPTION_FAILED, expected: "Encryption failed. Please try again" },
                { code: ErrorCode.DECRYPTION_FAILED, expected: "Decryption failed. Please check your master password" }
            ];

            testCases.forEach(({ code, expected }) => {
                const error = new Error("Test");
                const result = RetrospectError.fromError(error, ErrorType.USER, code, defaultContext);
                expect(result.userMessage).toBe(expected);
            });
        });

        it("should return default message for unknown error codes", () => {
            // Cast to bypass TypeScript checking for this test
            const unknownCode = "UNKNOWN_CODE" as ErrorCode;
            const error = new Error("Test");
            const result = RetrospectError.fromError(error, ErrorType.USER, unknownCode, defaultContext);
            expect(result.userMessage).toBe("An unexpected error occurred");
        });
    });

    describe("Retryable Error Detection", () => {
        it("should correctly identify retryable errors", () => {
            const retryableCodes = [
                ErrorCode.API_NETWORK_ERROR,
                ErrorCode.API_RATE_LIMITED,
                ErrorCode.DISK_SPACE_FULL
            ];

            retryableCodes.forEach(code => {
                const error = new Error("Test");
                const result = RetrospectError.fromError(error, ErrorType.API, code, defaultContext);
                expect(result.retryable).toBe(true);
            });
        });

        it("should correctly identify non-retryable errors", () => {
            const nonRetryableCodes = [
                ErrorCode.API_KEY_INVALID,
                ErrorCode.API_KEY_MISSING,
                ErrorCode.FILE_NOT_FOUND,
                ErrorCode.PERMISSION_DENIED,
                ErrorCode.INVALID_CONFIG,
                ErrorCode.ENCRYPTION_FAILED,
                ErrorCode.DECRYPTION_FAILED
            ];

            nonRetryableCodes.forEach(code => {
                const error = new Error("Test");
                const result = RetrospectError.fromError(error, ErrorType.USER, code, defaultContext);
                expect(result.retryable).toBe(false);
            });
        });
    });

    describe("Retry Mechanisms", () => {
        beforeEach(async () => {
            // Initialize the service before retry tests
            await service.initialize();
        });

        afterEach(async () => {
            await service.dispose();
        });

        describe("executeWithRetry - Retryable Errors", () => {
            it("should retry network errors up to maxRetries", async () => {
                let attemptCount = 0;
                const maxRetries = 2;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    throw new Error("Network error occurred");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(maxRetries + 1); // Initial attempt + retries
                expect(attemptCount).toBe(maxRetries + 1);
            });

            it("should retry rate limited errors", async () => {
                let attemptCount = 0;
                const maxRetries = 3;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    throw new Error("Rate limit exceeded");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(maxRetries + 1);
                expect(attemptCount).toBe(maxRetries + 1);
            });

            it("should succeed after retries if operation eventually works", async () => {
                let attemptCount = 0;
                const expectedResult = "success";
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    if (attemptCount < 3) {
                        throw new Error("Network error occurred");
                    }
                    return expectedResult;
                });

                const result = await service.executeWithRetry(operation, defaultContext, { maxRetries: 3 });

                expect(result).toBe(expectedResult);
                expect(operation).toHaveBeenCalledTimes(3);
                expect(attemptCount).toBe(3);
            });

            it("should handle RetrospectError instances in retries", async () => {
                const maxRetries = 2;
                
                const operation = jest.fn().mockImplementation(() => {
                    throw new RetrospectError(
                        ErrorType.NETWORK,
                        ErrorCode.API_NETWORK_ERROR,
                        "Network error",
                        "Network error. Please check your internet connection",
                        defaultContext,
                        true,
                        true
                    );
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries })
                ).rejects.toThrow(RetrospectError);

                expect(operation).toHaveBeenCalledTimes(maxRetries + 1);
            });
        });

        describe("executeWithRetry - Non-Retryable Errors", () => {
            it("should not retry API key invalid errors", async () => {
                let attemptCount = 0;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    throw new Error("API key is invalid");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: 3 })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(1); // Only initial attempt
                expect(attemptCount).toBe(1);
            });

            it("should not retry file not found errors", async () => {
                let attemptCount = 0;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    throw new Error("File not found");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: 3 })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(1);
                expect(attemptCount).toBe(1);
            });

            it("should not retry permission denied errors", async () => {
                let attemptCount = 0;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    throw new Error("Permission denied");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: 3 })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(1);
                expect(attemptCount).toBe(1);
            });

            it("should not retry encryption failed errors", async () => {
                let attemptCount = 0;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    throw new Error("Encryption failed");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: 3 })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(1);
                expect(attemptCount).toBe(1);
            });
        });

        describe("Backoff Delay Calculations", () => {
            it("should calculate exponential backoff with jitter", () => {
                const baseDelay = 10;
                
                // Test multiple attempts to verify exponential growth
                const delay1 = (service as TestableErrorHandlingService).calculateBackoffDelay(0, baseDelay);
                const delay2 = (service as TestableErrorHandlingService).calculateBackoffDelay(1, baseDelay);
                const delay3 = (service as TestableErrorHandlingService).calculateBackoffDelay(2, baseDelay);

                // Should follow exponential pattern: baseDelay * 2^attempt * jitter
                // Jitter is between 0.85 and 1.15, so we test bounds
                expect(delay1).toBeGreaterThanOrEqual(baseDelay * 0.85);
                expect(delay1).toBeLessThanOrEqual(baseDelay * 1.15);

                expect(delay2).toBeGreaterThanOrEqual(baseDelay * 2 * 0.85);
                expect(delay2).toBeLessThanOrEqual(baseDelay * 2 * 1.15);

                expect(delay3).toBeGreaterThanOrEqual(baseDelay * 4 * 0.85);
                expect(delay3).toBeLessThanOrEqual(baseDelay * 4 * 1.15);
            });

            it("should cap delay at maximum value", () => {
                const baseDelay = 10;
                const maxDelay = 30000; // This is hardcoded in the service
                
                // High attempt number should be capped at maxDelay
                const delay = (service as TestableErrorHandlingService).calculateBackoffDelay(10, baseDelay);
                
                expect(delay).toBeLessThanOrEqual(maxDelay);
            });

            it("should include jitter to prevent thundering herd", () => {
                const baseDelay = 10;
                const attempt = 1;
                
                // Run multiple calculations to verify jitter varies
                const delays = Array.from({ length: 10 }, () => 
                    (service as TestableErrorHandlingService).calculateBackoffDelay(attempt, baseDelay)
                );
                
                // Check that not all delays are identical (jitter is working)
                const uniqueDelays = new Set(delays);
                expect(uniqueDelays.size).toBeGreaterThan(1);
            });
        });

        describe("Retry Configuration", () => {
            it("should use custom maxRetries from options", async () => {
                const customMaxRetries = 1;
                
                const operation = jest.fn().mockImplementation(() => {
                    throw new Error("Network error occurred");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: customMaxRetries })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(customMaxRetries + 1);
            });

            it("should use custom retryDelay from options", async () => {
                const customDelay = 500;
                let startTime = Date.now();
                let endTime: number;
                let attemptCount = 0;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    if (attemptCount === 1) {
                        startTime = Date.now();
                        throw new Error("Network error occurred");
                    } else {
                        endTime = Date.now();
                        throw new Error("Network error occurred");
                    }
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { 
                        maxRetries: 1, 
                        retryDelay: customDelay 
                    })
                ).rejects.toThrow();

                // Verify that some delay occurred (should be at least customDelay * 0.85 due to jitter)
                const actualDelay = endTime! - startTime;
                expect(actualDelay).toBeGreaterThanOrEqual(customDelay * 0.8); // Account for timing variance
            });

            it("should use service config defaults when options not provided", async () => {
                const operation = jest.fn().mockImplementation(() => {
                    throw new Error("Network error occurred");
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext)
                ).rejects.toThrow();

                // Should use default maxRetries from service config (3)
                expect(operation).toHaveBeenCalledTimes(defaultConfig.maxRetries + 1);
            });
        });

        describe("Error Handling During Retries", () => {
            it("should handle mixed retryable and non-retryable errors", async () => {
                let attemptCount = 0;
                
                const operation = jest.fn().mockImplementation(() => {
                    attemptCount++;
                    if (attemptCount === 1) {
                        throw new Error("Network error occurred"); // Retryable
                    } else {
                        throw new Error("API key is invalid"); // Non-retryable
                    }
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: 3 })
                ).rejects.toThrow();

                // Should stop at second attempt due to non-retryable error
                expect(operation).toHaveBeenCalledTimes(2);
            });

            it("should throw RetrospectError on retry exhaustion", async () => {
                const operation = jest.fn().mockImplementation(() => {
                    throw new Error("Network error occurred");
                });

                try {
                    await service.executeWithRetry(operation, defaultContext, { maxRetries: 1 });
                    fail("Should have thrown an error");
                } catch (error) {
                    expect(error).toBeInstanceOf(RetrospectError);
                    expect((error as RetrospectError).code).toBe(ErrorCode.API_NETWORK_ERROR);
                    expect((error as RetrospectError).retryable).toBe(true);
                }
            });

            it("should handle non-Error objects thrown", async () => {
                const operation = jest.fn().mockImplementation(() => {
                    throw "String error"; // Non-Error object
                });

                await expect(
                    service.executeWithRetry(operation, defaultContext, { maxRetries: 1 })
                ).rejects.toThrow();

                expect(operation).toHaveBeenCalledTimes(1); // Should classify as non-retryable
            });
        });
    });

    describe("Error History Management", () => {
        beforeEach(async () => {
            await service.initialize();
        });

        afterEach(async () => {
            await service.dispose();
        });

        describe("Error Recording", () => {
            it("should record errors in history", async () => {
                const error = new Error("Test error");
                
                await service.handleError(error, defaultContext);
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(1);
                expect(history[0]).toBeInstanceOf(RetrospectError);
                expect(history[0].message).toBe("Test error");
            });

            it("should record multiple errors for same component:operation", async () => {
                const error1 = new Error("First error");
                const error2 = new Error("Second error");
                
                await service.handleError(error1, defaultContext);
                await service.handleError(error2, defaultContext);
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(2);
                expect(history[0].message).toBe("First error");
                expect(history[1].message).toBe("Second error");
            });

            it("should record errors for different component:operation combinations", async () => {
                const context1 = { ...defaultContext, component: "comp1", operation: "op1" };
                const context2 = { ...defaultContext, component: "comp2", operation: "op2" };
                
                await service.handleError(new Error("Error 1"), context1);
                await service.handleError(new Error("Error 2"), context2);
                
                const history1 = service.getErrorHistory("comp1", "op1");
                const history2 = service.getErrorHistory("comp2", "op2");
                
                expect(history1).toHaveLength(1);
                expect(history2).toHaveLength(1);
                expect(history1[0].message).toBe("Error 1");
                expect(history2[0].message).toBe("Error 2");
            });

            it("should record RetrospectError instances directly", async () => {
                const retrospectError = new RetrospectError(
                    ErrorType.API,
                    ErrorCode.API_KEY_INVALID,
                    "API error",
                    "User message",
                    defaultContext
                );
                
                await service.handleError(retrospectError, defaultContext);
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(1);
                expect(history[0]).toBe(retrospectError);
                expect(history[0].code).toBe(ErrorCode.API_KEY_INVALID);
            });
        });

        describe("Error History Size Limits", () => {
            it("should limit history to 50 entries per component:operation", async () => {
                // Add 55 errors to exceed the limit
                for (let i = 0; i < 55; i++) {
                    await service.handleError(new Error(`Error ${i}`), defaultContext);
                }
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(50);
                
                // Should keep the most recent 50 (5-54)
                expect(history[0].message).toBe("Error 5");
                expect(history[49].message).toBe("Error 54");
            });

            it("should maintain separate limits for different component:operation pairs", async () => {
                const context1 = { ...defaultContext, component: "comp1", operation: "op1" };
                const context2 = { ...defaultContext, component: "comp2", operation: "op2" };
                
                // Add 30 errors to each
                for (let i = 0; i < 30; i++) {
                    await service.handleError(new Error(`Comp1 Error ${i}`), context1);
                    await service.handleError(new Error(`Comp2 Error ${i}`), context2);
                }
                
                const history1 = service.getErrorHistory("comp1", "op1");
                const history2 = service.getErrorHistory("comp2", "op2");
                
                expect(history1).toHaveLength(30);
                expect(history2).toHaveLength(30);
                expect(history1[0].message).toBe("Comp1 Error 0");
                expect(history2[0].message).toBe("Comp2 Error 0");
            });
        });

        describe("Error History Retrieval", () => {
            beforeEach(async () => {
                // Set up test data
                const contexts = [
                    { ...defaultContext, component: "service1", operation: "operation1" },
                    { ...defaultContext, component: "service1", operation: "operation2" },
                    { ...defaultContext, component: "service2", operation: "operation1" },
                    { ...defaultContext, component: "service2", operation: "operation2" }
                ];
                
                for (let i = 0; i < contexts.length; i++) {
                    await service.handleError(new Error(`Error ${i}`), contexts[i]);
                }
            });

            it("should retrieve errors for specific component and operation", () => {
                const history = service.getErrorHistory("service1", "operation1");
                
                expect(history).toHaveLength(1);
                expect(history[0].context.component).toBe("service1");
                expect(history[0].context.operation).toBe("operation1");
                expect(history[0].message).toBe("Error 0");
            });

            it("should retrieve all errors for a component", () => {
                const history = service.getErrorHistory("service1");
                
                expect(history).toHaveLength(2);
                expect(history[0].context.component).toBe("service1");
                expect(history[1].context.component).toBe("service1");
                
                // Should contain both operations
                const operations = history.map(e => e.context.operation);
                expect(operations).toContain("operation1");
                expect(operations).toContain("operation2");
            });

            it("should retrieve all errors when no filters provided", () => {
                const history = service.getErrorHistory();
                
                expect(history).toHaveLength(4);
                
                // Should contain all components
                const components = history.map(e => e.context.component);
                expect(components).toContain("service1");
                expect(components).toContain("service2");
            });

            it("should return empty array for non-existent component:operation", () => {
                const history = service.getErrorHistory("nonexistent", "operation");
                
                expect(history).toHaveLength(0);
                expect(Array.isArray(history)).toBe(true);
            });

            it("should return empty array for non-existent component", () => {
                const history = service.getErrorHistory("nonexistent");
                
                expect(history).toHaveLength(0);
                expect(Array.isArray(history)).toBe(true);
            });
        });

        describe("Error History Clearing", () => {
            beforeEach(async () => {
                // Set up test data
                const contexts = [
                    { ...defaultContext, component: "service1", operation: "operation1" },
                    { ...defaultContext, component: "service1", operation: "operation2" },
                    { ...defaultContext, component: "service2", operation: "operation1" },
                    { ...defaultContext, component: "service2", operation: "operation2" }
                ];
                
                for (let i = 0; i < contexts.length; i++) {
                    await service.handleError(new Error(`Error ${i}`), contexts[i]);
                }
            });

            it("should clear errors for specific component and operation", () => {
                service.clearErrorHistory("service1", "operation1");
                
                const clearedHistory = service.getErrorHistory("service1", "operation1");
                const remainingHistory = service.getErrorHistory();
                
                expect(clearedHistory).toHaveLength(0);
                expect(remainingHistory).toHaveLength(3); // Other 3 should remain
            });

            it("should clear all errors for a component", () => {
                service.clearErrorHistory("service1");
                
                const clearedHistory = service.getErrorHistory("service1");
                const remainingHistory = service.getErrorHistory();
                
                expect(clearedHistory).toHaveLength(0);
                expect(remainingHistory).toHaveLength(2); // service2 errors should remain
                
                // Verify service2 errors are still there
                const service2History = service.getErrorHistory("service2");
                expect(service2History).toHaveLength(2);
            });

            it("should clear all error history when no parameters provided", () => {
                service.clearErrorHistory();
                
                const allHistory = service.getErrorHistory();
                expect(allHistory).toHaveLength(0);
            });

            it("should handle clearing non-existent component gracefully", () => {
                const originalHistory = service.getErrorHistory();
                
                service.clearErrorHistory("nonexistent");
                
                const newHistory = service.getErrorHistory();
                expect(newHistory).toHaveLength(originalHistory.length);
            });

            it("should handle clearing non-existent operation gracefully", () => {
                const originalHistory = service.getErrorHistory();
                
                service.clearErrorHistory("service1", "nonexistent");
                
                const newHistory = service.getErrorHistory();
                expect(newHistory).toHaveLength(originalHistory.length);
            });
        });

        describe("Error History with Different Error Types", () => {
            it("should record history for different error types", async () => {
                const errors = [
                    new Error("API key is invalid"),
                    new Error("Network error occurred"),
                    new Error("File not found"),
                    new Error("Rate limit exceeded")
                ];
                
                for (const error of errors) {
                    await service.handleError(error, defaultContext);
                }
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(4);
                
                // Verify different error types are classified correctly
                expect(history[0].code).toBe(ErrorCode.API_KEY_INVALID);
                expect(history[1].code).toBe(ErrorCode.API_NETWORK_ERROR);
                expect(history[2].code).toBe(ErrorCode.FILE_NOT_FOUND);
                expect(history[3].code).toBe(ErrorCode.API_RATE_LIMITED);
            });

            it("should preserve error metadata in history", async () => {
                const contextWithMetadata: ErrorContext = {
                    ...defaultContext,
                    metadata: {
                        userId: "123",
                        requestId: "req-456",
                        timestamp: Date.now()
                    }
                };
                
                await service.handleError(new Error("Test error"), contextWithMetadata);
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(1);
                expect(history[0].context.metadata).toEqual({
                    userId: "123",
                    requestId: "req-456",
                    timestamp: expect.any(Number)
                });
            });

            it("should maintain chronological order in history", async () => {
                const baseTime = Date.now();
                
                for (let i = 0; i < 3; i++) {
                    const context = {
                        ...defaultContext,
                        timestamp: baseTime + (i * 1000)
                    };
                    await service.handleError(new Error(`Error ${i}`), context);
                }
                
                const history = service.getErrorHistory("test-component", "test-operation");
                expect(history).toHaveLength(3);
                
                // Should be in chronological order (oldest first)
                for (let i = 0; i < 2; i++) {
                    expect(history[i].context.timestamp).toBeLessThan(history[i + 1].context.timestamp);
                }
            });
        });

        describe("Error History Disposal", () => {
            it("should clear all history on service disposal", async () => {
                await service.handleError(new Error("Test error"), defaultContext);
                
                const history = service.getErrorHistory();
                expect(history).toHaveLength(1);
                
                await service.dispose();
                
                // Should throw since service is disposed
                expect(() => service.getErrorHistory()).toThrow();
            });

            it("should prevent operations after disposal", async () => {
                await service.dispose();
                
                expect(() => service.getErrorHistory()).toThrow();
                expect(() => service.clearErrorHistory()).toThrow();
            });
        });
    });
});