import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	requestUrl,
} from "obsidian";

// Ultra-simple settings
interface SimpleSettings {
	openaiApiKey: string;
	enableAI: boolean;
	privacyTags: string;
	summaryFolder: string;
}

const DEFAULT_SETTINGS: SimpleSettings = {
	openaiApiKey: "",
	enableAI: false,
	privacyTags: "private,noai,confidential",
	summaryFolder: "Summaries",
};

// Simple logger - inline instead of separate file
class SimpleLogger {
	constructor(private name: string) {}
	
	info(msg: string) { console.log(`[${this.name}] ${msg}`); }
	error(msg: string, err?: any) { 
		console.error(`[${this.name}] ${msg}`, err); 
		new Notice(`${this.name}: ${msg}`);
	}
}

// Simple AI service - inline instead of complex abstraction
class SimpleAI {
	constructor(private apiKey: string, private logger: SimpleLogger) {}
	
	async analyze(content: string): Promise<string> {
		if (!this.apiKey) throw new Error("API key required");
		
		const response = await requestUrl({
			url: "https://api.openai.com/v1/chat/completions",
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [{
					role: "user",
					content: `Analyze this note and provide key insights:\n\n${content}`
				}],
				max_tokens: 500
			})
		});
		
		return response.json.choices[0].message.content;
	}
}

export default class UltraSimpleRetrospectAI extends Plugin {
	settings: SimpleSettings;
	logger: SimpleLogger;
	ai: SimpleAI;

	async onload() {
		this.logger = new SimpleLogger("RetrospectAI");
		await this.loadSettings();
		
		if (this.settings.enableAI && this.settings.openaiApiKey) {
			this.ai = new SimpleAI(this.settings.openaiApiKey, this.logger);
		}

		// Single command - analyze current note
		this.addCommand({
			id: "analyze-note",
			name: "Analyze Current Note",
			callback: () => this.analyzeCurrentNote(),
		});

		// Single ribbon icon
		this.addRibbonIcon("brain", "Analyze Note", () => this.analyzeCurrentNote());

		// Settings
		this.addSettingTab(new SimpleSettingsTab(this.app, this));
		
		this.logger.info("Ultra-simple RetrospectAI loaded");
	}

	private async analyzeCurrentNote() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active file");
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			
			// Simple privacy check
			const privacyTags = this.settings.privacyTags.split(",").map(t => t.trim());
			if (privacyTags.some(tag => content.includes(`#${tag}`))) {
				new Notice("File contains privacy tags - skipping analysis");
				return;
			}

			// Basic analysis without AI
			const analysis = this.basicAnalysis(content, file);
			
			// AI analysis if enabled
			let aiInsights = "";
			if (this.settings.enableAI && this.ai) {
				try {
					aiInsights = await this.ai.analyze(content.substring(0, 3000)); // Limit content
				} catch (error) {
					this.logger.error("AI analysis failed", error);
					aiInsights = "AI analysis unavailable";
				}
			}

			// Show results
			new ResultModal(this.app, analysis, aiInsights).open();
			
		} catch (error) {
			this.logger.error("Analysis failed", error);
		}
	}

	private basicAnalysis(content: string, file: TFile): string {
		const lines = content.split('\n');
		const wordCount = content.split(/\s+/).length;
		const headings = lines.filter(line => line.startsWith('#')).length;
		const links = (content.match(/\[\[.*?\]\]/g) || []).length;
		const tags = (content.match(/#\w+/g) || []).length;

		return `# Analysis: ${file.name}

**Basic Stats:**
- Words: ${wordCount}
- Lines: ${lines.length}
- Headings: ${headings}
- Links: ${links}
- Tags: ${tags}

**Created:** ${new Date(file.stat.ctime).toLocaleDateString()}
**Modified:** ${new Date(file.stat.mtime).toLocaleDateString()}`;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// Simple result modal
class ResultModal extends Modal {
	constructor(app: App, private basic: string, private ai: string) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl("h2", { text: "Note Analysis" });
		
		// Basic analysis
		const basicDiv = contentEl.createDiv();
		basicDiv.innerHTML = this.basic.replace(/\n/g, '<br>');
		
		// AI analysis if available
		if (this.ai && this.ai !== "AI analysis unavailable") {
			contentEl.createEl("h3", { text: "AI Insights" });
			const aiDiv = contentEl.createDiv();
			aiDiv.innerHTML = this.ai.replace(/\n/g, '<br>');
		}
		
		// Close button
		const button = contentEl.createEl("button", { text: "Close" });
		button.onclick = () => this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Simple settings tab
class SimpleSettingsTab extends PluginSettingTab {
	plugin: UltraSimpleRetrospectAI;

	constructor(app: App, plugin: UltraSimpleRetrospectAI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'RetrospectAI Settings' });

		new Setting(containerEl)
			.setName('Enable AI Analysis')
			.setDesc('Use OpenAI for advanced insights')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAI)
				.onChange(async (value) => {
					this.plugin.settings.enableAI = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Your OpenAI API key for AI analysis')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.openaiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value;
					await this.plugin.saveSettings();
					if (value && this.plugin.settings.enableAI) {
						this.plugin.ai = new SimpleAI(value, this.plugin.logger);
					}
				}));

		new Setting(containerEl)
			.setName('Privacy Tags')
			.setDesc('Comma-separated tags to exclude from analysis')
			.addText(text => text
				.setValue(this.plugin.settings.privacyTags)
				.onChange(async (value) => {
					this.plugin.settings.privacyTags = value;
					await this.plugin.saveSettings();
				}));
	}
}