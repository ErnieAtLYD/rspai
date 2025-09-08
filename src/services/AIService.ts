// src/services/AIService.ts

import { App, TFile } from "obsidian";
import { BaseService } from "./BaseService";
import { ErrorHandlingService, ErrorType, ErrorCode, RetrospectError } from "./ErrorHandlingService";

/**
 * AI service configuration
 */
export interface AIServiceConfig {
    provider: 'openai' | 'ollama';
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
    apiUrl: string;
    timeout?: number;
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
 * Ollama API response structure
 */
interface OllamaResponse {
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

/**
 * Abstract LLM provider interface
 */
interface LLMProvider {
    callAPI(prompt: string): Promise<string>;
    testConnection(): Promise<boolean>;
    getModelInfo(): { model: string; maxTokens: number; temperature: number };
}

/**
 * OpenAI provider implementation
 */
class OpenAIProvider implements LLMProvider {
    constructor(
        private config: AIServiceConfig,
        private errorHandler: ErrorHandlingService
    ) {}

    async callAPI(prompt: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 60000);

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
                await this.handleOpenAIError(response);
            }

            const data: OpenAIResponse = await response.json();
            return this.extractOpenAIResponse(data);
        } catch (error) {
            clearTimeout(timeoutId);
            return this.handleNetworkError(error);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const testPrompt = "Reply with just 'OK' if you can read this.";
            await this.callAPI(testPrompt);
            return true;
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                { operation: 'testConnection', component: 'OpenAIProvider', timestamp: Date.now() },
                { showNotice: false, logToConsole: true }
            );
            return false;
        }
    }

    getModelInfo(): { model: string; maxTokens: number; temperature: number } {
        return {
            model: this.config.model,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature
        };
    }

    private async handleOpenAIError(response: Response): Promise<never> {
        const errorText = await response.text();
        
        if (response.status === 401) {
            throw new RetrospectError(
                ErrorType.USER,
                ErrorCode.API_KEY_INVALID,
                `Invalid API key: ${response.status} ${response.statusText}`,
                "Invalid API key. Please check your OpenAI API key in settings",
                { operation: 'callOpenAI', component: 'OpenAIProvider', timestamp: Date.now() }
            );
        }
        
        if (response.status === 429) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RATE_LIMITED,
                `Rate limited: ${response.status} ${response.statusText}`,
                "API rate limit exceeded. Please try again in a few minutes",
                { operation: 'callOpenAI', component: 'OpenAIProvider', timestamp: Date.now() },
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
                { operation: 'callOpenAI', component: 'OpenAIProvider', timestamp: Date.now() },
                true,
                true
            );
        }
        
        throw new RetrospectError(
            ErrorType.API,
            ErrorCode.API_RESPONSE_ERROR,
            `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
            "OpenAI API request failed. Please check your settings and try again",
            { operation: 'callOpenAI', component: 'OpenAIProvider', timestamp: Date.now() }
        );
    }

    private handleNetworkError(error: Error): Promise<never> {
        if (error.name === 'AbortError') {
            throw new RetrospectError(
                ErrorType.NETWORK,
                ErrorCode.API_NETWORK_ERROR,
                "Request timeout",
                "Request timed out. Please check your internet connection and try again",
                { operation: 'callOpenAI', component: 'OpenAIProvider', timestamp: Date.now() },
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
                { operation: 'callOpenAI', component: 'OpenAIProvider', timestamp: Date.now() },
                true,
                true
            );
        }
        
        throw error;
    }

    private extractOpenAIResponse(response: OpenAIResponse): string {
        if (!response.choices || response.choices.length === 0) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RESPONSE_ERROR,
                "No choices in OpenAI response",
                "Invalid response from OpenAI. Please try again",
                { operation: 'extractOpenAIResponse', component: 'OpenAIProvider', timestamp: Date.now() }
            );
        }

        const content = response.choices[0].message?.content;
        if (!content) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RESPONSE_ERROR,
                "No content in OpenAI response",
                "Empty response from OpenAI. Please try again",
                { operation: 'extractOpenAIResponse', component: 'OpenAIProvider', timestamp: Date.now() }
            );
        }

        return content.trim();
    }
}

/**
 * Ollama provider implementation
 */
class OllamaProvider implements LLMProvider {
    constructor(
        private config: AIServiceConfig,
        private errorHandler: ErrorHandlingService
    ) {}

    async callAPI(prompt: string): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

        try {
            const response = await fetch(`${this.config.apiUrl}/api/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: this.config.model,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: this.config.temperature,
                        num_predict: this.config.maxTokens,
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                await this.handleOllamaError(response);
            }

            const data: OllamaResponse = await response.json();
            return this.extractOllamaResponse(data);
        } catch (error) {
            clearTimeout(timeoutId);
            return this.handleNetworkError(error);
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            const testPrompt = "Reply with just 'OK' if you can read this.";
            await this.callAPI(testPrompt);
            return true;
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                { operation: 'testConnection', component: 'OllamaProvider', timestamp: Date.now() },
                { showNotice: false, logToConsole: true }
            );
            return false;
        }
    }

    getModelInfo(): { model: string; maxTokens: number; temperature: number } {
        return {
            model: this.config.model,
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature
        };
    }

    private async handleOllamaError(response: Response): Promise<never> {
        const errorText = await response.text();
        
        if (response.status === 404) {
            throw new RetrospectError(
                ErrorType.USER,
                ErrorCode.API_RESPONSE_ERROR,
                `Model not found: ${this.config.model}`,
                `Ollama model '${this.config.model}' not found. Please ensure the model is downloaded.`,
                { operation: 'callOllama', component: 'OllamaProvider', timestamp: Date.now() }
            );
        }
        
        if (response.status >= 500) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RESPONSE_ERROR,
                `Ollama server error: ${response.status} ${response.statusText}`,
                "Ollama service is temporarily unavailable. Please ensure Ollama is running.",
                { operation: 'callOllama', component: 'OllamaProvider', timestamp: Date.now() },
                true,
                true
            );
        }
        
        throw new RetrospectError(
            ErrorType.API,
            ErrorCode.API_RESPONSE_ERROR,
            `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`,
            "Ollama API request failed. Please check that Ollama is running and try again",
            { operation: 'callOllama', component: 'OllamaProvider', timestamp: Date.now() }
        );
    }

    private handleNetworkError(error: Error): Promise<never> {
        if (error.name === 'AbortError') {
            throw new RetrospectError(
                ErrorType.NETWORK,
                ErrorCode.API_NETWORK_ERROR,
                "Request timeout",
                "Request timed out. Please check if Ollama is running and try again",
                { operation: 'callOllama', component: 'OllamaProvider', timestamp: Date.now() },
                true,
                true
            );
        }
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new RetrospectError(
                ErrorType.NETWORK,
                ErrorCode.API_NETWORK_ERROR,
                "Network error",
                "Unable to connect to Ollama. Please ensure Ollama is running on the configured URL",
                { operation: 'callOllama', component: 'OllamaProvider', timestamp: Date.now() },
                true,
                true
            );
        }
        
        throw error;
    }

    private extractOllamaResponse(response: OllamaResponse): string {
        if (!response.response) {
            throw new RetrospectError(
                ErrorType.API,
                ErrorCode.API_RESPONSE_ERROR,
                "No response in Ollama response",
                "Empty response from Ollama. Please try again",
                { operation: 'extractOllamaResponse', component: 'OllamaProvider', timestamp: Date.now() }
            );
        }

        return response.response.trim();
    }
}

