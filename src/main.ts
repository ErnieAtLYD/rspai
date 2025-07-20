// src/main.ts

import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	moment,
	TFolder
} from "obsidian";

import { MasterPasswordModal, EncryptionSetupModal, EncryptionManagementModal } from "./modals";

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
	NLPAnalysisConfig
} from "./services";

interface JournalReflectionSettings {
	// LLM Provider Settings
	llmProvider: 'openai' | 'ollama';
	// OpenAI Settings
	openaiApiKey: string | EncryptedData;
	openaiModel: string;
	// Ollama Settings
	ollamaBaseUrl: string;
	ollamaModel: string;
	ollamaTimeout: number;
	// General Settings
	daysToInclude: number;
	excludePrivate: boolean;
	periodicNoteFolders: string[];
	reflectionFolder: string;
	encryptionEnabled?: boolean;
	encryptionSetup?: boolean;
	analysisEnabled?: boolean;
	patternThreshold?: number;
	enableTrendAnalysis?: boolean;
	enableSemanticAnalysis?: boolean;
	cacheAnalysisResults?: boolean;
	enableAdvancedNLP?: boolean;
	nlpAnalysisDepth?: 'basic' | 'moderate' | 'deep';
	blockerDetectionSensitivity?: 'low' | 'medium' | 'high';
	// Analysis Scope Settings
	enabledAnalysisScopes?: boolean;
	analysisScope?: 'whole-life' | 'work-only' | 'custom';
	customAnalysisScope?: {
		name: string;
		includeKeywords: string[];
		excludeKeywords: string[];
		includeFolders: string[];
		excludeFolders: string[];
		includeTags: string[];
		excludeTags: string[];
	};
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MAX_TOKENS = 1000;
const OPENAI_TEMPERATURE = 0.7;

const DEFAULT_SETTINGS: JournalReflectionSettings = {
	// LLM Provider Settings
	llmProvider: 'openai',
	// OpenAI Settings
	openaiApiKey: "",
	openaiModel: OPENAI_MODEL,
	// Ollama Settings
	ollamaBaseUrl: "http://localhost:11434",
	ollamaModel: "llama3.1:8b",
	ollamaTimeout: 30000,
	// General Settings
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
	nlpAnalysisDepth: 'moderate',
	blockerDetectionSensitivity: 'medium',
	// Analysis Scope Settings
	enabledAnalysisScopes: false,
	analysisScope: 'whole-life',
	customAnalysisScope: {
		name: '',
		includeKeywords: [],
		excludeKeywords: [],
		includeFolders: [],
		excludeFolders: [],
		includeTags: [],
		excludeTags: []
	}
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
	serviceManager: ServiceManager;
	private masterPassword: string | null = null;
	public errorHandler: ErrorHandlingService;

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
	}

	/**
	 * Register all services with the service manager
	 */
	private async registerServices(): Promise<void> {
		// Register error handling service first
		this.serviceManager.register('errorHandlingService', {
			implementation: (serviceManager: ServiceManager) => {
				const config: ErrorHandlingConfig = {
					maxRetries: 3,
					baseRetryDelay: 1000,
					enableLogging: true,
					enableNotifications: true
				};
				return new ErrorHandlingService(this.app, config);
			},
			dependencies: [],
			singleton: true
		});

		// Register encryption service
		this.serviceManager.register('encryptionService', {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				const config: EncryptionConfig = {
					iterations: 100000,
					keyLength: 256
				};
				return new EncryptionService(this.app, config, errorHandler);
			},
			dependencies: ['errorHandlingService'],
			singleton: true
		});

