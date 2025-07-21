// tests/SettingsValidation.test.ts

import { jest } from '@jest/globals';

// Mock the main plugin class with validation methods
class MockJournalReflectionPlugin {
    settings: any;

    constructor(settings: any = {}) {
        this.settings = settings;
    }

    // Extract the validateSettings method from main.ts
    validateSettings(): void {
        // Default settings for comparison (from DEFAULT_SETTINGS in main.ts)
        const DEFAULT_SETTINGS = {
            llmProvider: 'openai',
            openaiApiKey: "",
            openaiModel: "gpt-4o-mini",
            ollamaBaseUrl: "http://localhost:11434",
            ollamaModel: "llama3.1:8b",
            ollamaTimeout: 30000,
            daysToInclude: 7,
            excludePrivate: true,
            periodicNoteFolders: ["Daily Notes"],
            reflectionFolder: "Summaries",
            encryptionEnabled: false,
            encryptionSetup: false,
            communicationStyle: 'encouraging',
            analysisDepth: 'standard',
            analysisEnabled: true,
            patternThreshold: 0.6,
            enableTrendAnalysis: true,
            enableSemanticAnalysis: true,
            cacheAnalysisResults: true,
            enableAdvancedNLP: true,
            nlpAnalysisDepth: 'moderate',
            blockerDetectionSensitivity: 'medium',
            enabledAnalysisScopes: true,
            analysisScope: 'whole-life',
            customAnalysisScope: {
                name: '',
                includeKeywords: [],
                excludeKeywords: [],
                includeFolders: [],
                excludeFolders: [],
                includeTags: [],
                excludeTags: []
            },
            enableAutoScan: false,
            scanFrequency: 'manual',
            lastAutoScan: 0
        };

        // Ensure periodicNoteFolders is always an array
        if (!Array.isArray(this.settings.periodicNoteFolders)) {
            this.settings.periodicNoteFolders = [];
        }

        // Clean up empty strings and ensure all entries are valid strings
        this.settings.periodicNoteFolders = this.settings.periodicNoteFolders
            .filter((folder: any) => folder && typeof folder === "string")
            .map((folder: string) => folder.trim())
            .filter((folder: string) => folder.length > 0);

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

        if (
            !this.settings.reflectionFolder ||
            this.settings.reflectionFolder.trim() === ""
        ) {
            this.settings.reflectionFolder = DEFAULT_SETTINGS.reflectionFolder;
        }

        if (!this.settings.communicationStyle || !['direct', 'gentle', 'encouraging'].includes(this.settings.communicationStyle)) {
            this.settings.communicationStyle = DEFAULT_SETTINGS.communicationStyle;
        }

        if (!this.settings.analysisDepth || !['basic', 'standard', 'detailed'].includes(this.settings.analysisDepth)) {
            this.settings.analysisDepth = DEFAULT_SETTINGS.analysisDepth;
        }
    }
}

