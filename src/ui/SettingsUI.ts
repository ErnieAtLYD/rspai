// src/ui/SettingsUI.ts

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

    private createFormSetting(
        containerEl: HTMLElement, 
        settingName: string, 
        settingDesc: string, 
        settingValue: boolean | string | number, 
        onChange: (value: boolean | string | number) => void,
        settingType: 'toggle' | 'dropdown' | 'slider' | 'text' | 'button' = 'toggle',
        options?: {
            toggleOptions?: {
                onChange?: (value: boolean) => void;
            };
            dropdownOptions?: Array<{ value: string; label: string }>;
            sliderOptions?: {
                min?: number;
                max?: number;
                step?: number;
            };
            textOptions?: {
                placeholder?: string;
                type?: 'text' | 'password' | 'email' | 'url' | 'number';
                disabled?: boolean;
            };
            buttonOptions?: {
                buttonText?: string;
                onClick?: () => void;
            };
        }
    ): Setting {
        switch (settingType) {
            case 'toggle':
                return new Setting(containerEl)
                    .setName(settingName)
                    .setDesc(settingDesc)
                    .addToggle((toggle) =>
                        toggle.setValue(settingValue as boolean).onChange(onChange)
                    );
            case 'dropdown':
                return new Setting(containerEl)
                    .setName(settingName)
                    .setDesc(settingDesc)
                    .addDropdown((dropdown) => {
                        if (options?.dropdownOptions) {
                            options.dropdownOptions.forEach(option => {
                                dropdown.addOption(option.value, option.label);
                            });
                        } else {
                            dropdown.addOption("option1", "Option 1")
                                   .addOption("option2", "Option 2");
                        }
                        return dropdown.setValue(settingValue as string).onChange(onChange);
                    });
            case 'slider':
                return new Setting(containerEl)
                    .setName(settingName)
                    .setDesc(settingDesc)
                    .addSlider((slider) => {
                        const sliderOptions = options?.sliderOptions;
                        const min = sliderOptions?.min ?? 1;
                        const max = sliderOptions?.max ?? 100;
                        const step = sliderOptions?.step ?? 1;
                        return slider.setLimits(min, max, step).setValue(settingValue as number).onChange(onChange);
                    });
            case 'text':
                return new Setting(containerEl)
                    .setName(settingName)
                    .setDesc(settingDesc)
                    .addText((text) => {
                        const textOptions = options?.textOptions;
                        if (textOptions?.placeholder) {
                            text.setPlaceholder(textOptions.placeholder);
                        }
                        if (textOptions?.disabled) {
                            text.setDisabled(textOptions.disabled);
                        }
                        text.setValue(settingValue as string).onChange(onChange);
                        if (textOptions?.type && textOptions.type !== 'text') {
                            text.inputEl.type = textOptions.type;
                        }
                        return text;
                    });
            case 'button':
                return new Setting(containerEl)
                    .setName(settingName)
                    .setDesc(settingDesc)
                    .addButton((button) => {
                        const buttonOptions = options?.buttonOptions;
                        const buttonText = buttonOptions?.buttonText || settingValue as string;
                        const onClick = buttonOptions?.onClick || (() => onChange(settingValue));
                        return button.setButtonText(buttonText).onClick(onClick);
                    });
            default:
                return new Setting(containerEl).setName(settingName).setDesc(settingDesc);
        }
    }

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Retrospect AI Settings" });

		// 🤖 AI Provider Section
		containerEl.createEl("h3", { text: "🤖 AI Provider" });
		
		// LLM Provider selection
		this.createFormSetting(
            containerEl, 
            "AI Provider", 
            "Choose your preferred AI provider. OpenAI requires an API key, Ollama runs locally for enhanced privacy.", 
            this.plugin.settings.llmProvider, 
            async (value: 'openai' | 'ollama') => {
                if (value === 'openai' || value === 'ollama') {
                    this.plugin.settings.llmProvider = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateServiceConfigurations();
                    this.display();
                }
        }, 'dropdown', {
            dropdownOptions: [
                { value: 'openai', label: 'OpenAI' },
                { value: 'ollama', label: 'Ollama' }
            ]
        });



		// Provider-specific settings section (dynamic based on selection)
		this.renderProviderSettings(containerEl);

		// ⚙️ Analysis Settings Section
		containerEl.createEl("h3", { text: "⚙️ Analysis Settings" });

        // Communication style
        this.createFormSetting(
            containerEl, 
            "Communication Style", 
            "How should AI communicate insights with you?", 
            this.plugin.settings.communicationStyle || 'encouraging', 
            async (value: 'direct' | 'gentle' | 'encouraging') => {
                this.plugin.settings.communicationStyle = value;
                await this.plugin.saveSettings();
            },
            'dropdown',
            {
                dropdownOptions: [
                    { value: 'direct', label: 'Direct - Straightforward and concise' }, 
                    { value: 'gentle', label: 'Gentle - Supportive and nurturing' }, 
                    { value: 'encouraging', label: 'Encouraging - Uplifting and motivational' }
                ]
            }
        );

		// Analysis Scope Settings (Feature Flag)
        this.createFormSetting(
            containerEl, 
            "Analysis Scope", 
            "Choose the scope of analysis to focus on specific areas of your journal", 
            this.plugin.settings.analysisScope || 'whole-life', 
            async (value: 'whole-life' | 'work-only' | 'custom') => {
                this.plugin.settings.analysisScope = value;
                await this.plugin.saveSettings();
                // Refresh to show/hide custom scope settings
                this.display();
            },
            'dropdown',
            {
                dropdownOptions: [
                    { value: 'whole-life', label: 'Whole Life - Analyze all entries' }, 
                    { value: 'work-only', label: 'Work Only - Focus on work-related entries' }, 
                    { value: 'custom', label: 'Custom - Define your own scope' }
                ]
            }
        );

        // Analysis depth
        this.createFormSetting(
            containerEl, 
            "Analysis Depth", 
            "How deep should the analysis be?", 
            this.plugin.settings.analysisDepth || 'standard', 
            async (value: 'basic' | 'standard' | 'detailed') => {
                this.plugin.settings.analysisDepth = value;
                await this.plugin.saveSettings();
            },
            'dropdown',
            {
                dropdownOptions: [
                    { value: 'basic', label: 'Basic - Quick insights and patterns' }, 
                    { value: 'standard', label: 'Standard - Balanced analysis with good detail' }, 
                    { value: 'detailed', label: 'Detailed - Comprehensive deep-dive analysis' }
                ]
            }
        );

		// Enable trend analysis
        this.createFormSetting(
            containerEl, 
            "Enable Trend Analysis", 
            "Analyze patterns and changes over time in your journal entries", 
            this.plugin.settings.enableTrendAnalysis ?? true, 
            async (value: boolean) => {
                this.plugin.settings.enableTrendAnalysis = value;
                await this.plugin.saveSettings();
            },
            'toggle'
        );


		// Enable AI insights
        this.createFormSetting(
            containerEl, 
            "Enable AI-Powered Insights", 
            "Use AI to generate deep semantic insights and personalized recommendations", 
            this.plugin.settings.enableSemanticAnalysis ?? true, 
            async (value: boolean) => {
                this.plugin.settings.enableSemanticAnalysis = value;
                await this.plugin.saveSettings();
            },
            'toggle'
        );

		// Cache analysis results
        this.createFormSetting(
            containerEl, 
            "Cache Analysis Results", 
            "Cache analysis results to improve performance (recommended)", 
            this.plugin.settings.cacheAnalysisResults ?? true, 
            async (value: boolean) => {
                this.plugin.settings.cacheAnalysisResults = value;
                await this.plugin.saveSettings();
            },
            'toggle'
        );

		// 🕐 Auto-Scan Settings Section
		containerEl.createEl("h3", { text: "🕐 Auto-Scan Settings" });
		
		// Enable Auto-scan
        this.createFormSetting(
            containerEl, 
            "Enable Auto-scan", 
            "Automatically run analysis at specified intervals", 
            this.plugin.settings.enableAutoScan ?? false, 
            async (value: boolean) => {
                this.plugin.settings.enableAutoScan = value;
                await this.plugin.saveSettings();
                
                // Refresh to show/hide scan frequency setting
                this.display();
            },
            'toggle'
        );

        // Scan Frequency (only show if auto-scan is enabled)
        if (this.plugin.settings.enableAutoScan) {
            this.createFormSetting(
                containerEl, 
                "Scan Frequency", 
                "How often to automatically run analysis", 
                this.plugin.settings.scanFrequency || 'weekly', 
                async (value: 'manual' | 'daily' | 'weekly') => {
                    this.plugin.settings.scanFrequency = value;
                    await this.plugin.saveSettings();
                    
                    // If changing from manual to scheduled, trigger an immediate scan
                    if (value !== 'manual' && this.plugin.settings.enableAutoScan) {
                        this.plugin.runAutoScan();
                    }
                },
                'dropdown',
                {
                    dropdownOptions: [
                        { value: 'manual', label: 'Manual - Only when triggered manually' },
                        { value: 'daily', label: 'Daily - Run analysis every 24 hours' },
                        { value: 'weekly', label: 'Weekly - Run analysis every 7 days' }
                    ]
                }
            );

            // Show last scan time if available
            if (this.plugin.settings.lastAutoScan && this.plugin.settings.lastAutoScan > 0) {
                const lastScanDate = new Date(this.plugin.settings.lastAutoScan).toLocaleString();
                const infoEl = containerEl.createDiv({ cls: "setting-item-description" });
                infoEl.style.color = "var(--text-muted)";
                infoEl.createSpan({ text: `Last auto-scan: ${lastScanDate}` });
            }

            // Manual trigger button
            this.createFormSetting(
                containerEl, 
                "Run Auto-scan Now", 
                "Trigger an immediate analysis run (useful for testing)", 
                "Run Now", 
                () => {
                    this.plugin.runAutoScan();
                },
                'button',
                {
                    buttonOptions: {
                        buttonText: "Run Now",
                        onClick: () => {
                            this.plugin.runAutoScan();
                        }
                    }
                }
            );
        }

		// 🔒 Privacy & Content Section
		containerEl.createEl("h3", { text: "🔒 Privacy & Content" });

		// Private content marker
        this.createFormSetting(
            containerEl, 
            "Exclude Private Notes", 
            "Skip notes that contain the #private tag to protect sensitive content", 
            this.plugin.settings.excludePrivate ?? true, 
            async (value: boolean) => {
                this.plugin.settings.excludePrivate = value;
                await this.plugin.saveSettings();
            },
            'toggle'
        );

		// Periodic note folders path
        this.createFormSetting(
            containerEl, 
            "Periodic Note Folders", 
            "Comma-separated paths to your periodic note folders. If folders are found, only those will be searched. If empty or no folders exist, the entire vault will be searched as fallback.", 
            this.plugin.settings.periodicNoteFolders?.join(", ") || "", 
                         async (value: string) => {
                 const folders = value.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
                 this.plugin.settings.periodicNoteFolders = folders;
                 await this.plugin.saveSettings();
                 if (this.journalFolderSetting) {
                     this.validateFolderPaths(
                         this.journalFolderSetting,
                         folders
                     );
                 }
             },
            'text',
            {
                textOptions: {
                    placeholder: "Daily Notes, Journal",
                    type: 'text'
                }
            }
        );

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
        this.createFormSetting(
            containerEl, 
            "Reflection Output Folder", 
            "Where to save generated reflections (will be created if it doesn't exist)", 
            this.plugin.settings.reflectionFolder || "Summaries", 
            async (value: string) => {
                this.plugin.settings.reflectionFolder = value;
                await this.plugin.saveSettings();
            },
            'text'
        );

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
        this.createFormSetting(
            containerEl, 
            "Days to Include", 
            "How many days back to look for journal entries", 
            this.plugin.settings.daysToInclude, 
            async (value: number) => {
                this.plugin.settings.daysToInclude = value;
                await this.plugin.saveSettings();
            },
            'slider'
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

            this.createFormSetting(
                containerEl, 
                "API Key Security", 
                `Current status: ${encryptionStatus}. Click to manage encryption settings.`, 
                this.plugin.settings.encryptionEnabled ? "🔒 Encrypted" : "🔓 Plain Text", 
                async (value: boolean) => {
                    this.plugin.settings.encryptionEnabled = value;
                },
                'button',
                {
                    buttonOptions: {
                        buttonText: "Manage Encryption",
                        onClick: () => {
                            const modal = new EncryptionManagementModal(this.app, this.plugin, () => {
                                // Refresh the settings display after modal closes
                                this.display();
                            }, this.plugin.errorHandler);
                            modal.open();
                        }
                    }
                }
            );

			// API Key setting
            const apiKeySetting = this.createFormSetting(
                containerEl, 
                "OpenAI API Key", 
                this.plugin.settings.encryptionEnabled ? 
                    "Your API key is encrypted. Use 'Manage Encryption' to modify." : 
                    "Your OpenAI API key for generating reflections (stored in plain text)", 
                this.plugin.settings.openaiApiKey as string, 
                async (value: string) => {
                    this.plugin.settings.openaiApiKey = value;
                    await this.plugin.saveSettings();
                },
                'text',
                {
                    textOptions: {
                        placeholder: "sk-...",
                        type: 'password'
                    }
                }
            );

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
            this.createFormSetting(
                containerEl, 
                "OpenAI Model", 
                "Which OpenAI model to use for analysis and summaries", 
                this.plugin.settings.openaiModel, 
                async (value: string) => {
                    this.plugin.settings.openaiModel = value;
                    await this.plugin.saveSettings();
                },
                'dropdown',
                {
                    dropdownOptions: [
                        { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },   
                        { value: 'gpt-4o', label: 'GPT-4o' }, 
                        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                    ]
                }
            );
		}

		// Ollama Settings (show only when Ollama is selected)
		if (this.plugin.settings.llmProvider === 'ollama') {
			containerEl.createEl("h4", { text: "Ollama Configuration" });

			// Ollama base URL
            this.createFormSetting(
                containerEl, 
                "Ollama Base URL", 
                "The base URL where Ollama is running (usually http://localhost:11434)", 
                this.plugin.settings.ollamaBaseUrl, 
                async (value: string) => {
                    this.plugin.settings.ollamaBaseUrl = value;
                    await this.plugin.saveSettings();
                },
                'text',
                {
                    textOptions: {
                        placeholder: "http://localhost:11434"
                    }
                }
            );

			// Ollama model selection
            this.createFormSetting(
                containerEl, 
                "Ollama Model", 
                "The Ollama model to use (ensure it's downloaded first with 'ollama pull <model>')", 
                this.plugin.settings.ollamaModel, 
                async (value: string) => {
                    this.plugin.settings.ollamaModel = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateServiceConfigurations();
                },
                'text',
                {
                    textOptions: {
                        placeholder: "llama3.1:8b"
                    }
                }
            );

			// Ollama timeout
            this.createFormSetting(
                containerEl, 
                "Request Timeout", 
                "Timeout for Ollama requests in milliseconds (30000 = 30 seconds)", 
                this.plugin.settings.ollamaTimeout.toString(), 
                async (value: string) => {
                    const timeout = parseInt(value);
                    if (!isNaN(timeout) && timeout > 0) {
                        this.plugin.settings.ollamaTimeout = timeout;
                    }
                },
                'text',
                {
                    textOptions: {
                        placeholder: "30000"
                    }
                }
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
        this.createFormSetting(
            containerEl, 
            "Blocker Detection Sensitivity", 
            "Adjust how sensitive the system is to detecting productivity blockers", 
            this.plugin.settings.blockerDetectionSensitivity || 'medium', 
            async (value: 'low' | 'medium' | 'high') => {
                this.plugin.settings.blockerDetectionSensitivity = value;
                await this.plugin.saveSettings();
            },
            'dropdown',
            {
                dropdownOptions: [
                    { value: 'low', label: 'Low - Only detect obvious blockers' },
                    { value: 'medium', label: 'Medium - Balanced detection' },
                    { value: 'high', label: 'High - Detect subtle blockers' }
                ]
            }
        );

		// NLP Analysis Depth (only show if advanced NLP is enabled)
        this.createFormSetting(
            containerEl, 
            "NLP Analysis Depth", 
            "Choose the depth of NLP analysis: Basic (fast), Moderate (balanced), Deep (comprehensive)", 
            this.plugin.settings.nlpAnalysisDepth || 'moderate', 
            async (value: 'basic' | 'moderate' | 'deep') => {
                this.plugin.settings.nlpAnalysisDepth = value;
                await this.plugin.saveSettings();
            },
            'dropdown',
            {
                dropdownOptions: [
                    { value: 'basic', label: 'Basic - Fast analysis with core features' },
                    { value: 'moderate', label: 'Moderate - Balanced depth and performance' },
                    { value: 'deep', label: 'Deep - Comprehensive analysis (slower)' }
                ]
            }
        );

		// NLP Analysis Depth (only show if advanced NLP is enabled)
		if (this.plugin.settings.enableAdvancedNLP ?? true) {
            this.createFormSetting(
                containerEl, 
                "NLP Analysis Depth", 
                "Choose the depth of NLP analysis: Basic (fast), Moderate (balanced), Deep (comprehensive)", 
                this.plugin.settings.nlpAnalysisDepth || 'moderate', 
                async (value: 'basic' | 'moderate' | 'deep') => {
                    this.plugin.settings.nlpAnalysisDepth = value;
                    await this.plugin.saveSettings();
                },
                'dropdown',
                {
                    dropdownOptions: [
                        { value: 'basic', label: 'Basic - Fast analysis with core features' },
                        { value: 'moderate', label: 'Moderate - Balanced depth and performance' },
                        { value: 'deep', label: 'Deep - Comprehensive analysis (slower)' }
                    ]
                }
            );
			// NLP Features Info
			const infoEl = containerEl.createDiv({ cls: "setting-item-description" });
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
