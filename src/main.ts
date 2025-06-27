// src/main.ts

import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	moment,
} from "obsidian";

interface JournalReflectionSettings {
	openaiApiKey: string;
	openaiModel: string;
	daysToInclude: number;
	excludePrivate: boolean;
	periodicNoteFolders: string[];
	reflectionFolder: string;
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
	periodicNoteFolders: ["Daily Notes"],
	reflectionFolder: "Summaries",
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
		const cutoffDate = moment().subtract(
			this.settings.daysToInclude,
			"days"
		);

		// Try folder-based approach first
		const folderFiles = await this.getPeriodicFilesFromFolders();

		if (folderFiles.length > 0) {
			// Apply date filtering to folder-discovered files
			const recentFolderFiles = folderFiles.filter((file) => {
				const fileDate = moment(file.stat.mtime);
				return fileDate.isAfter(cutoffDate);
			});

			console.log(
				`Found ${recentFolderFiles.length} recent files from journal folder (${folderFiles.length} total)`
			);
			return recentFolderFiles;
		}

		// Fallback to current time-based filtering across all files
		console.log(
			"No journal folder configured or no files found, falling back to vault-wide search"
		);
		const allFiles = this.app.vault.getMarkdownFiles();

		return allFiles.filter((file) => {
			const fileDate = moment(file.stat.mtime);
			return fileDate.isAfter(cutoffDate);
		});
	}

	/**
	 * Get periodic files from configured folders
	 * @returns {Promise<TFile[]>} - Array of markdown files from configured folders
	 * @description
	 * This method checks the configured journal folder and collects all markdown files.
	 * Handles cases where folders don't exist gracefully by returning empty array.
	 */
	async getPeriodicFilesFromFolders(): Promise<TFile[]> {
		const periodicFiles: TFile[] = [];

		// If no periodic note folders are configured or empty, return empty array
		if (
			!this.settings.periodicNoteFolders ||
			this.settings.periodicNoteFolders.length === 0
		) {
			return periodicFiles;
		}

		// Process each configured folder
		for (const folderPath of this.settings.periodicNoteFolders) {
			if (!folderPath || folderPath.trim() === "") {
				continue; // Skip empty folder paths
			}

			const trimmedPath = folderPath.trim();

			try {
				// Check if the folder exists
				const folder =
					this.app.vault.getAbstractFileByPath(trimmedPath);

				if (!folder || !(folder instanceof TFolder)) {
					// Folder doesn't exist, handle gracefully
					console.log(
						`Periodic note folder "${trimmedPath}" not found, skipping`
					);
					continue;
				}

				// Get all files in the folder (including subfolders)
				const allFiles = this.app.vault.getMarkdownFiles();

				// Filter files that are within the specified folder
				const folderFiles = allFiles.filter((file) => {
					return (
						file.path.startsWith(trimmedPath + "/") ||
						file.path === trimmedPath ||
						(trimmedPath === "" && !file.path.includes("/"))
					);
				});

				periodicFiles.push(...folderFiles);

				console.log(
					`Found ${folderFiles.length} markdown files in periodic note folder "${trimmedPath}"`
				);
			} catch (error) {
				// Handle any errors gracefully
				console.error(
					`Error accessing periodic note folder "${trimmedPath}":`,
					error
				);
			}
		}

		return periodicFiles;
	}

	/**
	 * Get the content of the notes
	 * @param files - The files to get the content of
	 * @returns {Promise<string>} - The content of the notes
	 * @description
	 * This function is used to get the content of the notes.
	 */
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

		const response = await fetch(OPENAI_API_URL, {
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
		});

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
		const summaryPath = `${this.settings.reflectionFolder}/Weekly Reflection - ${date}.md`;

		// Create Summaries folder if it doesn't exist
		const summariesFolder =
			this.app.vault.getAbstractFileByPath(this.settings.reflectionFolder);
		if (!summariesFolder) {
			await this.app.vault.createFolder(this.settings.reflectionFolder);
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
	private async migrateSettings(loadedData: Record<string, unknown>): Promise<void> {
		let needsSave = false;

		// Migration: Convert old journalFolder to new periodicNoteFolders array
		if (loadedData.journalFolder && !loadedData.periodicNoteFolders) {
			const {journalFolder} = loadedData;
			if (typeof journalFolder === 'string') {
				const oldFolder = journalFolder.trim();
				if (oldFolder) {
					this.settings.periodicNoteFolders = [oldFolder];
					console.log(`Migrated journal folder "${oldFolder}" to periodicNoteFolders array`);
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
			(folder) => folder && typeof folder === "string" && folder.trim().length > 0
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
			console.log("Settings migration completed and saved");
		}
	}

	async saveSettings() {
		// Validate and clean settings before saving
		this.validateSettings();

		await this.saveData(this.settings);
		console.log("Settings saved successfully", this.settings);
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

		if (!this.settings.reflectionFolder || this.settings.reflectionFolder.trim() === "") {
			this.settings.reflectionFolder = DEFAULT_SETTINGS.reflectionFolder;
		}
	}

	/**
	 * Test settings persistence (for development/debugging)
	 */
	async testSettingsPersistence(): Promise<void> {
		console.log("=== Testing Settings Persistence ===");

		// Save current settings
		const originalSettings = { ...this.settings };
		console.log("Original settings:", originalSettings);

		// Modify settings
		const testFolders = ["Test Folder 1", "Test Folder 2", "Test/Nested"];
		this.settings.periodicNoteFolders = testFolders;
		this.settings.daysToInclude = 14;

		console.log("Modified settings:", this.settings);

		// Save and reload
		await this.saveSettings();
		await this.loadSettings();

		console.log("Reloaded settings:", this.settings);

		// Verify persistence
		const foldersMatch =
			JSON.stringify(this.settings.periodicNoteFolders) ===
			JSON.stringify(testFolders);
		const daysMatch = this.settings.daysToInclude === 14;

		if (foldersMatch && daysMatch) {
			new Notice("✅ Settings persistence test PASSED");
			console.log("✅ Settings persistence test PASSED");
		} else {
			new Notice("❌ Settings persistence test FAILED");
			console.log("❌ Settings persistence test FAILED");
			console.log("Expected folders:", testFolders);
			console.log("Actual folders:", this.settings.periodicNoteFolders);
		}

		// Restore original settings
		this.settings = originalSettings;
		await this.saveSettings();
		console.log("Restored original settings");
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
			cls: "setting-item-description",
		});
		helpToggle.innerHTML = `<a href="#" style="color: var(--text-accent); text-decoration: none;">📁 Show folder configuration help</a>`;
		helpToggle.style.marginTop = "5px";
		helpToggle.style.marginBottom = "15px";
		helpToggle.style.cursor = "pointer";
		
		const folderHelpEl = containerEl.createDiv({
			cls: "setting-item-description",
		});
		folderHelpEl.innerHTML = `
			<strong>Format:</strong> <code>Daily Notes, Journal/2024, Work/Logs</code><br>
			<strong>Examples:</strong> Single: <code>Daily Notes</code> | Multiple: <code>Daily Notes, Journal</code><br>
			<strong>Behavior:</strong> Searches specified folders first, falls back to entire vault if none found<br>
			<strong>Tips:</strong> Leave empty for vault-wide search • Check validation icon (✓/✗/ℹ) for status
		`;
		folderHelpEl.style.marginTop = "8px";
		folderHelpEl.style.marginBottom = "20px";
		folderHelpEl.style.fontSize = "0.85em";
		folderHelpEl.style.color = "var(--text-muted)";
		folderHelpEl.style.lineHeight = "1.3";
		folderHelpEl.style.padding = "8px";
		folderHelpEl.style.backgroundColor = "var(--background-secondary)";
		folderHelpEl.style.borderRadius = "4px";
		folderHelpEl.style.border = "1px solid var(--background-modifier-border)";
		folderHelpEl.style.display = "none";
		
		helpToggle.addEventListener("click", (e) => {
			e.preventDefault();
			const isVisible = folderHelpEl.style.display !== "none";
			folderHelpEl.style.display = isVisible ? "none" : "block";
			helpToggle.innerHTML = isVisible 
				? `<a href="#" style="color: var(--text-accent); text-decoration: none;">📁 Show folder configuration help</a>`
				: `<a href="#" style="color: var(--text-accent); text-decoration: none;">📁 Hide folder configuration help</a>`;
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
				iconEl.innerHTML = "✓";
				iconEl.style.color = "var(--color-green)";
				break;
			case "error":
				iconEl.innerHTML = "✗";
				iconEl.style.color = "var(--color-red)";
				break;
			case "info":
				iconEl.innerHTML = "ℹ";
				iconEl.style.color = "var(--color-blue)";
				break;
		}

		// Style the icon
		iconEl.style.position = "absolute";
		iconEl.style.right = "10px";
		iconEl.style.top = "50%";
		iconEl.style.transform = "translateY(-50%)";
		iconEl.style.fontSize = "16px";
		iconEl.style.fontWeight = "bold";
		iconEl.style.cursor = "help";
		iconEl.title = tooltip;

		// Make the setting container relative for absolute positioning
		const settingControl = setting.settingEl.querySelector(
			".setting-item-control"
		);
		if (settingControl) {
			(settingControl as HTMLElement).style.position = "relative";
			settingControl.appendChild(iconEl);
		}
	}
}
