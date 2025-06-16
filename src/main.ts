import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import { ErrorHandler } from "./error-handler";
import { Logger, LogLevel } from "./logger";
import {
	MarkdownProcessingService,
	MarkdownProcessingConfig,
	ProcessingResult,
} from "./markdown-processing-service";
import {
	AIService,
	AIServiceSettings,
	DEFAULT_AI_SETTINGS,
	AIProvider,
} from "./ai-service";
import { PrivacyLevel } from "./ai-interfaces";
import { SummaryNoteCreator } from "./summary-note-creator";
import { EnhancedAnalysisResult } from "./ai-service-orchestrator";

interface RetrospectiveAISettings {
	// Processing settings
	enablePrivacyFilter: boolean;
	privacyTags: string[];
	enableMetadataExtraction: boolean;
	enableSectionDetection: boolean;

	// Performance settings
	maxFileSize: number;
	batchSize: number;
	enableCaching: boolean;

	// Debug settings
	debugMode: boolean;
	logLevel: LogLevel;

	// Summary settings
	summaryWritingStyle: "business" | "personal" | "academic";
	enableAISummaryInsights: boolean;
	respectPrivacyInSummaries: boolean;

	// AI settings
	aiSettings: AIServiceSettings;
}

const DEFAULT_SETTINGS: RetrospectiveAISettings = {
	enablePrivacyFilter: true,
	privacyTags: ["private-ai", "confidential-ai", "no-ai"],
	enableMetadataExtraction: true,
	enableSectionDetection: true,
	maxFileSize: 10 * 1024 * 1024, // 10MB
	batchSize: 50,
	enableCaching: true,
	debugMode: false,
	logLevel: LogLevel.INFO,
	summaryWritingStyle: "personal",
	enableAISummaryInsights: true,
	respectPrivacyInSummaries: true,
	aiSettings: DEFAULT_AI_SETTINGS,
};

export default class RetrospectiveAIPlugin extends Plugin {
	logger: Logger;
	errorHandler: ErrorHandler;
	settings: RetrospectiveAISettings;
	markdownProcessor: MarkdownProcessingService;
	aiService: AIService;
	summaryNoteCreator: SummaryNoteCreator;
	private cleanupTasks: (() => Promise<void> | void)[] = [];

	async onload() {
		// Initialize logger and error handler
		this.logger = new Logger("Retrospective AI", true, LogLevel.DEBUG);
		this.errorHandler = new ErrorHandler(this.logger);

		try {
			this.logger.info("Initializing RetrospectAI plugin");

			// Initialize the plugin
			await this.initializePlugin();

			this.logger.info("RetrospectAI plugin initialized successfully");
		} catch (error) {
			this.logger.userError(
				"Error initializing RetrospectAI plugin",
				error
			);
		}
	}

