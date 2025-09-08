// tests/main.test.ts

import JournalReflectionPlugin, { DEFAULT_SETTINGS } from '../src/main';
import { ServiceManager } from '../src/services/ServiceManager';
import { ErrorHandlingService } from '../src/services/ErrorHandlingService';

// Mock Obsidian components
jest.mock('obsidian', () => ({
    Plugin: class Plugin {
        app: any;
        manifest: any;
        loadData = jest.fn();
        saveData = jest.fn();
        addRibbonIcon = jest.fn();
        addCommand = jest.fn();
        addSettingTab = jest.fn();
        registerInterval = jest.fn();
        constructor(app: any, manifest: any) {
            this.app = app;
            this.manifest = manifest;
        }
    },
    Modal: class Modal {
        app: any;
        constructor(app: any) {
            this.app = app;
        }
        open() {}
        close() {}
    },
    PluginSettingTab: class PluginSettingTab {
        app: any;
        plugin: any;
        constructor(app: any, plugin: any) {
            this.app = app;
            this.plugin = plugin;
        }
        display() {}
    },
    Notice: jest.fn(),
    moment: jest.fn(() => ({
        format: jest.fn().mockReturnValue('2024-01-01 12:00'),
        subtract: jest.fn().mockReturnThis(),
        isAfter: jest.fn().mockReturnValue(true)
    }))
}));

// Mock services
jest.mock('../src/services/ServiceManager');
jest.mock('../src/services/ErrorHandlingService');
jest.mock('../src/modals');
jest.mock('../src/ui/SettingsUI');

// Mock window.moment
(global as any).window = {
    moment: jest.fn(() => ({
        format: jest.fn().mockReturnValue('2024-01-01 12:00')
    }))
};

