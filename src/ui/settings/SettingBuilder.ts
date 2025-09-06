// src/ui/settings/SettingBuilder.ts
import { Setting } from "obsidian";
import { JournalReflectionSettings } from "../../types";

/**
 * The SettingConfig interface is responsible for defining the configuration of a setting.
 */
export interface SettingConfig {
	name: string;
	description: string;
	key: string;
	section?: string;
	validation?: (value: unknown) => string | null;
	conditional?: (settings: JournalReflectionSettings) => boolean;
}

/**
 * The ToggleConfig interface is responsible for defining the configuration of a toggle setting.
 */
export interface ToggleConfig extends SettingConfig {
	type: "toggle";
	defaultValue: boolean;
}

/**
 * The DropdownConfig interface is responsible for defining the configuration of a dropdown setting.
 */
export interface DropdownConfig extends SettingConfig {
	type: "dropdown";
	options: Array<{ value: string; label: string }>;
	defaultValue: string;
}

/**
 * The SliderConfig interface is responsible for defining the configuration of a slider setting.
 */
export interface SliderConfig extends SettingConfig {
	type: "slider";
	min: number;
	max: number;
	step: number;
	defaultValue: number;
	dynamicTooltip?: boolean;
}

/**
 * The TextConfig interface is responsible for defining the configuration of a text setting.
 */
export interface TextConfig extends SettingConfig {
	type: "text";
	placeholder?: string;
	inputType?: "text" | "password" | "email" | "url" | "number";
	defaultValue: string;
	disabled?: boolean;
}

/**
 * The ButtonConfig interface is responsible for defining the configuration of a button setting.
 */
export interface ButtonConfig extends SettingConfig {
	type: "button";
	buttonText: string;
	action: () => void | Promise<void>;
}

/**
 * The SettingDefinition interface is responsible for defining the configuration of a setting.
 */
export type SettingDefinition =
	| ToggleConfig
	| DropdownConfig
	| SliderConfig
	| TextConfig
	| ButtonConfig;

/**
 * The SettingBuilder class is responsible for building the settings UI.
 */
export class SettingBuilder {
	private settings: JournalReflectionSettings;
	private saveSettings: () => Promise<void>;
	private onUpdate?: (key: string, value: unknown) => void | Promise<void>;

	/**
	 * The constructor for the SettingBuilder class.
	 * @param settings - The settings instance.
	 * @param saveSettings - The function to save the settings.
	 * @param onUpdate - The function to update the settings.
	 */
	constructor(
		settings: JournalReflectionSettings,
		saveSettings: () => Promise<void>,
		onUpdate?: (key: string, value: unknown) => void | Promise<void>
	) {
		this.settings = settings;
		this.saveSettings = saveSettings;
		this.onUpdate = onUpdate;
	}

	/**
	 * The build method is responsible for building the settings UI.
	 * @param containerEl - The container element.
	 * @param config - The configuration of the setting.
	 * @returns The setting element.
	 */
	build(containerEl: HTMLElement, config: SettingDefinition): Setting {
		// Check conditional rendering
		if (config.conditional && !config.conditional(this.settings)) {
			return new Setting(containerEl); // Return empty setting
		}

		const currentValue =
			this.settings[config.key as keyof JournalReflectionSettings] ??
			this.getDefaultValue(config);

		switch (config.type) {
			case "toggle":
				return this.buildToggle(
					containerEl,
					config,
					currentValue as boolean
				);
			case "dropdown":
				return this.buildDropdown(
					containerEl,
					config,
					currentValue as string
				);
			case "slider":
				return this.buildSlider(
					containerEl,
					config,
					currentValue as number
				);
			case "text":
				return this.buildText(
					containerEl,
					config,
					currentValue as string
				);
			case "button":
				return this.buildButton(containerEl, config);
			default:
				throw new Error(
					`Unknown setting type: ${(config as unknown as { type: string }).type}`
				);
		}
	}

