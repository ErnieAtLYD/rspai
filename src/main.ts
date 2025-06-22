import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Editor,
	MarkdownView,
} from "obsidian";
import { ErrorHandler } from "./error-handler";
import { Logger, LogLevel } from "./logger";

// Import only what we actually use
import {
	MarkdownProcessingService,
	MarkdownProcessingConfig,
	ProcessingResult,
} from "./markdown-processing-service";
import {
	AIService,
	AIServiceSettings,
	DEFAULT_AI_SETTINGS,
	SimpleAnalysisResult,
} from "./ai-service";
import { PrivacyLevel } from "./ai-interfaces";

// Simplified types for MVP
type AnalysisScope = "whole-life" | "work-only" | "personal-only" | "custom";

interface RetrospectiveAISettings {
	// Processing settings
	enablePrivacyFilter: boolean;
	privacyTags: string[];
	privacyFolders: string[];
	redactionStrategy: "exclude" | "redact" | "summarize";
	enableAuditLog: boolean;
	auditLogPath: string;

	enableMetadataExtraction: boolean;
	enableSectionDetection: boolean;

	// Performance settings
	maxFileSize: number;
	enableCaching: boolean;

	// Debug settings
	debugMode: boolean;
	logLevel: LogLevel;

	// Summary settings
	summaryWritingStyle: "business" | "personal" | "academic";
	enableAISummaryInsights: boolean;
	respectPrivacyInSummaries: boolean;

	// Pattern Detection settings
	analysisScope: AnalysisScope;

	// AI settings
	aiSettings: AIServiceSettings;
}

const DEFAULT_SETTINGS: RetrospectiveAISettings = {
	enablePrivacyFilter: true,
	privacyTags: ["private-ai", "confidential-ai", "no-ai"],
	privacyFolders: ["Private/", "Personal/", "Confidential/"],
	redactionStrategy: "exclude",
	enableAuditLog: false,
	auditLogPath: "audit.log",
	enableMetadataExtraction: true,
	enableSectionDetection: true,
	maxFileSize: 10 * 1024 * 1024, // 10MB
	enableCaching: true,
	debugMode: false,
	logLevel: LogLevel.INFO,
	summaryWritingStyle: "personal",
	enableAISummaryInsights: true,
	respectPrivacyInSummaries: true,
	analysisScope: "whole-life",
	aiSettings: DEFAULT_AI_SETTINGS,
};

export default class SimplifiedRetrospectAI extends Plugin {
	logger: Logger;
	errorHandler: ErrorHandler;
	settings: RetrospectiveAISettings;
	markdownProcessor: MarkdownProcessingService;
	aiService: AIService;
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

					// Simple connection test
					try {
						await this.aiService.generateCompletion("Hello", {
							maxTokens: 5,
						});
						if (this.settings.debugMode) {
							console.log(
								"🔧 RetrospectAI: OpenAI connection test successful"
							);
						}
						this.logger.info("OpenAI connection test successful");
						new Notice(
							"RetrospectAI: AI connection established successfully"
						);
					} catch (testError) {
						console.log(
							"🔧 RetrospectAI: OpenAI connection test failed:",
							testError
						);
						this.logger.error(
							"OpenAI connection test failed:",
							testError
						);
						new Notice(
							`RetrospectAI: OpenAI connection failed - ${
								testError instanceof Error
									? testError.message
									: "Unknown error"
							}`,
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
			callback: () => this.analyzeCurrentNote(),
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
			id: "test-ai-connection",
			name: "Test AI Connection",
			callback: () => {
				this.testAIConnection();
			},
		});

		// Add settings tab
		this.addSettingTab(new RetrospectiveAISettingTab(this.app, this));

