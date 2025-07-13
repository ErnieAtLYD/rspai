// src/services/AIService.ts

import { App, TFile } from "obsidian";
import { BaseService } from "./BaseService";
import { ErrorHandlingService, ErrorType, ErrorCode, RetrospectError } from "./ErrorHandlingService";

/**
 * AI service configuration
 */
export interface AIServiceConfig {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    apiUrl: string;
}

/**
 * OpenAI API response structure
 */
interface OpenAIResponse {
    choices: Array<{
        message?: {
            content?: string;
        };
    }>;
}

/**
 * AI service for generating journal summaries
 * Handles all OpenAI API interactions
 */
export class AIService extends BaseService {
    private config: AIServiceConfig;
    private errorHandler: ErrorHandlingService;

    constructor(app: App, config: AIServiceConfig, errorHandler?: ErrorHandlingService) {
        super(app);
        this.config = config;
        this.errorHandler = errorHandler || new ErrorHandlingService(app, {
            maxRetries: 3,
            baseRetryDelay: 1000,
            enableLogging: true,
            enableNotifications: true
        });
    }

    /**
     * Update AI service configuration
     * 
     * @param config - New configuration
     */
    updateConfig(config: AIServiceConfig): void {
        this.ensureNotDisposed();
        this.config = config;
    }

    /**
     * Generate a summary of journal entries
     * 
     * @param content - Combined content of journal entries
     * @param sourceFiles - Source files for context
     * @returns Generated summary
     */
    async generateSummary(content: string, sourceFiles: TFile[]): Promise<string> {
        this.ensureReady();

        if (!this.config.apiKey) {
            throw new RetrospectError(
                ErrorType.USER,
                ErrorCode.API_KEY_MISSING,
                "OpenAI API key is not configured",
                "Please configure your OpenAI API key in settings",
                { operation: 'generateSummary', component: 'AIService', timestamp: Date.now() }
            );
        }

        if (!content || content.trim().length === 0) {
            throw new RetrospectError(
                ErrorType.VALIDATION,
                ErrorCode.INVALID_CONFIG,
                "No content provided for summary generation",
                "No journal content found to summarize",
                { operation: 'generateSummary', component: 'AIService', timestamp: Date.now() }
            );
        }

        const prompt = this.buildPrompt(content, sourceFiles);
        
        return await this.errorHandler.executeWithRetry(
            async () => {
                const response = await this.callOpenAI(prompt);
                return this.extractSummaryFromResponse(response);
            },
            { operation: 'generateSummary', component: 'AIService', timestamp: Date.now() },
            { maxRetries: 3, retryDelay: 1000 }
        );
    }

    /**
     * Generate a response to a custom prompt
     * 
     * @param prompt - Custom prompt to send to the AI
     * @returns Generated response text
     */
    async generateResponse(prompt: string): Promise<string> {
        this.ensureReady();

        if (!this.config.apiKey) {
            throw new RetrospectError(
                ErrorType.USER,
                ErrorCode.API_KEY_MISSING,
                "OpenAI API key is not configured",
                "Please configure your OpenAI API key in settings",
                { operation: 'generateResponse', component: 'AIService', timestamp: Date.now() }
            );
        }

        if (!prompt || prompt.trim().length === 0) {
            throw new RetrospectError(
                ErrorType.VALIDATION,
                ErrorCode.INVALID_CONFIG,
                "No prompt provided for response generation",
                "No prompt provided for AI response",
                { operation: 'generateResponse', component: 'AIService', timestamp: Date.now() }
            );
        }
        
        return await this.errorHandler.executeWithRetry(
            async () => {
                const response = await this.callOpenAI(prompt);
                return this.extractSummaryFromResponse(response);
            },
            { operation: 'generateResponse', component: 'AIService', timestamp: Date.now() },
            { maxRetries: 3, retryDelay: 1000 }
        );
    }

