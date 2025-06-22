// src/summary-note-creator.ts

import { App, TFile } from "obsidian";
import { Logger } from "./logger";
import { ProcessingResult } from "./markdown-processing-service";
import { AIService } from "./ai-service";
import { NaturalLanguageGenerator, NLGFactory } from "./natural-language-generator";
import { PrivacyFilter } from "./privacy-filter";
import { PatternDetectionEngine } from "./pattern-detection-engine";
import { 
	PatternDefinition, 
	VaultPatternResult, 
	NoteAnalysisRecord, 
	PatternDetectionOptions,
	AnalysisScope,
	PatternType,
	PatternCorrelation 
} from "./pattern-detection-interfaces";

export interface SummaryNoteOptions {
	folderPath: string;
	filenameTemplate: string;
	createBacklinks: boolean;
	overwriteExisting: boolean;
	// Enhanced options for AI-powered insights
	enableAIInsights: boolean;
	writingStyle: 'business' | 'personal' | 'academic';
	includeRecommendations: boolean;
	includePatternAnalysis: boolean;
	includeTrendAnalysis: boolean;
	// Privacy options
	respectPrivacySettings: boolean;
	// NEW: Pattern Detection options
	enablePatternDetection: boolean;
	patternDetectionScope: AnalysisScope;
	includeVaultPatterns: boolean;
	includePatternCorrelations: boolean;
	includeTemporalAnalysis: boolean;
	patternConfidenceThreshold: number;
	// NEW: Performance optimization options
	enablePerformanceOptimization: boolean;
	maxProcessingTime: number;
	enableParallelProcessing: boolean;
	enableCaching: boolean;
	cacheTTL: number;
	sizeBasedOptimization: boolean;
	maxDocumentSize: number;
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryNoteOptions = {
	folderPath: "Summaries",
	filenameTemplate: "Summary - {{date}} - {{originalName}}",
	createBacklinks: true,
	overwriteExisting: false,
	enableAIInsights: true,
	writingStyle: 'personal',
	includeRecommendations: true,
	includePatternAnalysis: true,
	includeTrendAnalysis: true,
	respectPrivacySettings: true,
	// NEW: Pattern Detection defaults
	enablePatternDetection: true,
	patternDetectionScope: 'whole-life',
	includeVaultPatterns: false,
	includePatternCorrelations: false,
	includeTemporalAnalysis: true,
	patternConfidenceThreshold: 0.6,
	// NEW: Performance optimization defaults
	enablePerformanceOptimization: true,
	maxProcessingTime: 60000, // 60 seconds
	enableParallelProcessing: true,
	enableCaching: true,
	cacheTTL: 3600000, // 1 hour
	sizeBasedOptimization: true,
	maxDocumentSize: 50000, // 50KB
};

// Performance optimization interfaces
interface CachedResult {
	data: unknown;
	timestamp: number;
	ttl: number;
}

interface PerformanceMetrics {
	startTime: number;
	aiCallsCount: number;
	patternAnalysisTime: number;
	totalProcessingTime: number;
	cacheHits: number;
	cacheMisses: number;
}

/**
 * Creates a summary note for a given file.
 * 
 * @param app - The Obsidian app instance.
 * @param logger - The logger instance.
 * @param aiService - The AI service for generating insights.
 * @param privacyFilter - The privacy filter for respecting privacy settings.
 * @param patternDetectionEngine - The pattern detection engine for advanced pattern analysis.
 * @param options - The options for the summary note.
 * @returns The path to the created summary note.
 */
export class SummaryNoteCreator {
	private nlgGenerator: NaturalLanguageGenerator;
	private cache: Map<string, CachedResult> = new Map();
	private performanceMetrics: PerformanceMetrics = {
		startTime: 0,
		aiCallsCount: 0,
		patternAnalysisTime: 0,
		totalProcessingTime: 0,
		cacheHits: 0,
		cacheMisses: 0
	};

	constructor(
		private app: App, 
		private logger: Logger,
		private aiService?: AIService,
		private privacyFilter?: PrivacyFilter,
		private patternDetectionEngine?: PatternDetectionEngine
	) {
		// Initialize with personal style by default - can be changed per summary
		this.nlgGenerator = NLGFactory.createForPersonal();
	}

	async createSummaryNote(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: Partial<SummaryNoteOptions> = {}
	): Promise<string> {
		const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
		this.resetPerformanceMetrics();

		try {
			// Privacy check: Determine if AI insights should be disabled for this file
			const shouldUseAI = await this.shouldEnableAIForFile(originalFile, opts);
			
			if (opts.enableAIInsights && !shouldUseAI) {
				this.logger.info(`Privacy protection: Disabling AI insights for file: ${originalFile.path}`);
				opts.enableAIInsights = false;
			}

			// Performance optimization: Check document size
			if (opts.sizeBasedOptimization && opts.enableAIInsights) {
				const fileSize = await this.getFileSize(originalFile);
				if (fileSize > opts.maxDocumentSize) {
					this.logger.info(`Large document detected (${fileSize} bytes), applying size-based optimizations`);
					opts.enableAIInsights = this.shouldReduceAIProcessing(fileSize, opts.maxDocumentSize);
					opts.includeVaultPatterns = false; // Disable expensive vault-wide analysis
					opts.includePatternCorrelations = false;
				}
			}

			// Generate filename
			const filename = this.generateFilename(originalFile, opts.filenameTemplate);
			const fullPath = `${opts.folderPath}/${filename}.md`;

			this.logger.info(`Generated filename: ${filename}`);
			this.logger.info(`Full path will be: ${fullPath}`);
			this.logger.info(`Folder path: ${opts.folderPath}`);
			this.logger.info(`AI insights enabled: ${opts.enableAIInsights}`);

			// Ensure folder exists first
			await this.ensureFolderExists(opts.folderPath);

			// Check if file exists
			const exists = await this.fileExists(fullPath);
			this.logger.info(`File exists check: ${exists} for path: ${fullPath}`);
			if (exists && !opts.overwriteExisting) {
				throw new Error(`Summary note already exists: ${fullPath}`);
			}

			// Generate enhanced content with performance optimizations
			const content = await this.generateEnhancedSummaryContentOptimized(originalFile, analysisResult, opts);

			// Create or update file using the vault API consistently
			if (exists) {
				// File exists, modify it
				const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
				if (existingFile instanceof TFile) {
					await this.app.vault.modify(existingFile, content);
					this.logger.info(`Updated existing summary note: ${fullPath}`);
				} else {
					// Fallback to adapter write
					await this.app.vault.adapter.write(fullPath, content);
					this.logger.info(`Updated existing summary note via adapter: ${fullPath}`);
				}
			} else {
				// File doesn't exist, create it
				this.logger.info(`Creating new file: ${fullPath}`);
				try {
					await this.app.vault.create(fullPath, content);
					this.logger.info(`Successfully created new summary note: ${fullPath}`);
				} catch (createError) {
					// If vault.create fails, ensure folder exists at filesystem level and try adapter
					this.logger.warn(`vault.create failed, ensuring folder exists at filesystem level: ${createError}`);
					
					try {
						// Make sure folder exists at filesystem level
						await this.app.vault.adapter.mkdir(opts.folderPath);
						this.logger.info(`Created folder at filesystem level: ${opts.folderPath}`);
					} catch (mkdirError) {
						// Folder might already exist, that's ok
						this.logger.info(`Folder creation skipped (might already exist): ${mkdirError.message}`);
					}
					
					// Now try to write the file
					await this.app.vault.adapter.write(fullPath, content);
					this.logger.info(`Successfully created new summary note via adapter: ${fullPath}`);
				}
			}

			// Log performance metrics
			this.logPerformanceMetrics(opts);

			return fullPath;
		} catch (error) {
			this.logger.error("Failed to create summary note:", error);
			throw error;
		}
	}

