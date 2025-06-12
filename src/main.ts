import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { ErrorHandler } from "./error-handler";
import { Logger, LogLevel } from "./logger";

interface RetrospectiveAISettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: RetrospectiveAISettings = {
	mySetting: "default",
};

export default class RetrospectiveAIPlugin extends Plugin {
	logger: Logger;
	errorHandler: ErrorHandler;
	settings: RetrospectiveAISettings;

	async onload() {
		// Initialize logger and error handler with debug mode enabled for development
		this.logger = new Logger("Retrospective AI", true, LogLevel.DEBUG);
		this.errorHandler = new ErrorHandler(this.logger);

		try {
			this.logger.info("Initializing plugin");

			// Initialize the plugin
			await this.initializePlugin();

			this.logger.info("Plugin initialized");
		} catch (error) {
			this.logger.userError("Error initializing plugin", error);
		}
	}

	private async initializePlugin() {
		await this.loadSettings();

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon(
			"brain",
			"Retrospective AI",
			(evt: MouseEvent) => {
				this.handleRibbonClick();
			}
		);
		ribbonIconEl.addClass("retrospective-ai-ribbon-class");

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Status Bar Text");

		// Add simple command
		this.addCommand({
			id: "open-sample-modal-simple",
			name: "Open sample modal (simple)",
			callback: () => {
				new SampleModal(this.app).open();
			},
		});

		// Add editor command
		this.addCommand({
			id: "sample-editor-command",
			name: "Sample editor command",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection("Sample Editor Command");
			},
		});

		// Add complex command
		this.addCommand({
			id: "open-sample-modal-complex",
			name: "Open sample modal (complex)",
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			},
		});

		// Add settings tab
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Add DOM event listener
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// Add interval
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);

	}

	private handleRibbonClick() {
		this.logger.info("Ribbon clicked");
		// Add actual functionality here, e.g.:
		// new Notice("RetrospectAI activated!");
		// this.performSomeOperation();
	}

	onunload() {
		console.log("onunloading plugin");
		// this.ribbonIconEl.removeClass('retrospective-ai-ribbon-class');
	}

	private async loadSettings() {
		await this.errorHandler.safeAsync(
			async () => {
				// Example settings loading
				this.logger.debug("Loading plugin settings");
				const settings = await this.loadData();
				this.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
			},
			"Failed to load plugin settings",
			false // Don't show to user, just log
		);
	}
	async saveSettings() {
		await this.errorHandler.safeAsync(
			async () => await this.saveData(this.settings),
			"Failed to save plugin settings",
			true // Show to user since save failures are important
		);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: RetrospectiveAIPlugin;

	constructor(app: App, plugin: RetrospectiveAIPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