    /**
     * Test the AI service configuration
     * Makes a simple API call to verify connectivity
     * 
     * @returns True if connection is successful
     */
    async testConnection(): Promise<boolean> {
        this.ensureReady();

        if (!this.config.apiKey) {
            throw new RetrospectError(
                ErrorType.USER,
                ErrorCode.API_KEY_MISSING,
                "OpenAI API key is not configured",
                "Please configure your OpenAI API key in settings",
                { operation: 'testConnection', component: 'AIService', timestamp: Date.now() }
            );
        }

        try {
            const testPrompt = "Reply with just 'OK' if you can read this.";
            const response = await this.callOpenAI(testPrompt);
            return response.choices && response.choices.length > 0;
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                { operation: 'testConnection', component: 'AIService', timestamp: Date.now() },
                { showNotice: false, logToConsole: true }
            );
            return false;
        }
    }

    /**
     * Get current AI model information
     * 
     * @returns Current model and configuration
     */
    getModelInfo(): { model: string; maxTokens: number; temperature: number } {
        this.ensureNotDisposed();
        
        return {
            model: this.config.model,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature
        };
    }

    /**
     * Build the prompt for journal summary generation
     * 
     * @param content - Journal content
     * @param sourceFiles - Source files for context
     * @returns Formatted prompt
     */
    private buildPrompt(content: string, sourceFiles: TFile[]): string {
        const fileCount = sourceFiles.length;
        const fileNames = sourceFiles.map(f => f.basename).join(", ");

        return `Please analyze these journal entries from the past week and provide a thoughtful reflection. Focus on:

1. Key themes and patterns you notice
2. Emotional journey and growth
3. Important events or insights
4. Areas for future reflection or action

Be encouraging and supportive in your tone, like a wise friend reflecting back what they've observed.

Journal entries (${fileCount} files: ${fileNames}):
${content}

Please provide a structured reflection that would be meaningful for weekly review.`;
    }

    /**
     * Make API call to OpenAI
     * 
     * @param prompt - Prompt to send
     * @returns API response
     */
    private async callOpenAI(prompt: string): Promise<OpenAIResponse> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        try {
            const response = await fetch(this.config.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    max_tokens: this.config.maxTokens,
                    temperature: this.config.temperature,
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                
                if (response.status === 401) {
                    throw new RetrospectError(
                        ErrorType.USER,
                        ErrorCode.API_KEY_INVALID,
                        `Invalid API key: ${response.status} ${response.statusText}`,
                        "Invalid API key. Please check your OpenAI API key in settings",
                        { operation: 'callOpenAI', component: 'AIService', timestamp: Date.now() }
                    );
                }
                
                if (response.status === 429) {
                    throw new RetrospectError(
                        ErrorType.API,
                        ErrorCode.API_RATE_LIMITED,
                        `Rate limited: ${response.status} ${response.statusText}`,
                        "API rate limit exceeded. Please try again in a few minutes",
                        { operation: 'callOpenAI', component: 'AIService', timestamp: Date.now() },
                        true,
                        true
                    );
                }
                
                if (response.status >= 500) {
                    throw new RetrospectError(
                        ErrorType.API,
                        ErrorCode.API_RESPONSE_ERROR,
                        `Server error: ${response.status} ${response.statusText}`,
                        "OpenAI service is temporarily unavailable. Please try again later",
                        { operation: 'callOpenAI', component: 'AIService', timestamp: Date.now() },
                        true,
                        true
                    );
                }
                
                throw new RetrospectError(
                    ErrorType.API,
                    ErrorCode.API_RESPONSE_ERROR,
                    `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
                    "OpenAI API request failed. Please check your settings and try again",
                    { operation: 'callOpenAI', component: 'AIService', timestamp: Date.now() }
                );
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new RetrospectError(
                    ErrorType.NETWORK,
                    ErrorCode.API_NETWORK_ERROR,
                    "Request timeout",
                    "Request timed out. Please check your internet connection and try again",
                    { operation: 'callOpenAI', component: 'AIService', timestamp: Date.now() },
                    true,
                    true
                );
            }
            
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new RetrospectError(
                    ErrorType.NETWORK,
                    ErrorCode.API_NETWORK_ERROR,
                    "Network error",
                    "Unable to connect to OpenAI. Please check your internet connection",
                    { operation: 'callOpenAI', component: 'AIService', timestamp: Date.now() },
                    true,
                    true
                );
            }
            
            throw error;
        }
    }

    /**
     * Extract summary content from OpenAI response
     * 
     * @param response - OpenAI API response
     * @returns Summary content
     */
    private extractSummaryFromResponse(response: OpenAIResponse): string {
        if (!response.choices || response.choices.length === 0) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RESPONSE_ERROR,
                "No choices in OpenAI response",
                "Invalid response from OpenAI. Please try again",
                { operation: 'extractSummaryFromResponse', component: 'AIService', timestamp: Date.now() }
            );
        }

        const content = response.choices[0].message?.content;
        if (!content) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RESPONSE_ERROR,
                "No content in OpenAI response",
                "Empty response from OpenAI. Please try again",
                { operation: 'extractSummaryFromResponse', component: 'AIService', timestamp: Date.now() }
            );
        }

        return content.trim();
    }

    /**
     * Initialize the AI service
     */
    protected async onInitialize(): Promise<void> {
        // Initialize error handler first if not already initialized
        await this.errorHandler.initialize();
        
        // Validate configuration
        if (!this.config.apiUrl) {
            throw new RetrospectError(
                ErrorType.CRITICAL,
                ErrorCode.INVALID_CONFIG,
                "AI service API URL is not configured",
                "AI service configuration is invalid",
                { operation: 'onInitialize', component: 'AIService', timestamp: Date.now() }
            );
        }

        if (!this.config.model) {
            throw new RetrospectError(
                ErrorType.CRITICAL,
                ErrorCode.INVALID_CONFIG,
                "AI service model is not configured",
                "AI service configuration is invalid",
                { operation: 'onInitialize', component: 'AIService', timestamp: Date.now() }
            );
        }

        // Log service initialization (using console.log is acceptable for service lifecycle)
        console.log(`AI service initialized with model: ${this.config.model}`);
    }

    /**
     * Dispose the AI service
     */
    protected async onDispose(): Promise<void> {
        // Dispose error handler only if we own it
        if (this.errorHandler && this.errorHandler.isReady()) {
            await this.errorHandler.dispose();
        }
        
        // Clear sensitive data
        this.config = {
            apiKey: "",
            model: "",
            maxTokens: 0,
            temperature: 0,
            apiUrl: ""
        };
        
        // Log service disposal (using console.log is acceptable for service lifecycle)
        console.log("AI service disposed");
    }
}