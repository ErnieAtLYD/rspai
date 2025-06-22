import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

// Import the real Logger and ErrorHandler instead of creating simple ones
import { Logger, LogLevel } from "./logger";
import { ErrorHandler } from "./error-handler";

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
} from "./ai-service";

// Simplified Settings (reduced from complex MVP settings)
interface SimpleSettings {
	// Core AI
	openaiApiKey: string;
	enableAI: boolean;

	// Basic Privacy
	privacyTags: string[];
	privacyFolders: string[];

	// Simple Performance
	maxFileSize: number;
	enableCaching: boolean;
	debugMode: boolean;
}

const SIMPLE_DEFAULT_SETTINGS: SimpleSettings = {
	openaiApiKey: "",
	enableAI: false,
	privacyTags: ["private", "noai", "confidential"],
	privacyFolders: ["Private/", "Personal/"],
	maxFileSize: 5 * 1024 * 1024, // 5MB
	enableCaching: true,
	debugMode: false,
};

export default class SimplifiedRetrospectAI extends Plugin {
	logger: Logger;
	errorHandler: ErrorHandler;
	settings: SimpleSettings;
	markdownProcessor: MarkdownProcessingService;
	aiService: AIService;

	async onload() {
		this.logger = new Logger("RetrospectAI", false, LogLevel.INFO);
		this.errorHandler = new ErrorHandler(this.logger);

		await this.loadSettings();
		await this.initializeServices();
		this.registerCommands();
		this.addRibbonIcon("brain", "Analyze Note", () =>
			this.analyzeCurrentNote()
		);
		this.addSettingTab(new SimpleSettingsTab(this.app, this));

		this.logger.info("Simplified RetrospectAI loaded");
	}

	private async initializeServices() {
		// Simplified markdown processor config
		const config: Partial<MarkdownProcessingConfig> = {
			enablePrivacyFilter: true,
			privacyTags: this.settings.privacyTags,
			maxFileSize: this.settings.maxFileSize,
			enableCaching: this.settings.enableCaching,
		};

		this.markdownProcessor = new MarkdownProcessingService(
			this.app,
			this.logger,
			this.errorHandler,
			config
		);

		// Simplified AI service
		if (this.settings.enableAI) {
			const aiSettings: AIServiceSettings = {
				...DEFAULT_AI_SETTINGS,
				enableAI: true,
				primaryProvider: "openai",
				openaiConfig: {
					...DEFAULT_AI_SETTINGS.openaiConfig,
					apiKey: this.settings.openaiApiKey,
				},
			};

			this.aiService = new AIService(
				this.logger,
				this.errorHandler,
				aiSettings
			);
			await this.aiService.initialize();
		}
	}

	private registerCommands() {
		// Single main command
		this.addCommand({
			id: "analyze-current-note",
			name: "Analyze Current Note",
			callback: () => this.analyzeCurrentNote(),
		});

		// AI command if enabled
		if (this.settings.enableAI) {
			this.addCommand({
				id: "analyze-with-ai",
				name: "Analyze with AI",
				callback: () => this.analyzeWithAI(),
			});
		}
	}

	private async analyzeCurrentNote() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active file");
			return;
		}

		const result = await this.errorHandler.safeAsync(
			() => this.markdownProcessor.processFile(file),
			"Failed to analyze note"
		);

		if (result) {
			new AnalysisModal(this.app, result).open();
		}
	}

	private async analyzeWithAI() {
		if (!this.settings.enableAI || !this.aiService) {
			new Notice("AI analysis not enabled");
			return;
		}

		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active file");
			return;
		}

		const content = await this.app.vault.read(file);
		const insights = await this.aiService.generateInsights(
			content.substring(0, 3000)
		);
		const insights = analysis.summary || "No insights available";

		new AIInsightsModal(this.app, insights).open();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			SIMPLE_DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// Simple Analysis Modal
class AnalysisModal extends Modal {
	constructor(app: App, private result: ProcessingResult) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Note Analysis" });

		// Show basic stats
		const stats = contentEl.createDiv();
		stats.innerHTML = `
			<p><strong>Sections:</strong> ${
				this.result.sections?.length || 0
			}</p>
			<p><strong>Elements:</strong> ${this.result.parsedContent?.elements?.length || 0}</p>
			<p><strong>Word Count:</strong> ${this.result.parsedContent?.metadata?.wordCount || 0}</p>
		`;

		const button = contentEl.createEl("button", { text: "Close" });
		button.onclick = () => this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}

// Simple AI Insights Modal
class AIInsightsModal extends Modal {
	constructor(app: App, private insights: string) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "AI Insights" });

		const insightsDiv = contentEl.createDiv();
		insightsDiv.innerHTML = this.insights.replace(/\n/g, "<br>");

		const button = contentEl.createEl("button", { text: "Close" });
		button.onclick = () => this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}

// Simplified Settings Tab
class SimpleSettingsTab extends PluginSettingTab {
	plugin: SimplifiedRetrospectAI;

	constructor(app: App, plugin: SimplifiedRetrospectAI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "RetrospectAI Settings" });

		// AI Settings
		new Setting(containerEl)
			.setName("Enable AI Analysis")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableAI)
					.onChange(async (value) => {
						this.plugin.settings.enableAI = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("OpenAI API Key").addText((text) =>
			text
				.setPlaceholder("sk-...")
				.setValue(this.plugin.settings.openaiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value;
					await this.plugin.saveSettings();
				})
		);

		// Privacy Settings
		new Setting(containerEl)
			.setName("Privacy Tags")
			.setDesc("Tags to exclude from analysis")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.privacyTags.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.privacyTags = value
							.split(",")
							.map((t) => t.trim());
						await this.plugin.saveSettings();
					})
			);
	}
}
