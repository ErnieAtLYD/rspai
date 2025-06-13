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
import { AIService, AIServiceSettings, DEFAULT_AI_SETTINGS } from "./ai-service";

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
	debugMode: true,
	logLevel: LogLevel.DEBUG,
	aiSettings: DEFAULT_AI_SETTINGS,
};

export default class RetrospectiveAIPlugin extends Plugin {
	logger: Logger;
	errorHandler: ErrorHandler;
	settings: RetrospectiveAISettings;
	markdownProcessor: MarkdownProcessingService;
	aiService: AIService;

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

		// Initialize AI service if enabled
		if (this.settings.aiSettings.enableAI) {
			try {
				await this.aiService.initialize();
				this.logger.info("AI Service initialized successfully");
			} catch (error) {
				this.logger.warn("Failed to initialize AI Service:", error);
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
			
			const result = await this.aiService.analyzePersonalContent(content, {
				analysisDepth: 'standard',
			});

			if (result.success) {
				new AIAnalysisModal(this.app, result).open();
			} else {
				new Notice(`AI analysis failed: ${result.error || "Unknown error"}`);
			}
		} catch (error) {
			this.logger.error("Failed to analyze note with AI", error);
			new Notice("Failed to analyze note with AI - check console for details");
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
		if (!this.settings.aiSettings.enableAI) {
			new Notice("AI is disabled. Enable it in settings first.");
			return;
		}

		try {
			new Notice("Testing AI connection...");
			const provider = this.settings.aiSettings.primaryProvider;
			const result = await this.aiService.testProvider(provider);
			
			if (result.success) {
				new Notice(`✅ ${provider} connection successful!`);
			} else {
				new Notice(`❌ ${provider} connection failed: ${result.error}`);
			}
		} catch (error) {
			this.logger.error("Failed to test AI connection", error);
			new Notice("Failed to test AI connection - check console for details");
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
		
		// Dispose of AI service
		if (this.aiService) {
			await this.aiService.dispose();
		}
		
		this.logger.info("RetrospectAI plugin unloaded");
	}

	private async loadSettings() {
		await this.errorHandler.safeAsync(
			async () => {
				this.logger.debug("Loading plugin settings");
				const settings = await this.loadData();
				this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
			},
			"Failed to load plugin settings",
			false
		);
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
	constructor(app: App, private result: any) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "AI Analysis Results" });

		if (!this.result.success) {
			contentEl.createEl("p", {
				text: `Analysis failed: ${this.result.error || "Unknown error"}`,
				cls: "mod-error",
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
			
			const patternsList = patternsDiv.createEl("ul");
			this.result.patterns.forEach((pattern: any) => {
				const item = patternsList.createEl("li");
				item.createEl("strong", { text: pattern.title });
				item.createEl("p", { text: pattern.description });
				item.createEl("small", { text: `Confidence: ${(pattern.confidence * 100).toFixed(1)}%` });
			});
		}

		// Insights
		if (this.result.insights && this.result.insights.length > 0) {
			const insightsDiv = contentEl.createDiv();
			insightsDiv.createEl("h3", { text: "Insights" });
			
			const insightsList = insightsDiv.createEl("ul");
			this.result.insights.forEach((insight: string) => {
				insightsList.createEl("li", { text: insight });
			});
		}

		// Recommendations
		if (this.result.recommendations && this.result.recommendations.length > 0) {
			const recommendationsDiv = contentEl.createDiv();
			recommendationsDiv.createEl("h3", { text: "Recommendations" });
			
			const recommendationsList = recommendationsDiv.createEl("ul");
			this.result.recommendations.forEach((recommendation: string) => {
				recommendationsList.createEl("li", { text: recommendation });
			});
		}

		// Metadata
		if (this.result.orchestratorMetadata) {
			const metadataDiv = contentEl.createDiv();
			metadataDiv.createEl("h3", { text: "Analysis Metadata" });
			metadataDiv.createEl("p", { text: `Model used: ${this.result.modelUsed}` });
			metadataDiv.createEl("p", { text: `Processing time: ${this.result.processingTime}ms` });
			metadataDiv.createEl("p", { text: `Confidence: ${(this.result.confidence * 100).toFixed(1)}%` });
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class AIStatusModal extends Modal {
	constructor(app: App, private status: any) {
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
			text: `Initialized: ${this.status.initialized ? "✅ Yes" : "❌ No"}` 
		});
		statusDiv.createEl("p", { 
			text: `Enabled: ${this.status.enabled ? "✅ Yes" : "❌ No"}` 
		});
		statusDiv.createEl("p", { 
			text: `Active Provider: ${this.status.activeProvider || "None"}` 
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
		metricsDiv.createEl("p", { text: `Total Requests: ${this.status.metrics.totalRequests}` });
		metricsDiv.createEl("p", { text: `Successful Requests: ${this.status.metrics.successfulRequests}` });
		metricsDiv.createEl("p", { text: `Average Response Time: ${this.status.metrics.averageResponseTime.toFixed(2)}ms` });

		// Errors
		if (this.status.lastError) {
			const errorDiv = contentEl.createDiv();
			errorDiv.createEl("h3", { text: "Last Error" });
			errorDiv.createEl("p", { 
				text: this.status.lastError,
				cls: "mod-error"
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
						await this.plugin.aiService.updateSettings({ enableAI: value });
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
						this.plugin.settings.aiSettings.primaryProvider = value as any;
						await this.plugin.saveSettings();
						await this.plugin.aiService.updateSettings({ primaryProvider: value as any });
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
						this.plugin.settings.aiSettings.privacyLevel = value as any;
						await this.plugin.saveSettings();
						await this.plugin.aiService.updateSettings({ privacyLevel: value as any });
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
					.setValue(this.plugin.settings.aiSettings.openaiConfig.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.openaiConfig.apiKey = value;
						await this.plugin.saveSettings();
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
					.setValue(this.plugin.settings.aiSettings.openaiConfig.model)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.openaiConfig.model = value;
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
					.setValue(this.plugin.settings.aiSettings.ollamaConfig.endpoint)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.ollamaConfig.endpoint = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ollama Model")
			.setDesc("Which Ollama model to use")
			.addText((text) =>
				text
					.setPlaceholder("llama2")
					.setValue(this.plugin.settings.aiSettings.ollamaConfig.model)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.ollamaConfig.model = value;
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
						await this.plugin.testAIConnection();
					})
			);
	}
}
