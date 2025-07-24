// src/ui/_SettingsUI.ts

// TO DO: Implement Settings UI (refactor from main.ts)

import { App, PluginSettingTab, Setting } from "obsidian";
import JournalReflectionPlugin, { DEFAULT_SETTINGS } from "../main";
import { TFolder } from "obsidian";
import { EncryptionManagementModal } from "../modals";
import { AIService } from "../services";



/**
 * Setting tab for the plugin
 * @param app - The Obsidian app
 * @param plugin - The plugin instance
 * @returns {void}
 * @description
 * This class is used to display the settings tab for the plugin.
 */
export class JournalReflectionSettingTab extends PluginSettingTab {
	plugin: JournalReflectionPlugin;
	private journalFolderSetting: Setting | null = null;
	private reflectionFolderSetting: Setting | null = null;

	constructor(app: App, plugin: JournalReflectionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Helper function to ensure customAnalysisScope is initialized
	 * Reduces duplication in the settings UI
	 */
	private ensureCustomAnalysisScope(): void {
		if (!this.plugin.settings.customAnalysisScope) {
			this.plugin.settings.customAnalysisScope = {
				name: DEFAULT_SETTINGS.customAnalysisScope.name,
				includeKeywords: [...DEFAULT_SETTINGS.customAnalysisScope.includeKeywords],
				excludeKeywords: [...DEFAULT_SETTINGS.customAnalysisScope.excludeKeywords],
				includeFolders: [...DEFAULT_SETTINGS.customAnalysisScope.includeFolders],
				excludeFolders: [...DEFAULT_SETTINGS.customAnalysisScope.excludeFolders],
				includeTags: [...DEFAULT_SETTINGS.customAnalysisScope.includeTags],
				excludeTags: [...DEFAULT_SETTINGS.customAnalysisScope.excludeTags]
			};
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Retrospect AI Settings" });

		// 🤖 AI Provider Section
		containerEl.createEl("h3", { text: "🤖 AI Provider" });
		
		// LLM Provider selection
		new Setting(containerEl)
			.setName("AI Provider")
			.setDesc("Choose your preferred AI provider. OpenAI requires an API key, Ollama runs locally for enhanced privacy.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("openai", "OpenAI (Remote)")
					.addOption("ollama", "Ollama (Local)")
					.setValue(this.plugin.settings.llmProvider)
					.onChange(async (value: 'openai' | 'ollama') => {
						this.plugin.settings.llmProvider = value;
						await this.plugin.saveSettings();
						await this.plugin.updateServiceConfigurations();
						this.display(); // Refresh UI to show provider-specific settings
					})
			);

		// Provider-specific settings section (dynamic based on selection)
		this.renderProviderSettings(containerEl);

		// ⚙️ Analysis Settings Section
		containerEl.createEl("h3", { text: "⚙️ Analysis Settings" });

		// Communication style
		new Setting(containerEl)
			.setName("Communication Style")
			.setDesc("How should AI communicate insights with you?")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("direct", "Direct - Straightforward and concise")
					.addOption("gentle", "Gentle - Supportive and nurturing")
					.addOption("encouraging", "Encouraging - Uplifting and motivational")
					.setValue(this.plugin.settings.communicationStyle || 'encouraging')
					.onChange(async (value: 'direct' | 'gentle' | 'encouraging') => {
						this.plugin.settings.communicationStyle = value;
						await this.plugin.saveSettings();
					})
			);

		// Analysis Scope Settings (Feature Flag)
		new Setting(containerEl)
			.setName("Analysis Scope")
			.setDesc("Choose the scope of analysis to focus on specific areas of your journal")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("whole-life", "Whole Life - Analyze all entries")
					.addOption("work-only", "Work Only - Focus on work-related entries")
					.addOption("custom", "Custom - Define your own scope")
					.setValue(this.plugin.settings.analysisScope || 'whole-life')
					.onChange(async (value: 'whole-life' | 'work-only' | 'custom') => {
						this.plugin.settings.analysisScope = value;
						await this.plugin.saveSettings();
						// Refresh to show/hide custom scope settings
						this.display();
					})
			);


			


		// Analysis depth
		new Setting(containerEl)
			.setName("Analysis Depth")
			.setDesc("Choose how detailed the analysis should be")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("basic", "Basic - Quick insights and patterns")
					.addOption("standard", "Standard - Balanced analysis with good detail")
					.addOption("detailed", "Detailed - Comprehensive deep-dive analysis")
					.setValue(this.plugin.settings.analysisDepth || 'standard')
					.onChange(async (value: 'basic' | 'standard' | 'detailed') => {
						this.plugin.settings.analysisDepth = value;
						await this.plugin.saveSettings();
					})
			);