	/**
	 * Performance-optimized content generation with parallel processing and caching
	 */
	private async generateEnhancedSummaryContentOptimized(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: SummaryNoteOptions
	): Promise<string> {
		const now = new Date();
		const originalLink = options.createBacklinks
			? `[[${originalFile.path}]]`
			: originalFile.path;

		// Set up NLG generator based on writing style preference
		this.setupNLGGenerator(options.writingStyle);

		// Generate frontmatter
		const frontmatter = [
			"---",
			`title: "Summary of ${originalFile.basename}"`,
			`original_file: "${originalFile.path}"`,
			`created: ${now.toISOString()}`,
			`type: "summary"`,
			`writing_style: "${options.writingStyle}"`,
			`ai_enhanced: ${options.enableAIInsights}`,
			`performance_optimized: ${options.enablePerformanceOptimization}`,
			`tags: ["summary", "analysis", "retrospect-ai"]`,
			"---",
			"",
		].join("\n");

		// Generate main content sections
		const contentSections: string[] = [];

		// Header
		contentSections.push(`# Summary of ${originalFile.basename}`);
		contentSections.push("");
		contentSections.push(`**Original Note:** ${originalLink}`);
		contentSections.push(`**Generated:** ${now.toLocaleString()}`);
		contentSections.push("");

		// Performance optimization: Parallel processing of AI-intensive operations
		if (options.enableAIInsights && options.enableParallelProcessing && this.aiService) {
			const parallelResults = await this.generateContentSectionsInParallel(originalFile, analysisResult, options);
			
			// Add Executive Summary
			if (parallelResults.executiveSummary) {
				contentSections.push("## 🎯 Executive Summary");
				contentSections.push("");
				contentSections.push(parallelResults.executiveSummary);
				contentSections.push("");
			}

			// Add Key Insights
			if (parallelResults.insights && parallelResults.insights.length > 0) {
				contentSections.push("## 💡 Key Insights");
				contentSections.push("");
				parallelResults.insights.forEach((insight, index) => {
					contentSections.push(`### ${index + 1}. ${insight.title}`);
					contentSections.push(insight.description);
					if (insight.evidence && insight.evidence.length > 0) {
						contentSections.push("**Evidence:**");
						insight.evidence.forEach(evidence => {
							contentSections.push(`- ${evidence}`);
						});
					}
					contentSections.push("");
				});
			}

			// Add Pattern Analysis
			if (parallelResults.patternAnalysis && options.includePatternAnalysis) {
				contentSections.push("## 🔍 Pattern Analysis");
				contentSections.push("");
				contentSections.push(parallelResults.patternAnalysis.summary);
				contentSections.push("");
				
				parallelResults.patternAnalysis.patterns.forEach(pattern => {
					contentSections.push(`### ${pattern.name} (${pattern.type})`);
					contentSections.push(pattern.description);
					contentSections.push(`**Confidence:** ${Math.round(pattern.confidence * 100)}%`);
					contentSections.push("");
				});
			}

			// Add Recommendations
			if (parallelResults.recommendations && parallelResults.recommendations.length > 0 && options.includeRecommendations) {
				contentSections.push("## 🚀 Recommendations");
				contentSections.push("");
				parallelResults.recommendations.forEach((rec, index) => {
					contentSections.push(`### ${index + 1}. ${rec.title || 'Recommendation'}`);
					contentSections.push(rec.description);
					if (rec.actionSteps && rec.actionSteps.length > 0) {
						contentSections.push("**Action Steps:**");
						rec.actionSteps.forEach((step, stepIndex) => {
							contentSections.push(`${stepIndex + 1}. ${step.description}`);
						});
					}
					contentSections.push("");
				});
			}
		} else {
			// Fallback to sequential processing
			await this.generateContentSectionsSequentially(originalFile, analysisResult, options, contentSections);
		}

		// Content Analysis (always included, not AI-dependent)
		contentSections.push("## 📊 Content Analysis");
		contentSections.push("");
		contentSections.push(this.formatAnalysisResults(analysisResult));
		contentSections.push("");

		// Connection Opportunities
		const connections = this.generateConnectionOpportunities(analysisResult);
		if (connections.length > 0) {
			contentSections.push("## 🔗 Connection Opportunities");
			contentSections.push("");
			connections.forEach(connection => {
				contentSections.push(`- **${connection.type}**: ${connection.description}`);
			});
			contentSections.push("");
		}

		// Performance metrics (if enabled)
		if (options.enablePerformanceOptimization) {
			const metrics = this.getPerformanceMetrics();
			contentSections.push("---");
			contentSections.push("");
			contentSections.push(`*Generated in ${metrics.totalProcessingTime}ms with ${metrics.aiCallsCount} AI calls (${metrics.cacheHits} cache hits)*`);
		}

		return frontmatter + contentSections.join("\n");
	}

