import {
	App,
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
} from "./ai-service";

// Simplified MVP Settings Interface
interface MVPSettings {
	// Core AI settings
	aiSettings: AIServiceSettings;
	
	// Basic privacy settings
	enablePrivacyFilter: boolean;
	privacyTags: string[];
	privacyFolders: string[];
	
	// Summary settings
	summaryWritingStyle: "business" | "personal" | "academic";
	
	// Simple performance settings
	maxFileSize: number;
	enableCaching: boolean;
	
	// Debug mode
	debugMode: boolean;
}

const MVP_DEFAULT_SETTINGS: MVPSettings = {
	aiSettings: DEFAULT_AI_SETTINGS,
	enablePrivacyFilter: true,
	privacyTags: ["private", "noai", "confidential"],
	privacyFolders: ["Private/", "Personal/", "Confidential/"],
	summaryWritingStyle: "personal",
	maxFileSize: 5 * 1024 * 1024, // 5MB (reduced from 10MB)
	enableCaching: true,
	debugMode: false,
};

export default class RetrospectiveAIPlugin extends Plugin {
	logger: Logger;
	errorHandler: ErrorHandler;
	settings: MVPSettings;
	markdownProcessor: MarkdownProcessingService;
	aiService: AIService;

	async onload() {
		// Initialize core services
		this.logger = new Logger("RetrospectAI", true, LogLevel.INFO);
		this.errorHandler = new ErrorHandler(this.logger);

		try {
			this.logger.info("Initializing RetrospectAI MVP");
			await this.initializePlugin();
			this.logger.info("RetrospectAI MVP initialized successfully");
			new Notice("RetrospectAI: Ready for use!");
		} catch (error) {
			this.logger.userError("Error initializing RetrospectAI", error);
			new Notice("RetrospectAI: Initialization failed. Check console for details.");
		}
	}