		// Enable trend analysis
		new Setting(containerEl)
			.setName("Enable Trend Analysis")
			.setDesc("Analyze patterns and changes over time in your journal entries")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTrendAnalysis ?? true)
					.onChange(async (value) => {
						this.plugin.settings.enableTrendAnalysis = value;
						await this.plugin.saveSettings();
					})
			);

		// Enable AI insights
		new Setting(containerEl)
			.setName("Enable AI-Powered Insights")
			.setDesc("Use AI to generate deep semantic insights and personalized recommendations")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSemanticAnalysis ?? true)
					.onChange(async (value) => {
						this.plugin.settings.enableSemanticAnalysis = value;
						await this.plugin.saveSettings();
					})
			);

		// Cache analysis results
		new Setting(containerEl)
			.setName("Cache Analysis Results")
			.setDesc("Cache analysis results to improve performance (recommended)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.cacheAnalysisResults ?? true)
					.onChange(async (value) => {
						this.plugin.settings.cacheAnalysisResults = value;
						await this.plugin.saveSettings();
					})
			);
		

		// 🔒 Privacy & Content Section
		containerEl.createEl("h3", { text: "🔒 Privacy & Content" });

		// Private content marker
		new Setting(containerEl)
			.setName("Exclude Private Notes")
			.setDesc("Skip notes that contain the #private tag to protect sensitive content")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.excludePrivate)
					.onChange(async (value) => {
						this.plugin.settings.excludePrivate = value;
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


		// 🔧 Advanced Section (collapsible)
		this.renderAdvancedSection(containerEl);
	}

	/**
	 * Render provider-specific settings
	 */
	private renderProviderSettings(containerEl: HTMLElement): void {
		// OpenAI Settings (show only when OpenAI is selected)
		if (this.plugin.settings.llmProvider === 'openai') {
			containerEl.createEl("h4", { text: "OpenAI Configuration" });

			// Encryption status and management
			const encryptionStatus = this.plugin.settings.encryptionEnabled ? "🔒 Encrypted" : "🔓 Plain Text";
			new Setting(containerEl)
				.setName("API Key Security")
				.setDesc(`Current status: ${encryptionStatus}. Click to manage encryption settings.`)
				.addButton((btn) => {
					btn.setButtonText("Manage Encryption")
						.onClick(() => {
							const modal = new EncryptionManagementModal(this.app, this.plugin, () => {
								// Refresh the settings display after modal closes
								this.display();
							}, this.plugin.errorHandler);
							modal.open();
						});
				});

			// API Key setting
			const apiKeySetting = new Setting(containerEl)
				.setName("OpenAI API Key")
				.setDesc(this.plugin.settings.encryptionEnabled ? 
					"Your API key is encrypted. Use 'Manage Encryption' to modify." : 
					"Your OpenAI API key for generating reflections (stored in plain text)");
			
			if (!this.plugin.settings.encryptionEnabled) {
				apiKeySetting.addText((text) => {
					text.setPlaceholder("sk-...")
						.setValue(typeof this.plugin.settings.openaiApiKey === 'string' ? this.plugin.settings.openaiApiKey : "")
						.onChange(async (value) => {
							this.plugin.settings.openaiApiKey = value;
							await this.plugin.saveSettings();
						});
					text.inputEl.type = "password";
				});
			} else {
				apiKeySetting.addText((text) => {
					text.setPlaceholder("[Encrypted]")
						.setValue("[Encrypted]")
						.setDisabled(true);
				});
			}
			
			// Security warning for plain text storage
			if (!this.plugin.settings.encryptionEnabled) {
				const warningEl = containerEl.createDiv({ cls: "setting-item-description" });
				warningEl.style.color = "var(--text-warning)";
				warningEl.createSpan({ text: "⚠️ " });
				warningEl.createEl("strong", { text: "Security Warning:" });
				warningEl.createSpan({ text: " Your API key is stored in plain text. Consider enabling encryption for better security." });
			}

			// Model selection
			new Setting(containerEl)
				.setName("OpenAI Model")
				.setDesc("Which OpenAI model to use for analysis and summaries")
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
		}

		// Ollama Settings (show only when Ollama is selected)
		if (this.plugin.settings.llmProvider === 'ollama') {
			containerEl.createEl("h4", { text: "Ollama Configuration" });

			// Ollama base URL
			new Setting(containerEl)
				.setName("Ollama Base URL")
				.setDesc("The base URL where Ollama is running (usually http://localhost:11434)")
				.addText((text) =>
					text
						.setPlaceholder("http://localhost:11434")
						.setValue(this.plugin.settings.ollamaBaseUrl)
						.onChange(async (value) => {
							this.plugin.settings.ollamaBaseUrl = value;
							await this.plugin.saveSettings();
							await this.plugin.updateServiceConfigurations();
						})
				);

			// Ollama model selection
			new Setting(containerEl)
				.setName("Ollama Model")
				.setDesc("The Ollama model to use (ensure it's downloaded first with 'ollama pull <model>')")
				.addText((text) =>
					text
						.setPlaceholder("llama3.1:8b")
						.setValue(this.plugin.settings.ollamaModel)
						.onChange(async (value) => {
							this.plugin.settings.ollamaModel = value;
							await this.plugin.saveSettings();
							await this.plugin.updateServiceConfigurations();
						})
				);

			// Ollama timeout
			new Setting(containerEl)
				.setName("Request Timeout")
				.setDesc("Timeout for Ollama requests in milliseconds (30000 = 30 seconds)")
				.addText((text) =>
					text
						.setPlaceholder("30000")
						.setValue(this.plugin.settings.ollamaTimeout.toString())
						.onChange(async (value) => {
							const timeout = parseInt(value);
							if (!isNaN(timeout) && timeout > 0) {
								this.plugin.settings.ollamaTimeout = timeout;
								await this.plugin.saveSettings();
								await this.plugin.updateServiceConfigurations();
							}
						})
				);

			// Ollama connection test
			new Setting(containerEl)
				.setName("Test Connection")
				.setDesc("Test if Ollama is running and the model is available")
				.addButton((btn) =>
					btn
						.setButtonText("Test Connection")
						.onClick(async () => {
							btn.setDisabled(true);
							btn.setButtonText("Testing...");
							
							try {
								const aiService = this.plugin.serviceManager.resolve<AIService>('aiService');
								const success = await aiService.testConnection();
								if (success) {
									btn.setButtonText("✅ Success");
									setTimeout(() => {
										btn.setButtonText("Test Connection");
										btn.setDisabled(false);
									}, 2000);
								} else {
									btn.setButtonText("❌ Failed");
									setTimeout(() => {
										btn.setButtonText("Test Connection");
										btn.setDisabled(false);
									}, 2000);
								}
							} catch (error) {
								btn.setButtonText("❌ Error");
								setTimeout(() => {
									btn.setButtonText("Test Connection");
									btn.setDisabled(false);
								}, 2000);
							}
						})
				);

			// Ollama setup instructions
			const ollamaInfoEl = containerEl.createDiv({ cls: "setting-item-description" });
			ollamaInfoEl.style.color = "var(--text-muted)";
			ollamaInfoEl.createSpan({ text: "💡 " });
			ollamaInfoEl.createEl("strong", { text: "Ollama Setup:" });
			ollamaInfoEl.createSpan({ text: " Download Ollama from " });
			ollamaInfoEl.createEl("a", { 
				text: "ollama.com", 
				href: "https://ollama.com",
				attr: { target: "_blank" }
			});
			ollamaInfoEl.createSpan({ text: ", then run 'ollama pull " + this.plugin.settings.ollamaModel + "' to download the model." });
		}
	}

	/**
	 * Render advanced settings section (collapsible)
	 */
	private renderAdvancedSection(containerEl: HTMLElement): void {
		// Create collapsible advanced section
		const advancedHeader = containerEl.createEl("h3", { 
			text: "🔧 Advanced", 
			cls: "retrospect-collapsible-header" 
		});
		
		const advancedContainer = containerEl.createDiv({ 
			cls: "retrospect-collapsible-content retrospect-collapsed" 
		});

		// Make header clickable to toggle section
		advancedHeader.style.cursor = "pointer";
		advancedHeader.addEventListener("click", () => {
			const isCollapsed = advancedContainer.classList.contains("retrospect-collapsed");
			advancedContainer.classList.toggle("retrospect-collapsed", !isCollapsed);
			advancedHeader.textContent = isCollapsed ? "🔧 Advanced (expanded)" : "🔧 Advanced";
		});

		// Pattern recognition threshold (simplified)
		new Setting(advancedContainer)
			.setName("Pattern Recognition Sensitivity")
			.setDesc("Adjust how sensitive pattern detection is (lower = more patterns detected)")
			.addSlider((slider) =>
				slider
					.setLimits(0.1, 1.0, 0.1)
					.setValue(this.plugin.settings.patternThreshold || 0.6)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.patternThreshold = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
		.setName("Enable Advanced NLP Analysis")
		.setDesc("Use advanced NLP for deeper insights including productivity themes, blocker detection, and multi-dimensional sentiment analysis")
		.addToggle((toggle) =>
			toggle
				.setValue(this.plugin.settings.enableAdvancedNLP ?? true)
				.onChange(async (value) => {
					this.plugin.settings.enableAdvancedNLP = value;
					await this.plugin.saveSettings();
					// Refresh to show/hide dependent settings
					this.display();
				})
		);


		// Show legacy NLP settings if enabled
		if (this.plugin.settings.enableAdvancedNLP) {
			this.renderLegacyNLPSettings(advancedContainer);
		}
	}

	/**
	 * Render legacy NLP settings for power users
	 */
	private renderLegacyNLPSettings(containerEl: HTMLElement): void {
		// Blocker Detection Sensitivity
		new Setting(containerEl)
			.setName("Blocker Detection Sensitivity")
			.setDesc("Adjust how sensitive the system is to detecting productivity blockers")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("low", "Low - Only detect obvious blockers")
					.addOption("medium", "Medium - Balanced detection")
					.addOption("high", "High - Detect subtle blockers")
					.setValue(this.plugin.settings.blockerDetectionSensitivity || 'medium')
					.onChange(async (value: 'low' | 'medium' | 'high') => {
						this.plugin.settings.blockerDetectionSensitivity = value;
						await this.plugin.saveSettings();
					})
			);

		// NLP Analysis Depth (only show if advanced NLP is enabled)
		if (this.plugin.settings.enableAdvancedNLP ?? true) {
			new Setting(containerEl)
				.setName("NLP Analysis Depth")
				.setDesc("Choose the depth of NLP analysis: Basic (fast), Moderate (balanced), Deep (comprehensive)")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("basic", "Basic - Fast analysis with core features")
						.addOption("moderate", "Moderate - Balanced depth and performance")
						.addOption("deep", "Deep - Comprehensive analysis (slower)")
						.setValue(this.plugin.settings.nlpAnalysisDepth || 'moderate')
						.onChange(async (value: 'basic' | 'moderate' | 'deep') => {
							this.plugin.settings.nlpAnalysisDepth = value;
							await this.plugin.saveSettings();
						})
				);
				
			// Scan Frequency Section
			containerEl.createEl("h4", { text: "Automatic Scanning" });
			
			// Enable Auto-scan
			new Setting(containerEl)
				.setName("Enable Auto-scan")
				.setDesc("Automatically run analysis at specified intervals")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.enableAutoScan ?? false)
						.onChange(async (value) => {
							this.plugin.settings.enableAutoScan = value;
							await this.plugin.saveSettings();
							
							// If enabling auto-scan, trigger an immediate scan
							if (value && this.plugin.settings.scanFrequency !== 'manual') {
								this.plugin.runAutoScan();
							}
							
							// Refresh to show/hide scan frequency setting
							this.display();
						})
				);
      
			// NLP Features Info
			const infoEl = containerEl.createDiv({ cls: "setting-item-description" })
			infoEl.style.color = "var(--text-muted)";
			infoEl.createEl("strong", { text: "Advanced NLP Features:" });
			infoEl.createEl("br");
      
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Productivity Theme Extraction:" });
			infoEl.createSpan({ text: " Identifies recurring themes in your work" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Blocker Detection:" });
			infoEl.createSpan({ text: " Spots procrastination, time management, and workflow issues" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Multi-dimensional Sentiment:" });
			infoEl.createSpan({ text: " Analyzes emotions, arousal levels, and productivity mood" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Context-aware Analysis:" });
			infoEl.createSpan({ text: " Understands the nuances of your writing style" });
			infoEl.createEl("br");
			infoEl.createSpan({ text: "• " });
			infoEl.createEl("strong", { text: "Pattern Correlation:" });
			infoEl.createSpan({ text: " Connects productivity patterns with mood and activities" });
		}
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
				iconEl.textContent = "✓";
				break;
			case "error":
				iconEl.textContent = "✗";
				break;
			case "info":
				iconEl.textContent = "ℹ";
				break;
		}

		iconEl.title = tooltip;

		// Make the setting container relative for absolute positioning
		const settingControl = setting.settingEl.querySelector(
			".setting-item-control"
		);
		if (settingControl) {
			settingControl.classList.add("has-validation");
			settingControl.appendChild(iconEl);
		}
	}
}