		// Register cache service
		this.serviceManager.register('cacheService', {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				const config: CacheConfig = {
					defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
					maxSize: 1000,
					persistToDisk: true,
					cleanupInterval: 5 * 60 * 1000, // 5 minutes
					// Batched write configuration
					batchWrites: true,
					batchInterval: 2000, // 2 seconds
					maxBatchSize: 50, // operations
					writeMode: 'batched'
				};
				return new CacheService(this.app, errorHandler, config, this.manifest.id);
			},
			dependencies: ['errorHandlingService'],
			singleton: true
		});

		// Register AI service
		this.serviceManager.register('aiService', {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				const config: AIServiceConfig = {
					provider: this.settings.llmProvider,
					apiKey: "", // Will be set when needed
					model: this.settings.llmProvider === 'openai' ? this.settings.openaiModel : this.settings.ollamaModel,
					maxTokens: OPENAI_MAX_TOKENS,
					temperature: OPENAI_TEMPERATURE,
					apiUrl: this.settings.llmProvider === 'openai' ? OPENAI_API_URL : this.settings.ollamaBaseUrl,
					timeout: this.settings.llmProvider === 'ollama' ? this.settings.ollamaTimeout : undefined
				};
				return new AIService(this.app, config, errorHandler);
			},
			dependencies: ['errorHandlingService'],
			singleton: true
		});

		// Register file operations service
		this.serviceManager.register('fileOperationsService', {
			implementation: (serviceManager: ServiceManager) => {
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				const config: FileOperationsConfig = {
					daysToInclude: this.settings.daysToInclude,
					excludePrivate: this.settings.excludePrivate,
					periodicNoteFolders: this.settings.periodicNoteFolders,
					reflectionFolder: this.settings.reflectionFolder,
					enabledAnalysisScopes: this.settings.enabledAnalysisScopes,
					analysisScope: this.settings.analysisScope,
					customAnalysisScope: this.settings.customAnalysisScope
				};
				return new FileOperationsService(this.app, config, errorHandler);
			},
			dependencies: ['errorHandlingService'],
			singleton: true
		});

		// Register NLP analysis service
		this.serviceManager.register('nlpAnalysisService', {
			implementation: (serviceManager: ServiceManager) => {
				const cacheService = serviceManager.resolve<CacheService>('cacheService');
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				const config: NLPAnalysisConfig = {
					cacheService,
					errorHandler,
					enableEntityRecognition: true,
					enableAdvancedSentiment: true,
					themeExtractionDepth: this.settings.nlpAnalysisDepth || 'moderate',
					blockerDetectionSensitivity: this.settings.blockerDetectionSensitivity || 'medium'
				};
				return new NLPAnalysisService(this.app, config);
			},
			dependencies: ['cacheService', 'errorHandlingService'],
			singleton: true
		});

		// Register pattern recognition service
		this.serviceManager.register('patternRecognitionService', {
			implementation: (serviceManager: ServiceManager) => {
				const aiService = serviceManager.resolve<AIService>('aiService');
				const cacheService = serviceManager.resolve<CacheService>('cacheService');
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				const nlpService = this.settings.enableAdvancedNLP ? 
					serviceManager.resolve<NLPAnalysisService>('nlpAnalysisService') : undefined;
				const config: PatternRecognitionConfig = {
					aiService,
					cacheService,
					errorHandler,
					nlpService,
					analysisDepth: 'medium',
					patternThreshold: this.settings.patternThreshold || 0.6,
					enableTrendAnalysis: this.settings.enableTrendAnalysis ?? true,
					enableSemanticAnalysis: this.settings.enableSemanticAnalysis ?? true,
					enableAdvancedNLP: this.settings.enableAdvancedNLP ?? true
				};
				return new PatternRecognitionService(this.app, config);
			},
			dependencies: this.settings.enableAdvancedNLP ? 
				['aiService', 'cacheService', 'errorHandlingService', 'nlpAnalysisService'] :
				['aiService', 'cacheService', 'errorHandlingService'],
			singleton: true
		});

		// Register analysis manager
		this.serviceManager.register('analysisManager', {
			implementation: (serviceManager: ServiceManager) => {
				const aiService = serviceManager.resolve<AIService>('aiService');
				const fileOperationsService = serviceManager.resolve<FileOperationsService>('fileOperationsService');
				const cacheService = serviceManager.resolve<CacheService>('cacheService');
				const patternRecognitionService = serviceManager.resolve<PatternRecognitionService>('patternRecognitionService');
				const errorHandler = serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
				
				const config: AnalysisManagerConfig = {
					aiService,
					fileOperationsService,
					cacheService,
					patternRecognitionService,
					errorHandler,
					defaultOptions: {
						useCache: true,
						depth: 'medium',
						includePredictions: false,
						generateSummary: true
					}
				};
				return new AnalysisManager(this.app, config);
			},
			dependencies: ['aiService', 'fileOperationsService', 'cacheService', 'patternRecognitionService', 'errorHandlingService'],
			singleton: true
		});

		// Initialize all services
		await this.serviceManager.initializeAll();
		
		// Get error handler reference for easy access (already set in ServiceManager during initializeAll)
		this.errorHandler = this.serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
	}

	/**
	 * Update service configurations when settings change
	 */
	async updateServiceConfigurations(): Promise<void> {
		if (!this.serviceManager) return;

		// Update AI service configuration
		if (this.serviceManager.has('aiService')) {
			const aiService = this.serviceManager.resolve<AIService>('aiService');
			const config: AIServiceConfig = {
				provider: this.settings.llmProvider,
				apiKey: await this.getDecryptedApiKey(),
				model: this.settings.llmProvider === 'openai' ? this.settings.openaiModel : this.settings.ollamaModel,
				maxTokens: OPENAI_MAX_TOKENS,
				temperature: OPENAI_TEMPERATURE,
				apiUrl: this.settings.llmProvider === 'openai' ? OPENAI_API_URL : this.settings.ollamaBaseUrl,
				timeout: this.settings.llmProvider === 'ollama' ? this.settings.ollamaTimeout : undefined
			};
			aiService.updateConfig(config);
		}

		// Update file operations service configuration
		if (this.serviceManager.has('fileOperationsService')) {
			const fileOpsService = this.serviceManager.resolve<FileOperationsService>('fileOperationsService');
			fileOpsService.updateConfig({
				daysToInclude: this.settings.daysToInclude,
				excludePrivate: this.settings.excludePrivate,
				periodicNoteFolders: this.settings.periodicNoteFolders,
				reflectionFolder: this.settings.reflectionFolder,
				enabledAnalysisScopes: this.settings.enabledAnalysisScopes,
				analysisScope: this.settings.analysisScope,
				customAnalysisScope: this.settings.customAnalysisScope
			});
		}
	}

	/**
	 * Cleanup when plugin unloads
	 */
	async onunload() {
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
				{ operation, component: 'JournalReflectionPlugin', timestamp: Date.now() },
				true,
				false
			),
			{ operation, component: 'JournalReflectionPlugin', timestamp: Date.now() },
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
					{ operation: 'validateApiKey', component: 'JournalReflectionPlugin', timestamp: Date.now() },
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
					{ operation: 'validateAnalysisPrerequisites', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				),
				{ operation: 'validateAnalysisPrerequisites', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
			return false;
		}

		if (!await this.validateApiKey()) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.USER,
					ErrorCode.API_KEY_INVALID,
					"Please configure your OpenAI API key first",
					"Please configure your OpenAI API key first",
					{ operation: 'validateAnalysisPrerequisites', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				),
				{ operation: 'validateAnalysisPrerequisites', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
			return false;
		}

		// Check if critical services are available
		if (!this.serviceManager.has('fileOperationsService')) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.CRITICAL,
					ErrorCode.SERVICE_UNAVAILABLE,
					"File operations service not available",
					"File operations service not available",
					{ operation: 'validateAnalysisPrerequisites', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				),
				{ operation: 'validateAnalysisPrerequisites', component: 'JournalReflectionPlugin', timestamp: Date.now() }
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
					{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				),
				{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
			return;
		}

		await this.showInfo("Creating weekly journal summary...", 'createWeeklySummary');

		try {
			// Get services with fallback handling
			const fileOpsService = this.serviceManager.resolve<FileOperationsService>('fileOperationsService');
			const aiService = this.serviceManager.resolve<AIService>('aiService');

			// Find recent notes
			const recentNotes = await fileOpsService.findRecentNotes();

			if (recentNotes.length === 0) {
				await this.errorHandler?.handleError(
					new RetrospectError(
						ErrorType.USER,
						ErrorCode.NO_CONTENT_FOUND,
						"No journal entries found in the last week.",
						"No journal entries found in the last week.",
						{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() }
					),
					{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				);
				return;
			}

			// Get content from notes
			const notesContent = await fileOpsService.getNotesContent(recentNotes);

			if (notesContent.trim().length === 0) {
				await this.errorHandler?.handleError(
					new RetrospectError(
						ErrorType.USER,
						ErrorCode.NO_CONTENT_FOUND,
						"No content found in recent notes (all may be private).",
						"No content found in recent notes (all may be private).",
						{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() }
					),
					{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				);
				return;
			}

			// Generate summary with AI service
			const summary = await aiService.generateSummary(notesContent, recentNotes);

			// Create summary note
			const summaryFile = await fileOpsService.createSummaryNote(summary, recentNotes);

			// Open the summary file
			this.app.workspace.getLeaf().openFile(summaryFile);

			await this.showInfo("Weekly journal summary created!", 'createWeeklySummary');
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{ operation: 'createWeeklySummary', component: 'JournalReflectionPlugin', timestamp: Date.now() },
				{ showNotice: true }
			);
		}
	}

	/**
	 * Analyze journal patterns
	 */
	async analyzePatterns(): Promise<void> {
		if (!await this.validateAnalysisPrerequisites()) {
			return;
		}

		await this.showInfo("Analyzing journal patterns...", 'analyzePatterns');

		try {
			// Check if analysis service is available
			if (!this.serviceManager.has('analysisManager')) {
				await this.errorHandler?.handleError(
					new RetrospectError(
						ErrorType.CRITICAL,
						ErrorCode.SERVICE_UNAVAILABLE,
						"Analysis service not available. Pattern analysis disabled.",
						"Analysis service not available. Pattern analysis disabled.",
						{ operation: 'analyzePatterns', component: 'JournalReflectionPlugin', timestamp: Date.now() }
					),
					{ operation: 'analyzePatterns', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				);
				return;
			}

			const analysisManager = this.serviceManager.resolve<AnalysisManager>('analysisManager');
			const patterns = await analysisManager.analyzePatterns(7);

			if (patterns.length === 0) {
				await this.showInfo("No significant patterns detected in recent entries.", 'analyzePatterns');
				return;
			}

			// Create patterns report
			const report = this.formatPatternsReport(patterns);
			const fileName = `Pattern Analysis - ${moment().format('YYYY-MM-DD HH-mm')}`;
			const fileOpsService = this.serviceManager.resolve<FileOperationsService>('fileOperationsService');
			const reportFile = await fileOpsService.createAnalysisReport(fileName, report);

			this.app.workspace.getLeaf().openFile(reportFile);
			await this.showInfo(`Found ${patterns.length} patterns - report created!`, 'analyzePatterns');
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{ operation: 'analyzePatterns', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
		}
	}

	/**
	 * Analyze journal trends
	 */
	async analyzeTrends(): Promise<void> {
		if (!await this.validateAnalysisPrerequisites()) {
			return;
		}

		await this.showInfo("Analyzing journal trends...", 'analyzeTrends');

		try {
			const analysisManager = this.serviceManager.resolve<AnalysisManager>('analysisManager');
			const trends = await analysisManager.analyzeTrends(14);

			if (trends.length === 0) {
				await this.showInfo("No significant trends detected in recent entries.", 'analyzeTrends');
				return;
			}

			// Create trends report
			const report = this.formatTrendsReport(trends);
			const fileName = `Trend Analysis - ${moment().format('YYYY-MM-DD HH-mm')}`;
			const fileOpsService = this.serviceManager.resolve<FileOperationsService>('fileOperationsService');
			const reportFile = await fileOpsService.createAnalysisReport(fileName, report);

			this.app.workspace.getLeaf().openFile(reportFile);
			await this.showInfo(`Found ${trends.length} trends - report created!`, 'analyzeTrends');
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{ operation: 'analyzeTrends', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
		}
	}

	/**
	 * Perform comprehensive analysis
	 */
	async performComprehensiveAnalysis(): Promise<void> {
		if (!await this.validateAnalysisPrerequisites()) {
			return;
		}

		await this.showInfo("Performing comprehensive analysis...", 'performComprehensiveAnalysis');

		try {
			const analysisManager = this.serviceManager.resolve<AnalysisManager>('analysisManager');
			const result = await analysisManager.analyzeJournalEntries(7, { 
				generateSummary: true, 
				depth: 'deep' 
			});

			// Create comprehensive report
			const report = this.formatComprehensiveReport(result);
			const fileName = `Comprehensive Analysis - ${moment().format('YYYY-MM-DD HH-mm')}`;
			const fileOpsService = this.serviceManager.resolve<FileOperationsService>('fileOperationsService');
			const reportFile = await fileOpsService.createAnalysisReport(fileName, report);

			this.app.workspace.getLeaf().openFile(reportFile);
			await this.showInfo(`Analysis complete! Confidence: ${(result.confidence * 100).toFixed(0)}%`, 'performComprehensiveAnalysis');
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{ operation: 'performComprehensiveAnalysis', component: 'JournalReflectionPlugin', timestamp: Date.now() }
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
					{ operation: 'clearAnalysisCache', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				),
				{ operation: 'clearAnalysisCache', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
			return;
		}

		try {
			const analysisManager = this.serviceManager.resolve<AnalysisManager>('analysisManager');
			await analysisManager.clearAnalysisCache();
		} catch (error) {
			await this.errorHandler.handleError(
				error instanceof Error ? error : new Error(String(error)),
				{ operation: 'clearAnalysisCache', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
		}
	}

	private formatPatternsReport(patterns: PatternData[]): string {
		let report = `# Journal Pattern Analysis\n\n`;
		report += `Generated: ${moment().format('YYYY-MM-DD HH:mm')}\n\n`;
		report += `## Detected Patterns (${patterns.length})\n\n`;

		for (const pattern of patterns) {
			report += `### ${pattern.type.replace('_', ' ').toUpperCase()}\n`;
			report += `- **Confidence**: ${(pattern.confidence * 100).toFixed(0)}%\n`;
			report += `- **Description**: ${pattern.description}\n`;
			if (pattern.metadata?.keywords && Array.isArray(pattern.metadata.keywords)) {
				report += `- **Keywords**: ${pattern.metadata.keywords.join(', ')}\n`;
			}
			report += `\n`;
		}

		return report;
	}

	private formatTrendsReport(trends: TrendData[]): string {
		let report = `# Journal Trend Analysis\n\n`;
		report += `Generated: ${moment().format('YYYY-MM-DD HH:mm')}\n\n`;
		report += `## Detected Trends (${trends.length})\n\n`;

		for (const trend of trends) {
			report += `### ${trend.metric.replace('_', ' ').toUpperCase()}\n`;
			report += `- **Direction**: ${trend.direction}\n`;
			report += `- **Strength**: ${trend.strength.toFixed(2)}\n`;
			report += `- **Data Points**: ${trend.timePoints.length}\n`;
			report += `\n`;
		}

		return report;
	}

	private formatComprehensiveReport(result: AnalysisResult): string {
		let report = `# Comprehensive Journal Analysis\n\n`;
		report += `Generated: ${moment().format('YYYY-MM-DD HH:mm')}\n`;
		report += `Time Range: ${result.timeRange}\n`;
		report += `Overall Confidence: ${(result.confidence * 100).toFixed(0)}%\n\n`;

		if (result.summary) {
			report += `## Summary\n\n${result.summary}\n\n`;
		}

		if (result.patterns.length > 0) {
			report += `## Patterns (${result.patterns.length})\n\n`;
			for (const pattern of result.patterns) {
				report += `- **${pattern.type}**: ${pattern.description} (${(pattern.confidence * 100).toFixed(0)}%)\n`;
			}
			report += `\n`;
		}

		if (result.trends.length > 0) {
			report += `## Trends (${result.trends.length})\n\n`;
			for (const trend of result.trends) {
				report += `- **${trend.metric}**: ${trend.direction} trend (strength: ${trend.strength.toFixed(2)})\n`;
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
						'migrateSettings'
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
	 * Get decrypted API key
	 */
	private async getDecryptedApiKey(): Promise<string> {
		if (!this.settings.openaiApiKey) {
			return "";
		}

		// If encryption is not enabled, return the key as-is
		if (!this.settings.encryptionEnabled) {
			return typeof this.settings.openaiApiKey === 'string' ? this.settings.openaiApiKey : "";
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
			const encryptionService = this.serviceManager.resolve<EncryptionService>('encryptionService');
			const encryptedData = this.settings.openaiApiKey as EncryptedData;
			return await encryptionService.decrypt(encryptedData, this.masterPassword);
		} catch (error) {
			await this.errorHandler?.handleError(
				new RetrospectError(
					ErrorType.USER,
					ErrorCode.ENCRYPTION_ERROR,
					"Failed to decrypt API key. Please check your master password.",
					"Failed to decrypt API key. Please check your master password.",
					{ operation: 'getDecryptedApiKey', component: 'JournalReflectionPlugin', timestamp: Date.now() }
				),
				{ operation: 'getDecryptedApiKey', component: 'JournalReflectionPlugin', timestamp: Date.now() }
			);
			this.masterPassword = null;
			return "";
		}
	}

	/**
	 * Encrypt and store API key
	 */
	private async encryptAndStoreApiKey(apiKey: string, masterPassword: string): Promise<void> {
		if (!apiKey) {
			this.settings.openaiApiKey = "";
			return;
		}

		try {
			const encryptionService = this.serviceManager.resolve<EncryptionService>('encryptionService');
			const encryptedData = await encryptionService.encrypt(apiKey, masterPassword);
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
			const errorHandler = this.serviceManager.resolve<ErrorHandlingService>('errorHandlingService');
			const modal = new EncryptionSetupModal(this.app, async (password, apiKey) => {
				if (password && apiKey) {
					try {
						await this.encryptAndStoreApiKey(apiKey, password);
						this.settings.encryptionSetup = true;
						await this.saveSettings();
						await this.showInfo("Encryption setup completed successfully!", 'setupEncryption');
						resolve(true);
					} catch (error) {
						await this.errorHandler?.handleError(
							error instanceof Error ? error : new Error(String(error)),
							{ operation: 'setupEncryption', component: 'JournalReflectionPlugin', timestamp: Date.now() }
						);
						resolve(false);
					}
				} else {
					resolve(false);
				}
			}, errorHandler);
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
			await this.showInfo("Encryption disabled. API key is now stored in plain text.", 'disableEncryption');
		}
	}
}

/**
 * Setting tab for the plugin
 * @param app - The Obsidian app
 * @param plugin - The plugin instance
 * @returns {void}
 * @description
 * This class is used to display the settings tab for the plugin.
 */
class JournalReflectionSettingTab extends PluginSettingTab {
	plugin: JournalReflectionPlugin;
	private journalFolderSetting: Setting | null = null;
	private reflectionFolderSetting: Setting | null = null;

	constructor(app: App, plugin: JournalReflectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Helper function to ensure customAnalysisScope is initialized
	 * Reduces duplication in the settings UI
	 */
	private ensureCustomAnalysisScope(): void {
		if (!this.plugin.settings.customAnalysisScope) {
			this.plugin.settings.customAnalysisScope = {
				name: DEFAULT_SETTINGS.customAnalysisScope!.name,
				includeKeywords: [...DEFAULT_SETTINGS.customAnalysisScope!.includeKeywords],
				excludeKeywords: [...DEFAULT_SETTINGS.customAnalysisScope!.excludeKeywords],
				includeFolders: [...DEFAULT_SETTINGS.customAnalysisScope!.includeFolders],
				excludeFolders: [...DEFAULT_SETTINGS.customAnalysisScope!.excludeFolders],
				includeTags: [...DEFAULT_SETTINGS.customAnalysisScope!.includeTags],
				excludeTags: [...DEFAULT_SETTINGS.customAnalysisScope!.excludeTags]
			};
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Journal Reflection Settings" });

		// Security Section
		containerEl.createEl("h3", { text: "Security" });
		
		// Encryption status and management
		const encryptionStatus = this.plugin.settings.encryptionEnabled ? "🔒 Encrypted" : "🔓 Plain Text";
		new Setting(containerEl)
			.setName("API Key Storage")
			.setDesc(`Current status: ${encryptionStatus}. Click to manage encryption settings.`)
			.addButton((btn) => {
				btn.setButtonText("Manage Encryption")
					.onClick(() => {
						const modal = new EncryptionManagementModal(this.app, this.plugin, () => {
							// Refresh the settings display after modal closes
							this.display();
						}, this.plugin.errorHandler);
						modal.open();
					});
			});

		// API Key (only show for OpenAI)
		if (this.plugin.settings.llmProvider === 'openai') {
			const apiKeySetting = new Setting(containerEl)
				.setName("OpenAI API Key")
				.setDesc(this.plugin.settings.encryptionEnabled ? 
					"Your API key is encrypted. Use 'Manage Encryption' to modify." : 
					"Your OpenAI API key for generating reflections (stored in plain text)");
			
		if (!this.plugin.settings.encryptionEnabled) {
			apiKeySetting.addText((text) => {
				text.setPlaceholder("sk-...")
					.setValue(typeof this.plugin.settings.openaiApiKey === 'string' ? this.plugin.settings.openaiApiKey : "")
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});
		} else {
			apiKeySetting.addText((text) => {
				text.setPlaceholder("[Encrypted]")
					.setValue("[Encrypted]")
					.setDisabled(true);
			});
		}
		
		// Security warning for plain text storage
		if (!this.plugin.settings.encryptionEnabled) {
			const warningEl = containerEl.createDiv({ cls: "setting-item-description" });
			warningEl.style.color = "var(--text-warning)";
			warningEl.createSpan({ text: "⚠️ " });
			warningEl.createEl("strong", { text: "Security Warning:" });
			warningEl.createSpan({ text: " Your API key is stored in plain text. Consider enabling encryption for better security." });
		}
	}
		
		containerEl.createEl("h3", { text: "AI Configuration" });

		// LLM Provider selection
		new Setting(containerEl)
			.setName("LLM Provider")
			.setDesc("Choose your preferred AI provider. OpenAI requires an API key, Ollama runs locally for privacy.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("openai", "OpenAI (Remote)")
					.addOption("ollama", "Ollama (Local)")
					.setValue(this.plugin.settings.llmProvider)
					.onChange(async (value: 'openai' | 'ollama') => {
						this.plugin.settings.llmProvider = value;
						await this.plugin.saveSettings();
						await this.plugin.updateServiceConfigurations();
						this.display(); // Refresh UI to show/hide relevant settings
					})
			);

		// OpenAI Settings (show only when OpenAI is selected)
		if (this.plugin.settings.llmProvider === 'openai') {
			containerEl.createEl("h4", { text: "OpenAI Settings" });

			// Model selection
			new Setting(containerEl)
				.setName("OpenAI Model")
				.setDesc("Which OpenAI model to use")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("gpt-4o-mini", "GPT-4o Mini (Recommended)")
						.addOption("gpt-4o", "GPT-4o")
						.addOption("gpt-3.5-turbo", "GPT-3.5 Turbo")
						.setValue(this.plugin.settings.openaiModel)
						.onChange(async (value) => {
						this.plugin.settings.openaiModel = value;
						await this.plugin.saveSettings();
					})
			);
		}

		// Ollama Settings (show only when Ollama is selected)
		if (this.plugin.settings.llmProvider === 'ollama') {
			containerEl.createEl("h4", { text: "Ollama Settings" });

			// Ollama base URL
			new Setting(containerEl)
				.setName("Ollama Base URL")
				.setDesc("The base URL where Ollama is running (usually http://localhost:11434)")
				.addText((text) =>
					text
						.setPlaceholder("http://localhost:11434")
						.setValue(this.plugin.settings.ollamaBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.ollamaBaseUrl = value;
							await this.plugin.saveSettings();
							await this.plugin.updateServiceConfigurations();
						})
				);

			// Ollama model selection
			new Setting(containerEl)
				.setName("Ollama Model")
				.setDesc("The Ollama model to use (ensure it's downloaded first with 'ollama pull <model>')")
				.addText((text) =>
					text
						.setPlaceholder("llama3.1:8b")
						.setValue(this.plugin.settings.ollamaModel)
						.onChange(async (value) => {
							this.plugin.settings.ollamaModel = value;
							await this.plugin.saveSettings();
							await this.plugin.updateServiceConfigurations();
						})
				);

			// Ollama timeout
			new Setting(containerEl)
				.setName("Request Timeout")
				.setDesc("Timeout for Ollama requests in milliseconds (30000 = 30 seconds)")
				.addText((text) =>
					text
						.setPlaceholder("30000")
						.setValue(this.plugin.settings.ollamaTimeout.toString())
						.onChange(async (value) => {
							const timeout = parseInt(value);
							if (!isNaN(timeout) && timeout > 0) {
								this.plugin.settings.ollamaTimeout = timeout;
								await this.plugin.saveSettings();
								await this.plugin.updateServiceConfigurations();
							}
						})
				);

			// Ollama connection test
			new Setting(containerEl)
				.setName("Test Ollama Connection")
				.setDesc("Test if Ollama is running and the model is available")
				.addButton((btn) =>
					btn
						.setButtonText("Test Connection")
						.onClick(async () => {
							btn.setDisabled(true);
							btn.setButtonText("Testing...");
							
							try {
								const aiService = this.plugin.serviceManager.resolve<AIService>('aiService');
								const success = await aiService.testConnection();
								if (success) {
									btn.setButtonText("✅ Success");
									setTimeout(() => {
										btn.setButtonText("Test Connection");
										btn.setDisabled(false);
									}, 2000);
								} else {
									btn.setButtonText("❌ Failed");
									setTimeout(() => {
										btn.setButtonText("Test Connection");
										btn.setDisabled(false);
									}, 2000);
								}
							} catch (error) {
								btn.setButtonText("❌ Error");
								setTimeout(() => {
									btn.setButtonText("Test Connection");
									btn.setDisabled(false);
								}, 2000);
							}
						})
				);

			// Ollama setup instructions
			const ollamaInfoEl = containerEl.createDiv({ cls: "setting-item-description" });
			ollamaInfoEl.style.color = "var(--text-muted)";
			ollamaInfoEl.createSpan({ text: "💡 " });
			ollamaInfoEl.createEl("strong", { text: "Ollama Setup:" });
			ollamaInfoEl.createSpan({ text: " Download Ollama from " });
			ollamaInfoEl.createEl("a", { 
				text: "ollama.com", 
				href: "https://ollama.com",
				attr: { target: "_blank" }
			});
			ollamaInfoEl.createSpan({ text: ", then run 'ollama pull " + this.plugin.settings.ollamaModel + "' to download the model." });
		}

		containerEl.createEl("h3", { text: "Content Settings" });

		// Periodic note folders path
		this.journalFolderSetting = new Setting(containerEl)
			.setName("Periodic Note Folders")
			.setDesc(
				"Comma-separated paths to your periodic note folders. If folders are found, only those will be searched. If empty or no folders exist, the entire vault will be searched as fallback."
			)
			.addText((text) => {
				text.setPlaceholder("Daily Notes, Journal")
					.setValue(
						this.plugin.settings.periodicNoteFolders?.join(", ") ||
							""
					)
					.onChange(async (value) => {
						// Parse comma-separated values and trim whitespace
						const folders = value
							.split(",")
							.map((f) => f.trim())
							.filter((f) => f.length > 0);
						this.plugin.settings.periodicNoteFolders = folders;
						await this.plugin.saveSettings();
						if (this.journalFolderSetting) {
							this.validateFolderPaths(
								this.journalFolderSetting,
								folders
							);
						}
					});
			});

		// Initial validation using requestAnimationFrame to ensure DOM is ready
		requestAnimationFrame(() => {
			if (this.journalFolderSetting) {
				this.validateFolderPaths(
					this.journalFolderSetting,
					this.plugin.settings.periodicNoteFolders || []
				);
			}
		});

		// Add collapsible help section
		const helpToggle = containerEl.createDiv({
			cls: "setting-item-description journal-reflection-help-toggle",
		});

		const helpLink = helpToggle.createEl("a", {
			href: "#",
			text: "📁 Show folder configuration help",
		});

		const folderHelpEl = containerEl.createDiv({
			cls: "setting-item-description journal-reflection-folder-help",
		});

		// Create help content using DOM API
		const formatLine = folderHelpEl.createDiv();
		formatLine.createEl("strong", { text: "Format:" });
		formatLine.appendText(" ");
		formatLine.createEl("code", {
			text: "Daily Notes, Journal/2024, Work/Logs",
		});

		folderHelpEl.createEl("br");

		const examplesLine = folderHelpEl.createDiv();
		examplesLine.createEl("strong", { text: "Examples:" });
		examplesLine.appendText(" Single: ");
		examplesLine.createEl("code", { text: "Daily Notes" });
		examplesLine.appendText(" | Multiple: ");
		examplesLine.createEl("code", { text: "Daily Notes, Journal" });

		folderHelpEl.createEl("br");

		const behaviorLine = folderHelpEl.createDiv();
		behaviorLine.createEl("strong", { text: "Behavior:" });
		behaviorLine.appendText(
			" Searches specified folders first, falls back to entire vault if none found"
		);

		folderHelpEl.createEl("br");

		const tipsLine = folderHelpEl.createDiv();
		tipsLine.createEl("strong", { text: "Tips:" });
		tipsLine.appendText(
			" Leave empty for vault-wide search • Check validation icon (✓/✗/ℹ) for status"
		);

		helpToggle.addEventListener("click", (e) => {
			e.preventDefault();
			const isVisible = folderHelpEl.classList.contains("visible");
			folderHelpEl.classList.toggle("visible", !isVisible);
			helpLink.textContent = isVisible
				? "📁 Show folder configuration help"
				: "📁 Hide folder configuration help";
		});

		// Reflection output folder
		this.reflectionFolderSetting = new Setting(containerEl)
			.setName("Reflection Output Folder")
			.setDesc(
				"Where to save generated reflections (will be created if it doesn't exist)"
			)
			.addText((text) => {
				text.setPlaceholder("Reflections")
					.setValue(
						this.plugin.settings.reflectionFolder || "Summaries"
					)
					.onChange(async (value) => {
						this.plugin.settings.reflectionFolder = value;
						await this.plugin.saveSettings();
						if (this.reflectionFolderSetting) {
							this.validateOrCreateFolder(
								this.reflectionFolderSetting,
								value
							);
						}
					});
			});

		// Initial validation using requestAnimationFrame to ensure DOM is ready
		requestAnimationFrame(() => {
			if (this.reflectionFolderSetting) {
				this.validateOrCreateFolder(
					this.reflectionFolderSetting,
					this.plugin.settings.reflectionFolder || "Summaries"
				);
			}
		});

		// Days to include
		new Setting(containerEl)
			.setName("Days to Include")
			.setDesc("How many days back to look for journal entries")
			.addSlider((slider) =>
				slider
					.setLimits(1, 30, 1)
					.setValue(this.plugin.settings.daysToInclude)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.daysToInclude = value;
						await this.plugin.saveSettings();
					})
			);

		// Privacy toggle
		new Setting(containerEl)
			.setName("Exclude Private Notes")
			.setDesc("Skip notes that contain #private tag")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.excludePrivate)
					.onChange(async (value) => {
						this.plugin.settings.excludePrivate = value;
						await this.plugin.saveSettings();
					})
			);

		// Analysis Scope Section (Feature Flag)
		if (this.plugin.settings.enabledAnalysisScopes) {
			containerEl.createEl("h3", { text: "Analysis Scope" });

			// Analysis Scope Selection
			new Setting(containerEl)
				.setName("Analysis Scope")
				.setDesc("Choose the scope of analysis to focus on specific areas of your journal")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("whole-life", "Whole Life - Analyze all entries")
						.addOption("work-only", "Work Only - Focus on work-related entries")
						.addOption("custom", "Custom - Define your own scope")
						.setValue(this.plugin.settings.analysisScope || 'whole-life')
						.onChange(async (value: 'whole-life' | 'work-only' | 'custom') => {
							this.plugin.settings.analysisScope = value;
							await this.plugin.saveSettings();
							// Refresh to show/hide custom scope settings
							this.display();
						})
				);

			// Custom Scope Settings (only show if custom is selected)
			if (this.plugin.settings.analysisScope === 'custom') {
				this.ensureCustomAnalysisScope();
				const customScope = this.plugin.settings.customAnalysisScope!;

				// Custom Scope Name
				new Setting(containerEl)
					.setName("Custom Scope Name")
					.setDesc("A descriptive name for your custom analysis scope")
					.addText((text) => {
						text.setPlaceholder("e.g., Health & Wellness, Creative Projects")
							.setValue(customScope.name)
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.name = value;
								await this.plugin.saveSettings();
							});
					});

				// Include Keywords
				new Setting(containerEl)
					.setName("Include Keywords")
					.setDesc("Comma-separated keywords to include in analysis (e.g., work, project, meeting)")
					.addText((text) => {
						text.setPlaceholder("work, project, meeting, deadline")
							.setValue(customScope.includeKeywords.join(', '))
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.includeKeywords = value
									.split(',')
									.map(k => k.trim())
									.filter(k => k.length > 0);
								await this.plugin.saveSettings();
							});
					});

				// Exclude Keywords
				new Setting(containerEl)
					.setName("Exclude Keywords")
					.setDesc("Comma-separated keywords to exclude from analysis (e.g., personal, private)")
					.addText((text) => {
						text.setPlaceholder("personal, private, family")
							.setValue(customScope.excludeKeywords.join(', '))
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.excludeKeywords = value
									.split(',')
									.map(k => k.trim())
									.filter(k => k.length > 0);
								await this.plugin.saveSettings();
							});
					});

				// Include Tags
				new Setting(containerEl)
					.setName("Include Tags")
					.setDesc("Comma-separated tags to include in analysis (without #, e.g., work, project)")
					.addText((text) => {
						text.setPlaceholder("work, project, meeting")
							.setValue(customScope.includeTags.join(', '))
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.includeTags = value
									.split(',')
									.map(k => k.trim())
									.filter(k => k.length > 0);
								await this.plugin.saveSettings();
							});
					});

				// Exclude Tags
				new Setting(containerEl)
					.setName("Exclude Tags")
					.setDesc("Comma-separated tags to exclude from analysis (without #, e.g., personal, private)")
					.addText((text) => {
						text.setPlaceholder("personal, private, family")
							.setValue(customScope.excludeTags.join(', '))
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.excludeTags = value
									.split(',')
									.map(k => k.trim())
									.filter(k => k.length > 0);
								await this.plugin.saveSettings();
							});
					});

				// Include Folders
				new Setting(containerEl)
					.setName("Include Folders")
					.setDesc("Comma-separated folder paths to include in analysis (e.g., Work Notes, Projects)")
					.addText((text) => {
						text.setPlaceholder("Work Notes, Projects, Meetings")
							.setValue(customScope.includeFolders.join(', '))
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.includeFolders = value
									.split(',')
									.map(k => k.trim())
									.filter(k => k.length > 0);
								await this.plugin.saveSettings();
							});
					});

				// Exclude Folders
				new Setting(containerEl)
					.setName("Exclude Folders")
					.setDesc("Comma-separated folder paths to exclude from analysis (e.g., Personal, Private)")
					.addText((text) => {
						text.setPlaceholder("Personal, Private, Family")
							.setValue(customScope.excludeFolders.join(', '))
							.onChange(async (value) => {
								this.ensureCustomAnalysisScope();
								this.plugin.settings.customAnalysisScope!.excludeFolders = value
									.split(',')
									.map(k => k.trim())
									.filter(k => k.length > 0);
								await this.plugin.saveSettings();
							});
					});

				// Scope Preview
				const scopePreview = containerEl.createDiv({ cls: "setting-item-description" });
				scopePreview.createEl("strong", { text: "Custom Scope Preview:" });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Name: " });
				scopePreview.createSpan({ text: customScope.name || 'Unnamed' });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Include Keywords: " });
				scopePreview.createSpan({ text: customScope.includeKeywords.length > 0 ? customScope.includeKeywords.join(', ') : 'None' });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Exclude Keywords: " });
				scopePreview.createSpan({ text: customScope.excludeKeywords.length > 0 ? customScope.excludeKeywords.join(', ') : 'None' });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Include Tags: " });
				scopePreview.createSpan({ text: customScope.includeTags.length > 0 ? customScope.includeTags.map(t => '#' + t).join(', ') : 'None' });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Exclude Tags: " });
				scopePreview.createSpan({ text: customScope.excludeTags.length > 0 ? customScope.excludeTags.map(t => '#' + t).join(', ') : 'None' });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Include Folders: " });
				scopePreview.createSpan({ text: customScope.includeFolders.length > 0 ? customScope.includeFolders.join(', ') : 'None' });
				scopePreview.createEl("br");
				
				scopePreview.createEl("strong", { text: "Exclude Folders: " });
				scopePreview.createSpan({ text: customScope.excludeFolders.length > 0 ? customScope.excludeFolders.join(', ') : 'None' });
			}
		}

		// Advanced NLP Analysis Section
		containerEl.createEl("h3", { text: "Advanced NLP Analysis" });

		// Enable Analysis Scopes Feature Flag
		new Setting(containerEl)
			.setName("Enable Analysis Scopes (Beta)")
			.setDesc("Enable analysis scope settings to focus on specific areas of your journal (work-only, custom filters, etc.)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabledAnalysisScopes ?? false)
					.onChange(async (value) => {
						this.plugin.settings.enabledAnalysisScopes = value;
						await this.plugin.saveSettings();
						// Refresh to show/hide analysis scope settings
						this.display();
					})
			);

		// Enable Advanced NLP
		new Setting(containerEl)
			.setName("Enable Advanced NLP Analysis")
			.setDesc("Use sophisticated natural language processing for deeper insights including productivity themes, blocker detection, and multi-dimensional sentiment analysis")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableAdvancedNLP ?? true)
					.onChange(async (value) => {
						this.plugin.settings.enableAdvancedNLP = value;
						await this.plugin.saveSettings();
						// Refresh to show/hide dependent settings
						this.display();
					})
			);

		// NLP Analysis Depth (only show if advanced NLP is enabled)
		if (this.plugin.settings.enableAdvancedNLP ?? true) {
			new Setting(containerEl)
				.setName("NLP Analysis Depth")
				.setDesc("Choose the depth of NLP analysis: Basic (fast), Moderate (balanced), Deep (comprehensive)")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("basic", "Basic - Fast analysis with core features")
						.addOption("moderate", "Moderate - Balanced depth and performance")
						.addOption("deep", "Deep - Comprehensive analysis (slower)")
						.setValue(this.plugin.settings.nlpAnalysisDepth || 'moderate')
						.onChange(async (value: 'basic' | 'moderate' | 'deep') => {
							this.plugin.settings.nlpAnalysisDepth = value;
							await this.plugin.saveSettings();
						})
				);

			// Blocker Detection Sensitivity
			new Setting(containerEl)
				.setName("Blocker Detection Sensitivity")
				.setDesc("Adjust how sensitive the system is to detecting productivity blockers")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("low", "Low - Only detect obvious blockers")
						.addOption("medium", "Medium - Balanced detection")
						.addOption("high", "High - Detect subtle blockers")
						.setValue(this.plugin.settings.blockerDetectionSensitivity || 'medium')
						.onChange(async (value: 'low' | 'medium' | 'high') => {
							this.plugin.settings.blockerDetectionSensitivity = value;
							await this.plugin.saveSettings();
						})
				);

			// Pattern Recognition Threshold
			new Setting(containerEl)
				.setName("Pattern Recognition Threshold")
				.setDesc("Minimum confidence level for pattern detection (0.1 = very sensitive, 1.0 = very specific)")
				.addSlider((slider) =>
					slider
						.setLimits(0.1, 1.0, 0.1)
						.setValue(this.plugin.settings.patternThreshold || 0.6)
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.patternThreshold = value;
							await this.plugin.saveSettings();
						})
				);

			// Enable Trend Analysis
			new Setting(containerEl)
				.setName("Enable Trend Analysis")
				.setDesc("Analyze patterns and changes over time")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.enableTrendAnalysis ?? true)
						.onChange(async (value) => {
							this.plugin.settings.enableTrendAnalysis = value;
							await this.plugin.saveSettings();
						})
				);

			// Enable Semantic Analysis
			new Setting(containerEl)
				.setName("Enable AI Semantic Analysis")
				.setDesc("Use OpenAI for deep semantic understanding and insights generation")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.enableSemanticAnalysis ?? true)
						.onChange(async (value) => {
							this.plugin.settings.enableSemanticAnalysis = value;
							await this.plugin.saveSettings();
						})
				);

			// Cache Analysis Results
			new Setting(containerEl)
				.setName("Cache Analysis Results")
				.setDesc("Cache analysis results to improve performance (recommended)")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.cacheAnalysisResults ?? true)
						.onChange(async (value) => {
							this.plugin.settings.cacheAnalysisResults = value;
							await this.plugin.saveSettings();
						})
				);

			// NLP Features Info
			const infoEl = containerEl.createDiv({ cls: "setting-item-description" });
			infoEl.createEl("strong", { text: "Advanced NLP Features:" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Productivity Theme Extraction:" });
			infoEl.createSpan({ text: " Identifies recurring themes in your work" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Blocker Detection:" });
			infoEl.createSpan({ text: " Spots procrastination, time management, and workflow issues" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Multi-dimensional Sentiment:" });
			infoEl.createSpan({ text: " Analyzes emotions, arousal levels, and productivity mood" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Context-aware Analysis:" });
			infoEl.createSpan({ text: " Understands the nuances of your writing style" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Pattern Correlation:" });
			infoEl.createSpan({ text: " Connects productivity patterns with mood and activities" });
		}
	}

	/**
	 * Validate the folder path
	 * @param setting - The setting to validate
	 * @param folderPath - The folder path to validate
	 * @returns {void}
	 * @description
	 * This function is used to validate the folder path.
	 */
	private validateFolderPaths(setting: Setting, folderPaths: string[]): void {
		// Remove any existing validation indicators
		const existingIcon = setting.settingEl.querySelector(
			".folder-validation-icon"
		);
		if (existingIcon) {
			existingIcon.remove();
		}

		if (!folderPaths || folderPaths.length === 0) {
			this.addValidationIcon(
				setting,
				"info",
				"Will search in entire vault"
			);
			return;
		}

		// Check each folder and determine overall status
		let foundCount = 0;
		const totalCount = folderPaths.length;

		for (const folderPath of folderPaths) {
			if (!folderPath || folderPath.trim() === "") {
				continue;
			}

			const folder = this.app.vault.getAbstractFileByPath(
				folderPath.trim()
			);
			if (folder && folder instanceof TFolder) {
				foundCount++;
			}
		}

		if (foundCount === totalCount) {
			this.addValidationIcon(
				setting,
				"success",
				`All ${totalCount} folders found`
			);
		} else if (foundCount > 0) {
			this.addValidationIcon(
				setting,
				"info",
				`${foundCount}/${totalCount} folders found`
			);
		} else {
			this.addValidationIcon(setting, "error", "No folders found");
		}
	}

	private validateFolderPath(setting: Setting, folderPath: string): void {
		// Remove any existing validation indicators
		const existingIcon = setting.settingEl.querySelector(
			".folder-validation-icon"
		);
		if (existingIcon) {
			existingIcon.remove();
		}

		if (!folderPath || folderPath.trim() === "") {
			this.addValidationIcon(
				setting,
				"info",
				"Will search in root folder"
			);
			return;
		}

		// Check if folder exists
		const folder = this.app.vault.getAbstractFileByPath(folderPath.trim());

		if (folder && folder instanceof TFolder) {
			this.addValidationIcon(setting, "success", "Folder found");
		} else {
			this.addValidationIcon(setting, "error", "Folder not found");
		}
	}

	private async validateOrCreateFolder(
		setting: Setting,
		folderPath: string
	): Promise<void> {
		// Remove any existing validation indicators
		const existingIcon = setting.settingEl.querySelector(
			".folder-validation-icon"
		);
		if (existingIcon) {
			existingIcon.remove();
		}

		if (!folderPath || folderPath.trim() === "") {
			this.addValidationIcon(setting, "error", "Folder path required");
			return;
		}

		const trimmedPath = folderPath.trim();
		const folder = this.app.vault.getAbstractFileByPath(trimmedPath);

		if (folder && folder instanceof TFolder) {
			this.addValidationIcon(setting, "success", "Folder found");
		} else {
			// Try to create the folder
			try {
				await this.app.vault.createFolder(trimmedPath);
				this.addValidationIcon(setting, "success", "Folder created");
			} catch (error) {
				this.addValidationIcon(
					setting,
					"error",
					"Failed to create folder"
				);
			}
		}
	}

	private addValidationIcon(
		setting: Setting,
		type: "success" | "error" | "info",
		tooltip: string
	): void {
		const iconEl = setting.settingEl.createDiv({
			cls: `folder-validation-icon folder-validation-${type}`,
		});

		// Set icon based on type
		switch (type) {
			case "success":
				iconEl.textContent = "✓";
				break;
			case "error":
				iconEl.textContent = "✗";
				break;
			case "info":
				iconEl.textContent = "ℹ";
				break;
		}

		iconEl.title = tooltip;

		// Make the setting container relative for absolute positioning
		const settingControl = setting.settingEl.querySelector(
			".setting-item-control"
		);
		if (settingControl) {
			settingControl.classList.add("has-validation");
			settingControl.appendChild(iconEl);
		}
	}
}