	private async initializePlugin() {
		await this.loadSettings();

		// Initialize markdown processing service
		const processingConfig: Partial<MarkdownProcessingConfig> = {
			enablePrivacyFilter: this.settings.enablePrivacyFilter,
			privacyTags: this.settings.privacyTags,
			enableMetadataExtraction: this.settings.enableMetadataExtraction,
			enableSectionDetection: this.settings.enableSectionDetection,
			maxFileSize: this.settings.maxFileSize,
			batchSize: this.settings.batchSize,
			enableCaching: this.settings.enableCaching,
		};

		this.markdownProcessor = new MarkdownProcessingService(
			this.app,
			this.logger,
			this.errorHandler,
			processingConfig
		);

		// Initialize AI service
		this.aiService = new AIService(
			this.logger,
			this.errorHandler,
			this.settings.aiSettings
		);

		// Initialize summary note creator
		this.summaryNoteCreator = new SummaryNoteCreator(
			this.app,
			this.logger,
			this.aiService,
			this.settings.enablePrivacyFilter
				? this.markdownProcessor.getPrivacyFilter()
				: undefined
		);

		// Initialize AI service if enabled
		if (this.settings.aiSettings.enableAI) {
			if (this.settings.debugMode) {
				console.log("🔧 RetrospectAI: AI is enabled, initializing...");
			}
			try {
				this.logger.info("Initializing AI Service...");
				if (this.settings.debugMode) {
					console.log("🔧 RetrospectAI: AI Service settings", {
						primaryProvider:
							this.settings.aiSettings.primaryProvider,
						endpoint:
							this.settings.aiSettings.openaiConfig.endpoint,
						hasApiKey:
							!!this.settings.aiSettings.openaiConfig.apiKey,
						model: this.settings.aiSettings.openaiConfig.model,
					});
				}

				await this.aiService.initialize();
				if (this.settings.debugMode) {
					console.log(
						"🔧 RetrospectAI: AI Service initialized successfully"
					);
				}
				this.logger.info("AI Service initialized successfully");

				// Test the connection if OpenAI is the primary provider
				if (this.settings.aiSettings.primaryProvider === "openai") {
					if (this.settings.debugMode) {
						console.log(
							"🔧 RetrospectAI: Testing OpenAI connection..."
						);
					}
					this.logger.info("Testing OpenAI connection...");
					const testResult = await this.aiService.testProvider(
						"openai"
					);
					if (testResult.success) {
						if (this.settings.debugMode) {
							console.log(
								"🔧 RetrospectAI: OpenAI connection test successful"
							);
						}
						this.logger.info("OpenAI connection test successful");
						new Notice(
							"RetrospectAI: AI connection established successfully"
						);
					} else {
						console.log(
							"🔧 RetrospectAI: OpenAI connection test failed:",
							testResult.error
						);
						this.logger.error(
							"OpenAI connection test failed:",
							testResult.error
						);
						new Notice(
							`RetrospectAI: OpenAI connection failed - ${testResult.error}`,
							8000
						);
					}
				}
			} catch (error) {
				console.log(
					"🔧 RetrospectAI: Failed to initialize AI Service:",
					error
				);
				this.logger.error("Failed to initialize AI Service:", error);

				// Provide user-friendly error message
				let errorMessage = "Failed to initialize AI Service";
				if (error instanceof Error) {
					if (error.message.includes("API key")) {
						errorMessage =
							"OpenAI API key is missing or invalid. Please configure it in settings.";
					} else if (
						error.message.includes("network") ||
						error.message.includes("connection")
					) {
						errorMessage =
							"Unable to connect to AI service. Please check your internet connection.";
					} else if (
						error.message.includes("endpoint") ||
						error.message.includes("configuration")
					) {
						errorMessage =
							"AI configuration error. Please check your settings and try again.";
					} else {
						errorMessage = `AI Service error: ${error.message}`;
					}
				}

				new Notice(`RetrospectAI: ${errorMessage}`, 10000);

				// Don't automatically disable AI - let user fix the issue
				this.logger.warn(
					"AI Service initialization failed, but keeping AI enabled for user to fix"
				);
			}
		} else {
			if (this.settings.debugMode) {
				console.log("🔧 RetrospectAI: AI is disabled in settings");
			}
			this.logger.info("AI Service disabled in settings");
			// Check if AI was previously disabled due to errors
			if (
				this.settings.aiSettings.primaryProvider === "openai" &&
				this.settings.aiSettings.openaiConfig.apiKey
			) {
				if (this.settings.debugMode) {
					console.log(
						"🔧 RetrospectAI: AI appears to have been disabled but API key is configured"
					);
				}
				this.logger.info(
					"AI appears to have been disabled due to previous errors, but API key is configured"
				);
				new Notice(
					"RetrospectAI: AI is disabled. You can re-enable it in settings if you've fixed any configuration issues.",
					6000
				);
			}
		}

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon(
			"brain",
			"RetrospectAI: Analyze Current Note",
			(evt: MouseEvent) => {
				this.handleRibbonClick();
			}
		);
		ribbonIconEl.addClass("retrospective-ai-ribbon-class");

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("RetrospectAI Ready");

		// Add commands
		this.addCommand({
			id: "analyze-current-note",
			name: "Analyze Current Note",
			callback: () => {
				this.analyzeCurrentNote();
			},
		});

		this.addCommand({
			id: "analyze-current-note-detailed",
			name: "Analyze Current Note (Detailed)",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.analyzeCurrentNoteDetailed();
			},
		});

		this.addCommand({
			id: "show-processing-stats",
			name: "Show Processing Statistics",
			callback: () => {
				this.showProcessingStats();
			},
		});

		this.addCommand({
			id: "clear-processing-cache",
			name: "Clear Processing Cache",
			callback: () => {
				this.clearProcessingCache();
			},
		});

		// AI-related commands
		this.addCommand({
			id: "analyze-with-ai",
			name: "Analyze Current Note with AI",
			callback: () => {
				this.analyzeCurrentNoteWithAI();
			},
		});

		this.addCommand({
			id: "show-ai-status",
			name: "Show AI Service Status",
			callback: () => {
				this.showAIStatus();
			},
		});

		this.addCommand({
			id: "test-ai-connection",
			name: "Test AI Connection",
			callback: () => {
				this.testAIConnection();
			},
		});

		this.addCommand({
			id: "create-summary-note",
			name: "Create Summary Note",
			callback: () => {
				this.createSummaryNote();
			},
		});

