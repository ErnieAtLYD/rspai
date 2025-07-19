// src/main.ts

import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	moment,
	TFolder,
	Notice,
} from "obsidian";

import {
	MasterPasswordModal,
	EncryptionSetupModal,
	EncryptionManagementModal,
} from "./modals";

import {
	ServiceManager,
	AIService,
	AIServiceConfig,
	FileOperationsService,
	FileOperationsConfig,
	EncryptionService,
	EncryptionConfig,
	EncryptedData,
	CacheService,
	CacheConfig,
	PatternRecognitionService,
	PatternRecognitionConfig,
	PatternData,
	TrendData,
	AnalysisManager,
	AnalysisManagerConfig,
	AnalysisResult,
	ErrorHandlingService,
	ErrorHandlingConfig,
	RetrospectError,
	ErrorCode,
	ErrorType,
	NLPAnalysisService,
	NLPAnalysisConfig,
} from "./services";

import { JournalReflectionSettings } from "./types";
import { JournalReflectionSettingTab } from "./ui/SettingsUI";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MAX_TOKENS = 1000;
const OPENAI_TEMPERATURE = 0.7;

const DEFAULT_SETTINGS: JournalReflectionSettings = {
	openaiApiKey: "",
	openaiModel: OPENAI_MODEL,
	daysToInclude: 7,
	excludePrivate: true,
	periodicNoteFolders: ["Daily Notes"],
	reflectionFolder: "Summaries",
	encryptionEnabled: false,
	encryptionSetup: false,
	analysisEnabled: true,
	patternThreshold: 0.6,
	enableTrendAnalysis: true,
	enableSemanticAnalysis: true,
	cacheAnalysisResults: true,
	enableAdvancedNLP: true,
	nlpAnalysisDepth: "moderate",
	blockerDetectionSensitivity: "medium",
	// Analysis Scope Settings
	enabledAnalysisScopes: true,
	analysisScope: "whole-life",
	customAnalysisScope: {
		name: "",
		includeKeywords: [],
		excludeKeywords: [],
		includeFolders: [],
		excludeFolders: [],
		includeTags: [],
		excludeTags: [],
	},
	// Scan Frequency Settings
	enableAutoScan: true,
	scanFrequency: "daily",
	lastAutoScan: Date.now(),
};

/**
 * Journal Reflection Plugin
 * @description
 * This plugin is used to create a weekly summary of the journal entries.
 * It uses the OpenAI API to generate a summary of the journal entries.
 * It then creates a summary note in the configured reflection folder.
 * It also creates backlinks to the source notes.
 */
export default class JournalReflectionPlugin extends Plugin {
	settings: JournalReflectionSettings;
	private serviceManager: ServiceManager;
	private masterPassword: string | null = null;
	public errorHandler: ErrorHandlingService;
	private autoScanInterval: ReturnType<typeof setInterval> | null = null;
	private isAutoScanRunning = false;

	/**
	 * Load the plugin
	 * @description
	 * This function is used to load the plugin.
	 * It loads the settings and adds the ribbon icon and command.
	 * It also adds the settings tab.
	 */
	async onload() {
		await this.loadSettings();

		// Initialize service manager
		this.serviceManager = new ServiceManager(this.app);
		await this.registerServices();

		// Update service configurations with loaded settings
		await this.updateServiceConfigurations();

		// Add ribbon icon
		this.addRibbonIcon("book-open", "Create Weekly Journal Summary", () => {
			this.createWeeklySummary();
		});

		// Add commands
		this.addCommand({
			id: "create-weekly-summary",
			name: "Create Weekly Journal Summary",
			callback: () => this.createWeeklySummary(),
		});

		this.addCommand({
			id: "analyze-patterns",
			name: "Analyze Journal Patterns",
			callback: () => this.analyzePatterns(),
		});

		this.addCommand({
			id: "analyze-trends",
			name: "Analyze Journal Trends",
			callback: () => this.analyzeTrends(),
		});

		this.addCommand({
			id: "comprehensive-analysis",
			name: "Comprehensive Journal Analysis",
			callback: () => this.performComprehensiveAnalysis(),
		});

		this.addCommand({
			id: "clear-analysis-cache",
			name: "Clear Analysis Cache",
			callback: () => this.clearAnalysisCache(),
		});

		// Add settings tab
		this.addSettingTab(new JournalReflectionSettingTab(this.app, this));

		// Setup auto-scan if enabled
		this.setupAutoScan();
	}

