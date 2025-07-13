// src/services/NLPAnalysisService.ts

import { App } from "obsidian";
import { BaseService } from "./BaseService";
import { CacheService } from "./CacheService";
import { ErrorHandlingService } from "./ErrorHandlingService";

// Type definitions for external NLP libraries
interface CompromiseDoc {
	sentences(): { out(format: string): string[] };
	people(): { out(format: string): string[] };
	places(): { out(format: string): string[] };
	organizations(): { out(format: string): string[] };
}

interface SentimentAnalyzer {
	analyze(text: string): { score: number };
}

interface NaturalModule {
	PorterStemmer: { stem(word: string): string };
	stopwords: string[];
	WordTokenizer: new () => { tokenize(text: string): string[] };
	TfIdf: new () => {
		addDocument(text: string): void;
		listTerms(docIndex: number): Array<{ term: string; tfidf: number }>;
	};
}

// External NLP libraries (using require with type assertions for compatibility)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nlp = require("compromise") as (text: string) => CompromiseDoc;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sentiment = require("sentiment") as new () => SentimentAnalyzer;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const natural = require("natural") as NaturalModule;

export interface ProductivityTheme {
	theme: string;
	confidence: number;
	keywords: string[];
	frequency: number;
	context: string[];
}

export interface BlockerPattern {
	type:
		| "procrastination"
		| "time_management"
		| "workflow_disruption"
		| "energy_motivation"
		| "external";
	severity: "low" | "medium" | "high";
	confidence: number;
	indicators: string[];
	context: string;
	suggestions?: string[];
}

export interface SentimentAnalysis {
	overall: {
		polarity: number; // -1 to 1
		subjectivity: number; // 0 to 1
		label: "positive" | "neutral" | "negative";
	};
	emotions: {
		joy: number;
		anger: number;
		fear: number;
		sadness: number;
		surprise: number;
		trust: number;
	};
	arousal: "calm" | "moderate" | "energetic";
	confidence_level: "uncertain" | "neutral" | "confident";
	productivity_sentiment:
		| "accomplished"
		| "frustrated"
		| "overwhelmed"
		| "motivated"
		| "neutral";
}

export interface TextPreprocessingResult {
	originalText: string;
	cleanedText: string;
	tokens: string[];
	sentences: string[];
	entities: Array<{ text: string; type: string; confidence: number }>;
	posTagged: Array<{ word: string; pos: string }>;
	keywords: string[];
}

export interface NLPAnalysisConfig {
	cacheService: CacheService;
	errorHandler: ErrorHandlingService;
	enableEntityRecognition: boolean;
	enableAdvancedSentiment: boolean;
	themeExtractionDepth: "basic" | "moderate" | "deep";
	blockerDetectionSensitivity: "low" | "medium" | "high";
}

/**
 * Advanced NLP service for sophisticated text analysis
 * Provides text preprocessing, theme extraction, blocker detection, and sentiment analysis
 */
export class NLPAnalysisService extends BaseService {
	private config: NLPAnalysisConfig;
	private sentimentAnalyzer: SentimentAnalyzer;
	private stemmer: { stem(word: string): string };
	private stopWords: Set<string>;

	constructor(app: App, config: NLPAnalysisConfig) {
		super(app);
		this.config = config;
		this.sentimentAnalyzer = new Sentiment();
		this.stemmer = natural.PorterStemmer;
		this.stopWords = new Set(natural.stopwords);

		// Add productivity-specific stop words
		const productivityStopWords = [
			"just",
			"really",
			"quite",
			"very",
			"pretty",
			"somewhat",
		];
		productivityStopWords.forEach((word) => this.stopWords.add(word));
	}

	protected async onInitialize(): Promise<void> {
		if (!this.config.cacheService || !this.config.errorHandler) {
			throw new Error(
				"NLPAnalysisService requires CacheService and ErrorHandlingService"
			);
		}

		// Initialize NLP models
		this.initializeProductivityBlockerPatterns();
		this.initializeThemeExtractionModels();

		console.log("NLP Analysis Service initialized");
	}

	protected async onDispose(): Promise<void> {
		// Clear any cached models or data
		console.log("NLP Analysis Service disposed");
	}

