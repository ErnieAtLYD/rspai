// src/services/NLPAnalysisServiceNew.ts

import { App } from "obsidian";
import { BaseService } from "./BaseService";
import { CacheService } from "./CacheService";
import { ErrorHandlingService } from "./ErrorHandlingService";
import { 
	TextProcessor, 
	ThemeExtractor, 
	SentimentAnalyzer, 
	BlockerDetector,
	ProductivityTheme,
	BlockerPattern,
	SentimentAnalysis
} from "./nlp";

export interface NLPAnalysisConfig {
	analysisDepth: 'basic' | 'advanced' | 'comprehensive';
	blockerDetectionSensitivity: number;
	enableEntityRecognition: boolean;
	enableAdvancedSentiment: boolean;
}

export interface NLPAnalysisResult {
	themes: ProductivityTheme[];
	blockers: BlockerPattern[];
	sentiment: SentimentAnalysis;
	entities?: {
		people: string[];
		places: string[];
		organizations: string[];
	};
	keywords: string[];
	metadata: {
		textLength: number;
		processingTime: number;
		cacheHit: boolean;
	};
}

export class NLPAnalysisService extends BaseService {
	private textProcessor: TextProcessor;
	private themeExtractor: ThemeExtractor;
	private sentimentAnalyzer: SentimentAnalyzer;
	private blockerDetector: BlockerDetector;
	private config: NLPAnalysisConfig;
	private cacheService?: CacheService;
	private errorHandler?: ErrorHandlingService;

	constructor(app: App, config: NLPAnalysisConfig) {
		super(app);
		this.config = config;
		
		// Initialize processors
		this.textProcessor = new TextProcessor();
		this.themeExtractor = new ThemeExtractor(this.textProcessor);
		this.sentimentAnalyzer = new SentimentAnalyzer(this.textProcessor);
		this.blockerDetector = new BlockerDetector(this.textProcessor);
	}

	async initialize(): Promise<void> {
		await super.initialize();
		this.logger.info("Initialized with modular architecture");
	}

	async configure(
		cacheService?: CacheService,
		errorHandler?: ErrorHandlingService
	): Promise<void> {
		this.cacheService = cacheService;
		this.errorHandler = errorHandler;
	}

	async updateConfig(newConfig: Partial<NLPAnalysisConfig>): Promise<void> {
		this.config = { ...this.config, ...newConfig };
		this.logger.lifecycle('configured', JSON.stringify(newConfig));
	}

	async analyzeText(text: string): Promise<NLPAnalysisResult> {
		const startTime = Date.now();
		const textHash = this.textProcessor.generateTextHash(text);
		const cacheKey = `nlp_analysis_${textHash}`;

		try {
			// Check cache if available
			if (this.cacheService?.isReady()) {
				const cached = await this.cacheService.get(cacheKey) as NLPAnalysisResult | null;
				if (cached) {
					return {
						...cached,
						metadata: {
							...cached.metadata,
							cacheHit: true,
							processingTime: Date.now() - startTime
						}
					};
				}
			}

			// Process text
			const processed = await this.textProcessor.processText(text);

			// Run analyses based on config
			const [themes, blockers, sentiment] = await Promise.all([
				this.extractProductivityThemes(text),
				this.detectProductivityBlockers(text),
				this.analyzeSentiment(text)
			]);

			const result: NLPAnalysisResult = {
				themes,
				blockers,
				sentiment,
				entities: this.config.enableEntityRecognition && processed.entities ? {
					people: processed.entities.people,
					places: processed.entities.places,
					organizations: processed.entities.organizations
				} : undefined,
				keywords: processed.keywords,
				metadata: {
					textLength: text.length,
					processingTime: Date.now() - startTime,
					cacheHit: false
				}
			};

			// Cache result if available
			if (this.cacheService?.isReady()) {
				await this.cacheService.set(cacheKey, result, { ttl: 3600000 }); // 1 hour
			}

			return result;

		} catch (error) {
			await this.logger.error(
				'NLP text analysis failed',
				error as Error,
				{ textLength: text.length, config: this.config }
			);
			throw error;
		}
	}

	async extractProductivityThemes(text: string): Promise<ProductivityTheme[]> {
		const textHash = this.textProcessor.generateTextHash(text);
		const cacheKey = `themes_${textHash}`;

		try {
			if (this.cacheService?.isReady()) {
				const cached = await this.cacheService.get(cacheKey) as ProductivityTheme[] | null;
				if (cached) return cached;
			}

			const themes = await this.themeExtractor.extractThemes(text);

			if (this.cacheService?.isReady()) {
				await this.cacheService.set(cacheKey, themes, { ttl: 1800000 }); // 30 min
			}

			return themes;

		} catch (error) {
			await this.errorHandler?.handleError(
				error as Error,
				{
					operation: "Theme extraction",
					component: "NLPAnalysisService",
					metadata: { textLength: text.length },
					timestamp: Date.now()
				}
			);
			return [];
		}
	}

	async detectProductivityBlockers(text: string): Promise<BlockerPattern[]> {
		const textHash = this.textProcessor.generateTextHash(text);
		const cacheKey = `blockers_${textHash}`;

		try {
			if (this.cacheService?.isReady()) {
				const cached = await this.cacheService.get(cacheKey) as BlockerPattern[] | null;
				if (cached) return cached;
			}

			const blockers = await this.blockerDetector.detectBlockers(text);

			if (this.cacheService?.isReady()) {
				await this.cacheService.set(cacheKey, blockers, { ttl: 1800000 }); // 30 min
			}

			return blockers;

		} catch (error) {
			await this.errorHandler?.handleError(
				error as Error,
				{
					operation: "Blocker detection",
					component: "NLPAnalysisService",
					metadata: { textLength: text.length },
					timestamp: Date.now()
				}
			);
			return [];
		}
	}

	async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
		const textHash = this.textProcessor.generateTextHash(text);
		const cacheKey = `sentiment_${textHash}`;

		try {
			if (this.cacheService?.isReady()) {
				const cached = await this.cacheService.get(cacheKey) as SentimentAnalysis | null;
				if (cached) return cached;
			}

			const sentiment = await this.sentimentAnalyzer.analyzeSentiment(text);

			if (this.cacheService?.isReady()) {
				await this.cacheService.set(cacheKey, sentiment, { ttl: 1800000 }); // 30 min
			}

			return sentiment;

		} catch (error) {
			await this.errorHandler?.handleError(
				error as Error,
				{
					operation: "Sentiment analysis",
					component: "NLPAnalysisService",
					metadata: { textLength: text.length },
					timestamp: Date.now()
				}
			);
			// Return a default neutral sentiment analysis
			return {
				overall: {
					polarity: 0,
					subjectivity: 0.5,
					label: 'neutral'
				},
				emotions: {
					joy: 0,
					anger: 0,
					fear: 0,
					sadness: 0,
					surprise: 0,
					trust: 0
				},
				arousal: 'moderate',
				productivity_sentiment: 'neutral',
				confidence_level: 0.5
			};
		}
	}

	async dispose(): Promise<void> {
		// Clean up resources if needed
		await super.dispose();
	}
}