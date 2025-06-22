import { Logger } from "./logger";
import {
	AIModelAdapter,
	AIModelConfig,
	AIModelFactory,
} from "./ai-interfaces";
import { OpenAIAdapter } from "./openai-adapter";

/**
 * Simplified AI Model Factory for MVP - OpenAI only
 */
class SimpleAIModelFactory implements AIModelFactory {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Create a model adapter instance (OpenAI only)
	 */
	async createModel(config: AIModelConfig): Promise<AIModelAdapter> {
		this.logger.debug(`Creating model adapter for: ${config.name}`);

		// Only support OpenAI for MVP
		if (config.type !== "cloud") {
			throw new Error(`Unsupported model type: ${config.type}. MVP only supports OpenAI.`);
		}

		if (!config.apiKey) {
			throw new Error("API key is required for OpenAI models");
		}

		return new OpenAIAdapter(this.logger, config);
	}

	/**
	 * Get available model types (OpenAI only)
	 */
	async getAvailableModels(): Promise<string[]> {
		return [
			"gpt-4",
			"gpt-4-turbo",
			"gpt-3.5-turbo",
			"gpt-3.5-turbo-16k"
		];
	}

	/**
	 * Validate model configuration
	 */
	async validateConfig(
		config: AIModelConfig
	): Promise<{ valid: boolean; errors: string[] }> {
		const errors: string[] = [];

		if (!config.name) {
			errors.push("Model name is required");
		}

		if (config.type !== "cloud") {
			errors.push("Only cloud models (OpenAI) are supported in MVP");
		}

		if (!config.apiKey) {
			errors.push("API key is required");
		}

		if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 8192)) {
			errors.push("Max tokens must be between 1 and 8192");
		}

		if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
			errors.push("Temperature must be between 0 and 2");
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}
}

// Singleton instance
let factoryInstance: SimpleAIModelFactory | null = null;

/**
 * Get the AI model factory instance
 */
export function getAIModelFactory(logger?: Logger): AIModelFactory {
	if (!factoryInstance) {
		if (!logger) {
			throw new Error("Logger is required for first factory initialization");
		}
		factoryInstance = new SimpleAIModelFactory(logger);
	}
	return factoryInstance;
}

/**
 * Reset the factory instance (useful for testing)
 */
export function resetAIModelFactory(): void {
	factoryInstance = null;
}
