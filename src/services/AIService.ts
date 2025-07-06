// src/services/AIService.ts

import { App, TFile } from "obsidian";
import { BaseService } from "./BaseService";

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
 * AI service for generating journal summaries
 * Handles all OpenAI API interactions
 */
export class AIService extends BaseService {
    private config: AIServiceConfig;

    constructor(app: App, config: AIServiceConfig) {
        super(app);
        this.config = config;
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
            throw new Error("OpenAI API key is not configured");
        }

        if (!content || content.trim().length === 0) {
            throw new Error("No content provided for summary generation");
        }

        const prompt = this.buildPrompt(content, sourceFiles);
        
        try {
            const response = await this.callOpenAI(prompt);
            return this.extractSummaryFromResponse(response);
        } catch (error) {
            console.error("Failed to generate summary:", error);
            throw new Error(`Failed to generate summary: ${error.message}`);
        }
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
            throw new Error("OpenAI API key is not configured");
        }

        if (!prompt || prompt.trim().length === 0) {
            throw new Error("No prompt provided for response generation");
        }
        
        try {
            const response = await this.callOpenAI(prompt);
            return this.extractSummaryFromResponse(response);
        } catch (error) {
            console.error("Failed to generate response:", error);
            throw new Error(`Failed to generate response: ${error.message}`);
        }
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
            throw new Error("OpenAI API key is not configured");
        }

        try {
            const testPrompt = "Reply with just 'OK' if you can read this.";
            const response = await this.callOpenAI(testPrompt);
            return response.choices && response.choices.length > 0;
        } catch (error) {
            console.error("AI service connection test failed:", error);
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
    private async callOpenAI(prompt: string): Promise<any> {
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
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Extract summary content from OpenAI response
     * 
     * @param response - OpenAI API response
     * @returns Summary content
     */
    private extractSummaryFromResponse(response: any): string {
        if (!response.choices || response.choices.length === 0) {
            throw new Error("No choices in OpenAI response");
        }

        const content = response.choices[0].message?.content;
        if (!content) {
            throw new Error("No content in OpenAI response");
        }

        return content.trim();
    }

    /**
     * Initialize the AI service
     */
    protected async onInitialize(): Promise<void> {
        // Validate configuration
        if (!this.config.apiUrl) {
            throw new Error("AI service API URL is not configured");
        }

        if (!this.config.model) {
            throw new Error("AI service model is not configured");
        }

        console.log(`AI service initialized with model: ${this.config.model}`);
    }

    /**
     * Dispose the AI service
     */
    protected async onDispose(): Promise<void> {
        // Clear sensitive data
        this.config = {
            apiKey: "",
            model: "",
            maxTokens: 0,
            temperature: 0,
            apiUrl: ""
        };
        
        console.log("AI service disposed");
    }
}