	/**
	 * The buildToggle method is responsible for building a toggle setting.
	 * @param containerEl - The container element.
	 * @param config - The configuration of the setting.
	 * @param currentValue - The current value of the setting.
	 * @returns The setting element.
	 */
	private buildToggle(
		containerEl: HTMLElement,
		config: ToggleConfig,
		currentValue: boolean
	): Setting {
		return new Setting(containerEl)
			.setName(config.name)
			.setDesc(config.description)
			.addToggle((toggle) =>
				toggle.setValue(currentValue).onChange(async (value) => {
					await this.updateSetting(config.key, value);
					if (this.onUpdate) await this.onUpdate(config.key, value);
				})
			);
	}

	/**
	 * The buildDropdown method is responsible for building a dropdown setting.
	 * @param containerEl - The container element.
	 * @param config - The configuration of the setting.
	 * @param currentValue - The current value of the setting.
	 * @returns The setting element.
	 */
	private buildDropdown(
		containerEl: HTMLElement,
		config: DropdownConfig,
		currentValue: string
	): Setting {
		return new Setting(containerEl)
			.setName(config.name)
			.setDesc(config.description)
			.addDropdown((dropdown) => {
				config.options.forEach((option) => {
					dropdown.addOption(option.value, option.label);
				});
				return dropdown
					.setValue(currentValue)
					.onChange(async (value) => {
						await this.updateSetting(config.key, value);
						if (this.onUpdate)
							await this.onUpdate(config.key, value);
					});
			});
	}

	/**
	 * The buildSlider method is responsible for building a slider setting.
	 * @param containerEl - The container element.
	 * @param config - The configuration of the setting.
	 * @param currentValue - The current value of the setting.
	 * @returns The setting element.
	 */
	private buildSlider(
		containerEl: HTMLElement,
		config: SliderConfig,
		currentValue: number
	): Setting {
		return new Setting(containerEl)
			.setName(config.name)
			.setDesc(config.description)
			.addSlider((slider) => {
				slider
					.setLimits(config.min, config.max, config.step)
					.setValue(currentValue)
					.onChange(async (value) => {
						await this.updateSetting(config.key, value);
						if (this.onUpdate)
							await this.onUpdate(config.key, value);
					});

				if (config.dynamicTooltip) {
					slider.setDynamicTooltip();
				}

				return slider;
			});
	}

	/**
	 * The buildText method is responsible for building a text setting.
	 * @param containerEl - The container element.
	 * @param config - The configuration of the setting.
	 * @param currentValue - The current value of the setting.
	 * @returns The setting element.
	 */
	private buildText(
		containerEl: HTMLElement,
		config: TextConfig,
		currentValue: string
	): Setting {
		return new Setting(containerEl)
			.setName(config.name)
			.setDesc(config.description)
			.addText((text) => {
				if (config.placeholder) text.setPlaceholder(config.placeholder);
				if (config.disabled) text.setDisabled(config.disabled);
				if (config.inputType && config.inputType !== "text") {
					text.inputEl.type = config.inputType;
				}

				return text.setValue(currentValue).onChange(async (value) => {
					await this.updateSetting(config.key, value);
					if (this.onUpdate) await this.onUpdate(config.key, value);
				});
			});
	}

	/**
	 * The buildButton method is responsible for building a button setting.
	 * @param containerEl - The container element.
	 * @param config - The configuration of the setting.
	 * @returns The setting element.
	 */
	private buildButton(
		containerEl: HTMLElement,
		config: ButtonConfig
	): Setting {
		return new Setting(containerEl)
			.setName(config.name)
			.setDesc(config.description)
			.addButton((button) =>
				button.setButtonText(config.buttonText).onClick(config.action)
			);
	}

	/**
	 * The updateSetting method is responsible for updating the setting.
	 * @param key - The key of the setting.
	 * @param value - The value of the setting.
	 * @returns A promise that resolves when the setting is updated.
	 */
	private async updateSetting(key: string, value: unknown): Promise<void> {
		(this.settings as unknown as Record<string, unknown>)[key] = value;
		await this.saveSettings();
	}

	/**
	 * The getDefaultValue method is responsible for getting the default value of a setting.
	 * @param config - The configuration of the setting.
	 * @returns The default value of the setting.
	 */
	private getDefaultValue(config: SettingDefinition): unknown {
		switch (config.type) {
			case "toggle":
				return config.defaultValue;
			case "dropdown":
				return config.defaultValue;
			case "slider":
				return config.defaultValue;
			case "text":
				return config.defaultValue;
			default:
				return null;
		}
	}
}
