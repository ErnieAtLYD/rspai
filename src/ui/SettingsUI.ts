// src/ui/SettingsUI.ts

import {
    App,
    PluginSettingTab,
    Setting,
    TFolder,
    Notice,
} from "obsidian";

import {
    EncryptionManagementModal,
} from "../modals";

import { JournalReflectionSettings } from "../types";

export class JournalReflectionSettingTab extends PluginSettingTab {
    plugin: any; // We'll use any to avoid circular dependency
    private journalFolderSetting: Setting | null = null;
    private reflectionFolderSetting: Setting | null = null;

    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Helper function to ensure customAnalysisScope is initialized
     * Reduces duplication in the settings UI
     */
    private ensureCustomAnalysisScope(): void {
        if (!this.plugin.settings.customAnalysisScope) {
            const defaultScope = this.plugin.getDefaultSettings().customAnalysisScope;
            this.plugin.settings.customAnalysisScope = {
                name: defaultScope.name,
                includeKeywords: [...defaultScope.includeKeywords],
                excludeKeywords: [...defaultScope.excludeKeywords],
                includeFolders: [...defaultScope.includeFolders],
                excludeFolders: [...defaultScope.excludeFolders],
                includeTags: [...defaultScope.includeTags],
                excludeTags: [...defaultScope.excludeTags],
            };
        }
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Journal Reflection Settings" });

        // Security Section
        containerEl.createEl("h3", { text: "Security" });

        // Encryption status and management
        const encryptionStatus = this.plugin.settings.encryptionEnabled
            ? "🔒 Encrypted"
            : "🔓 Plain Text";
        new Setting(containerEl)
            .setName("API Key Storage")
            .setDesc(
                `Current status: ${encryptionStatus}. Click to manage encryption settings.`
            )
            .addButton((btn) => {
                btn.setButtonText("Manage Encryption").onClick(() => {
                    const modal = new EncryptionManagementModal(
                        this.app,
                        this.plugin,
                        () => {
                            // Refresh the settings display after modal closes
                            this.display();
                        },
                        this.plugin.errorHandler
                    );
                    modal.open();
                });
            });

        // OpenAI API Key
        const apiKeySetting = new Setting(containerEl)
            .setName("OpenAI API Key")
            .setDesc(
                this.plugin.settings.encryptionEnabled
                    ? "Your API key is encrypted. Use 'Manage Encryption' to modify."
                    : "Your OpenAI API key for generating reflections (stored in plain text)"
            );

        if (!this.plugin.settings.encryptionEnabled) {
            apiKeySetting.addText((text) => {
                text.setPlaceholder("sk-...")
                    .setValue(
                        typeof this.plugin.settings.openaiApiKey === "string"
                            ? this.plugin.settings.openaiApiKey
                            : ""
                    )
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
            const warningEl = containerEl.createDiv({
                cls: "setting-item-description",
            });
            warningEl.style.color = "var(--text-warning)";
            warningEl.createSpan({ text: "⚠️ " });
            warningEl.createEl("strong", { text: "Security Warning:" });
            warningEl.createSpan({
                text: " Your API key is stored in plain text. Consider enabling encryption for better security.",
            });
        }

        containerEl.createEl("h3", { text: "AI Configuration" });

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
            cls: "setting-item-description journal-reflection-help-toggle",
        });

        const helpLink = helpToggle.createEl("a", {
            href: "#",
            text: "📁 Show folder configuration help",
        });

        const folderHelpEl = containerEl.createDiv({
            cls: "setting-item-description journal-reflection-folder-help",
        });

        // Create help content using DOM API
        const formatLine = folderHelpEl.createDiv();
        formatLine.createEl("strong", { text: "Format:" });
        formatLine.appendText(" ");
        formatLine.createEl("code", {
            text: "Daily Notes, Journal/2024, Work/Logs",
        });

        folderHelpEl.createEl("br");

        const examplesLine = folderHelpEl.createDiv();
        examplesLine.createEl("strong", { text: "Examples:" });
        examplesLine.appendText(" Single: ");
        examplesLine.createEl("code", { text: "Daily Notes" });
        examplesLine.appendText(" | Multiple: ");
        examplesLine.createEl("code", { text: "Daily Notes, Journal" });

        folderHelpEl.createEl("br");

        const behaviorLine = folderHelpEl.createDiv();
        behaviorLine.createEl("strong", { text: "Behavior:" });
        behaviorLine.appendText(
            " Searches specified folders first, falls back to entire vault if none found"
        );

        folderHelpEl.createEl("br");

        const tipsLine = folderHelpEl.createDiv();
        tipsLine.createEl("strong", { text: "Tips:" });
        tipsLine.appendText(
            " Leave empty for vault-wide search • Check validation icon (✓/✗/ℹ) for status"
        );

        helpToggle.addEventListener("click", (e) => {
            e.preventDefault();
            const isVisible = folderHelpEl.classList.contains("visible");
            folderHelpEl.classList.toggle("visible", !isVisible);
            helpLink.textContent = isVisible
                ? "📁 Show folder configuration help"
                : "📁 Hide folder configuration help";
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

        // Analysis Scope Section (Feature Flag)
        if (this.plugin.settings.enabledAnalysisScopes) {
            this.renderAnalysisScopeSection(containerEl);
        }

        // Advanced NLP Analysis Section
        this.renderAdvancedNLPSection(containerEl);
    }

    private renderAnalysisScopeSection(containerEl: HTMLElement): void {
        containerEl.createEl("h3", { text: "Analysis Scope" });

        // Analysis Scope Selection
        new Setting(containerEl)
            .setName("Analysis Scope")
            .setDesc(
                "Choose the scope of analysis to focus on specific areas of your journal"
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption(
                        "whole-life",
                        "Whole Life - Analyze all entries"
                    )
                    .addOption(
                        "work-only",
                        "Work Only - Focus on work-related entries"
                    )
                    .addOption("custom", "Custom - Define your own scope")
                    .setValue(
                        this.plugin.settings.analysisScope || "whole-life"
                    )
                    .onChange(
                        async (
                            value: "whole-life" | "work-only" | "custom"
                        ) => {
                            this.plugin.settings.analysisScope = value;
                            await this.plugin.saveSettings();
                            // Refresh to show/hide custom scope settings
                            this.display();
                        }
                    )
            );

        // Custom Scope Settings (only show if custom is selected)
        if (this.plugin.settings.analysisScope === "custom") {
            this.renderCustomScopeSettings(containerEl);
        }
    }

    private renderCustomScopeSettings(containerEl: HTMLElement): void {
        this.ensureCustomAnalysisScope();
        const customScope = this.plugin.settings.customAnalysisScope!;

        // Custom Scope Name
        new Setting(containerEl)
            .setName("Custom Scope Name")
            .setDesc(
                "A descriptive name for your custom analysis scope"
            )
            .addText((text) => {
                text.setPlaceholder(
                    "e.g., Health & Wellness, Creative Projects"
                )
                    .setValue(customScope.name)
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.name =
                            value;
                        await this.plugin.saveSettings();
                    });
            });

        // Include Keywords
        new Setting(containerEl)
            .setName("Include Keywords")
            .setDesc(
                "Comma-separated keywords to include in analysis (e.g., work, project, meeting)"
            )
            .addText((text) => {
                text.setPlaceholder("work, project, meeting, deadline")
                    .setValue(customScope.includeKeywords.join(", "))
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.includeKeywords =
                            value
                                .split(",")
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Exclude Keywords
        new Setting(containerEl)
            .setName("Exclude Keywords")
            .setDesc(
                "Comma-separated keywords to exclude from analysis (e.g., personal, private)"
            )
            .addText((text) => {
                text.setPlaceholder("personal, private, family")
                    .setValue(customScope.excludeKeywords.join(", "))
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.excludeKeywords =
                            value
                                .split(",")
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Include Tags
        new Setting(containerEl)
            .setName("Include Tags")
            .setDesc(
                "Comma-separated tags to include in analysis (without #, e.g., work, project)"
            )
            .addText((text) => {
                text.setPlaceholder("work, project, meeting")
                    .setValue(customScope.includeTags.join(", "))
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.includeTags =
                            value
                                .split(",")
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Exclude Tags
        new Setting(containerEl)
            .setName("Exclude Tags")
            .setDesc(
                "Comma-separated tags to exclude from analysis (without #, e.g., personal, private)"
            )
            .addText((text) => {
                text.setPlaceholder("personal, private, family")
                    .setValue(customScope.excludeTags.join(", "))
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.excludeTags =
                            value
                                .split(",")
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Include Folders
        new Setting(containerEl)
            .setName("Include Folders")
            .setDesc(
                "Comma-separated folder paths to include in analysis (e.g., Work Notes, Projects)"
            )
            .addText((text) => {
                text.setPlaceholder("Work Notes, Projects, Meetings")
                    .setValue(customScope.includeFolders.join(", "))
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.includeFolders =
                            value
                                .split(",")
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Exclude Folders
        new Setting(containerEl)
            .setName("Exclude Folders")
            .setDesc(
                "Comma-separated folder paths to exclude from analysis (e.g., Personal, Private)"
            )
            .addText((text) => {
                text.setPlaceholder("Personal, Private, Family")
                    .setValue(customScope.excludeFolders.join(", "))
                    .onChange(async (value) => {
                        this.ensureCustomAnalysisScope();
                        this.plugin.settings.customAnalysisScope!.excludeFolders =
                            value
                                .split(",")
                                .map((k) => k.trim())
                                .filter((k) => k.length > 0);
                        await this.plugin.saveSettings();
                    });
            });

        // Scope Preview
        this.renderScopePreview(containerEl, customScope);
    }

    private renderScopePreview(containerEl: HTMLElement, customScope: any): void {
        const scopePreview = containerEl.createDiv({
            cls: "setting-item-description",
        });
        scopePreview.createEl("strong", {
            text: "Custom Scope Preview:",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Name: " });
        scopePreview.createSpan({
            text: customScope.name || "Unnamed",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Include Keywords: " });
        scopePreview.createSpan({
            text:
                customScope.includeKeywords.length > 0
                    ? customScope.includeKeywords.join(", ")
                    : "None",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Exclude Keywords: " });
        scopePreview.createSpan({
            text:
                customScope.excludeKeywords.length > 0
                    ? customScope.excludeKeywords.join(", ")
                    : "None",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Include Tags: " });
        scopePreview.createSpan({
            text:
                customScope.includeTags.length > 0
                    ? customScope.includeTags
                            .map((t: string) => "#" + t)
                            .join(", ")
                    : "None",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Exclude Tags: " });
        scopePreview.createSpan({
            text:
                customScope.excludeTags.length > 0
                    ? customScope.excludeTags
                            .map((t: string) => "#" + t)
                            .join(", ")
                    : "None",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Include Folders: " });
        scopePreview.createSpan({
            text:
                customScope.includeFolders.length > 0
                    ? customScope.includeFolders.join(", ")
                    : "None",
        });
        scopePreview.createEl("br");

        scopePreview.createEl("strong", { text: "Exclude Folders: " });
        scopePreview.createSpan({
            text:
                customScope.excludeFolders.length > 0
                    ? customScope.excludeFolders.join(", ")
                    : "None",
        });
    }

    private renderAdvancedNLPSection(containerEl: HTMLElement): void {
        containerEl.createEl("h3", { text: "Advanced NLP Analysis" });

        // Enable Analysis Scopes Feature Flag
        new Setting(containerEl)
            .setName("Enable Analysis Scopes (Beta)")
            .setDesc(
                "Enable analysis scope settings to focus on specific areas of your journal (work-only, custom filters, etc.)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.enabledAnalysisScopes ?? false
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.enabledAnalysisScopes = value;
                        await this.plugin.saveSettings();
                        // Refresh to show/hide analysis scope settings
                        this.display();
                    })
            );

        // Enable Advanced NLP
        new Setting(containerEl)
            .setName("Enable Advanced NLP Analysis")
            .setDesc(
                "Use sophisticated natural language processing for deeper insights including productivity themes, blocker detection, and multi-dimensional sentiment analysis"
            )
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

        // NLP Analysis Depth (only show if advanced NLP is enabled)
        if (this.plugin.settings.enableAdvancedNLP ?? true) {
            this.renderNLPAnalysisSettings(containerEl);
        }
    }

    private renderNLPAnalysisSettings(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("NLP Analysis Depth")
            .setDesc(
                "Choose the depth of NLP analysis: Basic (fast), Moderate (balanced), Deep (comprehensive)"
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption(
                        "basic",
                        "Basic - Fast analysis with core features"
                    )
                    .addOption(
                        "moderate",
                        "Moderate - Balanced depth and performance"
                    )
                    .addOption(
                        "deep",
                        "Deep - Comprehensive analysis (slower)"
                    )
                    .setValue(
                        this.plugin.settings.nlpAnalysisDepth || "moderate"
                    )
                    .onChange(
                        async (value: "basic" | "moderate" | "deep") => {
                            this.plugin.settings.nlpAnalysisDepth = value;
                            await this.plugin.saveSettings();
                        }
                    )
            );

        // Blocker Detection Sensitivity
        new Setting(containerEl)
            .setName("Blocker Detection Sensitivity")
            .setDesc(
                "Adjust how sensitive the system is to detecting productivity blockers"
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("low", "Low - Only detect obvious blockers")
                    .addOption("medium", "Medium - Balanced detection")
                    .addOption("high", "High - Detect subtle blockers")
                    .setValue(
                        this.plugin.settings.blockerDetectionSensitivity ||
                            "medium"
                    )
                    .onChange(async (value: "low" | "medium" | "high") => {
                        this.plugin.settings.blockerDetectionSensitivity =
                            value;
                        await this.plugin.saveSettings();
                    })
            );

        // Pattern Recognition Threshold
        new Setting(containerEl)
            .setName("Pattern Recognition Threshold")
            .setDesc(
                "Minimum confidence level for pattern detection (0.1 = very sensitive, 1.0 = very specific)"
            )
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

        // Enable Trend Analysis
        new Setting(containerEl)
            .setName("Enable Trend Analysis")
            .setDesc("Analyze patterns and changes over time")
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.enableTrendAnalysis ?? true
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.enableTrendAnalysis = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Enable Semantic Analysis
        new Setting(containerEl)
            .setName("Enable AI Semantic Analysis")
            .setDesc(
                "Use OpenAI for deep semantic understanding and insights generation"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.enableSemanticAnalysis ?? true
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.enableSemanticAnalysis = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Cache Analysis Results
        new Setting(containerEl)
            .setName("Cache Analysis Results")
            .setDesc(
                "Cache analysis results to improve performance (recommended)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(
                        this.plugin.settings.cacheAnalysisResults ?? true
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.cacheAnalysisResults = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Automatic Scanning Section
        this.renderAutoScanSettings(containerEl);

        // NLP Features Info
        this.renderNLPFeaturesInfo(containerEl);
    }

    private renderAutoScanSettings(containerEl: HTMLElement): void {
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
                        if (
                            value &&
                            this.plugin.settings.scanFrequency !== "manual"
                        ) {
                            this.plugin.runAutoScan();
                        }

                        // Refresh to show/hide scan frequency setting
                        this.display();
                    })
            );

        // Scan Frequency (only show if auto-scan is enabled)
        if (this.plugin.settings.enableAutoScan) {
            new Setting(containerEl)
                .setName("Scan Frequency")
                .setDesc("How often to run automatic analysis")
                .addDropdown((dropdown) =>
                    dropdown
                        .addOption("manual", "Manual only")
                        .addOption("daily", "Daily")
                        .addOption("weekly", "Weekly")
                        .setValue(
                            this.plugin.settings.scanFrequency ?? "manual"
                        )
                        .onChange(async (value) => {
                            const oldValue =
                                this.plugin.settings.scanFrequency;
                            this.plugin.settings.scanFrequency = value as
                                | "manual"
                                | "daily"
                                | "weekly";
                            await this.plugin.saveSettings();

                            // If changing from manual to scheduled, trigger immediate scan
                            if (
                                oldValue === "manual" &&
                                value !== "manual"
                            ) {
                                this.plugin.runAutoScan();
                            }
                        })
                );

            // Show last scan time if available
            if (
                this.plugin.settings.lastAutoScan &&
                this.plugin.settings.lastAutoScan > 0
            ) {
                this.renderLastScanInfo(containerEl);
            }
        }
    }

    private renderLastScanInfo(containerEl: HTMLElement): void {
        const lastScanDate = new Date(
            this.plugin.settings.lastAutoScan
        );
        const lastScanSetting = new Setting(containerEl)
            .setName("Last Auto-scan")
            .setDesc(
                `Last automatic scan: ${lastScanDate.toLocaleString()}`
            );

        // Add a manual scan trigger button
        lastScanSetting.addButton((button) =>
            button
                .setButtonText("Run Now")
                .setTooltip("Run analysis immediately")
                .onClick(async () => {
                    try {
                        await this.plugin.performComprehensiveAnalysis();
                        new Notice(
                            "Manual scan completed successfully"
                        );
                        this.display(); // Refresh to update last scan time
                    } catch (error) {
                        new Notice(
                            "Manual scan failed. Check console for details."
                        );
                        console.error("Manual scan error:", error);
                    }
                })
        );
    }

    private renderNLPFeaturesInfo(containerEl: HTMLElement): void {
        const infoEl = containerEl.createDiv({
            cls: "setting-item-description",
        });
        infoEl.createEl("strong", { text: "Advanced NLP Features:" });
        infoEl.createEl("br");
        infoEl.createSpan({ text: "• " });
        infoEl.createEl("strong", {
            text: "Productivity Theme Extraction:",
        });
        infoEl.createSpan({
            text: " Identifies recurring themes in your work",
        });
        infoEl.createEl("br");
        infoEl.createSpan({ text: "• " });
        infoEl.createEl("strong", { text: "Blocker Detection:" });
        infoEl.createSpan({
            text: " Spots procrastination, time management, and workflow issues",
        });
        infoEl.createEl("br");
        infoEl.createSpan({ text: "• " });
        infoEl.createEl("strong", { text: "Multi-dimensional Sentiment:" });
        infoEl.createSpan({
            text: " Analyzes emotions, arousal levels, and productivity mood",
        });
        infoEl.createEl("br");
        infoEl.createSpan({ text: "• " });
        infoEl.createEl("strong", { text: "Context-aware Analysis:" });
        infoEl.createSpan({
            text: " Understands the nuances of your writing style",
        });
        infoEl.createEl("br");
        infoEl.createSpan({ text: "• " });
        infoEl.createEl("strong", { text: "Pattern Correlation:" });
        infoEl.createSpan({
            text: " Connects productivity patterns with mood and activities",
        });
    }

    /**
     * Validate the folder path
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

    /**
     * Validate the folder path
     */
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

    /**
     * Validate the folder path
     */
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

    /**
     * Add a validation icon to the setting
     */
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