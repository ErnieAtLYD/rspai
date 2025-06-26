import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	moment,
} from "obsidian";

interface JournalReflectionSettings {
	openaiApiKey: string;
	openaiModel: string;
	daysToInclude: number;
	excludePrivate: boolean;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MAX_TOKENS = 1000;
const OPENAI_TEMPERATURE = 0.7;


const DEFAULT_SETTINGS: JournalReflectionSettings = {
	openaiApiKey: "",
	openaiModel: OPENAI_MODEL,
	daysToInclude: 7,
	excludePrivate: true,
};


export default class JournalReflectionPlugin extends Plugin {
	settings: JournalReflectionSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon("book-open", "Create Weekly Journal Summary", () => {
			this.createWeeklySummary();
		});

		// Add command
		this.addCommand({
			id: "create-weekly-summary",
			name: "Create Weekly Journal Summary",
			callback: () => this.createWeeklySummary(),
		});

		// Add settings tab
		this.addSettingTab(new JournalReflectionSettingTab(this.app, this));
	}

	async createWeeklySummary() {
		if (!this.settings.openaiApiKey) {
			new Notice("Please set your OpenAI API key in settings first!");
			return;
		}

		new Notice("Creating weekly journal summary...");

		try {
			// Find recent notes
			const recentNotes = await this.findRecentNotes();

			if (recentNotes.length === 0) {
				new Notice("No journal entries found in the last week.");
				return;
			}

			// Get content from notes
			const notesContent = await this.getNotesContent(recentNotes);

			if (notesContent.trim().length === 0) {
				new Notice(
					"No content found in recent notes (all may be private)."
				);
				return;
			}

			// Generate summary with OpenAI
			const summary = await this.generateSummary(
				notesContent,
				recentNotes
			);

			// Create summary note
			await this.createSummaryNote(summary, recentNotes);

			new Notice("Weekly journal summary created!");
		} catch (error) {
			console.error("Error creating summary:", error);
			new Notice(`Failed to create summary: ${error.message}`);
		}
	}

	async findRecentNotes(): Promise<TFile[]> {
		const files = this.app.vault.getMarkdownFiles();
		const cutoffDate = moment().subtract(
			this.settings.daysToInclude,
			"days"
		);

		return files.filter((file) => {
			const fileDate = moment(file.stat.mtime);
			return fileDate.isAfter(cutoffDate);
		});
	}

	async getNotesContent(files: TFile[]): Promise<string> {
		let combinedContent = "";

		for (const file of files) {
			const content = await this.app.vault.read(file);

			// Skip if private (contains #private tag)
			if (this.settings.excludePrivate && content.includes("#private")) {
				continue;
			}

			combinedContent += `\n## ${file.basename}\n${content}\n`;
		}

		return combinedContent;
	}

	async generateSummary(content: string, files: TFile[]): Promise<string> {
		const prompt = `Please analyze these journal entries from the past week and provide a thoughtful reflection. Focus on:

1. Key themes and patterns you notice
2. Emotional journey and growth
3. Important events or insights
4. Areas for future reflection or action

Be encouraging and supportive in your tone, like a wise friend reflecting back what they've observed.

Journal entries:
${content}

Please provide a structured reflection that would be meaningful for weekly review.`;

		const response = await fetch(
			OPENAI_API_URL,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.settings.openaiApiKey}`,
				},
				body: JSON.stringify({
					model: this.settings.openaiModel,
					messages: [
						{
							role: "user",
							content: prompt,
						},
					],
					max_tokens: OPENAI_MAX_TOKENS,
					temperature: OPENAI_TEMPERATURE,
				}),
			}
		);

		if (!response.ok) {
			throw new Error(
				`OpenAI API error: ${response.status} ${response.statusText}`
			);
		}

		const data = await response.json();
		return data.choices[0].message.content;
	}

	async createSummaryNote(
		summary: string,
		sourceFiles: TFile[]
	): Promise<void> {
		const date = moment().format("YYYY-MM-DD");
		const summaryPath = `Summaries/Weekly Reflection - ${date}.md`;

		// Create Summaries folder if it doesn't exist
		const summariesFolder =
			this.app.vault.getAbstractFileByPath("Summaries");
		if (!summariesFolder) {
			await this.app.vault.createFolder("Summaries");
		}

		// Create backlinks to source files
		const backlinks = sourceFiles
			.map((file) => `- [[${file.basename}]]`)
			.join("\n");

		const summaryContent = `# Weekly Reflection - ${date}

*Generated on ${moment().format("YYYY-MM-DD [at] HH:mm")}*

${summary}

---

## Source Notes
${backlinks}

---
*This reflection was generated from ${
			sourceFiles.length
		} journal entries from the past ${this.settings.daysToInclude} days.*
`;

		// Create the summary file
		try {
			await this.app.vault.create(summaryPath, summaryContent);

			// Open the summary file
			const summaryFile =
				this.app.vault.getAbstractFileByPath(summaryPath);
			if (summaryFile instanceof TFile) {
				this.app.workspace.getLeaf().openFile(summaryFile);
			}
		} catch (error) {
			if (error.message.includes("already exists")) {
				new Notice(
					"Summary for this week already exists. Delete it first or wait for next week."
				);
			} else {
				throw error;
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class JournalReflectionSettingTab extends PluginSettingTab {
	plugin: JournalReflectionPlugin;

	constructor(app: App, plugin: JournalReflectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Journal Reflection Settings" });

		// OpenAI API Key
		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Your OpenAI API key for generating reflections")
			.addText((text) =>
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					})
			);

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
	}
}