describe('JournalReflectionPlugin', () => {
    let plugin: JournalReflectionPlugin;
    let mockApp: any;
    let mockManifest: any;

    beforeEach(() => {
        mockApp = {
            vault: {
                adapter: {
                    read: jest.fn(),
                    write: jest.fn(),
                    exists: jest.fn()
                }
            },
            workspace: {
                getLeaf: jest.fn().mockReturnValue({
                    openFile: jest.fn()
                })
            }
        };

        mockManifest = {
            id: 'retrospect-ai',
            name: 'Retrospect AI',
            version: '1.0.0'
        };

        plugin = new JournalReflectionPlugin(mockApp, mockManifest);
        jest.clearAllMocks();
    });

    describe('Plugin Lifecycle', () => {
        it('should initialize with default settings', () => {
            expect(plugin.settings).toBeUndefined();
        });

        it('should load default settings when no saved data exists', async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            
            await plugin.loadSettings();
            
            expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
        });

        it('should merge loaded data with default settings', async () => {
            const savedData = { openaiApiKey: 'test-key', daysToInclude: 14 };
            plugin.loadData = jest.fn().mockResolvedValue(savedData);
            
            await plugin.loadSettings();
            
            expect(plugin.settings.openaiApiKey).toBe('test-key');
            expect(plugin.settings.daysToInclude).toBe(14);
            expect(plugin.settings.llmProvider).toBe(DEFAULT_SETTINGS.llmProvider);
        });

        it('should create service manager during onload', async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            const mockServiceManager = {
                register: jest.fn(),
                initializeAll: jest.fn().mockResolvedValue(undefined),
                resolve: jest.fn().mockReturnValue({
                    updateConfig: jest.fn()
                }),
                has: jest.fn().mockReturnValue(true),
                disposeAll: jest.fn().mockResolvedValue(undefined)
            };
            (ServiceManager as jest.Mock).mockImplementation(() => mockServiceManager);
            
            await plugin.onload();
            
            expect(ServiceManager).toHaveBeenCalledWith(mockApp);
            expect(plugin.serviceManager).toBe(mockServiceManager);
        });
    });

    describe('Settings Management', () => {
        beforeEach(async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            await plugin.loadSettings();
        });

        it('should validate settings correctly', async () => {
            plugin.settings.daysToInclude = -1;
            plugin.settings.periodicNoteFolders = ['', 'valid-folder', null as any];
            plugin.settings.reflectionFolder = '';
            
            await plugin.saveSettings();
            
            expect(plugin.settings.daysToInclude).toBe(DEFAULT_SETTINGS.daysToInclude);
            expect(plugin.settings.periodicNoteFolders).toEqual(['valid-folder']);
            expect(plugin.settings.reflectionFolder).toBe(DEFAULT_SETTINGS.reflectionFolder);
        });

        it('should migrate old journalFolder to periodicNoteFolders', async () => {
            const oldSettings = { journalFolder: 'Daily Notes' };
            plugin.loadData = jest.fn().mockResolvedValue(oldSettings);
            plugin.saveData = jest.fn();
            
            await plugin.loadSettings();
            
            expect(plugin.settings.periodicNoteFolders).toEqual(['Daily Notes']);
        });

        it('should clean up empty strings from periodicNoteFolders', async () => {
            plugin.settings.periodicNoteFolders = ['', 'valid', ' ', 'also-valid', ''];
            
            await plugin.saveSettings();
            
            expect(plugin.settings.periodicNoteFolders).toEqual(['valid', 'also-valid']);
        });
    });

    describe('API Key Management', () => {
        beforeEach(async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            await plugin.loadSettings();
        });

        it('should return empty string when no API key is set', async () => {
            plugin.settings.openaiApiKey = '';
            
            const result = await plugin.getDecryptedApiKey();
            
            expect(result).toBe('');
        });

        it('should return plain text API key when encryption is disabled', async () => {
            plugin.settings.openaiApiKey = 'test-api-key';
            plugin.settings.encryptionEnabled = false;
            
            const result = await plugin.getDecryptedApiKey();
            
            expect(result).toBe('test-api-key');
        });

        it('should handle invalid API key types gracefully', async () => {
            plugin.settings.openaiApiKey = null as any;
            plugin.settings.encryptionEnabled = false;
            
            const result = await plugin.getDecryptedApiKey();
            
            expect(result).toBe('');
        });
    });

    describe('Validation Methods', () => {
        beforeEach(async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            await plugin.loadSettings();
            
            // Mock service manager
            const mockServiceManager = {
                has: jest.fn().mockReturnValue(true),
                resolve: jest.fn()
            };
            plugin.serviceManager = mockServiceManager as any;
            
            // Mock error handler
            plugin.errorHandler = {
                handleError: jest.fn()
            } as any;
        });

        it('should validate API key correctly for OpenAI', async () => {
            plugin.settings.openaiApiKey = 'sk-test123';
            plugin.settings.encryptionEnabled = false;
            
            const result = await plugin['validateApiKey']();
            
            expect(result).toBe(true);
        });

        it('should return false for empty API key', async () => {
            plugin.settings.openaiApiKey = '';
            
            const result = await plugin['validateApiKey']();
            
            expect(result).toBe(false);
        });

        it('should validate analysis prerequisites', async () => {
            plugin.settings.llmProvider = 'openai';
            plugin.settings.openaiApiKey = 'sk-test123';
            plugin.settings.encryptionEnabled = false;
            
            const result = await plugin['validateAnalysisPrerequisites']();
            
            expect(result).toBe(true);
        });

        it('should fail validation when service manager is not initialized', async () => {
            plugin.serviceManager = null as any;
            
            const result = await plugin['validateAnalysisPrerequisites']();
            
            expect(result).toBe(false);
            expect(plugin.errorHandler.handleError).toHaveBeenCalled();
        });
    });

    describe('Report Formatting', () => {
        beforeEach(async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            await plugin.loadSettings();
        });

        it('should format patterns report correctly', () => {
            const patterns = [
                {
                    type: 'mood_pattern',
                    confidence: 0.85,
                    description: 'Positive mood in mornings',
                    metadata: { keywords: ['happy', 'energetic'] }
                },
                {
                    type: 'activity_pattern',
                    confidence: 0.72,
                    description: 'Exercise routine on weekdays',
                    metadata: {}
                }
            ];

            const report = plugin['formatPatternsReport'](patterns);

            expect(report).toContain('# Journal Pattern Analysis');
            expect(report).toContain('MOOD PATTERN');
            expect(report).toContain('85%');
            expect(report).toContain('Positive mood in mornings');
            expect(report).toContain('happy, energetic');
            expect(report).toContain('ACTIVITY PATTERN');
        });

        it('should format trends report correctly', () => {
            const trends = [
                {
                    metric: 'word_count',
                    direction: 'increasing' as const,
                    strength: 0.68,
                    timePoints: [100, 120, 140, 160]
                }
            ];

            const report = plugin['formatTrendsReport'](trends);

            expect(report).toContain('# Journal Trend Analysis');
            expect(report).toContain('WORD COUNT');
            expect(report).toContain('increasing');
            expect(report).toContain('0.68');
            expect(report).toContain('4');
        });

        it('should format comprehensive report correctly', () => {
            const result = {
                timeRange: '7 days',
                confidence: 0.78,
                summary: 'Overall positive week with focus on productivity',
                patterns: [
                    {
                        type: 'mood',
                        confidence: 0.85,
                        description: 'Stable mood patterns'
                    }
                ],
                trends: [
                    {
                        metric: 'activity_level',
                        direction: 'stable' as const,
                        strength: 0.45
                    }
                ],
                insights: [
                    {
                        category: 'Productivity',
                        insight: 'Strong focus on morning tasks'
                    }
                ]
            };

            const report = plugin['formatComprehensiveReport'](result);

            expect(report).toContain('# Comprehensive Journal Analysis');
            expect(report).toContain('7 days');
            expect(report).toContain('78%');
            expect(report).toContain('Overall positive week');
            expect(report).toContain('Stable mood patterns');
            expect(report).toContain('Strong focus on morning tasks');
        });
    });

    describe('Auto-scan Functionality', () => {
        beforeEach(async () => {
            plugin.loadData = jest.fn().mockResolvedValue(null);
            await plugin.loadSettings();
        });

        it('should determine auto-scan timing correctly', () => {
            const now = Date.now();
            plugin.settings.lastAutoScan = now - (25 * 60 * 60 * 1000); // 25 hours ago
            plugin.settings.scanFrequency = 'daily';
            
            const result = plugin['shouldRunAutoScan']();
            
            expect(result).toBe(true);
        });

        it('should not run auto-scan when interval has not passed', () => {
            const now = Date.now();
            plugin.settings.lastAutoScan = now - (1 * 60 * 60 * 1000); // 1 hour ago
            plugin.settings.scanFrequency = 'daily';
            
            const result = plugin['shouldRunAutoScan']();
            
            expect(result).toBe(false);
        });

        it('should initialize lastAutoScan when not set', () => {
            plugin.settings.lastAutoScan = 0;
            plugin.saveSettings = jest.fn();
            
            const result = plugin['shouldRunAutoScan']();
            
            expect(plugin.settings.lastAutoScan).toBeGreaterThan(0);
            expect(plugin.saveSettings).toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    describe('Default Settings', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_SETTINGS.llmProvider).toBe('openai');
            expect(DEFAULT_SETTINGS.daysToInclude).toBe(7);
            expect(DEFAULT_SETTINGS.excludePrivate).toBe(true);
            expect(DEFAULT_SETTINGS.periodicNoteFolders).toEqual(['Daily Notes']);
            expect(DEFAULT_SETTINGS.reflectionFolder).toBe('Summaries');
            expect(DEFAULT_SETTINGS.encryptionEnabled).toBe(false);
            expect(DEFAULT_SETTINGS.analysisEnabled).toBe(true);
            expect(DEFAULT_SETTINGS.enableAutoScan).toBe(false);
        });

        it('should have valid communication style options', () => {
            const validStyles = ['direct', 'gentle', 'encouraging'];
            expect(validStyles).toContain(DEFAULT_SETTINGS.communicationStyle);
        });

        it('should have valid analysis depth options', () => {
            const validDepths = ['basic', 'standard', 'detailed'];
            expect(validDepths).toContain(DEFAULT_SETTINGS.analysisDepth);
        });
    });
});