		// Add privacy visual indicators
		this.setupPrivacyVisualIndicators();
	}

	private async handleRibbonClick() {
		this.logger.info("Ribbon clicked - analyzing current note");
		await this.analyzeCurrentNote();
	}

	private async analyzeCurrentNote() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active file");
			return;
		}

		if (!(file instanceof TFile)) {
			new Notice("Active file is not a markdown file");
			return;
		}

		try {
			new Notice("Analyzing note...");
			const result = await this.errorHandler.safeAsync(
				() => this.markdownProcessor.processFile(file.path),
				"Failed to analyze note"
			);

			if (!result) {
				new Notice("Analysis failed - no result returned");
				return;
			}

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
				filePath: file.path,
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

			const result = await this.aiService.analyzePersonalContent(content);

			new SimpleAIAnalysisModal(this.app, result).open();
		} catch (error) {
			this.logger.error("Failed to analyze note with AI", error);
			new Notice(
				"Failed to analyze note with AI - check console for details"
			);
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

			if (!this.aiService.isReady()) {
				new Notice(
					"AI service not ready. Please check your configuration.",
					5000
				);
				return;
			}

			// Validate configuration before testing
			if (!this.settings.aiSettings.openaiConfig.apiKey) {
				new Notice(
					"OpenAI API key is required. Please configure it in settings.",
					5000
				);
				return;
			}

			await this.aiService.generateCompletion("Hello", { maxTokens: 5 });

			this.logger.info("OpenAI connection test successful");
			new Notice("✅ OpenAI connection successful!", 4000);
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

	/**
	 * Setup visual indicators for privacy-filtered content
	 */
	private setupPrivacyVisualIndicators(): void {
		// Add markdown post processor for preview mode
		this.registerMarkdownPostProcessor((element, context) => {
			if (!this.settings.enablePrivacyFilter) return;

			// Find privacy tags and add visual indicators
			const privacyTags = element.querySelectorAll(
				'a.tag[href*="#private-ai"], a.tag[href*="#confidential-ai"], a.tag[href*="#no-ai"]'
			);

			privacyTags.forEach((tag) => {
				tag.addClass("privacy-excluded");
				tag.setAttribute(
					"title",
					"This content is excluded from AI analysis"
				);
			});

			// Also check for custom privacy tags from settings
			this.settings.privacyTags.forEach((tagName) => {
				const customTags = element.querySelectorAll(
					`a.tag[href*="#${tagName}"]`
				);
				customTags.forEach((tag) => {
					tag.addClass("privacy-excluded");
					tag.setAttribute(
						"title",
						"This content is excluded from AI analysis"
					);
				});
			});
		});

		// Add file menu indicators for excluded files
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (this.isFileExcluded(file as TFile)) {
					menu.addItem((item) => {
						item.setTitle("🔒 Privacy Protected")
							.setIcon("shield")
							.setDisabled(true);
					});
				}
			})
		);

		// Add visual indicators to file explorer
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.updateFileExplorerIndicators();
			})
		);
	}

	/**
	 * Check if a file should be excluded based on privacy settings
	 */
	private isFileExcluded(file: TFile): boolean {
		if (!this.settings.enablePrivacyFilter || !file) return false;

		// Check if file is in excluded folder
		const filePath = file.path || "";
		for (const folder of this.settings.privacyFolders) {
			if (filePath.startsWith(folder)) {
				return true;
			}
		}

		// For more comprehensive checking, we'd need to read file content
		// For now, just check folder-based exclusions
		return false;
	}

	/**
	 * Update visual indicators in file explorer
	 */
	private updateFileExplorerIndicators(): void {
		if (!this.settings.enablePrivacyFilter) return;

		// Find all file titles in the explorer
		const fileElements = document.querySelectorAll(".nav-file-title");

		fileElements.forEach((element) => {
			const titleEl = element as HTMLElement;
			const filePath = titleEl.getAttribute("data-path") || "";

			// Check if file is in excluded folder
			const isExcluded = this.settings.privacyFolders.some((folder) =>
				filePath.startsWith(folder)
			);

			if (isExcluded) {
				titleEl.addClass("privacy-excluded");
				titleEl.setAttribute(
					"title",
					"This file is excluded from AI analysis"
				);
			} else {
				titleEl.removeClass("privacy-excluded");
				titleEl.removeAttribute("title");
			}
		});
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
		this.contentEl.empty();
	}
}

class SimpleAIAnalysisModal extends Modal {
	private copyButtonHandler?: () => void;
	private timeouts: number[] = [];

