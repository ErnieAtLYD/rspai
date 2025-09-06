// src/ui/SettingsUI.ts - Refactored main class
import { App, PluginSettingTab, Setting } from "obsidian";
import JournalReflectionPlugin from "../main";
import { SettingBuilder, SettingDefinition } from "./settings/SettingBuilder";
import {
	createSettingsConfig,
	SettingsSection,
} from "./settings/settingsConfig";
import { FolderValidator } from "./settings/FolderValidator";

/**
 * The JournalReflectionSettingTab class is responsible for
 * displaying the settings UI for the Journal Reflection plugin.
 */
export class JournalReflectionSettingTab extends PluginSettingTab {
	plugin: JournalReflectionPlugin;
	private settingBuilder: SettingBuilder;
	private folderValidator: FolderValidator;

	/**
	 * The constructor for the JournalReflectionSettingTab class.
	 * @param app - The app instance.
	 * @param plugin - The plugin instance.
	 */
	constructor(app: App, plugin: JournalReflectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.settingBuilder = new SettingBuilder(
			plugin.settings,
			() => plugin.saveSettings(),
			this.onSettingUpdate.bind(this)
		);
		this.folderValidator = new FolderValidator(app);
	}

	/**
	 * The display method is responsible for displaying
	 * the settings UI.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Retrospect AI Settings" });

		const config = createSettingsConfig(this.plugin);
		this.renderSections(containerEl, config);
	}

	/**
	 * The renderSections method is responsible for rendering
	 * the sections of the settings UI.
	 * @param containerEl - The container element.
	 * @param sections - The sections to render.
	 */
	private renderSections(
		containerEl: HTMLElement,
		sections: SettingsSection[]
	): void {
		sections.forEach((section) => {
			const sectionContainer = containerEl.createDiv({
				cls: "retrospect-section",
			});
			this.renderSection(sectionContainer, section);
		});
	}

	/**
	 * The renderSection method is responsible for rendering a
	 * section of the settings UI.
	 * @param containerEl - The container element.
	 * @param section - The section to render.
	 */
	private renderSection(
		containerEl: HTMLElement,
		section: SettingsSection
	): void {
		const header = containerEl.createEl("h3", {
			text: `${section.icon} ${section.title}`,
			cls: section.collapsible
				? "retrospect-collapsible-header"
				: undefined,
		});

		const contentContainer = section.collapsible
			? containerEl.createDiv({
				cls: "retrospect-collapsible-content retrospect-collapsed",
			})
			: containerEl;

		if (section.collapsible) {
			this.setupCollapsibleHeader(
				header,
				contentContainer,
				section.title,
				section.icon
			);
		}

		section.settings.forEach((settingConfig) => {
			const setting = this.settingBuilder.build(
				contentContainer,
				settingConfig
			);

			// Add validation if needed
			if (settingConfig.validation) {
				this.addValidation(setting, settingConfig);
			}
		});
	}

	/**
	 * The setupCollapsibleHeader method is responsible for 
   * setting up the collapsible header of the settings UI.
	 * @param header - The header element.
	 * @param content - The content element.
	 * @param title - The title of the section.
	 * @param icon - The icon of the section.
	 */
	private setupCollapsibleHeader(
		header: HTMLElement,
		content: HTMLElement,
		title: string,
		icon: string
	): void {
		header.style.cursor = "pointer";
		header.addEventListener("click", () => {
			const isCollapsed = content.classList.contains(
				"retrospect-collapsed"
			);
			content.classList.toggle("retrospect-collapsed", !isCollapsed);
			header.textContent = isCollapsed
				? `${icon} ${title} (expanded)`
				: `${icon} ${title}`;
		});
	}

	/**
	 * The onSettingUpdate method is responsible for handling 
   * the update of the settings.
	 * @param key - The key of the setting.
	 * @param _value - The value of the setting.
	 * @returns A promise that resolves when the setting is updated.
	 */
	private async onSettingUpdate(key: string, _value: unknown): Promise<void> {
		// Handle special cases that require UI updates
		switch (key) {
			case "llmProvider":
				await this.plugin.updateServiceConfigurations();
				this.display(); // Re-render to show/hide provider-specific settings
				break;
			case "enableAutoScan":
			case "analysisScope":
			case "enableAdvancedNLP":
				this.display(); // Re-render for conditional settings
				break;
			default:
				// Handle other updates as needed
				break;
		}
	}

	/**
	 * The addValidation method is responsible for adding 
   * validation to the settings.
	 * @param setting - The setting element.
	 * @param config - The configuration of the setting.
	 */
	private addValidation(setting: Setting, config: SettingDefinition): void {
		// Add validation logic based on the setting type
		if (config.key === "periodicNoteFolders") {
			const folderPaths = this.plugin.settings.periodicNoteFolders || [];
			this.folderValidator.validateFolderPaths(setting, folderPaths);
		} else if (config.key === "reflectionFolder") {
			const folderPath = this.plugin.settings.reflectionFolder || "";
			this.folderValidator.validateOrCreateFolder(setting, folderPath);
		}
	}
}