	/**
	 * Generate content sections in parallel for better performance
	 */
	private async generateContentSectionsInParallel(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: SummaryNoteOptions
	): Promise<{
		executiveSummary?: string;
		insights?: Array<{ title: string; description: string; evidence?: string[] }>;
		patternAnalysis?: { patterns: PatternDefinition[]; summary: string };
		recommendations?: Array<{ title?: string; description: string; actionSteps?: Array<{ description: string }> }>;
	}> {
		const promises: Promise<any>[] = [];
		const results: any = {};

		// Create timeout wrapper for AI operations
		const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
			return Promise.race([
				promise,
				new Promise<T>((_, reject) => 
					setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
				)
			]);
		};

		// Executive Summary
		if (this.aiService) {
			promises.push(
				withTimeout(this.generateExecutiveSummaryOptimized(originalFile, analysisResult), options.maxProcessingTime / 4)
					.then(result => { results.executiveSummary = result; })
					.catch(error => { 
						this.logger.warn("Executive summary generation failed:", error);
						results.executiveSummary = null;
					})
			);
		}

		// Key Insights
		if (this.aiService) {
			promises.push(
				withTimeout(this.generateKeyInsightsOptimized(originalFile, analysisResult), options.maxProcessingTime / 4)
					.then(result => { results.insights = result; })
					.catch(error => { 
						this.logger.warn("Key insights generation failed:", error);
						results.insights = [];
					})
			);
		}

		// Pattern Analysis
		if (options.includePatternAnalysis && this.patternDetectionEngine) {
			promises.push(
				withTimeout(this.generateAdvancedPatternAnalysisOptimized(originalFile, options), options.maxProcessingTime / 2)
					.then(result => { results.patternAnalysis = result; })
					.catch(error => { 
						this.logger.warn("Pattern analysis generation failed:", error);
						results.patternAnalysis = null;
					})
			);
		}

		// Recommendations
		if (options.includeRecommendations && this.aiService) {
			promises.push(
				withTimeout(this.generateRecommendationsOptimized(originalFile, analysisResult), options.maxProcessingTime / 4)
					.then(result => { results.recommendations = result; })
					.catch(error => { 
						this.logger.warn("Recommendations generation failed:", error);
						results.recommendations = [];
					})
			);
		}

		// Wait for all operations to complete
		await Promise.allSettled(promises);

		return results;
	}

