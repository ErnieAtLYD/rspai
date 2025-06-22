import { Logger } from "./logger";
import { ErrorHandler } from "./error-handler";
import { OpenAIAdapter } from "./openai-adapter";
import {
	AIModelConfig,
	AIModelType,
	PrivacyLevel,
	CompletionOptions,
} from "./ai-interfaces";

/**
 * Simplified AI service configuration for MVP
 */
export interface AIServiceSettings {
	// General AI settings
	enableAI: boolean;
	primaryProvider: "openai";

	// Privacy settings
	privacyLevel: PrivacyLevel;

	// OpenAI configuration
	openaiConfig: {
		apiKey: string;
		model: string;
		maxTokens: number;
		temperature: number;
		endpoint?: string;
	};
}

/**
 * Default AI service settings for MVP
 */
export const DEFAULT_AI_SETTINGS: AIServiceSettings = {
	enableAI: false,
	primaryProvider: "openai",
	privacyLevel: "hybrid",

	openaiConfig: {
		apiKey: "",
		model: "gpt-3.5-turbo",
		maxTokens: 2000,
		temperature: 0.7,
		endpoint: "https://api.openai.com/v1",
	},
};

/**
 * Simple analysis result for MVP
 */
export interface SimpleAnalysisResult {
	summary: string;
	keyInsights: string[];
	confidence: number;
}

/**
 * Simplified AI service for MVP - OpenAI only
 */
export class AIService {
	private logger: Logger;
	private errorHandler: ErrorHandler;
	private openaiAdapter: OpenAIAdapter | null = null;
	private settings: AIServiceSettings;
	private isInitialized = false;

	constructor(
		logger: Logger,
		errorHandler: ErrorHandler,
		settings: AIServiceSettings = DEFAULT_AI_SETTINGS
	) {
		this.logger = logger;
		this.errorHandler = errorHandler;
		this.settings = { ...settings };
	}

	/**
	 * Initialize the AI service with OpenAI
	 */
	async initialize(): Promise<void> {
		this.logger.info("Initializing simplified AI Service");

		try {
			if (!this.settings.enableAI) {
				this.logger.info("AI service disabled in settings");
				return;
			}

			if (!this.settings.openaiConfig.apiKey) {
				this.logger.warn("OpenAI API key not provided");
				return;
			}

			// Create OpenAI config
			const config: AIModelConfig = {
				name: this.settings.openaiConfig.model,
				type: "cloud" as AIModelType,
				endpoint: this.settings.openaiConfig.endpoint || "https://api.openai.com/v1",
				apiKey: this.settings.openaiConfig.apiKey,
				model: this.settings.openaiConfig.model,
				maxTokens: this.settings.openaiConfig.maxTokens,
				temperature: this.settings.openaiConfig.temperature,
			};

			// Initialize OpenAI adapter
			this.openaiAdapter = new OpenAIAdapter(this.logger, config);
			await this.openaiAdapter.initialize();

			this.isInitialized = true;
			this.logger.info("AI Service initialized successfully");
		} catch (error) {
			this.logger.error("Failed to initialize AI Service", error);
			throw error;
		}
	}

	/**
	 * Analyze personal content with OpenAI
	 */
	async analyzePersonalContent(
		content: string,
		options?: { maxLength?: number }
	): Promise<SimpleAnalysisResult> {
		if (!this.isInitialized || !this.openaiAdapter) {
			throw new Error("AI Service not initialized or API key missing");
		}

		try {
			const maxLength = options?.maxLength || 3000;
			const truncatedContent = content.substring(0, maxLength);

			const prompt = `Analyze this personal note and provide insights:

${truncatedContent}

Please provide:
1. A brief summary (2-3 sentences)
2. 3-5 key insights or patterns
3. Any actionable suggestions

Format your response as JSON with fields: summary, insights (array), suggestions (array)`;

			const completionOptions: CompletionOptions = {
				maxTokens: this.settings.openaiConfig.maxTokens,
				temperature: this.settings.openaiConfig.temperature,
			};

			const response = await this.openaiAdapter.generateCompletion(
				prompt,
				completionOptions
			);

			// Try to parse JSON response, fallback to simple parsing
			try {
				const parsed = JSON.parse(response);
				return {
					summary: parsed.summary || "Analysis completed",
					keyInsights: parsed.insights || [response.substring(0, 200)],
					confidence: 0.8,
				};
			} catch {
				// Fallback to simple text response
				return {
					summary: response.substring(0, 200),
					keyInsights: [response],
					confidence: 0.7,
				};
			}
		} catch (error) {
			this.logger.error("Failed to analyze content", error);
			throw error;
		}
	}

	/**
	 * Generate simple completion
	 */
	async generateCompletion(
		prompt: string,
		options?: CompletionOptions
	): Promise<string> {
		if (!this.isInitialized || !this.openaiAdapter) {
			throw new Error("AI Service not initialized");
		}

		return await this.openaiAdapter.generateCompletion(prompt, options);
	}

	/**
	 * Update settings
	 */
	async updateSettings(newSettings: Partial<AIServiceSettings>): Promise<void> {
		this.settings = { ...this.settings, ...newSettings };
		
		// Reinitialize if API key changed
		if (newSettings.openaiConfig?.apiKey) {
			this.isInitialized = false;
			await this.initialize();
		}
	}

	/**
	 * Get current settings
	 */
	getSettings(): AIServiceSettings {
		return { ...this.settings };
	}

	/**
	 * Check if service is ready
	 */
	isReady(): boolean {
		return this.isInitialized && !!this.openaiAdapter && !!this.settings.openaiConfig.apiKey;
	}

	/**
	 * Dispose of resources
	 */
	async dispose(): Promise<void> {
		this.openaiAdapter = null;
		this.isInitialized = false;
		this.logger.info("AI Service disposed");
	}
} 