	constructor(app: App, private result: SimpleAnalysisResult) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "AI Analysis Results" });

		// Summary
		if (this.result.summary) {
			const summaryDiv = contentEl.createDiv();
			summaryDiv.createEl("h3", { text: "Summary" });
			summaryDiv.createEl("p", { text: this.result.summary });
		}

		// Key Insights
		if (this.result.keyInsights && this.result.keyInsights.length > 0) {
			const insightsDiv = contentEl.createDiv();
			insightsDiv.createEl("h3", { text: "Key Insights" });
			const insightsList = insightsDiv.createEl("ul");
			this.result.keyInsights.forEach((insight) => {
				insightsList.createEl("li", { text: insight });
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
		const metadataDiv = contentEl.createDiv();
		metadataDiv.createEl("h3", { text: "Analysis Metadata" });
		metadataDiv.createEl("p", {
			text: `Confidence: ${(this.result.confidence * 100).toFixed(1)}%`,
		});
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

		// Key Insights
		if (this.result.keyInsights && this.result.keyInsights.length > 0) {
			text += "## Key Insights\n";
			this.result.keyInsights.forEach((insight) => {
				text += `- ${insight}\n`;
			});
			text += "\n";
		}

		return text;
	}
}

/**
 * Setting tab for the RetrospectiveAI plugin
 */
class RetrospectiveAISettingTab extends PluginSettingTab {
	plugin: SimplifiedRetrospectAI;

	constructor(app: App, plugin: SimplifiedRetrospectAI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Add main title
		containerEl.createEl("h2", { text: "RetrospectAI Settings" });

		this.renderGeneralTab(containerEl);
		this.renderAIModelsTab(containerEl);
		this.renderPrivacyTab(containerEl);
	}

	private renderGeneralTab(container: HTMLElement): void {
		// Processing settings
		container.createEl("h3", { text: "Processing" });

		new Setting(container)
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

		new Setting(container)
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

		new Setting(container)
			.setName("Analysis Scope")
			.setDesc("Choose what content to analyze for pattern detection")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("whole-life", "Whole Life - Analyze all notes")
					.addOption(
						"work-only",
						"Work Only - Focus on work-related content"
					)
					.addOption(
						"personal-only",
						"Personal Only - Focus on personal content"
					)
					.addOption(
						"custom",
						"Custom - Advanced filtering (coming soon)"
					)
					.setValue(this.plugin.settings.analysisScope)
					.onChange(async (value) => {
						this.plugin.settings.analysisScope =
							value as AnalysisScope;
						await this.plugin.saveSettings();

						// Show notice about the scope change
						if (value === "custom") {
							new Notice(
								"Custom scope configuration coming in a future update",
								4000
							);
						} else {
							new Notice(
								`Analysis scope changed to: ${value.replace(
									"-",
									" "
								)}`,
								3000
							);
						}
					})
			);

		// Performance settings
		container.createEl("h3", { text: "Performance" });

		new Setting(container)
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

		new Setting(container)
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
		container.createEl("h3", { text: "Debug" });

		new Setting(container)
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
	}

	private renderAIModelsTab(container: HTMLElement): void {
		// Main AI settings
		container.createEl("h3", { text: "AI Configuration" });

		new Setting(container)
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

		new Setting(container)
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
		container.createEl("h3", { text: "OpenAI Configuration" });

		new Setting(container)
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

		new Setting(container)
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

		// Test connection button
		container.createEl("h3", { text: "Connection Testing" });

		new Setting(container)
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

	private renderPrivacyTab(container: HTMLElement): void {
		container.createEl("h3", { text: "Privacy Controls" });

		new Setting(container)
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

		new Setting(container)
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

		new Setting(container)
			.setName("Privacy Folders")
			.setDesc(
				"Folders to exclude from analysis (e.g., Private/, Personal/)"
			)
			.addText((text) =>
				text
					.setPlaceholder("Private/, Personal/, Confidential/")
					.setValue(this.plugin.settings.privacyFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.privacyFolders = value
							.split(",")
							.map((folder) => folder.trim())
							.filter((folder) => folder);
						await this.plugin.saveSettings();
					})
			);

		// NEW: Redaction strategy
		new Setting(container)
			.setName("Redaction Strategy")
			.setDesc("How to handle files with mixed public/private content")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("exclude", "Exclude Entire File")
					.addOption("redact", "Redact Private Sections")
					.addOption("summarize", "Summarize Without Details")
					.setValue(this.plugin.settings.redactionStrategy)
					.onChange(async (value) => {
						this.plugin.settings.redactionStrategy = value as
							| "exclude"
							| "redact"
							| "summarize";
						await this.plugin.saveSettings();
					})
			);

		// NEW: Audit logging
		new Setting(container)
			.setName("Enable Audit Log")
			.setDesc("Track what content was filtered for privacy compliance")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableAuditLog)
					.onChange(async (value) => {
						this.plugin.settings.enableAuditLog = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