	private async initializePlugin() {
		await this.loadSettings();

		// Initialize markdown processing with simplified config
		const processingConfig: Partial<MarkdownProcessingConfig> = {
			enablePrivacyFilter: this.settings.enablePrivacyFilter,
			privacyTags: this.settings.privacyTags,
			enableMetadataExtraction: true,
			enableSectionDetection: true,
			maxFileSize: this.settings.maxFileSize,
			batchSize: 25, // Simplified batch size
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

		// Initialize AI if enabled
		if (this.settings.aiSettings.enableAI) {
			try {
				await this.aiService.initialize();
				this.logger.info("AI Service initialized successfully");
				
				// Test connection for primary provider
				if (this.settings.aiSettings.primaryProvider === "openai") {
					const testResult = await this.aiService.testProvider("openai");
					if (testResult.success) {
						this.logger.info("AI connection established");
					} else {
						this.logger.error("AI connection failed:", testResult.error);
						new Notice(`RetrospectAI: AI connection failed - ${testResult.error}`, 6000);
					}
				}
			} catch (error) {
				this.logger.error("Failed to initialize AI Service:", error);
				let errorMessage = "AI Service initialization failed";
				if (error instanceof Error) {
					if (error.message.includes("API key")) {
						errorMessage = "API key missing or invalid. Please configure it in settings.";
					} else if (error.message.includes("network")) {
						errorMessage = "Network connection failed. Check your internet connection.";
					}
				}
				new Notice(`RetrospectAI: ${errorMessage}`, 8000);
			}
		}

		this.setupUI();
		this.registerCommands();
	}

	private setupUI() {
		// Add ribbon icon
		const ribbonIcon = this.addRibbonIcon(
			"brain",
			"RetrospectAI: Analyze Current Note",
			() => this.analyzeCurrentNote()
		);
		ribbonIcon.addClass("retrospective-ai-ribbon");

		// Add status bar
		const statusBar = this.addStatusBarItem();
		statusBar.setText("RetrospectAI");
		statusBar.addClass("retrospective-ai-status");

		// Add settings tab
		this.addSettingTab(new MVPSettingsTab(this.app, this));
	}

	private registerCommands() {
		// Core analysis command
		this.addCommand({
			id: "analyze-current-note",
			name: "Analyze Current Note",
			callback: () => this.analyzeCurrentNote(),
		});

		// AI analysis command
		this.addCommand({
			id: "analyze-with-ai",
			name: "Analyze Current Note with AI",
			callback: () => this.analyzeCurrentNoteWithAI(),
		});

		// Basic summary creation command
		this.addCommand({
			id: "create-simple-summary",
			name: "Create Simple Summary",
			callback: () => this.createSimpleSummary(),
		});

		// Utility commands
		this.addCommand({
			id: "clear-cache",
			name: "Clear Processing Cache",
			callback: () => this.clearCache(),
		});

		this.addCommand({
			id: "test-ai-connection",
			name: "Test AI Connection",
			callback: () => this.testAIConnection(),
		});
	}

	// Core Analysis Functions
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
			const result = await this.markdownProcessor.processFile(activeFile.path);

			if (result.skipped) {
				new Notice(`Note skipped: ${result.skipReason}`);
				return;
			}

			// Show results in a modal
			new AnalysisResultModal(this.app, result).open();
			new Notice("Analysis complete!");

		} catch (error) {
			this.logger.error("Error analyzing note:", error);
			new Notice("Error analyzing note. Check console for details.");
		}
	}

	private async analyzeCurrentNoteWithAI() {
		if (!this.settings.aiSettings.enableAI) {
			new Notice("AI analysis is disabled. Enable it in settings.");
			return;
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to analyze");
			return;
		}

		try {
			new Notice("Analyzing note with AI...");
			const content = await this.app.vault.read(activeFile);
			
			// Apply privacy filter if enabled
			let processedContent = content;
			if (this.settings.enablePrivacyFilter) {
				const privacyFilter = this.markdownProcessor.getPrivacyFilter();
				if (privacyFilter && privacyFilter.shouldExcludeFile(activeFile.path, content)) {
					new Notice("Note contains private content and was excluded from AI analysis");
					return;
				}
				processedContent = privacyFilter ? privacyFilter.filterContent(content) : content;
			}

			const result = await this.aiService.analyzePersonalContent(
				processedContent,
				{
					extractPatterns: true,
					analysisDepth: 'comprehensive',
					enableCaching: this.settings.enableCaching,
				},
				{
					contentType: 'daily-reflection',
					complexity: 'medium',
					urgency: 'medium',
				}
			);

			new SimpleAIResultModal(this.app, result).open();
			new Notice("AI analysis complete!");

		} catch (error) {
			this.logger.error("Error in AI analysis:", error);
			new Notice("AI analysis failed. Check console for details.");
		}
	}

	private async createSimpleSummary() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file to analyze");
			return;
		}

		try {
			new Notice("Creating simple summary...");
			
			// Analyze the current note first
			const analysisResult = await this.markdownProcessor.processFile(activeFile.path);
			
			if (analysisResult.skipped) {
				new Notice(`Cannot create summary: ${analysisResult.skipReason}`);
				return;
			}

			// Create a simple summary note
			const summaryContent = this.generateSimpleSummaryContent(activeFile, analysisResult);
			const summaryPath = `Summaries/Summary - ${activeFile.basename}.md`;
			
			// Ensure Summaries folder exists
			await this.ensureFolderExists("Summaries");
			
			// Create the summary file
			await this.app.vault.create(summaryPath, summaryContent);
			
			new Notice(`Summary created: ${summaryPath}`);
			
			// Open the summary file
			const summaryFile = this.app.vault.getAbstractFileByPath(summaryPath);
			if (summaryFile instanceof TFile) {
				this.app.workspace.getLeaf().openFile(summaryFile);
			}

		} catch (error) {
			this.logger.error("Error creating summary:", error);
			if (error.message.includes("already exists")) {
				new Notice("Summary already exists. Delete it first or use a different name.");
			} else {
				new Notice("Failed to create summary. Check console for details.");
			}
		}
	}

	// Helper Functions
	private generateSimpleSummaryContent(file: TFile, result: ProcessingResult): string {
		const now = new Date();
		
		let content = `# Summary: ${file.basename}\n\n`;
		content += `**Created:** ${now.toLocaleString()}\n`;
		content += `**Original File:** [[${file.basename}]]\n\n`;
		
		content += `## Analysis Results\n\n`;
		content += `- **Processing Time:** ${result.processingTime}ms\n`;
		
		if (result.metadata) {
			content += `- **Word Count:** ${result.metadata.wordCount || 0}\n`;
			content += `- **Links:** ${result.metadata.links?.length || 0}\n`;
			content += `- **Tags:** ${result.metadata.tags?.length || 0}\n`;
		}
		
		if (result.sections && result.sections.length > 0) {
			content += `\n## Sections Found\n\n`;
			result.sections.forEach((section, index) => {
				content += `${index + 1}. ${section.title || 'Untitled Section'}\n`;
			});
		}
		
		content += `\n---\n*Generated by RetrospectAI MVP*`;
		
		return content;
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) {
			await this.app.vault.adapter.mkdir(folderPath);
		}
	}

	// Utility Functions
	private clearCache() {
		this.markdownProcessor.clearCache();
		new Notice("Processing cache cleared");
	}

	private async testAIConnection() {
		if (!this.settings.aiSettings.enableAI) {
			new Notice("AI is disabled in settings");
			return;
		}

		try {
			new Notice("Testing AI connection...");
			const provider = this.settings.aiSettings.primaryProvider;
			const result = await this.aiService.testProvider(provider);
			
			if (result.success) {
				new Notice(`AI connection successful (${provider})`);
			} else {
				new Notice(`AI connection failed: ${result.error}`, 6000);
			}
		} catch (error) {
			this.logger.error("Error testing AI connection:", error);
			new Notice("AI connection test failed. Check console for details.");
		}
	}

	// Settings Management
	async loadSettings() {
		this.settings = Object.assign({}, MVP_DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onunload() {
		this.logger.info("Unloading RetrospectAI MVP");
	}
}

// Simplified Analysis Result Modal
class AnalysisResultModal extends Modal {
	constructor(app: App, private result: ProcessingResult) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Note Analysis Results" });

		// Basic stats
		const statsDiv = contentEl.createDiv("analysis-stats");
		statsDiv.createEl("p", { text: `File: ${this.result.filePath}` });
		
		if (this.result.metadata) {
			statsDiv.createEl("p", { text: `Words: ${this.result.metadata.wordCount || 0}` });
			statsDiv.createEl("p", { text: `Links: ${this.result.metadata.links?.length || 0}` });
			statsDiv.createEl("p", { text: `Tags: ${this.result.metadata.tags?.length || 0}` });
		}

		if (this.result.sections) {
			statsDiv.createEl("p", { text: `Sections: ${this.result.sections.length}` });
		}

		// Processing info
		if (this.result.processingTime) {
			statsDiv.createEl("p", { text: `Processing time: ${this.result.processingTime}ms` });
		}

		// Close button
		const buttonDiv = contentEl.createDiv("modal-button-container");
		const closeButton = buttonDiv.createEl("button", { text: "Close" });
		closeButton.onclick = () => this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Simplified AI Analysis Modal
class SimpleAIResultModal extends Modal {
	constructor(app: App, private result: any) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "AI Analysis Results" });

		// Analysis content
		if (this.result && typeof this.result === 'object') {
			const analysisDiv = contentEl.createDiv("ai-analysis-content");
			analysisDiv.createEl("h3", { text: "AI Insights" });
			
			const analysisText = analysisDiv.createEl("div", { cls: "ai-analysis-text" });
			analysisText.innerHTML = JSON.stringify(this.result, null, 2).replace(/\n/g, '<br>');
		} else if (typeof this.result === 'string') {
			const analysisDiv = contentEl.createDiv("ai-analysis-content");
			analysisDiv.createEl("h3", { text: "AI Insights" });
			
			const analysisText = analysisDiv.createEl("div", { cls: "ai-analysis-text" });
			analysisText.innerHTML = this.result.replace(/\n/g, '<br>');
		}

		// Copy button
		const buttonDiv = contentEl.createDiv("modal-button-container");
		const copyButton = buttonDiv.createEl("button", { text: "Copy Analysis" });
		copyButton.onclick = () => {
			const textToCopy = typeof this.result === 'string' ? this.result : JSON.stringify(this.result, null, 2);
			navigator.clipboard.writeText(textToCopy);
			new Notice("Analysis copied to clipboard");
		};

		const closeButton = buttonDiv.createEl("button", { text: "Close" });
		closeButton.onclick = () => this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Simplified Settings Tab
class MVPSettingsTab extends PluginSettingTab {
	plugin: RetrospectiveAIPlugin;

	constructor(app: App, plugin: RetrospectiveAIPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'RetrospectAI MVP Settings' });

		// AI Configuration Section
		containerEl.createEl('h3', { text: 'AI Configuration' });

		new Setting(containerEl)
			.setName('Enable AI Analysis')
			.setDesc('Enable AI-powered analysis and insights')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.aiSettings.enableAI)
				.onChange(async (value) => {
					this.plugin.settings.aiSettings.enableAI = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('AI Provider')
			.setDesc('Choose your AI provider')
			.addDropdown(dropdown => dropdown
				.addOption('openai', 'OpenAI')
				.addOption('ollama', 'Ollama (Local)')
				.setValue(this.plugin.settings.aiSettings.primaryProvider)
				.onChange(async (value) => {
					this.plugin.settings.aiSettings.primaryProvider = value as any;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show provider-specific settings
				}));

		// Provider-specific settings
		if (this.plugin.settings.aiSettings.primaryProvider === 'openai') {
			new Setting(containerEl)
				.setName('OpenAI API Key')
				.setDesc('Your OpenAI API key')
				.addText(text => text
					.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.aiSettings.openaiConfig.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.openaiConfig.apiKey = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('OpenAI Model')
				.setDesc('OpenAI model to use')
				.addDropdown(dropdown => dropdown
					.addOption('gpt-4o-mini', 'GPT-4o Mini (Recommended)')
					.addOption('gpt-4o', 'GPT-4o')
					.addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo')
					.setValue(this.plugin.settings.aiSettings.openaiConfig.model)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.openaiConfig.model = value;
						await this.plugin.saveSettings();
					}));
		}

		if (this.plugin.settings.aiSettings.primaryProvider === 'ollama') {
			new Setting(containerEl)
				.setName('Ollama Endpoint')
				.setDesc('Ollama server endpoint')
				.addText(text => text
					.setPlaceholder('http://localhost:11434')
					.setValue(this.plugin.settings.aiSettings.ollamaConfig.endpoint)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.ollamaConfig.endpoint = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Ollama Model')
				.setDesc('Ollama model to use')
				.addText(text => text
					.setPlaceholder('llama2')
					.setValue(this.plugin.settings.aiSettings.ollamaConfig.model)
					.onChange(async (value) => {
						this.plugin.settings.aiSettings.ollamaConfig.model = value;
						await this.plugin.saveSettings();
					}));
		}

		// Privacy Section
		containerEl.createEl('h3', { text: 'Privacy Settings' });

		new Setting(containerEl)
			.setName('Enable Privacy Filter')
			.setDesc('Automatically exclude private content from AI analysis')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePrivacyFilter)
				.onChange(async (value) => {
					this.plugin.settings.enablePrivacyFilter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Privacy Tags')
			.setDesc('Tags that mark content as private (comma-separated)')
			.addText(text => text
				.setPlaceholder('private, noai, confidential')
				.setValue(this.plugin.settings.privacyTags.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.privacyTags = value.split(',').map(tag => tag.trim());
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Private Folders')
			.setDesc('Folders to exclude from AI analysis (comma-separated)')
			.addText(text => text
				.setPlaceholder('Private/, Personal/, Confidential/')
				.setValue(this.plugin.settings.privacyFolders.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.privacyFolders = value.split(',').map(folder => folder.trim());
					await this.plugin.saveSettings();
				}));

		// Summary Settings
		containerEl.createEl('h3', { text: 'Summary Settings' });

		new Setting(containerEl)
			.setName('Writing Style')
			.setDesc('Style for AI-generated summaries')
			.addDropdown(dropdown => dropdown
				.addOption('personal', 'Personal & Encouraging')
				.addOption('business', 'Business & Analytical')
				.addOption('academic', 'Academic & Neutral')
				.setValue(this.plugin.settings.summaryWritingStyle)
				.onChange(async (value) => {
					this.plugin.settings.summaryWritingStyle = value as any;
					await this.plugin.saveSettings();
				}));

		// Performance Section
		containerEl.createEl('h3', { text: 'Performance' });

		new Setting(containerEl)
			.setName('Enable Caching')
			.setDesc('Cache analysis results for better performance')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCaching)
				.onChange(async (value) => {
					this.plugin.settings.enableCaching = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Debug Mode')
			.setDesc('Enable detailed logging for troubleshooting')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));
	}
} 