	/**
	 * Register all services with the service manager
	 */
	private async registerServices(): Promise<void> {
		// Register error handling service first
		this.serviceManager.register("errorHandlingService", {
			implementation: (serviceManager: ServiceManager) => {
				const config: ErrorHandlingConfig = {
					maxRetries: 3,
					baseRetryDelay: 1000,
					enableLogging: true,
					enableNotifications: true,
				};
				return new ErrorHandlingService(this.app, config);
			},
			dependencies: [],
			singleton: true,
		});

		// Register encryption service
		this.serviceManager.register("encryptionService", {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);
				const config: EncryptionConfig = {
					iterations: 100000,
					keyLength: 256,
				};
				return new EncryptionService(this.app, config, errorHandler);
			},
			dependencies: ["errorHandlingService"],
			singleton: true,
		});

		// Register cache service
		this.serviceManager.register("cacheService", {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);
				const config: CacheConfig = {
					defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
					maxSize: 1000,
					persistToDisk: true,
					cleanupInterval: 5 * 60 * 1000, // 5 minutes
					// Batched write configuration
					batchWrites: true,
					batchInterval: 2000, // 2 seconds
					maxBatchSize: 50, // operations
					writeMode: "batched",
				};
				return new CacheService(
					this.app,
					errorHandler,
					config,
					this.manifest.id
				);
			},
			dependencies: ["errorHandlingService"],
			singleton: true,
		});

		// Register AI service
		this.serviceManager.register("aiService", {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);
				const config: AIServiceConfig = {
					apiKey: "", // Will be set when needed
					model: this.settings.openaiModel,
					maxTokens: OPENAI_MAX_TOKENS,
					temperature: OPENAI_TEMPERATURE,
					apiUrl: OPENAI_API_URL,
				};
				return new AIService(this.app, config, errorHandler);
			},
			dependencies: ["errorHandlingService"],
			singleton: true,
		});

		// Register file operations service
		this.serviceManager.register("fileOperationsService", {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);
				const config: FileOperationsConfig = {
					daysToInclude: this.settings.daysToInclude,
					excludePrivate: this.settings.excludePrivate,
					periodicNoteFolders: this.settings.periodicNoteFolders,
					reflectionFolder: this.settings.reflectionFolder,
					enabledAnalysisScopes: this.settings.enabledAnalysisScopes,
					analysisScope: this.settings.analysisScope,
					customAnalysisScope: this.settings.customAnalysisScope,
				};
				return new FileOperationsService(
					this.app,
					config,
					errorHandler
				);
			},
			dependencies: ["errorHandlingService"],
			singleton: true,
		});

		// Register NLP analysis service
		this.serviceManager.register("nlpAnalysisService", {
			implementation: (serviceManager: ServiceManager) => {
				const cacheService =
					serviceManager.resolve<CacheService>("cacheService");
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);
				const config: NLPAnalysisConfig = {
					cacheService,
					errorHandler,
					enableEntityRecognition: true,
					enableAdvancedSentiment: true,
					themeExtractionDepth:
						this.settings.nlpAnalysisDepth || "moderate",
					blockerDetectionSensitivity:
						this.settings.blockerDetectionSensitivity || "medium",
				};
				return new NLPAnalysisService(this.app, config);
			},
			dependencies: ["cacheService", "errorHandlingService"],
			singleton: true,
		});

		// Register pattern recognition service
		this.serviceManager.register("patternRecognitionService", {
			implementation: (serviceManager: ServiceManager) => {
				const aiService =
					serviceManager.resolve<AIService>("aiService");
				const cacheService =
					serviceManager.resolve<CacheService>("cacheService");
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);
				const nlpService = this.settings.enableAdvancedNLP
					? serviceManager.resolve<NLPAnalysisService>(
							"nlpAnalysisService"
					  )
					: undefined;
				const config: PatternRecognitionConfig = {
					aiService,
					cacheService,
					errorHandler,
					nlpService,
					analysisDepth: "medium",
					patternThreshold: this.settings.patternThreshold || 0.6,
					enableTrendAnalysis:
						this.settings.enableTrendAnalysis ?? true,
					enableSemanticAnalysis:
						this.settings.enableSemanticAnalysis ?? true,
					enableAdvancedNLP: this.settings.enableAdvancedNLP ?? true,
				};
				return new PatternRecognitionService(this.app, config);
			},
			dependencies: this.settings.enableAdvancedNLP
				? [
						"aiService",
						"cacheService",
						"errorHandlingService",
						"nlpAnalysisService",
				  ]
				: ["aiService", "cacheService", "errorHandlingService"],
			singleton: true,
		});

		// Register analysis manager
		this.serviceManager.register("analysisManager", {
			implementation: (serviceManager: ServiceManager) => {
				const aiService =
					serviceManager.resolve<AIService>("aiService");
				const fileOperationsService =
					serviceManager.resolve<FileOperationsService>(
						"fileOperationsService"
					);
				const cacheService =
					serviceManager.resolve<CacheService>("cacheService");
				const patternRecognitionService =
					serviceManager.resolve<PatternRecognitionService>(
						"patternRecognitionService"
					);
				const errorHandler =
					serviceManager.resolve<ErrorHandlingService>(
						"errorHandlingService"
					);

				const config: AnalysisManagerConfig = {
					aiService,
					fileOperationsService,
					cacheService,
					patternRecognitionService,
					errorHandler,
					defaultOptions: {
						useCache: true,
						depth: "medium",
						includePredictions: false,
						generateSummary: true,
					},
				};
				return new AnalysisManager(this.app, config);
			},
			dependencies: [
				"aiService",
				"fileOperationsService",
				"cacheService",
				"patternRecognitionService",
				"errorHandlingService",
			],
			singleton: true,
		});

		// Initialize all services
		await this.serviceManager.initializeAll();

		// Get error handler reference for easy access (already set in ServiceManager during initializeAll)
		this.errorHandler = this.serviceManager.resolve<ErrorHandlingService>(
			"errorHandlingService"
		);
	}

	/**
	 * Update service configurations when settings change
	 */
	private async updateServiceConfigurations(): Promise<void> {
		if (!this.serviceManager) return;

		// Update AI service configuration
		if (this.serviceManager.has("aiService")) {
			const aiService =
				this.serviceManager.resolve<AIService>("aiService");
			aiService.updateConfig({
				apiKey: await this.getDecryptedApiKey(),
				model: this.settings.openaiModel,
				maxTokens: OPENAI_MAX_TOKENS,
				temperature: OPENAI_TEMPERATURE,
				apiUrl: OPENAI_API_URL,
			});
		}

		// Update file operations service configuration
		if (this.serviceManager.has("fileOperationsService")) {
			const fileOpsService =
				this.serviceManager.resolve<FileOperationsService>(
					"fileOperationsService"
				);
			fileOpsService.updateConfig({
				daysToInclude: this.settings.daysToInclude,
				excludePrivate: this.settings.excludePrivate,
				periodicNoteFolders: this.settings.periodicNoteFolders,
				reflectionFolder: this.settings.reflectionFolder,
				enabledAnalysisScopes: this.settings.enabledAnalysisScopes,
				analysisScope: this.settings.analysisScope,
				customAnalysisScope: this.settings.customAnalysisScope,
			});
		}
	}

	/**
	 * Cleanup when plugin unloads
	 */
	async onunload() {
		this.clearAutoScan();
		if (this.serviceManager) {
			await this.serviceManager.disposeAll();
		}
	}

	/**
	 * Helper method to show info messages through ErrorHandlingService
	 */
	private async showInfo(message: string, operation: string): Promise<void> {
		await this.errorHandler?.handleError(
			new RetrospectError(
				ErrorType.USER,
				ErrorCode.INFO,
				message,
				message,
				{
					operation,
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				},
				true,
				false
			),
			{
				operation,
				component: "JournalReflectionPlugin",
				timestamp: Date.now(),
			},
			{ showNotice: true, logToConsole: false, throwAfterHandling: false }
		);
	}

	/**
	 * Validate that the API key is configured
	 */
	private async validateApiKey(): Promise<boolean> {
		try {
			const apiKey = await this.getDecryptedApiKey();
			return !!(apiKey && apiKey.trim().length > 0);
		} catch (error) {
			if (this.errorHandler) {
				await this.errorHandler.handleError(
					error instanceof Error ? error : new Error(String(error)),
					{
						operation: "validateApiKey",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					},
					{ showNotice: false, logToConsole: true }
				);
			}
			return false;
		}
	}

	/**
	 * Validate prerequisites for analysis commands
	 */
	private async validateAnalysisPrerequisites(): Promise<boolean> {
		if (!this.serviceManager) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.CRITICAL,
					ErrorCode.SERVICE_UNAVAILABLE,
					"Services not initialized",
					"Services not initialized",
					{
						operation: "validateAnalysisPrerequisites",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "validateAnalysisPrerequisites",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
			return false;
		}

		if (!(await this.validateApiKey())) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.USER,
					ErrorCode.API_KEY_INVALID,
					"Please configure your OpenAI API key first",
					"Please configure your OpenAI API key first",
					{
						operation: "validateAnalysisPrerequisites",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "validateAnalysisPrerequisites",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
			return false;
		}

		// Check if critical services are available
		if (!this.serviceManager.has("fileOperationsService")) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.CRITICAL,
					ErrorCode.SERVICE_UNAVAILABLE,
					"File operations service not available",
					"File operations service not available",
					{
						operation: "validateAnalysisPrerequisites",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "validateAnalysisPrerequisites",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
			return false;
		}

		return true;
	}

	/**
	 * Create a weekly summary
	 * @description
	 * This function is used to create a weekly summary of the journal entries.
	 * It uses the OpenAI API to generate a summary of the journal entries.
	 * It then creates a summary note in the configured reflection folder.
	 * It also creates backlinks to the source notes.
	 */
	async createWeeklySummary() {
		const apiKey = await this.getDecryptedApiKey();
		if (!apiKey) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.USER,
					ErrorCode.API_KEY_INVALID,
					"Please set your OpenAI API key in settings first!",
					"Please set your OpenAI API key in settings first!",
					{
						operation: "createWeeklySummary",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "createWeeklySummary",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
			return;
		}

		await this.showInfo(
			"Creating weekly journal summary...",
			"createWeeklySummary"
		);

		try {
			// Get services with fallback handling
			const fileOpsService =
				this.serviceManager.resolve<FileOperationsService>(
					"fileOperationsService"
				);
			const aiService =
				this.serviceManager.resolve<AIService>("aiService");

			// Find recent notes
			const recentNotes = await fileOpsService.findRecentNotes();

			if (recentNotes.length === 0) {
				await this.errorHandler?.handleError(
					new RetrospectError(
						ErrorType.USER,
						ErrorCode.NO_CONTENT_FOUND,
						"No journal entries found in the last week.",
						"No journal entries found in the last week.",
						{
							operation: "createWeeklySummary",
							component: "JournalReflectionPlugin",
							timestamp: Date.now(),
						}
					),
					{
						operation: "createWeeklySummary",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				);
				return;
			}

			// Get content from notes
			const notesContent = await fileOpsService.getNotesContent(
				recentNotes
			);

			if (notesContent.trim().length === 0) {
				await this.errorHandler?.handleError(
					new RetrospectError(
						ErrorType.USER,
						ErrorCode.NO_CONTENT_FOUND,
						"No content found in recent notes (all may be private).",
						"No content found in recent notes (all may be private).",
						{
							operation: "createWeeklySummary",
							component: "JournalReflectionPlugin",
							timestamp: Date.now(),
						}
					),
					{
						operation: "createWeeklySummary",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				);
				return;
			}

			// Generate summary with AI service
			const summary = await aiService.generateSummary(
				notesContent,
				recentNotes
			);

			// Create summary note
			const summaryFile = await fileOpsService.createSummaryNote(
				summary,
				recentNotes
			);

			// Open the summary file
			this.app.workspace.getLeaf().openFile(summaryFile);

			await this.showInfo(
				"Weekly journal summary created!",
				"createWeeklySummary"
			);
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "createWeeklySummary",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				},
				{ showNotice: true }
			);
		}
	}

	/**
	 * Analyze journal patterns
	 */
	async analyzePatterns(): Promise<void> {
		if (!(await this.validateAnalysisPrerequisites())) {
			return;
		}

		await this.showInfo("Analyzing journal patterns...", "analyzePatterns");

		try {
			// Check if analysis service is available
			if (!this.serviceManager.has("analysisManager")) {
				await this.errorHandler?.handleError(
					new RetrospectError(
						ErrorType.CRITICAL,
						ErrorCode.SERVICE_UNAVAILABLE,
						"Analysis service not available. Pattern analysis disabled.",
						"Analysis service not available. Pattern analysis disabled.",
						{
							operation: "analyzePatterns",
							component: "JournalReflectionPlugin",
							timestamp: Date.now(),
						}
					),
					{
						operation: "analyzePatterns",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				);
				return;
			}

			const analysisManager =
				this.serviceManager.resolve<AnalysisManager>("analysisManager");
			const patterns = await analysisManager.analyzePatterns(7);

			if (patterns.length === 0) {
				await this.showInfo(
					"No significant patterns detected in recent entries.",
					"analyzePatterns"
				);
				return;
			}

			// Create patterns report
			const report = this.formatPatternsReport(patterns);
			const fileName = `Pattern Analysis - ${moment().format(
				"YYYY-MM-DD HH-mm"
			)}`;
			const fileOpsService =
				this.serviceManager.resolve<FileOperationsService>(
					"fileOperationsService"
				);
			const reportFile = await fileOpsService.createAnalysisReport(
				fileName,
				report
			);

			this.app.workspace.getLeaf().openFile(reportFile);
			await this.showInfo(
				`Found ${patterns.length} patterns - report created!`,
				"analyzePatterns"
			);
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "analyzePatterns",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
		}
	}

	/**
	 * Analyze journal trends
	 */
	async analyzeTrends(): Promise<void> {
		if (!(await this.validateAnalysisPrerequisites())) {
			return;
		}

		await this.showInfo("Analyzing journal trends...", "analyzeTrends");

		try {
			const analysisManager =
				this.serviceManager.resolve<AnalysisManager>("analysisManager");
			const trends = await analysisManager.analyzeTrends(14);

			if (trends.length === 0) {
				await this.showInfo(
					"No significant trends detected in recent entries.",
					"analyzeTrends"
				);
				return;
			}

			// Create trends report
			const report = this.formatTrendsReport(trends);
			const fileName = `Trend Analysis - ${moment().format(
				"YYYY-MM-DD HH-mm"
			)}`;
			const fileOpsService =
				this.serviceManager.resolve<FileOperationsService>(
					"fileOperationsService"
				);
			const reportFile = await fileOpsService.createAnalysisReport(
				fileName,
				report
			);

			this.app.workspace.getLeaf().openFile(reportFile);
			await this.showInfo(
				`Found ${trends.length} trends - report created!`,
				"analyzeTrends"
			);
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "analyzeTrends",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
		}
	}

	/**
	 * Perform comprehensive analysis
	 */
	async performComprehensiveAnalysis(): Promise<void> {
		if (!(await this.validateAnalysisPrerequisites())) {
			return;
		}

		await this.showInfo(
			"Performing comprehensive analysis...",
			"performComprehensiveAnalysis"
		);

		try {
			const analysisManager =
				this.serviceManager.resolve<AnalysisManager>("analysisManager");
			const result = await analysisManager.analyzeJournalEntries(7, {
				generateSummary: true,
				depth: "deep",
			});

			// Create comprehensive report
			const report = this.formatComprehensiveReport(result);
			const fileName = `Comprehensive Analysis - ${moment().format(
				"YYYY-MM-DD HH-mm"
			)}`;
			const fileOpsService =
				this.serviceManager.resolve<FileOperationsService>(
					"fileOperationsService"
				);
			const reportFile = await fileOpsService.createAnalysisReport(
				fileName,
				report
			);

			this.app.workspace.getLeaf().openFile(reportFile);
			await this.showInfo(
				`Analysis complete! Confidence: ${(
					result.confidence * 100
				).toFixed(0)}%`,
				"performComprehensiveAnalysis"
			);
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "performComprehensiveAnalysis",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
		}
	}

	/**
	 * Clear analysis cache
	 */
	async clearAnalysisCache(): Promise<void> {
		if (!this.serviceManager) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.CRITICAL,
					ErrorCode.SERVICE_UNAVAILABLE,
					"Services not initialized",
					"Services not initialized",
					{
						operation: "clearAnalysisCache",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "clearAnalysisCache",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
			return;
		}

		try {
			const analysisManager =
				this.serviceManager.resolve<AnalysisManager>("analysisManager");
			await analysisManager.clearAnalysisCache();
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{
					operation: "clearAnalysisCache",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
		}
	}

	private formatPatternsReport(patterns: PatternData[]): string {
		let report = `# Journal Pattern Analysis\n\n`;
		report += `Generated: ${moment().format("YYYY-MM-DD HH:mm")}\n\n`;
		report += `## Detected Patterns (${patterns.length})\n\n`;

		for (const pattern of patterns) {
			report += `### ${pattern.type.replace("_", " ").toUpperCase()}\n`;
			report += `- **Confidence**: ${(pattern.confidence * 100).toFixed(
				0
			)}%\n`;
			report += `- **Description**: ${pattern.description}\n`;
			if (
				pattern.metadata?.keywords &&
				Array.isArray(pattern.metadata.keywords)
			) {
				report += `- **Keywords**: ${pattern.metadata.keywords.join(
					", "
				)}\n`;
			}
			report += `\n`;
		}

		return report;
	}

	private formatTrendsReport(trends: TrendData[]): string {
		let report = `# Journal Trend Analysis\n\n`;
		report += `Generated: ${moment().format("YYYY-MM-DD HH:mm")}\n\n`;
		report += `## Detected Trends (${trends.length})\n\n`;

		for (const trend of trends) {
			report += `### ${trend.metric.replace("_", " ").toUpperCase()}\n`;
			report += `- **Direction**: ${trend.direction}\n`;
			report += `- **Strength**: ${trend.strength.toFixed(2)}\n`;
			report += `- **Data Points**: ${trend.timePoints.length}\n`;
			report += `\n`;
		}

		return report;
	}

	private formatComprehensiveReport(result: AnalysisResult): string {
		let report = `# Comprehensive Journal Analysis\n\n`;
		report += `Generated: ${moment().format("YYYY-MM-DD HH:mm")}\n`;
		report += `Time Range: ${result.timeRange}\n`;
		report += `Overall Confidence: ${(result.confidence * 100).toFixed(
			0
		)}%\n\n`;

		if (result.summary) {
			report += `## Summary\n\n${result.summary}\n\n`;
		}

		if (result.patterns.length > 0) {
			report += `## Patterns (${result.patterns.length})\n\n`;
			for (const pattern of result.patterns) {
				report += `- **${pattern.type}**: ${pattern.description} (${(
					pattern.confidence * 100
				).toFixed(0)}%)\n`;
			}
			report += `\n`;
		}

		if (result.trends.length > 0) {
			report += `## Trends (${result.trends.length})\n\n`;
			for (const trend of result.trends) {
				report += `- **${trend.metric}**: ${
					trend.direction
				} trend (strength: ${trend.strength.toFixed(2)})\n`;
			}
			report += `\n`;
		}

		if (result.insights.length > 0) {
			report += `## Insights (${result.insights.length})\n\n`;
			for (const insight of result.insights) {
				report += `### ${insight.category}\n`;
				report += `${insight.insight}\n\n`;
			}
		}

		return report;
	}

	/**
	 * Load settings from storage
	 */
	async loadSettings() {
		const loadedData = await this.loadData();

		// Start with default settings
		this.settings = Object.assign({}, DEFAULT_SETTINGS);

		if (loadedData) {
			// Merge loaded settings
			this.settings = Object.assign(this.settings, loadedData);

			// Migration logic for existing users
			await this.migrateSettings(loadedData);
		}
	}

	/**
	 * Migrate settings for existing users
	 * @param loadedData - The raw data loaded from storage
	 */
	private async migrateSettings(
		loadedData: Record<string, unknown>
	): Promise<void> {
		let needsSave = false;

		// Migration: Convert old journalFolder to new periodicNoteFolders array
		if (loadedData.journalFolder && !loadedData.periodicNoteFolders) {
			const { journalFolder } = loadedData;
			if (typeof journalFolder === "string") {
				const oldFolder = journalFolder.trim();
				if (oldFolder) {
					this.settings.periodicNoteFolders = [oldFolder];
					await this.showInfo(
						`Settings migrated: Journal folder "${oldFolder}" converted to new format`,
						"migrateSettings"
					);
				} else {
					this.settings.periodicNoteFolders = [];
				}
				needsSave = true;
			}
		}

		// Ensure periodicNoteFolders is always an array
		if (!Array.isArray(this.settings.periodicNoteFolders)) {
			this.settings.periodicNoteFolders = [];
			needsSave = true;
		}

		// Clean up any empty strings in the array
		const cleanedFolders = this.settings.periodicNoteFolders.filter(
			(folder) =>
				folder && typeof folder === "string" && folder.trim().length > 0
		);

		if (
			cleanedFolders.length !== this.settings.periodicNoteFolders.length
		) {
			this.settings.periodicNoteFolders = cleanedFolders;
			needsSave = true;
		}

		// Save migrated settings
		if (needsSave) {
			await this.saveSettings();
		}
	}

	/**
	 * Save settings to storage
	 */
	async saveSettings() {
		// Validate and clean settings before saving
		this.validateSettings();

		await this.saveData(this.settings);

		// Update service configurations with new settings
		await this.updateServiceConfigurations();

		// Reconfigure auto-scan when settings change
		this.setupAutoScan();
	}

	/**
	 * Validate and clean settings before saving
	 */
	private validateSettings(): void {
		// Ensure periodicNoteFolders is always an array
		if (!Array.isArray(this.settings.periodicNoteFolders)) {
			this.settings.periodicNoteFolders = [];
		}

		// Clean up empty strings and ensure all entries are valid strings
		this.settings.periodicNoteFolders = this.settings.periodicNoteFolders
			.filter((folder) => folder && typeof folder === "string")
			.map((folder) => folder.trim())
			.filter((folder) => folder.length > 0);

		// Ensure other required settings have defaults
		if (
			typeof this.settings.daysToInclude !== "number" ||
			this.settings.daysToInclude < 1
		) {
			this.settings.daysToInclude = DEFAULT_SETTINGS.daysToInclude;
		}

		if (typeof this.settings.excludePrivate !== "boolean") {
			this.settings.excludePrivate = DEFAULT_SETTINGS.excludePrivate;
		}

		if (!this.settings.openaiModel) {
			this.settings.openaiModel = DEFAULT_SETTINGS.openaiModel;
		}

		if (
			!this.settings.reflectionFolder ||
			this.settings.reflectionFolder.trim() === ""
		) {
			this.settings.reflectionFolder = DEFAULT_SETTINGS.reflectionFolder;
		}
	}

	/**
	 * Get default settings for settings UI
	 */
	public getDefaultSettings(): JournalReflectionSettings {
		return DEFAULT_SETTINGS;
	}

	/**
	 * Get decrypted API key
	 */
	private async getDecryptedApiKey(): Promise<string> {
		if (!this.settings.openaiApiKey) {
			return "";
		}

		// If encryption is not enabled, return the key as-is
		if (!this.settings.encryptionEnabled) {
			return typeof this.settings.openaiApiKey === "string"
				? this.settings.openaiApiKey
				: "";
		}

		// If encryption is enabled but no master password is set, prompt for it
		if (!this.masterPassword) {
			const password = await this.promptForMasterPassword();
			if (!password) {
				return "";
			}
			this.masterPassword = password;
		}

		// Decrypt the API key
		try {
			const encryptionService =
				this.serviceManager.resolve<EncryptionService>(
					"encryptionService"
				);
			const encryptedData = this.settings.openaiApiKey as EncryptedData;
			return await encryptionService.decrypt(
				encryptedData,
				this.masterPassword
			);
		} catch (error) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.USER,
					ErrorCode.ENCRYPTION_ERROR,
					"Failed to decrypt API key. Please check your master password.",
					"Failed to decrypt API key. Please check your master password.",
					{
						operation: "getDecryptedApiKey",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "getDecryptedApiKey",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
			this.masterPassword = null;
			return "";
		}
	}

	/**
	 * Encrypt and store API key
	 */
	private async encryptAndStoreApiKey(
		apiKey: string,
		masterPassword: string
	): Promise<void> {
		if (!apiKey) {
			this.settings.openaiApiKey = "";
			return;
		}

		try {
			const encryptionService =
				this.serviceManager.resolve<EncryptionService>(
					"encryptionService"
				);
			const encryptedData = await encryptionService.encrypt(
				apiKey,
				masterPassword
			);
			this.settings.openaiApiKey = encryptedData;
			this.settings.encryptionEnabled = true;
			this.masterPassword = masterPassword;
		} catch (error) {
			throw new Error(`Failed to encrypt API key: ${error.message}`);
		}
	}

	/**
	 * Prompt user for master password
	 */
	private async promptForMasterPassword(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new MasterPasswordModal(this.app, (password) => {
				resolve(password);
			});
			modal.open();
		});
	}

	/**
	 * Setup encryption for the first time
	 */
	async setupEncryption(): Promise<boolean> {
		return new Promise((resolve) => {
			const errorHandler =
				this.serviceManager.resolve<ErrorHandlingService>(
					"errorHandlingService"
				);
			const modal = new EncryptionSetupModal(
				this.app,
				async (password, apiKey) => {
					if (password && apiKey) {
						try {
							await this.encryptAndStoreApiKey(apiKey, password);
							this.settings.encryptionSetup = true;
							await this.saveSettings();
							await this.showInfo(
								"Encryption setup completed successfully!",
								"setupEncryption"
							);
							resolve(true);
						} catch (error) {
							await this.errorHandler?.handleError(
								error instanceof Error
									? error
									: new Error(String(error)),
								{
									operation: "setupEncryption",
									component: "JournalReflectionPlugin",
									timestamp: Date.now(),
								}
							);
							resolve(false);
						}
					} else {
						resolve(false);
					}
				},
				errorHandler
			);
			modal.open();
		});
	}

	/**
	 * Disable encryption and convert to plain text
	 */
	async disableEncryption(): Promise<void> {
		if (!this.settings.encryptionEnabled) {
			return;
		}

		const apiKey = await this.getDecryptedApiKey();
		if (apiKey) {
			this.settings.openaiApiKey = apiKey;
			this.settings.encryptionEnabled = false;
			this.masterPassword = null;
			await this.saveSettings();
			await this.showInfo(
				"Encryption disabled. API key is now stored in plain text.",
				"disableEncryption"
			);
		}
	}

	/**
	 * Get the interval in milliseconds for the auto-scan
	 * @returns {number}
	 * @description
	 * This function returns the interval in milliseconds for the auto-scan.
	 * It returns 24 hours for daily scans and 7 days for weekly scans.
	 */
	private getAutoScanIntervalMs(): number {
		return this.settings.scanFrequency === "daily"
			? 24 * 60 * 60 * 1000
			: 7 * 24 * 60 * 60 * 1000;
	}

	/**
	 * Setup automatic scanning based on settings
	 */
	private setupAutoScan(): void {
		this.clearAutoScan();

		if (
			!this.settings.enableAutoScan ||
			this.settings.scanFrequency === "manual"
		) {
			return;
		}

		const intervalMs = this.getAutoScanIntervalMs();

		this.autoScanInterval = setInterval(async () => {
			if (this.shouldRunAutoScan()) {
				await this.runAutoScan();
			}
		}, intervalMs);

		// Register the interval for cleanup
		this.registerInterval(this.autoScanInterval as unknown as number);

		// Trigger immediate scan on setup if conditions are met
		if (this.shouldRunAutoScan()) {
			// Use setTimeout to avoid blocking the plugin load
			setTimeout(() => {
				this.runAutoScan();
			}, 5000); // Wait 5 seconds after plugin load
		}
	}

	/**
	 * Clear automatic scanning
	 */
	private clearAutoScan(): void {
		if (this.autoScanInterval) {
			clearInterval(this.autoScanInterval);
			this.autoScanInterval = null;
		}
	}

	/**
	 * Check if auto-scan should run
	 */
	private shouldRunAutoScan(): boolean {
		const now = Date.now();
		const intervalMs =
			this.settings.scanFrequency === "daily"
				? 24 * 60 * 60 * 1000
				: 7 * 24 * 60 * 60 * 1000;
		// If lastAutoScan is not set, initialize it and skip the first scan
		if (!this.settings.lastAutoScan) {
			this.settings.lastAutoScan = now;
			return false;
		}
		return now - this.settings.lastAutoScan >= intervalMs;
	}

	/**
	 * Run automatic scan
	 * @returns {Promise<void>}
	 * @description
	 * This function runs the automatic scan.
	 * It checks if the auto-scan is already running and returns if it is.
	 * It then saves the last auto-scan time and runs the comprehensive analysis.
	 * It finally sets the auto-scan running flag to false.
	 */
	public async runAutoScan(): Promise<void> {
		if (this.isAutoScanRunning) {
			return;
		}
		this.isAutoScanRunning = true;
		try {
			this.settings.lastAutoScan = Date.now();
			await this.saveSettings();

			// Run comprehensive analysis by default
			await this.performComprehensiveAnalysis();

			new Notice("Auto-scan completed successfully");
		} catch (error) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.USER,
					ErrorCode.API_RESPONSE_ERROR,
					"Auto-scan failed",
					"Auto-scan failed. Please check your settings and try again.",
					{
						operation: "Auto-scan",
						component: "JournalReflectionPlugin",
						timestamp: Date.now(),
					}
				),
				{
					operation: "Auto-scan",
					component: "JournalReflectionPlugin",
					timestamp: Date.now(),
				}
			);
		} finally {
			this.isAutoScanRunning = false;
		}
	}
}