/**
 * AI service for generating journal summaries
 * Handles multiple LLM provider interactions
 */
export class AIService extends BaseService {
    private config: AIServiceConfig;
    private errorHandler: ErrorHandlingService;
    private provider: LLMProvider;

    constructor(app: App, config: AIServiceConfig, errorHandler?: ErrorHandlingService) {
        super(app);
        this.config = config;
        this.errorHandler = errorHandler || new ErrorHandlingService(app, {
            maxRetries: 3,
            baseRetryDelay: 1000,
            enableLogging: true,
            enableNotifications: true
        });
        this.provider = this.createProvider();
    }

    /**
     * Create appropriate provider based on configuration
     */
    private createProvider(): LLMProvider {
        switch (this.config.provider) {
            case 'openai':
                return new OpenAIProvider(this.config, this.errorHandler);
            case 'ollama':
                return new OllamaProvider(this.config, this.errorHandler);
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    /**
     * Update AI service configuration
     * 
     * @param config - New configuration
     */
    updateConfig(config: AIServiceConfig): void {
        this.ensureNotDisposed();
        this.config = config;
        this.provider = this.createProvider();
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

        if (this.config.provider === 'openai' && !this.config.apiKey) {
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
                return await this.provider.callAPI(prompt);
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

        if (this.config.provider === 'openai' && !this.config.apiKey) {
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
                return await this.provider.callAPI(prompt);
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

        if (this.config.provider === 'openai' && !this.config.apiKey) {
            throw new RetrospectError(
                ErrorType.USER,
                ErrorCode.API_KEY_MISSING,
                "OpenAI API key is not configured",
                "Please configure your OpenAI API key in settings",
                { operation: 'testConnection', component: 'AIService', timestamp: Date.now() }
            );
        }

        return await this.provider.testConnection();
    }

    /**
     * Get current AI model information
     * 
     * @returns Current model and configuration
     */
    getModelInfo(): { model: string; maxTokens: number; temperature: number } {
        this.ensureNotDisposed();
        return this.provider.getModelInfo();
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

        this.logger.lifecycle('initialized', `with model: ${this.config.model}`);
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
            provider: 'openai',
            apiKey: "",
            model: "",
            maxTokens: 0,
            temperature: 0,
            apiUrl: ""
        };
        
        this.logger.lifecycle('disposed');
    }
}