describe('Settings Validation', () => {
    let plugin: MockJournalReflectionPlugin;

    beforeEach(() => {
        plugin = new MockJournalReflectionPlugin();
    });

    describe('periodicNoteFolders validation', () => {
        test('should convert non-array periodicNoteFolders to empty array', () => {
            plugin.settings.periodicNoteFolders = "not-an-array";
            plugin.validateSettings();
            expect(Array.isArray(plugin.settings.periodicNoteFolders)).toBe(true);
            expect(plugin.settings.periodicNoteFolders).toEqual([]);
        });

        test('should convert null periodicNoteFolders to empty array', () => {
            plugin.settings.periodicNoteFolders = null;
            plugin.validateSettings();
            expect(plugin.settings.periodicNoteFolders).toEqual([]);
        });

        test('should convert undefined periodicNoteFolders to empty array', () => {
            plugin.settings.periodicNoteFolders = undefined;
            plugin.validateSettings();
            expect(plugin.settings.periodicNoteFolders).toEqual([]);
        });

        test('should filter out non-string values from periodicNoteFolders', () => {
            plugin.settings.periodicNoteFolders = ["Daily Notes", null, 123, "", "Journal", undefined, true];
            plugin.validateSettings();
            expect(plugin.settings.periodicNoteFolders).toEqual(["Daily Notes", "Journal"]);
        });

        test('should trim and filter empty strings from periodicNoteFolders', () => {
            plugin.settings.periodicNoteFolders = ["  Daily Notes  ", "", "   ", "Journal", "  Archive  "];
            plugin.validateSettings();
            expect(plugin.settings.periodicNoteFolders).toEqual(["Daily Notes", "Journal", "Archive"]);
        });

        test('should preserve valid folder paths', () => {
            plugin.settings.periodicNoteFolders = ["Daily Notes", "Journal/Weekly", "Archive"];
            plugin.validateSettings();
            expect(plugin.settings.periodicNoteFolders).toEqual(["Daily Notes", "Journal/Weekly", "Archive"]);
        });
    });

    describe('daysToInclude validation', () => {
        test('should use default when daysToInclude is not a number', () => {
            plugin.settings.daysToInclude = "not-a-number";
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);
        });

        test('should use default when daysToInclude is null', () => {
            plugin.settings.daysToInclude = null;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);
        });

        test('should use default when daysToInclude is undefined', () => {
            plugin.settings.daysToInclude = undefined;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);
        });

        test('should use default when daysToInclude is less than 1', () => {
            plugin.settings.daysToInclude = 0;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);

            plugin.settings.daysToInclude = -5;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);
        });

        test('should preserve valid positive numbers', () => {
            plugin.settings.daysToInclude = 14;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(14);

            plugin.settings.daysToInclude = 1;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(1);
        });
    });

    describe('excludePrivate validation', () => {
        test('should use default when excludePrivate is not boolean', () => {
            plugin.settings.excludePrivate = "not-boolean";
            plugin.validateSettings();
            expect(plugin.settings.excludePrivate).toBe(true);
        });

        test('should use default when excludePrivate is null', () => {
            plugin.settings.excludePrivate = null;
            plugin.validateSettings();
            expect(plugin.settings.excludePrivate).toBe(true);
        });

        test('should preserve valid boolean values', () => {
            plugin.settings.excludePrivate = false;
            plugin.validateSettings();
            expect(plugin.settings.excludePrivate).toBe(false);

            plugin.settings.excludePrivate = true;
            plugin.validateSettings();
            expect(plugin.settings.excludePrivate).toBe(true);
        });
    });

    describe('openaiModel validation', () => {
        test('should use default when openaiModel is empty', () => {
            plugin.settings.openaiModel = "";
            plugin.validateSettings();
            expect(plugin.settings.openaiModel).toBe("gpt-4o-mini");
        });

        test('should use default when openaiModel is null', () => {
            plugin.settings.openaiModel = null;
            plugin.validateSettings();
            expect(plugin.settings.openaiModel).toBe("gpt-4o-mini");
        });

        test('should use default when openaiModel is undefined', () => {
            plugin.settings.openaiModel = undefined;
            plugin.validateSettings();
            expect(plugin.settings.openaiModel).toBe("gpt-4o-mini");
        });

        test('should preserve valid model names', () => {
            plugin.settings.openaiModel = "gpt-4o";
            plugin.validateSettings();
            expect(plugin.settings.openaiModel).toBe("gpt-4o");
        });
    });

    describe('reflectionFolder validation', () => {
        test('should use default when reflectionFolder is empty', () => {
            plugin.settings.reflectionFolder = "";
            plugin.validateSettings();
            expect(plugin.settings.reflectionFolder).toBe("Summaries");
        });

        test('should use default when reflectionFolder is whitespace only', () => {
            plugin.settings.reflectionFolder = "   ";
            plugin.validateSettings();
            expect(plugin.settings.reflectionFolder).toBe("Summaries");
        });

        test('should use default when reflectionFolder is null', () => {
            plugin.settings.reflectionFolder = null;
            plugin.validateSettings();
            expect(plugin.settings.reflectionFolder).toBe("Summaries");
        });

        test('should preserve valid folder paths', () => {
            plugin.settings.reflectionFolder = "My Reflections";
            plugin.validateSettings();
            expect(plugin.settings.reflectionFolder).toBe("My Reflections");
        });
    });

    describe('communicationStyle validation', () => {
        test('should use default for invalid communication style', () => {
            plugin.settings.communicationStyle = "invalid-style";
            plugin.validateSettings();
            expect(plugin.settings.communicationStyle).toBe("encouraging");
        });

        test('should use default when communicationStyle is null', () => {
            plugin.settings.communicationStyle = null;
            plugin.validateSettings();
            expect(plugin.settings.communicationStyle).toBe("encouraging");
        });

        test('should preserve valid communication styles', () => {
            const validStyles = ['direct', 'gentle', 'encouraging'];
            
            for (const style of validStyles) {
                plugin.settings.communicationStyle = style;
                plugin.validateSettings();
                expect(plugin.settings.communicationStyle).toBe(style);
            }
        });
    });

    describe('analysisDepth validation', () => {
        test('should use default for invalid analysis depth', () => {
            plugin.settings.analysisDepth = "invalid-depth";
            plugin.validateSettings();
            expect(plugin.settings.analysisDepth).toBe("standard");
        });

        test('should use default when analysisDepth is null', () => {
            plugin.settings.analysisDepth = null;
            plugin.validateSettings();
            expect(plugin.settings.analysisDepth).toBe("standard");
        });

        test('should preserve valid analysis depths', () => {
            const validDepths = ['basic', 'standard', 'detailed'];
            
            for (const depth of validDepths) {
                plugin.settings.analysisDepth = depth;
                plugin.validateSettings();
                expect(plugin.settings.analysisDepth).toBe(depth);
            }
        });
    });

    describe('comprehensive validation test', () => {
        test('should handle completely invalid settings object', () => {
            plugin.settings = {
                periodicNoteFolders: "not-array",
                daysToInclude: "not-number",
                excludePrivate: "not-boolean",
                openaiModel: null,
                reflectionFolder: "",
                communicationStyle: "invalid",
                analysisDepth: "invalid"
            };

            plugin.validateSettings();

            expect(plugin.settings.periodicNoteFolders).toEqual([]);
            expect(plugin.settings.daysToInclude).toBe(7);
            expect(plugin.settings.excludePrivate).toBe(true);
            expect(plugin.settings.openaiModel).toBe("gpt-4o-mini");
            expect(plugin.settings.reflectionFolder).toBe("Summaries");
            expect(plugin.settings.communicationStyle).toBe("encouraging");
            expect(plugin.settings.analysisDepth).toBe("standard");
        });

        test('should preserve valid settings', () => {
            plugin.settings = {
                periodicNoteFolders: ["Daily Notes", "Journal"],
                daysToInclude: 14,
                excludePrivate: false,
                openaiModel: "gpt-4o",
                reflectionFolder: "My Summaries",
                communicationStyle: "direct",
                analysisDepth: "detailed"
            };

            plugin.validateSettings();

            expect(plugin.settings.periodicNoteFolders).toEqual(["Daily Notes", "Journal"]);
            expect(plugin.settings.daysToInclude).toBe(14);
            expect(plugin.settings.excludePrivate).toBe(false);
            expect(plugin.settings.openaiModel).toBe("gpt-4o");
            expect(plugin.settings.reflectionFolder).toBe("My Summaries");
            expect(plugin.settings.communicationStyle).toBe("direct");
            expect(plugin.settings.analysisDepth).toBe("detailed");
        });

        test('should handle mixed valid and invalid settings', () => {
            plugin.settings = {
                periodicNoteFolders: ["Valid Folder", "", null, "  Another Valid  ", 123],
                daysToInclude: 21,
                excludePrivate: "not-boolean",
                openaiModel: "gpt-4o",
                reflectionFolder: null,
                communicationStyle: "gentle",
                analysisDepth: "invalid-depth"
            };

            plugin.validateSettings();

            expect(plugin.settings.periodicNoteFolders).toEqual(["Valid Folder", "Another Valid"]);
            expect(plugin.settings.daysToInclude).toBe(21);
            expect(plugin.settings.excludePrivate).toBe(true);
            expect(plugin.settings.openaiModel).toBe("gpt-4o");
            expect(plugin.settings.reflectionFolder).toBe("Summaries");
            expect(plugin.settings.communicationStyle).toBe("gentle");
            expect(plugin.settings.analysisDepth).toBe("standard");
        });
    });

    describe('edge cases', () => {
        test('should handle empty settings object', () => {
            plugin.settings = {};
            plugin.validateSettings();

            expect(plugin.settings.periodicNoteFolders).toEqual([]);
            expect(plugin.settings.daysToInclude).toBe(7);
            expect(plugin.settings.excludePrivate).toBe(true);
            expect(plugin.settings.openaiModel).toBe("gpt-4o-mini");
            expect(plugin.settings.reflectionFolder).toBe("Summaries");
            expect(plugin.settings.communicationStyle).toBe("encouraging");
            expect(plugin.settings.analysisDepth).toBe("standard");
        });

        test('should handle array with only invalid values', () => {
            plugin.settings.periodicNoteFolders = [null, "", "   ", undefined, 123, true];
            plugin.validateSettings();
            expect(plugin.settings.periodicNoteFolders).toEqual([]);
        });

        test('should handle float numbers for daysToInclude', () => {
            plugin.settings.daysToInclude = 7.5;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7.5);
        });

        test('should handle zero and negative numbers correctly', () => {
            plugin.settings.daysToInclude = 0;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);

            plugin.settings.daysToInclude = -10;
            plugin.validateSettings();
            expect(plugin.settings.daysToInclude).toBe(7);
        });
    });
});