	/**
	 * Optimized executive summary generation with caching
	 */
	private async generateExecutiveSummaryOptimized(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<string | null> {
		const lastModified = analysisResult.metadata?.lastModified || Date.now();
		const cacheKey = `exec_summary_${originalFile.path}_${lastModified}`;
		
		// Check cache first
		const cached = this.getCachedResult(cacheKey);
		if (cached) {
			this.performanceMetrics.cacheHits++;
			return cached as string;
		}

		this.performanceMetrics.cacheMisses++;
		this.performanceMetrics.aiCallsCount++;

		try {
			const result = await this.generateExecutiveSummary(originalFile, analysisResult);
			this.setCachedResult(cacheKey, result, DEFAULT_SUMMARY_OPTIONS.cacheTTL);
			return result;
		} catch (error) {
			this.logger.error("Failed to generate executive summary:", error);
			return null;
		}
	}

	/**
	 * Optimized key insights generation with caching
	 */
	private async generateKeyInsightsOptimized(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title: string; description: string; evidence?: string[] }>> {
		const lastModified = analysisResult.metadata?.lastModified || Date.now();
		const cacheKey = `key_insights_${originalFile.path}_${lastModified}`;
		
		// Check cache first
		const cached = this.getCachedResult(cacheKey);
		if (cached) {
			this.performanceMetrics.cacheHits++;
			return cached as Array<{ title: string; description: string; evidence?: string[] }>;
		}

		this.performanceMetrics.cacheMisses++;
		this.performanceMetrics.aiCallsCount++;

		try {
			const result = await this.generateKeyInsights(originalFile, analysisResult);
			this.setCachedResult(cacheKey, result, DEFAULT_SUMMARY_OPTIONS.cacheTTL);
			return result;
		} catch (error) {
			this.logger.error("Failed to generate key insights:", error);
			return [];
		}
	}

	/**
	 * Optimized pattern analysis with performance monitoring
	 */
	private async generateAdvancedPatternAnalysisOptimized(
		originalFile: TFile,
		options: SummaryNoteOptions
	): Promise<{ patterns: PatternDefinition[]; summary: string }> {
		const startTime = Date.now();
		const cacheKey = `pattern_analysis_${originalFile.path}_${options.patternConfidenceThreshold}`;
		
		// Check cache first
		const cached = this.getCachedResult(cacheKey);
		if (cached) {
			this.performanceMetrics.cacheHits++;
			return cached as { patterns: PatternDefinition[]; summary: string };
		}

		this.performanceMetrics.cacheMisses++;

		try {
			const result = await this.generateAdvancedPatternAnalysis(originalFile, options);
			const processingTime = Date.now() - startTime;
			this.performanceMetrics.patternAnalysisTime += processingTime;
			
			const simplified = {
				patterns: result.patterns,
				summary: result.summary
			};
			
			this.setCachedResult(cacheKey, simplified, DEFAULT_SUMMARY_OPTIONS.cacheTTL);
			return simplified;
		} catch (error) {
			this.logger.error("Failed to generate pattern analysis:", error);
			return { patterns: [], summary: "" };
		}
	}

	/**
	 * Optimized recommendations generation with caching
	 */
	private async generateRecommendationsOptimized(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title?: string; description: string; actionSteps?: Array<{ description: string }> }>> {
		const lastModified = analysisResult.metadata?.lastModified || Date.now();
		const cacheKey = `recommendations_${originalFile.path}_${lastModified}`;
		
		// Check cache first
		const cached = this.getCachedResult(cacheKey);
		if (cached) {
			this.performanceMetrics.cacheHits++;
			return cached as Array<{ title?: string; description: string; actionSteps?: Array<{ description: string }> }>;
		}

		this.performanceMetrics.cacheMisses++;
		this.performanceMetrics.aiCallsCount++;

		try {
			const result = await this.generateRecommendations(originalFile, analysisResult);
			this.setCachedResult(cacheKey, result, DEFAULT_SUMMARY_OPTIONS.cacheTTL);
			return result;
		} catch (error) {
			this.logger.error("Failed to generate recommendations:", error);
			return [];
		}
	}

	/**
	 * Fallback sequential content generation
	 */
	private async generateContentSectionsSequentially(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: SummaryNoteOptions,
		contentSections: string[]
	): Promise<void> {
		// Executive Summary (AI-powered if available)
		if (options.enableAIInsights && this.aiService) {
			const executiveSummary = await this.generateExecutiveSummaryOptimized(originalFile, analysisResult);
			if (executiveSummary) {
				contentSections.push("## 🎯 Executive Summary");
				contentSections.push("");
				contentSections.push(executiveSummary);
				contentSections.push("");
			}
		}

		// Key Insights (AI-powered)
		if (options.enableAIInsights && this.aiService) {
			const insights = await this.generateKeyInsightsOptimized(originalFile, analysisResult);
			if (insights.length > 0) {
				contentSections.push("## 💡 Key Insights");
				contentSections.push("");
				insights.forEach((insight, index) => {
					contentSections.push(`### ${index + 1}. ${insight.title}`);
					contentSections.push(insight.description);
					if (insight.evidence && insight.evidence.length > 0) {
						contentSections.push("**Evidence:**");
						insight.evidence.forEach(evidence => {
							contentSections.push(`- ${evidence}`);
						});
					}
					contentSections.push("");
				});
			}
		}

		// Pattern Analysis
		if (options.includePatternAnalysis && this.patternDetectionEngine) {
			const patternAnalysis = await this.generateAdvancedPatternAnalysisOptimized(originalFile, options);
			if (patternAnalysis.patterns.length > 0) {
				contentSections.push("## 🔍 Pattern Analysis");
				contentSections.push("");
				contentSections.push(patternAnalysis.summary);
				contentSections.push("");
				
				patternAnalysis.patterns.forEach(pattern => {
					contentSections.push(`### ${pattern.name} (${pattern.type})`);
					contentSections.push(pattern.description);
					contentSections.push(`**Confidence:** ${Math.round(pattern.confidence * 100)}%`);
					contentSections.push("");
				});
			}
		}

		// Recommendations
		if (options.includeRecommendations && this.aiService) {
			const recommendations = await this.generateRecommendationsOptimized(originalFile, analysisResult);
			if (recommendations.length > 0) {
				contentSections.push("## 🚀 Recommendations");
				contentSections.push("");
				recommendations.forEach((rec, index) => {
					contentSections.push(`### ${index + 1}. ${rec.title || 'Recommendation'}`);
					contentSections.push(rec.description);
					if (rec.actionSteps && rec.actionSteps.length > 0) {
						contentSections.push("**Action Steps:**");
						rec.actionSteps.forEach((step, stepIndex) => {
							contentSections.push(`${stepIndex + 1}. ${step.description}`);
						});
					}
					contentSections.push("");
				});
			}
		}
	}

	/**
	 * Caching utilities
	 */
	private getCachedResult(key: string): unknown {
		const cached = this.cache.get(key);
		if (!cached) return null;
		
		const now = Date.now();
		if (now - cached.timestamp > cached.ttl) {
			this.cache.delete(key);
			return null;
		}
		
		return cached.data;
	}

	private setCachedResult(key: string, data: unknown, ttl: number): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl
		});
	}

	/**
	 * Performance utilities
	 */
	private resetPerformanceMetrics(): void {
		this.performanceMetrics = {
			startTime: Date.now(),
			aiCallsCount: 0,
			patternAnalysisTime: 0,
			totalProcessingTime: 0,
			cacheHits: 0,
			cacheMisses: 0
		};
	}

	private getPerformanceMetrics(): PerformanceMetrics {
		this.performanceMetrics.totalProcessingTime = Date.now() - this.performanceMetrics.startTime;
		return { ...this.performanceMetrics };
	}

	private logPerformanceMetrics(options: SummaryNoteOptions): void {
		if (options.enablePerformanceOptimization) {
			const metrics = this.getPerformanceMetrics();
			this.logger.info(`Summary generation performance:`, {
				totalTime: `${metrics.totalProcessingTime}ms`,
				aiCalls: metrics.aiCallsCount,
				patternAnalysisTime: `${metrics.patternAnalysisTime}ms`,
				cacheHitRate: `${Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100)}%`,
				parallelProcessing: options.enableParallelProcessing
			});
		}
	}

	private async getFileSize(file: TFile): Promise<number> {
		try {
			const stat = await this.app.vault.adapter.stat(file.path);
			return stat?.size || 0;
		} catch {
			return 0;
		}
	}

	private shouldReduceAIProcessing(fileSize: number, maxSize: number): boolean {
		const ratio = fileSize / maxSize;
		if (ratio > 3) return false; // Disable AI for very large files
		if (ratio > 2) return Math.random() < 0.3; // 30% chance for large files
		if (ratio > 1.5) return Math.random() < 0.7; // 70% chance for medium-large files
		return true; // Enable for normal-sized files
	}

	/**
	 * Create a vault-wide pattern summary note
	 */
	async createVaultPatternSummary(
		options: Partial<SummaryNoteOptions> = {}
	): Promise<string> {
		const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };
		
		if (!this.patternDetectionEngine) {
			throw new Error("Pattern Detection Engine is required for vault pattern summaries");
		}

		try {
			const now = new Date();
			const filename = `Vault Pattern Summary - ${now.toISOString().split("T")[0]}`;
			const fullPath = `${opts.folderPath}/${filename}.md`;

			// Ensure folder exists
			await this.ensureFolderExists(opts.folderPath);

			// Generate vault-wide pattern analysis
			const patternOptions: PatternDetectionOptions = {
				scope: opts.patternDetectionScope,
				patternTypes: this.getEnabledPatternTypes(),
				minConfidence: opts.patternConfidenceThreshold,
				incremental: false,
				performance: {
					maxProcessingTime: 120000, // 2 minutes for comprehensive analysis
					enableParallel: true,
					batchSize: 20,
				},
				caching: {
					enabled: true,
					ttl: 3600000, // 1 hour
					forceRefresh: false,
				},
			};

			const vaultPatterns = await this.patternDetectionEngine.detectPatternsInVault(patternOptions);

			// Generate content
			const content = await this.generateVaultPatternSummaryContent(vaultPatterns, opts);

			// Create the file
			const exists = await this.fileExists(fullPath);
			if (exists && !opts.overwriteExisting) {
				throw new Error(`Vault pattern summary already exists: ${fullPath}`);
			}

			if (exists) {
				const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
				if (existingFile instanceof TFile) {
					await this.app.vault.modify(existingFile, content);
				} else {
					await this.app.vault.adapter.write(fullPath, content);
				}
			} else {
				try {
					await this.app.vault.create(fullPath, content);
				} catch (createError) {
					await this.app.vault.adapter.mkdir(opts.folderPath);
					await this.app.vault.adapter.write(fullPath, content);
				}
			}

			this.logger.info(`Created vault pattern summary: ${fullPath}`);
			return fullPath;
		} catch (error) {
			this.logger.error("Failed to create vault pattern summary:", error);
			throw error;
		}
	}

	/**
	 * Generate content for vault-wide pattern summary
	 */
	private async generateVaultPatternSummaryContent(
		vaultPatterns: VaultPatternResult,
		options: SummaryNoteOptions
	): Promise<string> {
		const now = new Date();
		
		// Set up NLG generator
		this.setupNLGGenerator(options.writingStyle);

		// Generate frontmatter
		const frontmatter = [
			"---",
			`title: "Vault Pattern Analysis - ${now.toISOString().split("T")[0]}"`,
			`created: ${now.toISOString()}`,
			`type: "vault-pattern-summary"`,
			`writing_style: "${options.writingStyle}"`,
			`analysis_scope: "${options.patternDetectionScope}"`,
			`patterns_found: ${vaultPatterns.summary.patternsFound}`,
			`files_analyzed: ${vaultPatterns.summary.filesAnalyzed}`,
			`tags: ["vault-analysis", "patterns", "retrospect-ai"]`,
			"---",
			"",
		].join("\n");

		const contentSections: string[] = [];

		// Header
		contentSections.push(`# Vault Pattern Analysis`);
		contentSections.push("");
		contentSections.push(`**Analysis Date:** ${now.toLocaleString()}`);
		contentSections.push(`**Scope:** ${options.patternDetectionScope}`);
		contentSections.push(`**Files Analyzed:** ${vaultPatterns.summary.filesAnalyzed}`);
		contentSections.push(`**Patterns Found:** ${vaultPatterns.summary.patternsFound}`);
		contentSections.push(`**Processing Time:** ${Math.round(vaultPatterns.summary.processingTime / 1000)}s`);
		contentSections.push("");

		// Executive Summary
		contentSections.push("## 🎯 Executive Summary");
		contentSections.push("");
		contentSections.push(this.generateVaultExecutiveSummary(vaultPatterns));
		contentSections.push("");

		// Top Patterns
		if (vaultPatterns.insights.topPatterns.length > 0) {
			contentSections.push("## 🏆 Top Patterns");
			contentSections.push("");
			vaultPatterns.insights.topPatterns.slice(0, 10).forEach((pattern, index) => {
				contentSections.push(`### ${index + 1}. ${pattern.name}`);
				contentSections.push(`**Type:** ${pattern.type} | **Confidence:** ${Math.round(pattern.confidence * 100)}%`);
				contentSections.push(`**Frequency:** ${pattern.frequency.count} occurrences (${pattern.frequency.trend})`);
				contentSections.push(pattern.description);
				contentSections.push("");
			});
		}

		// Emerging Patterns
		if (vaultPatterns.insights.emergingPatterns.length > 0) {
			contentSections.push("## 📈 Emerging Patterns");
			contentSections.push("");
			contentSections.push("New patterns that are gaining momentum:");
			contentSections.push("");
			vaultPatterns.insights.emergingPatterns.slice(0, 5).forEach(pattern => {
				contentSections.push(`- **${pattern.name}**: ${pattern.description} (${pattern.frequency.count} occurrences)`);
			});
			contentSections.push("");
		}

		// Declining Patterns
		if (vaultPatterns.insights.decliningPatterns.length > 0) {
			contentSections.push("## 📉 Declining Patterns");
			contentSections.push("");
			contentSections.push("Patterns that are becoming less frequent:");
			contentSections.push("");
			vaultPatterns.insights.decliningPatterns.slice(0, 5).forEach(pattern => {
				contentSections.push(`- **${pattern.name}**: ${pattern.description} (${pattern.frequency.count} occurrences)`);
			});
			contentSections.push("");
		}

		// Pattern Correlations
		if (vaultPatterns.correlations.length > 0) {
			contentSections.push("## 🔗 Pattern Correlations");
			contentSections.push("");
			contentSections.push("Patterns that frequently occur together:");
			contentSections.push("");
			vaultPatterns.correlations.slice(0, 10).forEach(correlation => {
				const strength = Math.round(correlation.strength * 100);
				contentSections.push(`- **${correlation.type}** correlation (${strength}% strength)`);
				contentSections.push(`  Co-occurrences: ${correlation.evidence.coOccurrences}`);
			});
			contentSections.push("");
		}

		// Recommendations
		if (vaultPatterns.insights.recommendations.length > 0) {
			contentSections.push("## 🚀 Vault-Wide Recommendations");
			contentSections.push("");
			vaultPatterns.insights.recommendations.forEach((rec, index) => {
				contentSections.push(`### ${index + 1}. ${rec}`);
			});
			contentSections.push("");
		}

		// Performance Metrics
		contentSections.push("## 📊 Analysis Performance");
		contentSections.push("");
		contentSections.push(`- **Throughput:** ${vaultPatterns.performance.throughput.toFixed(1)} files/second`);
		contentSections.push(`- **Memory Usage:** ${vaultPatterns.performance.memoryUsage.toFixed(1)} MB`);
		contentSections.push(`- **AI Calls:** ${vaultPatterns.performance.aiCallsCount}`);
		contentSections.push(`- **Cache Hit Rate:** ${Math.round(vaultPatterns.summary.cacheHitRate * 100)}%`);
		contentSections.push("");

		// Footer
		contentSections.push("---");
		contentSections.push("");
		contentSections.push("*This vault analysis was automatically generated by RetrospectAI Pattern Detection Engine*");
		contentSections.push(`*Analysis scope: ${options.patternDetectionScope} | Confidence threshold: ${Math.round(options.patternConfidenceThreshold * 100)}%*`);

		return frontmatter + contentSections.join("\n");
	}

	/**
	 * Generate executive summary for vault patterns
	 */
	private generateVaultExecutiveSummary(vaultPatterns: VaultPatternResult): string {
		const summary = vaultPatterns.summary;
		const insights = vaultPatterns.insights;
		
		let executiveSummary = `Analysis of ${summary.filesAnalyzed} files revealed ${summary.patternsFound} distinct patterns. `;
		
		if (insights.topPatterns.length > 0) {
			const topPattern = insights.topPatterns[0];
			executiveSummary += `The most prominent pattern is "${topPattern.name}" with ${topPattern.frequency.count} occurrences. `;
		}
		
		if (insights.emergingPatterns.length > 0) {
			executiveSummary += `${insights.emergingPatterns.length} emerging pattern${insights.emergingPatterns.length > 1 ? 's' : ''} suggest${insights.emergingPatterns.length === 1 ? 's' : ''} new trends developing. `;
		}
		
		if (insights.decliningPatterns.length > 0) {
			executiveSummary += `${insights.decliningPatterns.length} pattern${insights.decliningPatterns.length > 1 ? 's are' : ' is'} declining, indicating changing habits or priorities. `;
		}
		
		const processingTime = Math.round(summary.processingTime / 1000);
		executiveSummary += `Analysis completed efficiently in ${processingTime} second${processingTime !== 1 ? 's' : ''} with ${Math.round(summary.cacheHitRate * 100)}% cache utilization.`;
		
		return executiveSummary;
	}

	/**
	 * Determine if AI insights should be enabled for a specific file based on privacy settings
	 */
	private async shouldEnableAIForFile(
		originalFile: TFile,
		options: SummaryNoteOptions
	): Promise<boolean> {
		// If privacy settings should not be respected, allow AI
		if (!options.respectPrivacySettings) {
			return true;
		}

		// If no privacy filter is available, allow AI (fail open)
		if (!this.privacyFilter) {
			this.logger.debug("No privacy filter available, allowing AI insights");
			return true;
		}

		try {
			// Read the file content to check for privacy markers
			const content = await this.app.vault.read(originalFile);
			
			// Check if the file should be excluded from AI processing
			const shouldExclude = this.privacyFilter.shouldExcludeFile(originalFile.path, content);
			
			if (shouldExclude) {
				this.logger.info(`Privacy filter: File ${originalFile.path} marked as private, disabling AI insights`);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.warn(`Error checking privacy settings for file ${originalFile.path}:`, error);
			// Fail safe: if we can't check privacy, don't use AI
			return false;
		}
	}

	private generateFilename(originalFile: TFile, template: string): string {
		const now = new Date();
		const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
		const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
		const originalName = originalFile.basename;

		return template
			.replace("{{date}}", dateStr)
			.replace("{{time}}", timeStr)
			.replace("{{datetime}}", `${dateStr} ${timeStr}`)
			.replace("{{originalName}}", originalName)
			.replace(/[<>:"/\\|?*]/g, "-"); // Remove invalid filename characters
	}

	private setupNLGGenerator(style: 'business' | 'personal' | 'academic'): void {
		switch (style) {
			case 'business':
				this.nlgGenerator = NLGFactory.createForBusiness(this.aiService?.getSettings().openaiConfig ? undefined : undefined);
				break;
			case 'academic':
				this.nlgGenerator = NLGFactory.createForAcademic(this.aiService?.getSettings().openaiConfig ? undefined : undefined);
				break;
			case 'personal':
			default:
				this.nlgGenerator = NLGFactory.createForPersonal(this.aiService?.getSettings().openaiConfig ? undefined : undefined);
				break;
		}
	}

	private async generateExecutiveSummary(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<string | null> {
		if (!this.aiService) return null;

		try {
			const content = await this.app.vault.read(originalFile);
			const aiAnalysis = await this.aiService.analyzePersonalContent(content, {
				generateSummary: true,
				analysisDepth: 'standard'
			});

			if (aiAnalysis.success && aiAnalysis.summary) {
				return aiAnalysis.summary;
			}
		} catch (error) {
			this.logger.warn("Failed to generate executive summary:", error);
		}

		return null;
	}

	private async generateKeyInsights(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title: string; description: string; evidence?: string[] }>> {
		if (!this.aiService) return [];

		try {
			const content = await this.app.vault.read(originalFile);
			const aiAnalysis = await this.aiService.analyzePersonalContent(content, {
				extractPatterns: true,
				analysisDepth: 'comprehensive'
			});

			if (aiAnalysis.success && aiAnalysis.insights) {
				return aiAnalysis.insights.map((insight, index) => ({
					title: `Insight ${index + 1}`,
					description: insight,
					evidence: []
				}));
			}
		} catch (error) {
			this.logger.warn("Failed to generate key insights:", error);
		}

		return [];
	}

	/**
	 * Generate advanced pattern analysis using the Pattern Detection Engine
	 */
	private async generateAdvancedPatternAnalysis(
		originalFile: TFile,
		options: SummaryNoteOptions
	): Promise<{
		patterns: PatternDefinition[];
		correlations: PatternCorrelation[];
		summary: string;
		insights: string[];
	}> {
		if (!this.patternDetectionEngine) {
			return { patterns: [], correlations: [], summary: "", insights: [] };
		}

		try {
			// Analyze the specific file
			const patternOptions: PatternDetectionOptions = {
				scope: options.patternDetectionScope,
				patternTypes: this.getEnabledPatternTypes(),
				minConfidence: options.patternConfidenceThreshold,
				incremental: false,
				performance: {
					maxProcessingTime: 30000, // 30 seconds
					enableParallel: false,
					batchSize: 1,
				},
				caching: {
					enabled: true,
					ttl: 3600000, // 1 hour
					forceRefresh: false,
				},
			};

			const analysisRecord = await this.patternDetectionEngine.analyzeFilePatterns(
				originalFile,
				patternOptions
			);

			// Get vault-wide patterns if requested
			let vaultPatterns: VaultPatternResult | null = null;
			if (options.includeVaultPatterns) {
				vaultPatterns = await this.patternDetectionEngine.detectPatternsInVault(patternOptions);
			}

			// Generate summary
			const summary = this.generatePatternSummary(analysisRecord, vaultPatterns);
			
			// Generate insights
			const insights = this.generatePatternInsights(analysisRecord, vaultPatterns);

			return {
				patterns: analysisRecord.analysis.patternsFound,
				correlations: vaultPatterns?.correlations || [],
				summary,
				insights,
			};
		} catch (error) {
			this.logger.error("Failed to generate advanced pattern analysis:", error);
			return { patterns: [], correlations: [], summary: "", insights: [] };
		}
	}

	/**
	 * Get enabled pattern types based on configuration
	 */
	private getEnabledPatternTypes(): PatternType[] {
		return [
			'productivity-theme',
			'productivity-blocker',
			'sentiment-pattern',
			'sentiment-change',
			'procrastination-language',
			'distraction-language',
			'positive-momentum',
			'work-pattern',
			'habit-pattern',
			'mood-pattern',
			'health-pattern',
			'personal-activity',
		];
	}

	/**
	 * Generate a summary of pattern analysis results
	 */
	private generatePatternSummary(
		analysisRecord: NoteAnalysisRecord,
		vaultPatterns: VaultPatternResult | null
	): string {
		const patterns = analysisRecord.analysis.patternsFound;
		if (patterns.length === 0) {
			return "No significant patterns detected in this note.";
		}

		const patternTypes = [...new Set(patterns.map(p => p.type))];
		const highConfidencePatterns = patterns.filter(p => p.confidence >= 0.8);
		
		let summary = `Found ${patterns.length} patterns across ${patternTypes.length} categories. `;
		
		if (highConfidencePatterns.length > 0) {
			summary += `${highConfidencePatterns.length} patterns show high confidence (≥80%). `;
		}

		if (vaultPatterns) {
			summary += `This note contains ${Math.round((patterns.length / vaultPatterns.summary.patternsFound) * 100)}% of your total detected patterns.`;
		}

		return summary;
	}

	/**
	 * Generate insights from pattern analysis
	 */
	private generatePatternInsights(
		analysisRecord: NoteAnalysisRecord,
		vaultPatterns: VaultPatternResult | null
	): string[] {
		const insights: string[] = [];
		const patterns = analysisRecord.analysis.patternsFound;

		// Sentiment insights
		const sentimentPatterns = patterns.filter(p => p.type.includes('sentiment'));
		if (sentimentPatterns.length > 0) {
			const avgSentiment = analysisRecord.content.sentimentScore;
			if (avgSentiment > 0.3) {
				insights.push("This note reflects a generally positive emotional state.");
			} else if (avgSentiment < -0.3) {
				insights.push("This note indicates some negative emotions or challenges.");
			}
		}

		// Productivity insights
		const productivityPatterns = patterns.filter(p => p.type.includes('productivity'));
		if (productivityPatterns.length > 0) {
			const blockers = productivityPatterns.filter(p => p.type === 'productivity-blocker');
			if (blockers.length > 0) {
				insights.push(`Identified ${blockers.length} productivity blockers that may need attention.`);
			}
		}

		// Temporal insights
		const now = new Date();
		const recentPatterns = patterns.filter(p => 
			(now.getTime() - p.temporal.lastSeen.getTime()) < 7 * 24 * 60 * 60 * 1000 // Last 7 days
		);
		if (recentPatterns.length > patterns.length * 0.7) {
			insights.push("Most patterns in this note are recent, indicating active ongoing themes.");
		}

		return insights;
	}

	/**
	 * Generate recommendations based on detected patterns
	 */
	private async generateRecommendations(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title?: string; description: string; actionSteps?: Array<{ description: string }> }>> {
		if (!this.aiService) return [];

		try {
			const content = await this.app.vault.read(originalFile);
			const aiAnalysis = await this.aiService.analyzePersonalContent(content, {
				suggestActions: true,
				analysisDepth: 'comprehensive'
			});

			if (aiAnalysis.success && aiAnalysis.recommendations) {
				return aiAnalysis.recommendations.map(rec => ({
					description: rec,
					actionSteps: []
				}));
			}
		} catch (error) {
			this.logger.warn("Failed to generate recommendations:", error);
		}

		return [];
	}

	private generateConnectionOpportunities(analysisResult: ProcessingResult): Array<{ type: string; description: string }> {
		const connections: Array<{ type: string; description: string }> = [];

		// Analyze content for connection opportunities
		if (analysisResult.metadata?.tags && analysisResult.metadata.tags.length > 0) {
			const tagStrings = analysisResult.metadata.tags.slice(0, 3).map(tag => 
				typeof tag === 'string' ? tag : tag.normalized
			);
			connections.push({
				type: "Tag-based connections",
				description: `Notes with similar tags: ${tagStrings.join(", ")}`
			});
		}

		if (analysisResult.sections && analysisResult.sections.length > 0) {
			const categories = [...new Set(analysisResult.sections.map(s => s.category).filter(c => c !== 'other'))];
			if (categories.length > 0) {
				connections.push({
					type: "Content category connections",
					description: `Notes in categories: ${categories.slice(0, 3).join(", ")}`
				});
			}
		}

		if (analysisResult.metadata?.links && analysisResult.metadata.links.length > 0) {
			connections.push({
				type: "Linked notes",
				description: `Explore connections through ${analysisResult.metadata.links.length} internal links`
			});
		}

		// Add temporal connections
		connections.push({
			type: "Temporal connections",
			description: "Notes created around the same time period for context"
		});

		return connections;
	}

	private formatAnalysisResults(result: ProcessingResult): string {
		if (!result.success) {
			return "❌ **Analysis Failed**\n\nThe analysis could not be completed due to errors.";
		}

		if (result.skipped) {
			return `⏭️ **Analysis Skipped**\n\nReason: ${
				result.skipReason || "Unknown"
			}`;
		}

		const sections: string[] = [];

		// Basic stats
		sections.push("### 📊 Basic Statistics");
		if (result.metadata) {
			sections.push(`- **Word Count:** ${result.metadata.wordCount}`);
			sections.push(
				`- **Character Count:** ${result.metadata.characterCount}`
			);
			sections.push(
				`- **Reading Time:** ~${Math.ceil(
					result.metadata.wordCount / 200
				)} minutes`
			);
		}
		sections.push(`- **Processing Time:** ${result.processingTime}ms`);
		sections.push("");

		// Content structure
		if (result.parsedContent && result.parsedContent.elements.length > 0) {
			sections.push("### 🏗️ Content Structure");

			const elementTypes = result.parsedContent.elements.reduce(
				(acc, el) => {
					acc[el.type] = (acc[el.type] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			Object.entries(elementTypes).forEach(([type, count]) => {
				sections.push(`- **${this.capitalizeFirst(type)}:** ${count}`);
			});
			sections.push("");
		}

		// Sections
		if (result.sections && result.sections.length > 0) {
			sections.push("### 📝 Document Sections");
			result.sections.forEach((section, index) => {
				sections.push(
					`${index + 1}. **${section.title}** (Level ${
						section.level
					})`
				);
				if (section.wordCount > 0) {
					sections.push(`   - ${section.wordCount} words`);
				}
				if (section.category !== "other") {
					sections.push(`   - Category: ${section.category}`);
				}
			});
			sections.push("");
		}

		// Metadata insights
		if (result.metadata) {
			sections.push("### 🔍 Content Insights");

					if (result.metadata.tags && result.metadata.tags.length > 0) {
			// Handle both string arrays and NormalizedTag objects
			const tagStrings = result.metadata.tags.map(tag => 
				typeof tag === 'string' ? tag : tag.normalized
			);
			sections.push(`- **Tags:** ${tagStrings.join(", ")}`);
		}

			if (result.metadata.links && result.metadata.links.length > 0) {
				sections.push(
					`- **Internal Links:** ${result.metadata.links.length}`
				);
			}

			sections.push("");
		}

		// Warnings
		if (result.warnings.length > 0) {
			sections.push("### ⚠️ Warnings");
			result.warnings.forEach((warning) => {
				sections.push(`- ${warning}`);
			});
			sections.push("");
		}

		return sections.join("\n");
	}

	private async fileExists(path: string): Promise<boolean> {
		this.logger.info(`Checking if file exists: ${path}`);
		
		try {
			// Try vault API first
			const file = this.app.vault.getAbstractFileByPath(path);
			this.logger.info(`Vault API result: ${file ? file.constructor.name : 'null'}`);
			
			if (file instanceof TFile) {
				this.logger.info(`File exists via vault API: ${path}`);
				return true;
			}
			
			// Fallback to adapter - but only check for files, not folders
			const stat = await this.app.vault.adapter.stat(path);
			this.logger.info(`Adapter stat result: ${JSON.stringify(stat)}`);
			
			// Check if it's actually a file (not a folder)
			if (stat && stat.type === 'file') {
				this.logger.info(`File exists via adapter: ${path}`);
				return true;
			} else {
				this.logger.info(`Path exists but is not a file: ${path} (type: ${stat?.type || 'unknown'})`);
				return false;
			}
		} catch (error) {
			this.logger.info(`File does not exist: ${path} (${error.message})`);
			return false;
		}
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		this.logger.info(`Ensuring folder exists: ${folderPath}`);
		
		try {
			// Check if folder exists using vault API first
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (folder) {
				this.logger.info(`Folder already exists via vault API: ${folderPath}`);
				return; // Folder already exists
			}
			
			// Try adapter stat as fallback
			await this.app.vault.adapter.stat(folderPath);
			this.logger.info(`Folder exists via adapter stat: ${folderPath}`);
		} catch {
			// Folder doesn't exist, create it
			this.logger.info(`Folder doesn't exist, creating: ${folderPath}`);
			try {
				await this.app.vault.createFolder(folderPath);
				this.logger.info(`Successfully created folder: ${folderPath}`);
			} catch (folderError) {
				// If createFolder fails, try creating parent folders recursively
				this.logger.warn(`createFolder failed, trying recursive creation: ${folderError}`);
				await this.createFolderRecursively(folderPath);
				this.logger.info(`Successfully created folder recursively: ${folderPath}`);
			}
		}
	}

	private async createFolderRecursively(folderPath: string): Promise<void> {
		const parts = folderPath.split('/').filter(part => part.length > 0);
		let currentPath = '';
		
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			
			try {
				const exists = this.app.vault.getAbstractFileByPath(currentPath);
				if (!exists) {
					await this.app.vault.createFolder(currentPath);
					this.logger.info(`Created folder part: ${currentPath}`);
				}
			} catch (error) {
				// If vault API fails, try adapter
				try {
					await this.app.vault.adapter.stat(currentPath);
				} catch {
					await this.app.vault.adapter.mkdir(currentPath);
					this.logger.info(`Created folder part via adapter: ${currentPath}`);
				}
			}
		}
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}