		// Add settings tab
		this.addSettingTab(new RetrospectiveAISettingTab(this.app, this));
	}

	private async handleRibbonClick() {
		this.logger.info("Ribbon clicked - analyzing current note");
		await this.analyzeCurrentNote();
	}

	private async analyzeCurrentNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to analyze");
			return;
		}

		if (!(activeFile instanceof TFile)) {
			new Notice("Active file is not a markdown file");
			return;
		}

		try {
			new Notice("Analyzing note...");
			const result = await this.markdownProcessor.processFile(
				activeFile.path
			);

			if (result.skipped) {
				new Notice(`Note skipped: ${result.skipReason}`);
				return;
			}

			if (!result.success) {
				new Notice(
					`Analysis failed: ${
						result.errors[0]?.message || "Unknown error"
					}`
				);
				return;
			}

			// Show basic results
			const stats = this.formatBasicStats(result);
			new Notice(`Analysis complete: ${stats}`, 5000);

			this.logger.info("Note analysis completed", {
				filePath: activeFile.path,
				processingTime: result.processingTime,
				elementCount: result.parsedContent?.elements.length,
				sectionCount: result.sections?.length,
				wordCount: result.metadata?.wordCount,
			});
		} catch (error) {
			this.logger.error("Failed to analyze note", error);
			new Notice("Failed to analyze note - check console for details");
		}
	}

	private async analyzeCurrentNoteDetailed() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to analyze");
			return;
		}

		if (!(activeFile instanceof TFile)) {
			new Notice("Active file is not a markdown file");
			return;
		}

		try {
			const result = await this.markdownProcessor.processFile(
				activeFile.path
			);
			new DetailedAnalysisModal(this.app, result).open();
		} catch (error) {
			this.logger.error("Failed to analyze note", error);
			new Notice("Failed to analyze note - check console for details");
		}
	}

	private showProcessingStats() {
		const stats = this.markdownProcessor.getStatistics();
		const config = this.markdownProcessor.getConfig();

		const message = `Processing Statistics:
• Cache size: ${stats.cacheSize} files
• Total processed: ${stats.totalProcessedFiles} files
• Average time: ${stats.averageProcessingTime.toFixed(2)}ms
• Privacy filter: ${config.enablePrivacyFilter ? "Enabled" : "Disabled"}
• Metadata extraction: ${
			config.enableMetadataExtraction ? "Enabled" : "Disabled"
		}
• Section detection: ${config.enableSectionDetection ? "Enabled" : "Disabled"}`;

		new Notice(message, 8000);
		this.logger.info("Processing statistics", stats);
	}

	private clearProcessingCache() {
		this.markdownProcessor.clearCache();
		new Notice("Processing cache cleared");
		this.logger.info("Processing cache cleared");
	}

	private async analyzeCurrentNoteWithAI() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to analyze");
			return;
		}

		if (!(activeFile instanceof TFile)) {
			new Notice("Active file is not a markdown file");
			return;
		}

		if (!this.settings.aiSettings.enableAI) {
			new Notice("AI analysis is disabled. Enable it in settings.");
			return;
		}

		try {
			new Notice("Analyzing note with AI...");
			const content = await this.app.vault.read(activeFile);

			const result = await this.aiService.analyzePersonalContent(
				content,
				{
					analysisDepth: "standard",
				}
			);

			if (result.success) {
				new AIAnalysisModal(this.app, result).open();
			} else {
				new Notice(
					`AI analysis failed: ${result.error || "Unknown error"}`
				);
			}
		} catch (error) {
			this.logger.error("Failed to analyze note with AI", error);
			new Notice(
				"Failed to analyze note with AI - check console for details"
			);
		}
	}

	private async showAIStatus() {
		try {
			const status = await this.aiService.getStatus();
			new AIStatusModal(this.app, status).open();
		} catch (error) {
			this.logger.error("Failed to get AI status", error);
			new Notice("Failed to get AI status - check console for details");
		}
	}

	async testAIConnection() {
		try {
			this.logger.info("Testing AI connection...");

			if (!this.settings.aiSettings.enableAI) {
				new Notice(
					"AI is disabled. Please enable AI in settings first.",
					5000
				);
				return;
			}

			if (!this.aiService) {
				new Notice(
					"AI service not initialized. Please check your configuration.",
					5000
				);
				return;
			}

			const provider = this.settings.aiSettings.primaryProvider;
			this.logger.info(`Testing connection to ${provider}...`);

			// Validate configuration before testing
			if (provider === "openai") {
				if (!this.settings.aiSettings.openaiConfig.apiKey) {
					new Notice(
						"OpenAI API key is required. Please configure it in settings.",
						5000
					);
					return;
				}
				if (
					!this.settings.aiSettings.openaiConfig.apiKey.startsWith(
						"sk-"
					)
				) {
					new Notice(
						'OpenAI API key appears to be invalid. It should start with "sk-".',
						5000
					);
					return;
				}
			}

			const result = await this.aiService.testProvider(provider);

			if (result.success) {
				this.logger.info(`${provider} connection test successful`);
				new Notice(
					`✅ ${provider.toUpperCase()} connection successful!`,
					4000
				);
			} else {
				this.logger.error(
					`${provider} connection test failed:`,
					result.error
				);
				new Notice(
					`❌ ${provider.toUpperCase()} connection failed: ${
						result.error
					}`,
					8000
				);
			}
		} catch (error) {
			this.logger.error("Error testing AI connection:", error);
			let errorMessage = "Connection test failed";
			if (error instanceof Error) {
				if (error.message.includes("API key")) {
					errorMessage =
						"Invalid API key. Please check your configuration.";
				} else if (
					error.message.includes("network") ||
					error.message.includes("fetch")
				) {
					errorMessage =
						"Network error. Please check your internet connection.";
				} else {
					errorMessage = error.message;
				}
			}
			new Notice(`❌ Connection test failed: ${errorMessage}`, 8000);
		}
	}

	private async createSummaryNote() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to analyze");
			return;
		}

		if (!(activeFile instanceof TFile)) {
			new Notice("Active file is not a markdown file");
			return;
		}

		try {
			new Notice("Analyzing note and creating summary...");

			// First, analyze the current note
			const analysisResult = await this.markdownProcessor.processFile(
				activeFile.path
			);

			if (!analysisResult.success) {
				new Notice(
					"Failed to analyze note - check console for details"
				);
				this.logger.error("Analysis failed", analysisResult.errors);
				return;
			}

			// Create the summary note with user preferences
			const summaryPath = await this.summaryNoteCreator.createSummaryNote(
				activeFile,
				analysisResult,
				{
					overwriteExisting: true,
					enableAIInsights: this.settings.enableAISummaryInsights,
					writingStyle: this.settings.summaryWritingStyle,
					respectPrivacySettings:
						this.settings.respectPrivacyInSummaries,
				}
			);

			new Notice(`✅ Summary note created: ${summaryPath}`);

			// Optionally open the summary note
			const summaryFile =
				this.app.vault.getAbstractFileByPath(summaryPath);
			if (summaryFile instanceof TFile) {
				await this.app.workspace.getLeaf().openFile(summaryFile);
			}
		} catch (error) {
			this.logger.error("Failed to create summary note", error);
			new Notice(`Failed to create summary note: ${error.message}`);
		}
	}

	private formatBasicStats(result: ProcessingResult): string {
		const parts: string[] = [];

		if (result.parsedContent) {
			parts.push(`${result.parsedContent.elements.length} elements`);
		}

		if (result.sections) {
			parts.push(`${result.sections.length} sections`);
		}

		if (result.metadata) {
			parts.push(`${result.metadata.wordCount} words`);
		}

		parts.push(`${result.processingTime}ms`);

		return parts.join(", ");
	}

	async onunload() {
		this.logger.info("RetrospectAI plugin unloading");

		// Run all registered cleanup tasks
		for (const cleanup of this.cleanupTasks) {
			try {
				await cleanup();
			} catch (error) {
				this.logger.error("Error during cleanup:", error);
			}
		}

		// Dispose of AI service
		if (this.aiService) {
			try {
				await this.aiService.dispose();
			} catch (error) {
				this.logger.error("Error disposing AI service:", error);
			}
		}

		// Clear any remaining references
		this.cleanupTasks = [];

		this.logger.info("RetrospectAI plugin unloaded");
	}

	/**
	 * Register a cleanup task to be run during plugin unload
	 */
	private registerCleanup(cleanup: () => Promise<void> | void): void {
		this.cleanupTasks.push(cleanup);
	}

	private async loadSettings() {
		if (this.settings?.debugMode) {
			console.log("🔧 RetrospectAI: Loading settings - NEW CODE ACTIVE");
		}
		await this.errorHandler.safeAsync(
			async () => {
				this.logger.debug("Loading plugin settings");
				const savedSettings = await this.loadData();

				if (this.settings?.debugMode) {
					console.log("🔧 RetrospectAI: Raw saved settings", {
						hasAiSettings: !!savedSettings?.aiSettings,
						enableAI: savedSettings?.aiSettings?.enableAI,
						primaryProvider:
							savedSettings?.aiSettings?.primaryProvider,
						hasOpenAIConfig:
							!!savedSettings?.aiSettings?.openaiConfig,
						openAIEndpoint:
							savedSettings?.aiSettings?.openaiConfig?.endpoint,
						hasApiKey:
							!!savedSettings?.aiSettings?.openaiConfig?.apiKey,
					});
				}

				// Deep merge settings to preserve nested defaults
				this.settings = this.deepMergeSettings(
					DEFAULT_SETTINGS,
					savedSettings || {}
				);

				if (this.settings.debugMode) {
					console.log("🔧 RetrospectAI: Merged settings result", {
						enableAI: this.settings.aiSettings.enableAI,
						primaryProvider:
							this.settings.aiSettings.primaryProvider,
						openAIEndpoint:
							this.settings.aiSettings.openaiConfig.endpoint,
						hasApiKey:
							!!this.settings.aiSettings.openaiConfig.apiKey,
						apiKeyLength:
							this.settings.aiSettings.openaiConfig.apiKey
								?.length || 0,
					});
				}

				// Ensure OpenAI endpoint is set if missing
				if (
					this.settings.aiSettings.openaiConfig &&
					!this.settings.aiSettings.openaiConfig.endpoint
				) {
					if (this.settings.debugMode) {
						console.log(
							"🔧 RetrospectAI: OpenAI endpoint missing, setting default"
						);
					}
					this.settings.aiSettings.openaiConfig.endpoint =
						"https://api.openai.com/v1";
				}
			},
			"Failed to load plugin settings",
			false
		);
	}

	/**
	 * Deep merge settings objects to preserve nested defaults
	 */
	private deepMergeSettings(
		defaults: RetrospectiveAISettings,
		saved: Partial<RetrospectiveAISettings>
	): RetrospectiveAISettings {
		const result = { ...defaults };

		// Handle each top-level property
		Object.keys(saved).forEach((key) => {
			const typedKey = key as keyof RetrospectiveAISettings;
			const savedValue = saved[typedKey];

			if (savedValue === null || savedValue === undefined) {
				return; // Keep default value
			}

			// Special handling for aiSettings to preserve nested structure
			if (typedKey === "aiSettings" && typeof savedValue === "object") {
				result.aiSettings = this.deepMergeAISettings(
					defaults.aiSettings,
					savedValue as Partial<AIServiceSettings>
				);
			} else {
				// For primitive values and arrays, use saved value
				(result as Record<string, unknown>)[typedKey] = savedValue;
			}
		});

		return result;
	}

	/**
	 * Deep merge AI settings to preserve nested configuration objects
	 */
	private deepMergeAISettings(
		defaults: AIServiceSettings,
		saved: Partial<AIServiceSettings>
	): AIServiceSettings {
		const result = { ...defaults };

		Object.keys(saved).forEach((key) => {
			const typedKey = key as keyof AIServiceSettings;
			const savedValue = saved[typedKey];

			if (savedValue === null || savedValue === undefined) {
				return; // Keep default value
			}

			// Special handling for nested config objects
			if (typedKey === "openaiConfig" && typeof savedValue === "object") {
				result.openaiConfig = {
					...defaults.openaiConfig,
					...(savedValue as Partial<typeof defaults.openaiConfig>),
				};
			} else if (
				typedKey === "ollamaConfig" &&
				typeof savedValue === "object"
			) {
				result.ollamaConfig = {
					...defaults.ollamaConfig,
					...(savedValue as Partial<typeof defaults.ollamaConfig>),
				};
			} else if (
				typedKey === "mockConfig" &&
				typeof savedValue === "object"
			) {
				result.mockConfig = {
					...defaults.mockConfig,
					...(savedValue as Partial<typeof defaults.mockConfig>),
				};
			} else if (
				typedKey === "defaultAnalysisOptions" &&
				typeof savedValue === "object"
			) {
				result.defaultAnalysisOptions = {
					...defaults.defaultAnalysisOptions,
					...(savedValue as Partial<
						typeof defaults.defaultAnalysisOptions
					>),
				};
			} else {
				// For primitive values and arrays, use saved value
				(result as Record<string, unknown>)[typedKey] = savedValue;
			}
		});

		return result;
	}

	async saveSettings() {
		await this.errorHandler.safeAsync(
			async () => await this.saveData(this.settings),
			"Failed to save plugin settings",
			true
		);
	}
}