	/**
	 * Preprocess text for NLP analysis
	 */
	async preprocessText(text: string): Promise<TextPreprocessingResult> {
		this.ensureReady();

		const textHash = await this.generateTextHash(text);
		const cacheKey = `nlp_preprocess_${textHash}`;
		const cached =
			await this.config.cacheService.get<TextPreprocessingResult>(
				cacheKey
			);
		if (cached) return cached;

		try {
			const doc = nlp(text);

			// Clean and tokenize text
			const cleanedText = this.cleanText(text);
			const tokens = this.tokenizeText(cleanedText);
			const sentences = doc.sentences().out("array");

			// Extract entities if enabled
			let entities: Array<{
				text: string;
				type: string;
				confidence: number;
			}> = [];
			if (this.config.enableEntityRecognition) {
				entities = this.extractEntities(doc);
			}

			// POS tagging
			const posTagged = this.performPOSTagging(tokens);

			// Extract keywords using TF-IDF (create fresh instance for isolation)
			const keywords = this.extractKeywords(cleanedText);

			const result: TextPreprocessingResult = {
				originalText: text,
				cleanedText,
				tokens,
				sentences,
				entities,
				posTagged,
				keywords,
			};

			// Cache for 24 hours
			await this.config.cacheService.set(cacheKey, result, {
				ttl: 24 * 60 * 60 * 1000,
			});
			return result;
		} catch (error) {
			await this.config.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "preprocess_text",
					component: "NLPAnalysisService",
					timestamp: Date.now(),
				}
			);
			throw error;
		}
	}

	/**
	 * Extract productivity themes using advanced NLP techniques
	 */
	async extractProductivityThemes(
		text: string
	): Promise<ProductivityTheme[]> {
		this.ensureReady();

		const textHash = await this.generateTextHash(text);
		const cacheKey = `themes_${textHash}`;
		const cached = await this.config.cacheService.get<ProductivityTheme[]>(
			cacheKey
		);
		if (cached) return cached;

		try {
			const preprocessed = await this.preprocessText(text);
			const themes: ProductivityTheme[] = [];

			// Create isolated TF-IDF instance for this analysis
			const tfidf = new natural.TfIdf();
			tfidf.addDocument(preprocessed.cleanedText);

			// Define productivity theme categories
			const themeCategories = {
				project_management: [
					"project",
					"deadline",
					"milestone",
					"sprint",
					"planning",
					"roadmap",
				],
				time_management: [
					"schedule",
					"calendar",
					"time",
					"priority",
					"urgent",
					"deadline",
				],
				collaboration: [
					"meeting",
					"team",
					"discussion",
					"feedback",
					"collaboration",
					"communication",
				],
				learning: [
					"learn",
					"study",
					"research",
					"course",
					"skill",
					"knowledge",
				],
				problem_solving: [
					"problem",
					"solution",
					"debug",
					"fix",
					"troubleshoot",
					"resolve",
				],
				creative_work: [
					"design",
					"create",
					"brainstorm",
					"ideate",
					"innovate",
					"creative",
				],
				focus_flow: [
					"focus",
					"flow",
					"concentration",
					"deep work",
					"distraction",
					"interruption",
				],
			};

			// Calculate theme relevance using keyword matching and TF-IDF
			for (const [themeKey, keywords] of Object.entries(
				themeCategories
			)) {
				const matches = this.calculateThemeRelevance(
					preprocessed,
					keywords,
					tfidf
				);

				if (matches.confidence > 0.1) {
					themes.push({
						theme: themeKey.replace("_", " "),
						confidence: matches.confidence,
						keywords: matches.foundKeywords,
						frequency: matches.frequency,
						context: matches.context,
					});
				}
			}

			// Sort by confidence
			themes.sort((a, b) => b.confidence - a.confidence);

			// Cache for 12 hours
			await this.config.cacheService.set(cacheKey, themes, {
				ttl: 12 * 60 * 60 * 1000,
			});
			return themes;
		} catch (error) {
			await this.config.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "extract_productivity_themes",
					component: "NLPAnalysisService",
					timestamp: Date.now(),
				}
			);
			return [];
		}
	}

	/**
	 * Detect productivity blockers using advanced pattern matching
	 */
	async detectProductivityBlockers(text: string): Promise<BlockerPattern[]> {
		this.ensureReady();

		const textHash = await this.generateTextHash(text);
		const cacheKey = `blockers_${textHash}`;
		const cached = await this.config.cacheService.get<BlockerPattern[]>(
			cacheKey
		);
		if (cached) return cached;

		try {
			const preprocessed = await this.preprocessText(text);
			const blockers: BlockerPattern[] = [];

			// Define blocker patterns with different sensitivity levels
			const blockerPatterns = this.getBlockerPatterns();

			for (const pattern of blockerPatterns) {
				const matches = this.detectPatternInText(preprocessed, pattern);

				if (matches.length > 0) {
					const severity = this.calculateBlockerSeverity(
						matches,
						pattern
					);
					const confidence = this.calculatePatternConfidence(
						matches,
						preprocessed.tokens.length
					);

					// Apply sensitivity threshold
					const threshold = this.getSensitivityThreshold();
					if (confidence >= threshold) {
						blockers.push({
							type: pattern.type,
							severity,
							confidence,
							indicators: matches,
							context: this.extractBlockerContext(
								preprocessed,
								matches
							),
							suggestions: this.generateBlockerSuggestions(
								pattern.type,
								severity
							),
						});
					}
				}
			}

			// Cache for 6 hours
			await this.config.cacheService.set(cacheKey, blockers, {
				ttl: 6 * 60 * 60 * 1000,
			});
			return blockers;
		} catch (error) {
			await this.config.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "detect_productivity_blockers",
					component: "NLPAnalysisService",
					timestamp: Date.now(),
				}
			);
			return [];
		}
	}

	/**
	 * Perform multi-dimensional sentiment analysis
	 */
	async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
		this.ensureReady();

		const textHash = await this.generateTextHash(text);
		const cacheKey = `sentiment_${textHash}`;
		const cached = await this.config.cacheService.get<SentimentAnalysis>(
			cacheKey
		);
		if (cached) return cached;

		try {
			const preprocessed = await this.preprocessText(text);

			// Basic sentiment analysis
			const basicSentiment = this.sentimentAnalyzer.analyze(
				preprocessed.cleanedText
			);

			// Advanced sentiment features
			const emotions = this.analyzeEmotions(preprocessed);
			const arousal = this.detectArousalLevel(preprocessed);
			const confidence = this.detectConfidenceLevel(preprocessed);
			const productivitySentiment =
				this.analyzeProductivitySentiment(preprocessed);

			const result: SentimentAnalysis = {
				overall: {
					polarity: this.normalizePolarity(basicSentiment.score),
					subjectivity: this.calculateSubjectivity(preprocessed),
					label: this.classifySentiment(basicSentiment.score),
				},
				emotions,
				arousal,
				confidence_level: confidence,
				productivity_sentiment: productivitySentiment,
			};

			// Cache for 6 hours
			await this.config.cacheService.set(cacheKey, result, {
				ttl: 6 * 60 * 60 * 1000,
			});
			return result;
		} catch (error) {
			await this.config.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "analyze_sentiment",
					component: "NLPAnalysisService",
					timestamp: Date.now(),
				}
			);

			// Return neutral sentiment on error
			return this.getNeutralSentiment();
		}
	}

	// Private helper methods

	private cleanText(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, " ") // Remove punctuation
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim();
	}

	private tokenizeText(text: string): string[] {
		const tokenizer = new natural.WordTokenizer();
		return tokenizer
			.tokenize(text)
			.filter(
				(token: string) =>
					token.length > 2 && !this.stopWords.has(token)
			)
			.map((token: string) => this.stemmer.stem(token));
	}

	private extractEntities(
		doc: CompromiseDoc
	): Array<{ text: string; type: string; confidence: number }> {
		const entities: Array<{
			text: string;
			type: string;
			confidence: number;
		}> = [];

		// Extract people, places, organizations
		const people = doc.people().out("array");
		const places = doc.places().out("array");
		const organizations = doc.organizations().out("array");

		people.forEach((person: string) =>
			entities.push({ text: person, type: "person", confidence: 0.8 })
		);
		places.forEach((place: string) =>
			entities.push({ text: place, type: "place", confidence: 0.8 })
		);
		organizations.forEach((org: string) =>
			entities.push({ text: org, type: "organization", confidence: 0.8 })
		);

		return entities;
	}

	private performPOSTagging(
		tokens: string[]
	): Array<{ word: string; pos: string }> {
		// Simplified POS tagging - in a real implementation, you'd use a more sophisticated tagger
		return tokens.map((token: string) => ({
			word: token,
			pos: this.guessPartOfSpeech(token),
		}));
	}

	private guessPartOfSpeech(word: string): string {
		// Very basic POS guessing - replace with proper tagger in production
		if (word.endsWith("ing")) return "VBG";
		if (word.endsWith("ed")) return "VBD";
		if (word.endsWith("ly")) return "RB";
		return "NN"; // Default to noun
	}

	private extractKeywords(text: string): string[] {
		// Create isolated TF-IDF instance for keyword extraction
		const tfidf = new natural.TfIdf();
		tfidf.addDocument(text);

		const keywords: string[] = [];
		tfidf
			.listTerms(0)
			.slice(0, 20)
			.forEach((item: { term: string; tfidf: number }) => {
				keywords.push(item.term);
			});

		return keywords;
	}

	private calculateThemeRelevance(
		preprocessed: TextPreprocessingResult,
		keywords: string[],
		tfidf?: InstanceType<NaturalModule["TfIdf"]>
	) {
		const foundKeywords: string[] = [];
		let totalMatches = 0;
		const context: string[] = [];

		for (const keyword of keywords) {
			if (preprocessed.cleanedText.includes(keyword)) {
				foundKeywords.push(keyword);
				totalMatches++;

				// Extract context sentences
				preprocessed.sentences.forEach((sentence) => {
					if (sentence.toLowerCase().includes(keyword)) {
						context.push(sentence);
					}
				});
			}
		}

		const frequency = totalMatches / preprocessed.tokens.length;
		const confidence = Math.min(frequency * 10, 1.0);

		return {
			confidence,
			foundKeywords,
			frequency,
			context: context.slice(0, 3),
		};
	}

	private initializeProductivityBlockerPatterns(): void {
		// Initialize patterns in memory for quick access
	}

	private initializeThemeExtractionModels(): void {
		// Initialize any pre-trained models or pattern libraries
	}

	private getBlockerPatterns() {
		return [
			{
				type: "procrastination" as const,
				patterns: [
					"putting off",
					"avoiding",
					"procrastinating",
					"delaying",
					"postponing",
				],
			},
			{
				type: "time_management" as const,
				patterns: [
					"ran out of time",
					"deadline pressure",
					"time crunch",
					"behind schedule",
				],
			},
			{
				type: "workflow_disruption" as const,
				patterns: [
					"interrupted",
					"distracted",
					"context switching",
					"multitasking",
				],
			},
			{
				type: "energy_motivation" as const,
				patterns: [
					"no energy",
					"burned out",
					"unmotivated",
					"exhausted",
					"overwhelmed",
				],
			},
			{
				type: "external" as const,
				patterns: [
					"blocked by",
					"waiting for",
					"depends on",
					"external dependency",
				],
			},
		];
	}

	private detectPatternInText(
		preprocessed: TextPreprocessingResult,
		pattern: { type: BlockerPattern['type']; patterns: string[] }
	): string[] {
		const matches: string[] = [];

		for (const patternText of pattern.patterns) {
			if (preprocessed.cleanedText.includes(patternText)) {
				matches.push(patternText);
			}
		}

		return matches;
	}

	private calculateBlockerSeverity(
		matches: string[],
		pattern: { type: BlockerPattern['type']; patterns: string[] }
	): "low" | "medium" | "high" {
		if (matches.length >= 3) return "high";
		if (matches.length >= 2) return "medium";
		return "low";
	}

	private calculatePatternConfidence(
		matches: string[],
		totalTokens: number
	): number {
		return matches.length / totalTokens;
	}

	private getSensitivityThreshold(): number {
		switch (this.config.blockerDetectionSensitivity) {
			case "low":
				return 0.1;
			case "medium":
				return 0.05;
			case "high":
				return 0.02;
			default:
				return 0.05;
		}
	}

	private extractBlockerContext(
		preprocessed: TextPreprocessingResult,
		matches: string[]
	): string {
		// Find sentences containing blocker indicators
		const contextSentences = preprocessed.sentences.filter((sentence) =>
			matches.some((match) => sentence.toLowerCase().includes(match))
		);

		return contextSentences.slice(0, 2).join(" ");
	}

	private generateBlockerSuggestions(
		type: BlockerPattern["type"],
		severity: BlockerPattern["severity"]
	): string[] {
		const suggestions: Record<string, string[]> = {
			procrastination: [
				"Break task into smaller chunks",
				"Use time-boxing technique",
				"Identify root cause of avoidance",
			],
			time_management: [
				"Review and adjust schedules",
				"Use time-blocking",
				"Prioritize tasks using Eisenhower matrix",
			],
			workflow_disruption: [
				"Implement focus blocks",
				"Turn off notifications",
				"Communicate boundaries to team",
			],
			energy_motivation: [
				"Take regular breaks",
				"Review workload balance",
				"Consider energy management strategies",
			],
			external: [
				"Follow up on dependencies",
				"Create contingency plans",
				"Escalate blocked items",
			],
		};

		return suggestions[type] || ["Consider reviewing current approach"];
	}

	private analyzeEmotions(preprocessed: TextPreprocessingResult) {
		// Simplified emotion detection using keyword matching
		const emotionKeywords = {
			joy: ["happy", "excited", "accomplished", "satisfied", "proud"],
			anger: ["frustrated", "angry", "annoyed", "irritated"],
			fear: ["worried", "anxious", "concerned", "nervous"],
			sadness: ["sad", "disappointed", "discouraged", "down"],
			surprise: ["surprised", "unexpected", "amazed"],
			trust: ["confident", "sure", "certain", "trust"],
		};

		const emotions: Record<string, number> = {};

		for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
			const matches = keywords.filter((keyword) =>
				preprocessed.cleanedText.includes(keyword)
			).length;
			emotions[emotion] = Math.min(matches / 10, 1.0);
		}

		return emotions as SentimentAnalysis["emotions"];
	}

	private detectArousalLevel(
		preprocessed: TextPreprocessingResult
	): "calm" | "moderate" | "energetic" {
		const energeticWords = [
			"excited",
			"energetic",
			"pumped",
			"motivated",
			"driven",
		];
		const calmWords = ["calm", "peaceful", "relaxed", "steady", "balanced"];

		const energeticScore = energeticWords.filter((word) =>
			preprocessed.cleanedText.includes(word)
		).length;

		const calmScore = calmWords.filter((word) =>
			preprocessed.cleanedText.includes(word)
		).length;

		if (energeticScore > calmScore * 2) return "energetic";
		if (calmScore > energeticScore * 2) return "calm";
		return "moderate";
	}

	private detectConfidenceLevel(
		preprocessed: TextPreprocessingResult
	): "uncertain" | "neutral" | "confident" {
		const confidentWords = [
			"confident",
			"sure",
			"certain",
			"definitely",
			"absolutely",
		];
		const uncertainWords = [
			"uncertain",
			"maybe",
			"perhaps",
			"might",
			"possibly",
		];

		const confidentScore = confidentWords.filter((word) =>
			preprocessed.cleanedText.includes(word)
		).length;

		const uncertainScore = uncertainWords.filter((word) =>
			preprocessed.cleanedText.includes(word)
		).length;

		if (confidentScore > uncertainScore) return "confident";
		if (uncertainScore > confidentScore) return "uncertain";
		return "neutral";
	}

	private analyzeProductivitySentiment(
		preprocessed: TextPreprocessingResult
	): "accomplished" | "frustrated" | "overwhelmed" | "motivated" | "neutral" {
		const sentimentKeywords = {
			accomplished: [
				"accomplished",
				"completed",
				"finished",
				"achieved",
				"done",
			],
			frustrated: [
				"frustrated",
				"stuck",
				"blocked",
				"difficult",
				"struggling",
			],
			overwhelmed: [
				"overwhelmed",
				"too much",
				"stressed",
				"pressure",
				"swamped",
			],
			motivated: [
				"motivated",
				"ready",
				"excited",
				"determined",
				"focused",
			],
		};

		let maxScore = 0;
		let dominant = "neutral" as const;

		for (const [sentiment, keywords] of Object.entries(sentimentKeywords)) {
			const score = keywords.filter((keyword) =>
				preprocessed.cleanedText.includes(keyword)
			).length;

			if (score > maxScore) {
				maxScore = score;
				dominant = sentiment as typeof dominant;
			}
		}

		return maxScore > 0 ? dominant : "neutral";
	}

	private normalizePolarity(score: number): number {
		// Normalize sentiment score to -1 to 1 range
		return Math.max(-1, Math.min(1, score / 10));
	}

	private calculateSubjectivity(
		preprocessed: TextPreprocessingResult
	): number {
		// Simplified subjectivity calculation
		const subjectiveWords = [
			"think",
			"feel",
			"believe",
			"seem",
			"appear",
			"probably",
		];
		const matches = subjectiveWords.filter((word) =>
			preprocessed.cleanedText.includes(word)
		).length;

		return Math.min(matches / 10, 1.0);
	}

	private classifySentiment(
		score: number
	): "positive" | "neutral" | "negative" {
		if (score > 2) return "positive";
		if (score < -2) return "negative";
		return "neutral";
	}

	private getNeutralSentiment(): SentimentAnalysis {
		return {
			overall: {
				polarity: 0,
				subjectivity: 0.5,
				label: "neutral",
			},
			emotions: {
				joy: 0,
				anger: 0,
				fear: 0,
				sadness: 0,
				surprise: 0,
				trust: 0,
			},
			arousal: "moderate",
			confidence_level: "neutral",
			productivity_sentiment: "neutral",
		};
	}

	private async generateTextHash(text: string): Promise<string> {
		// Use Web Crypto API for stronger hash function
		const encoder = new TextEncoder();
		const data = encoder.encode(text);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.substring(0, 16);
	}
}