class DetailedAnalysisModal extends Modal {
	constructor(app: App, private result: ProcessingResult) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Detailed Analysis Results" });

		if (this.result.skipped) {
			contentEl.createEl("p", {
				text: `Analysis skipped: ${this.result.skipReason}`,
				cls: "mod-warning",
			});
			return;
		}

		if (!this.result.success) {
			contentEl.createEl("p", {
				text: "Analysis failed",
				cls: "mod-error",
			});

			if (this.result.errors.length > 0) {
				const errorList = contentEl.createEl("ul");
				this.result.errors.forEach((error) => {
					errorList.createEl("li", {
						text: `${error.component}: ${error.message}`,
					});
				});
			}
			return;
		}

		// Processing info
		const processingDiv = contentEl.createDiv();
		processingDiv.createEl("h3", { text: "Processing Information" });
		processingDiv.createEl("p", {
			text: `Processing time: ${this.result.processingTime}ms`,
		});
		processingDiv.createEl("p", {
			text: `File path: ${this.result.filePath}`,
		});

		// Content analysis
		if (this.result.parsedContent) {
			const contentDiv = contentEl.createDiv();
			contentDiv.createEl("h3", { text: "Content Analysis" });
			contentDiv.createEl("p", {
				text: `Elements found: ${this.result.parsedContent.elements.length}`,
			});

			// Element breakdown
			const elementTypes = this.result.parsedContent.elements.reduce(
				(acc, el) => {
					acc[el.type] = (acc[el.type] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			const elementList = contentDiv.createEl("ul");
			Object.entries(elementTypes).forEach(([type, count]) => {
				elementList.createEl("li", { text: `${type}: ${count}` });
			});
		}

		// Metadata
		if (this.result.metadata) {
			const metadataDiv = contentEl.createDiv();
			metadataDiv.createEl("h3", { text: "Metadata" });
			metadataDiv.createEl("p", {
				text: `Word count: ${this.result.metadata.wordCount}`,
			});
			metadataDiv.createEl("p", {
				text: `Character count: ${this.result.metadata.characterCount}`,
			});
			metadataDiv.createEl("p", {
				text: `Tags: ${this.result.metadata.tags.length}`,
			});
			metadataDiv.createEl("p", {
				text: `Links: ${this.result.metadata.links.length}`,
			});
		}

		// Sections
		if (this.result.sections) {
			const sectionsDiv = contentEl.createDiv();
			sectionsDiv.createEl("h3", { text: "Sections" });
			sectionsDiv.createEl("p", {
				text: `Sections found: ${this.result.sections.length}`,
			});

			const sectionList = sectionsDiv.createEl("ul");
			this.result.sections.forEach((section) => {
				const item = sectionList.createEl("li");
				item.createEl("strong", { text: section.title });
				item.createEl("span", {
					text: ` (Level ${section.level}, ${section.wordCount} words, Category: ${section.category})`,
				});
			});
		}

		// Errors and warnings
		if (this.result.errors.length > 0) {
			const errorsDiv = contentEl.createDiv();
			errorsDiv.createEl("h3", { text: "Errors" });
			const errorList = errorsDiv.createEl("ul");
			this.result.errors.forEach((error) => {
				errorList.createEl("li", {
					text: `${error.component}: ${error.message}`,
					cls:
						error.severity === "error"
							? "mod-error"
							: "mod-warning",
				});
			});
		}

		if (this.result.warnings.length > 0) {
			const warningsDiv = contentEl.createDiv();
			warningsDiv.createEl("h3", { text: "Warnings" });
			const warningList = warningsDiv.createEl("ul");
			this.result.warnings.forEach((warning) => {
				warningList.createEl("li", {
					text: warning,
					cls: "mod-warning",
				});
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class AIAnalysisModal extends Modal {
	private copyButtonHandler?: () => void;
	private timeouts: number[] = [];

	constructor(app: App, private result: EnhancedAnalysisResult) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "AI Analysis Results" });

		if (!this.result.success) {
			contentEl.createEl("p", {
				text: `Analysis failed: ${this.result.error}`,
				cls: "mod-warning",
			});
			return;
		}

		// Summary
		if (this.result.summary) {
			const summaryDiv = contentEl.createDiv();
			summaryDiv.createEl("h3", { text: "Summary" });
			summaryDiv.createEl("p", { text: this.result.summary });
		}

		// Patterns
		if (this.result.patterns && this.result.patterns.length > 0) {
			const patternsDiv = contentEl.createDiv();
			patternsDiv.createEl("h3", { text: "Detected Patterns" });
			this.result.patterns.forEach((pattern) => {
				const patternDiv = patternsDiv.createDiv();
				patternDiv.createEl("h4", { text: pattern.title });
				patternDiv.createEl("p", { text: pattern.description });
				patternDiv.createEl("p", {
					text: `Confidence: ${(pattern.confidence * 100).toFixed(
						1
					)}%`,
					cls: "mod-muted",
				});
			});
		}

		// Insights
		if (this.result.insights && this.result.insights.length > 0) {
			const insightsDiv = contentEl.createDiv();
			insightsDiv.createEl("h3", { text: "Insights" });
			const insightsList = insightsDiv.createEl("ul");
			this.result.insights.forEach((insight) => {
				insightsList.createEl("li", { text: insight });
			});
		}

		// Recommendations
		if (
			this.result.recommendations &&
			this.result.recommendations.length > 0
		) {
			const recommendationsDiv = contentEl.createDiv();
			recommendationsDiv.createEl("h3", { text: "Recommendations" });
			const recommendationsList = recommendationsDiv.createEl("ul");
			this.result.recommendations.forEach((recommendation) => {
				recommendationsList.createEl("li", { text: recommendation });
			});
		}

		// Copy button
		const copyButton = contentEl.createEl("button", {
			text: "Copy Analysis to Clipboard",
			cls: "mod-cta",
		});

		// Store the handler reference for cleanup
		this.copyButtonHandler = () => {
			const analysisText = this.formatAnalysisForClipboard();
			navigator.clipboard
				.writeText(analysisText)
				.then(() => {
					copyButton.textContent = "Copied!";
					const timeoutId = window.setTimeout(() => {
						copyButton.textContent = "Copy Analysis to Clipboard";
					}, 2000);
					this.timeouts.push(timeoutId);
				})
				.catch(() => {
					copyButton.textContent = "Copy failed";
					const timeoutId = window.setTimeout(() => {
						copyButton.textContent = "Copy Analysis to Clipboard";
					}, 2000);
					this.timeouts.push(timeoutId);
				});
		};

		copyButton.addEventListener("click", this.copyButtonHandler);

		// Metadata
		if (this.result.orchestratorMetadata) {
			const metadataDiv = contentEl.createDiv();
			metadataDiv.createEl("h3", { text: "Analysis Metadata" });
			metadataDiv.createEl("p", {
				text: `Model used: ${this.result.modelUsed}`,
			});
			metadataDiv.createEl("p", {
				text: `Processing time: ${this.result.processingTime}ms`,
			});
			metadataDiv.createEl("p", {
				text: `Confidence: ${(this.result.confidence * 100).toFixed(
					1
				)}%`,
			});
		}
	}

	/**
	 * Close the modal
	 */
	onClose() {
		const { contentEl } = this;

		// Clear all timeouts
		this.timeouts.forEach((timeoutId) => {
			clearTimeout(timeoutId);
		});
		this.timeouts = [];

		// Remove event listener if it exists
		if (this.copyButtonHandler) {
			const copyButton = contentEl.querySelector("button");
			if (copyButton) {
				copyButton.removeEventListener("click", this.copyButtonHandler);
			}
			this.copyButtonHandler = undefined;
		}

		contentEl.empty();
	}

	/**
	 * Format the analysis for clipboard
	 */
	private formatAnalysisForClipboard(): string {
		let text = "# AI Analysis Results\n\n";

		// Summary
		if (this.result.summary) {
			text += "## Summary\n";
			text += this.result.summary + "\n\n";
		}

		// Patterns
		if (this.result.patterns && this.result.patterns.length > 0) {
			text += "## Detected Patterns\n";
			this.result.patterns.forEach((pattern) => {
				text += `### ${pattern.title}\n`;
				text += `${pattern.description}\n`;
				text += `*Confidence: ${(pattern.confidence * 100).toFixed(
					1
				)}%*\n\n`;
			});
		}

		// Insights
		if (this.result.insights && this.result.insights.length > 0) {
			text += "## Insights\n";
			this.result.insights.forEach((insight) => {
				text += `- ${insight}\n`;
			});
			text += "\n";
		}

		// Recommendations
		if (
			this.result.recommendations &&
			this.result.recommendations.length > 0
		) {
			text += "## Recommendations\n";
			this.result.recommendations.forEach((recommendation) => {
				text += `- ${recommendation}\n`;
			});
			text += "\n";
		}

		return text;
	}
}

interface AIStatus {
	initialized: boolean;
	enabled: boolean;
	activeProvider: string | null;
	availableProviders: string[];
	capabilities: string[];
	metrics: {
		totalRequests: number;
		successfulRequests: number;
		averageResponseTime: number;
	};
	lastError?: string;
}

class AIStatusModal extends Modal {
	constructor(app: App, private status: AIStatus) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "AI Service Status" });

		// Basic status
		const statusDiv = contentEl.createDiv();
		statusDiv.createEl("h3", { text: "Service Status" });
		statusDiv.createEl("p", {
			text: `Initialized: ${
				this.status.initialized ? "✅ Yes" : "❌ No"
			}`,
		});
		statusDiv.createEl("p", {
			text: `Enabled: ${this.status.enabled ? "✅ Yes" : "❌ No"}`,
		});
		statusDiv.createEl("p", {
			text: `Active Provider: ${this.status.activeProvider || "None"}`,
		});

		// Available providers
		if (this.status.availableProviders.length > 0) {
			const providersDiv = contentEl.createDiv();
			providersDiv.createEl("h3", { text: "Available Providers" });
			const providersList = providersDiv.createEl("ul");
			this.status.availableProviders.forEach((provider: string) => {
				providersList.createEl("li", { text: provider });
			});
		}

		// Capabilities
		if (this.status.capabilities.length > 0) {
			const capabilitiesDiv = contentEl.createDiv();
			capabilitiesDiv.createEl("h3", { text: "Capabilities" });
			const capabilitiesList = capabilitiesDiv.createEl("ul");
			this.status.capabilities.forEach((capability: string) => {
				capabilitiesList.createEl("li", { text: capability });
			});
		}

		// Metrics
		const metricsDiv = contentEl.createDiv();
		metricsDiv.createEl("h3", { text: "Usage Metrics" });
		metricsDiv.createEl("p", {
			text: `Total Requests: ${this.status.metrics.totalRequests}`,
		});
		metricsDiv.createEl("p", {
			text: `Successful Requests: ${this.status.metrics.successfulRequests}`,
		});
		metricsDiv.createEl("p", {
			text: `Average Response Time: ${this.status.metrics.averageResponseTime.toFixed(
				2
			)}ms`,
		});

		// Errors
		if (this.status.lastError) {
			const errorDiv = contentEl.createDiv();
			errorDiv.createEl("h3", { text: "Last Error" });
			errorDiv.createEl("p", {
				text: this.status.lastError,
				cls: "mod-error",
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class RetrospectiveAISettingTab extends PluginSettingTab {
	plugin: RetrospectiveAIPlugin;

	constructor(app: App, plugin: RetrospectiveAIPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "RetrospectAI Settings" });

		// Privacy settings
		containerEl.createEl("h3", { text: "Privacy Settings" });

		new Setting(containerEl)
			.setName("Enable Privacy Filter")
			.setDesc("Filter out private content based on tags and folders")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enablePrivacyFilter)
					.onChange(async (value) => {
						this.plugin.settings.enablePrivacyFilter = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Privacy Tags")
			.setDesc(
				"Comma-separated list of tags that mark content as private"
			)
			.addText((text) =>
				text
					.setPlaceholder("private, confidential, personal")
					.setValue(this.plugin.settings.privacyTags.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.privacyTags = value
							.split(",")
							.map((tag) => tag.trim())
							.filter((tag) => tag);
						await this.plugin.saveSettings();
					})
			);

		// Processing settings
		containerEl.createEl("h3", { text: "Processing Settings" });

		new Setting(containerEl)
			.setName("Enable Metadata Extraction")
			.setDesc("Extract metadata, links, tags, and references from notes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableMetadataExtraction)
					.onChange(async (value) => {
						this.plugin.settings.enableMetadataExtraction = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable Section Detection")
			.setDesc("Detect and categorize sections within notes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSectionDetection)
					.onChange(async (value) => {
						this.plugin.settings.enableSectionDetection = value;
						await this.plugin.saveSettings();
					})
			);

		// Performance settings
		containerEl.createEl("h3", { text: "Performance Settings" });

		new Setting(containerEl)
			.setName("Max File Size")
			.setDesc("Maximum file size to process (in MB)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 50, 1)
					.setValue(this.plugin.settings.maxFileSize / (1024 * 1024))
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxFileSize = value * 1024 * 1024;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable Caching")
			.setDesc("Cache processing results for better performance")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableCaching)
					.onChange(async (value) => {
						this.plugin.settings.enableCaching = value;
						await this.plugin.saveSettings();
					})
			);

		// Debug settings
		containerEl.createEl("h3", { text: "Debug Settings" });

		new Setting(containerEl)
			.setName("Debug Mode")
			.setDesc("Enable debug logging and detailed error messages")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						this.plugin.logger.setDebugMode(value);
						await this.plugin.saveSettings();
					})
			);

		// AI settings
		containerEl.createEl("h3", { text: "AI Settings" });

		new Setting(containerEl)
			.setName("Enable AI Analysis")
			.setDesc("Enable AI-powered analysis features")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.aiSettings.enableAI)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.enableAI = value;
						await this.plugin.saveSettings();
						// Update AI service
						await this.plugin.aiService.updateSettings({
							enableAI: value,
						});
					})
			);

		new Setting(containerEl)
			.setName("Primary AI Provider")
			.setDesc("Choose the primary AI provider for analysis")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("mock", "Mock (Testing)")
					.addOption("openai", "OpenAI")
					.addOption("ollama", "Ollama (Local)")
					.setValue(this.plugin.settings.aiSettings.primaryProvider)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.primaryProvider =
							value as AIProvider;
						await this.plugin.saveSettings();
						await this.plugin.aiService.updateSettings({
							primaryProvider: value as AIProvider,
						});
					})
			);

		new Setting(containerEl)
			.setName("Privacy Level")
			.setDesc("Control how your data is processed")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("local", "Local Only")
					.addOption("hybrid", "Hybrid (Recommended)")
					.addOption("cloud", "Cloud Services")
					.setValue(this.plugin.settings.aiSettings.privacyLevel)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.privacyLevel =
							value as PrivacyLevel;
						await this.plugin.saveSettings();
						await this.plugin.aiService.updateSettings({
							privacyLevel: value as PrivacyLevel,
						});
					})
			);

		// OpenAI settings
		containerEl.createEl("h4", { text: "OpenAI Configuration" });

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Your OpenAI API key for cloud-based analysis")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(
						this.plugin.settings.aiSettings.openaiConfig.apiKey
					)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.openaiConfig.apiKey =
							value;
						await this.plugin.saveSettings();

						// Validate API key format
						if (value && !value.startsWith("sk-")) {
							new Notice(
								'Warning: OpenAI API key should start with "sk-"',
								5000
							);
						} else if (value && value.length < 20) {
							new Notice(
								"Warning: OpenAI API key appears to be too short",
								5000
							);
						} else if (value && value.length > 10) {
							new Notice(
								"OpenAI API key updated successfully",
								3000
							);
						}
					})
			);

		new Setting(containerEl)
			.setName("OpenAI Model")
			.setDesc("Which OpenAI model to use")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("gpt-3.5-turbo", "GPT-3.5 Turbo")
					.addOption("gpt-4", "GPT-4")
					.addOption("gpt-4-turbo", "GPT-4 Turbo")
					.setValue(
						this.plugin.settings.aiSettings.openaiConfig.model
					)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.openaiConfig.model =
							value;
						await this.plugin.saveSettings();
					})
			);

		// Ollama settings
		containerEl.createEl("h4", { text: "Ollama Configuration" });

		new Setting(containerEl)
			.setName("Ollama Endpoint")
			.setDesc("URL for your local Ollama instance")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:11434")
					.setValue(
						this.plugin.settings.aiSettings.ollamaConfig.endpoint
					)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.ollamaConfig.endpoint =
							value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ollama Model")
			.setDesc("Which Ollama model to use")
			.addText((text) =>
				text
					.setPlaceholder("llama2")
					.setValue(
						this.plugin.settings.aiSettings.ollamaConfig.model
					)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.ollamaConfig.model =
							value;
						await this.plugin.saveSettings();
					})
			);

		// Test connection button
		new Setting(containerEl)
			.setName("Test AI Connection")
			.setDesc("Test connection to the selected AI provider")
			.addButton((button) =>
				button
					.setButtonText("Test Connection")
					.setCta()
					.onClick(async () => {
						button.setButtonText("Testing...");
						button.setDisabled(true);

						try {
							await this.plugin.testAIConnection();
						} finally {
							button.setButtonText("Test Connection");
							button.setDisabled(false);
						}
					})
			);
	}
}
