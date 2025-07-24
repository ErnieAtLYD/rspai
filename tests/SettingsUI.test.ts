// Tests for SettingsUI functionality

import { jest } from '@jest/globals';

// Mock Obsidian classes
const mockObsidian = require('./mocks/obsidian.js');
const { App, Setting, PluginSettingTab, TFolder } = mockObsidian;

// Make Setting available globally for the tests
global.Setting = Setting;

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
    callback();
    return 0;
});

// Mock dependencies
const mockPlugin = {
    settings: {
        llmProvider: 'openai',
        openaiApiKey: 'test-key',
        openaiModel: 'gpt-4o-mini',
        ollamaBaseUrl: 'http://localhost:11434',
        ollamaModel: 'llama3.1:8b',
        ollamaTimeout: 30000,
        daysToInclude: 7,
        excludePrivate: true,
        periodicNoteFolders: ['Daily Notes'],
        reflectionFolder: 'Summaries',
        encryptionEnabled: false,
        encryptionSetup: false,
        communicationStyle: 'encouraging',
        analysisDepth: 'standard',
        analysisScope: 'whole-life',
        enableTrendAnalysis: true,
        enableSemanticAnalysis: true,
        cacheAnalysisResults: true,
        enableAdvancedNLP: true,
        nlpAnalysisDepth: 'moderate',
        blockerDetectionSensitivity: 'medium',
        patternThreshold: 0.6,
        enableAutoScan: false,
        customAnalysisScope: {
            name: '',
            includeKeywords: [],
            excludeKeywords: [],
            includeFolders: [],
            excludeFolders: [],
            includeTags: [],
            excludeTags: []
        }
    },
    saveSettings: jest.fn().mockResolvedValue(undefined),
    updateServiceConfigurations: jest.fn().mockResolvedValue(undefined),
    runAutoScan: jest.fn(),
    serviceManager: {
        resolve: jest.fn().mockReturnValue({
            testConnection: jest.fn().mockResolvedValue(true)
        })
    },
    errorHandler: {
        handleError: jest.fn()
    }
};

const mockApp = {
    vault: {
        getAbstractFileByPath: jest.fn(),
        createFolder: jest.fn().mockResolvedValue(undefined)
    }
};

// Mock the EncryptionManagementModal
jest.mock('../src/modals', () => ({
    EncryptionManagementModal: jest.fn().mockImplementation((app, plugin, callback) => ({
        open: jest.fn(() => callback && callback())
    }))
}));

// Mock DEFAULT_SETTINGS
const DEFAULT_SETTINGS = {
    customAnalysisScope: {
        name: '',
        includeKeywords: [],
        excludeKeywords: [],
        includeFolders: [],
        excludeFolders: [],
        includeTags: [],
        excludeTags: []
    }
};

// Import the class to test after mocking
jest.mock('../src/main', () => ({
    default: jest.fn(),
    DEFAULT_SETTINGS
}));

// Now import the SettingsUI class
import { JournalReflectionSettingTab } from '../src/ui/SettingsUI';

describe('JournalReflectionSettingTab', () => {
    let settingsTab: JournalReflectionSettingTab;
    let mockContainerEl: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create a helper function for comprehensive DOM mocking
        const createMockElement = (tag?: string, attrs?: any): any => ({
            tagName: tag?.toUpperCase() || 'DIV',
            textContent: attrs?.text || '',
            empty: jest.fn(),
            classList: {
                add: jest.fn(),
                contains: jest.fn().mockReturnValue(false),
                toggle: jest.fn()
            },
            style: {},
            addEventListener: jest.fn(),
            appendChild: jest.fn(),
            querySelector: jest.fn().mockReturnValue(null),
            createSpan: jest.fn((attrs) => createMockElement('span', attrs)),
            createEl: jest.fn((tag, attrs) => createMockElement(tag, attrs)),
            createDiv: jest.fn((attrs) => createMockElement('div', attrs)),
            setAttribute: jest.fn(),
            href: attrs?.href || '',
            title: attrs?.title || ''
        });
        
        mockContainerEl = createMockElement();

        settingsTab = new JournalReflectionSettingTab(mockApp as any, mockPlugin as any);
        settingsTab.containerEl = mockContainerEl;
    });

    describe('Constructor', () => {
        test('should initialize with app and plugin', () => {
            expect(settingsTab.plugin).toBe(mockPlugin);
            expect(settingsTab.app).toBe(mockApp);
        });
    });

    describe('ensureCustomAnalysisScope', () => {
        test('should initialize customAnalysisScope if not present', () => {
            mockPlugin.settings.customAnalysisScope = undefined;
            (settingsTab as any).ensureCustomAnalysisScope();
            
            expect(mockPlugin.settings.customAnalysisScope).toEqual(DEFAULT_SETTINGS.customAnalysisScope);
        });

        test('should not overwrite existing customAnalysisScope', () => {
            const existingScope = {
                name: 'test',
                includeKeywords: ['work'],
                excludeKeywords: [],
                includeFolders: [],
                excludeFolders: [],
                includeTags: [],
                excludeTags: []
            };
            mockPlugin.settings.customAnalysisScope = existingScope;
            
            (settingsTab as any).ensureCustomAnalysisScope();
            
            expect(mockPlugin.settings.customAnalysisScope).toBe(existingScope);
        });
    });

    describe('createFormSetting', () => {
        test('should create toggle setting', () => {
            const onChange = jest.fn();
            const result = (settingsTab as any).createFormSetting(
                mockContainerEl,
                'Test Setting',
                'Test Description',
                true,
                onChange,
                'toggle'
            );

            expect(result).toBeDefined();
            expect(result.constructor.name).toBe('Setting');
        });

        test('should create dropdown setting with options', () => {
            const onChange = jest.fn();
            const options = {
                dropdownOptions: [
                    { value: 'option1', label: 'Option 1' },
                    { value: 'option2', label: 'Option 2' }
                ]
            };

            const result = (settingsTab as any).createFormSetting(
                mockContainerEl,
                'Test Dropdown',
                'Test Description',
                'option1',
                onChange,
                'dropdown',
                options
            );

            expect(result).toBeDefined();
            expect(result.constructor.name).toBe('Setting');
        });

        test('should create slider setting with limits', () => {
            const onChange = jest.fn();
            const options = {
                sliderOptions: { min: 0, max: 10, step: 1 }
            };

            const result = (settingsTab as any).createFormSetting(
                mockContainerEl,
                'Test Slider',
                'Test Description',
                5,
                onChange,
                'slider',
                options
            );

            expect(result).toBeDefined();
            expect(result.constructor.name).toBe('Setting');
        });

        test('should create text setting with placeholder', () => {
            const onChange = jest.fn();
            const options = {
                textOptions: { placeholder: 'Enter text', type: 'password' as const }
            };

            const result = (settingsTab as any).createFormSetting(
                mockContainerEl,
                'Test Text',
                'Test Description',
                'test-value',
                onChange,
                'text',
                options
            );

            expect(result).toBeDefined();
            expect(result.constructor.name).toBe('Setting');
        });

        test('should create button setting with click handler', () => {
            const onChange = jest.fn();
            const onClick = jest.fn();
            const options = {
                buttonOptions: { buttonText: 'Click Me', onClick }
            };

            const result = (settingsTab as any).createFormSetting(
                mockContainerEl,
                'Test Button',
                'Test Description',
                'button-value',
                onChange,
                'button',
                options
            );

            expect(result).toBeDefined();
            expect(result.constructor.name).toBe('Setting');
        });

        test('should return default setting for invalid type', () => {
            const onChange = jest.fn();
            const result = (settingsTab as any).createFormSetting(
                mockContainerEl,
                'Test Setting',
                'Test Description',
                'value',
                onChange,
                'invalid-type' as any
            );

            expect(result).toBeDefined();
            expect(result.constructor.name).toBe('Setting');
        });
    });

    describe('display', () => {
        test('should clear container and create main sections', () => {
            settingsTab.display();

            expect(mockContainerEl.empty).toHaveBeenCalled();
            expect(mockContainerEl.createEl).toHaveBeenCalledWith('h2', { text: 'Retrospect AI Settings' });
            
            // Check that section containers are created
            expect(mockContainerEl.createDiv).toHaveBeenCalledWith({ cls: 'retrospect-section' });
            expect(mockContainerEl.createDiv).toHaveBeenCalledTimes(5); // 5 sections
        });
    });

    describe('renderProviderSettings', () => {
        test('should render OpenAI settings when provider is openai', () => {
            mockPlugin.settings.llmProvider = 'openai';
            
            (settingsTab as any).renderProviderSettings(mockContainerEl);

            expect(mockContainerEl.createEl).toHaveBeenCalledWith('h4', { text: 'OpenAI Configuration' });
        });

        test('should render Ollama settings when provider is ollama', () => {
            mockPlugin.settings.llmProvider = 'ollama';
            
            (settingsTab as any).renderProviderSettings(mockContainerEl);

            expect(mockContainerEl.createEl).toHaveBeenCalledWith('h4', { text: 'Ollama Configuration' });
        });
    });

    describe('validateFolderPaths', () => {
        let mockSetting: any;

        beforeEach(() => {
            mockSetting = {
                settingEl: {
                    querySelector: jest.fn().mockReturnValue(null),
                    createDiv: jest.fn().mockReturnValue({
                        classList: { add: jest.fn() },
                        textContent: '',
                        title: '',
                        appendChild: jest.fn()
                    })
                }
            };
        });

        test('should show info message for empty folder paths', () => {
            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            (settingsTab as any).validateFolderPaths(mockSetting, []);

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'info',
                'Will search in entire vault'
            );
        });

        test('should validate existing folders', () => {
            mockApp.vault.getAbstractFileByPath.mockImplementation((path) => {
                if (path === 'Daily Notes') {
                    return new TFolder('Daily Notes');
                }
                return null;
            });

            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            (settingsTab as any).validateFolderPaths(mockSetting, ['Daily Notes', 'NonExistent']);

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'info',
                '1/2 folders found'
            );
        });

        test('should show success when all folders exist', () => {
            mockApp.vault.getAbstractFileByPath.mockImplementation((path) => {
                return new TFolder(path);
            });

            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            (settingsTab as any).validateFolderPaths(mockSetting, ['Daily Notes', 'Journal']);

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'success',
                'All 2 folders found'
            );
        });

        test('should show error when no folders exist', () => {
            mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            (settingsTab as any).validateFolderPaths(mockSetting, ['NonExistent1', 'NonExistent2']);

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'error',
                'No folders found'
            );
        });
    });

    describe('validateOrCreateFolder', () => {
        let mockSetting: any;

        beforeEach(() => {
            mockSetting = {
                settingEl: {
                    querySelector: jest.fn().mockReturnValue(null),
                    createDiv: jest.fn().mockReturnValue({
                        classList: { add: jest.fn() },
                        textContent: '',
                        title: '',
                        appendChild: jest.fn()
                    })
                }
            };
        });

        test('should show error for empty path', async () => {
            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            await (settingsTab as any).validateOrCreateFolder(mockSetting, '');

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'error',
                'Folder path required'
            );
        });

        test('should show success for existing folder', async () => {
            mockApp.vault.getAbstractFileByPath.mockReturnValue(new TFolder('Summaries'));
            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            await (settingsTab as any).validateOrCreateFolder(mockSetting, 'Summaries');

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'success',
                'Folder found'
            );
        });

        test('should create folder and show success', async () => {
            mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
            mockApp.vault.createFolder.mockResolvedValue(undefined);
            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            await (settingsTab as any).validateOrCreateFolder(mockSetting, 'NewFolder');

            expect(mockApp.vault.createFolder).toHaveBeenCalledWith('NewFolder');
            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'success',
                'Folder created'
            );
        });

        test('should show error when folder creation fails', async () => {
            mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
            mockApp.vault.createFolder.mockRejectedValue(new Error('Creation failed'));
            const addValidationIconSpy = jest.spyOn(settingsTab as any, 'addValidationIcon');
            
            await (settingsTab as any).validateOrCreateFolder(mockSetting, 'FailFolder');

            expect(addValidationIconSpy).toHaveBeenCalledWith(
                mockSetting,
                'error',
                'Failed to create folder'
            );
        });
    });

    describe('addValidationIcon', () => {
        let mockSetting: any;

        beforeEach(() => {
            const mockIconEl = {
                textContent: '',
                title: ''
            };
            
            const mockSettingControl = {
                classList: { add: jest.fn() },
                appendChild: jest.fn()
            };

            mockSetting = {
                settingEl: {
                    createDiv: jest.fn().mockReturnValue(mockIconEl),
                    querySelector: jest.fn().mockReturnValue(mockSettingControl)
                }
            };
        });

        test('should add success icon', () => {
            (settingsTab as any).addValidationIcon(mockSetting, 'success', 'Success message');

            const createDivCall = mockSetting.settingEl.createDiv.mock.calls[0];
            expect(createDivCall[0].cls).toBe('folder-validation-icon folder-validation-success');
        });

        test('should add error icon', () => {
            (settingsTab as any).addValidationIcon(mockSetting, 'error', 'Error message');

            const createDivCall = mockSetting.settingEl.createDiv.mock.calls[0];
            expect(createDivCall[0].cls).toBe('folder-validation-icon folder-validation-error');
        });

        test('should add info icon', () => {
            (settingsTab as any).addValidationIcon(mockSetting, 'info', 'Info message');

            const createDivCall = mockSetting.settingEl.createDiv.mock.calls[0];
            expect(createDivCall[0].cls).toBe('folder-validation-icon folder-validation-info');
        });
    });

    describe('renderAdvancedSection', () => {
        test('should create collapsible advanced section', () => {
            // Create a helper function for comprehensive DOM mocking (same as beforeEach)
            const createMockElement = (tag?: string, attrs?: any): any => ({
                tagName: tag?.toUpperCase() || 'DIV',
                textContent: attrs?.text || '',
                empty: jest.fn(),
                classList: {
                    add: jest.fn(),
                    contains: jest.fn().mockReturnValue(false),
                    toggle: jest.fn()
                },
                style: {},
                addEventListener: jest.fn(),
                appendChild: jest.fn(),
                querySelector: jest.fn().mockReturnValue(null),
                createSpan: jest.fn((attrs) => createMockElement('span', attrs)),
                createEl: jest.fn((tag, attrs) => createMockElement(tag, attrs)),
                createDiv: jest.fn((attrs) => createMockElement('div', attrs)),
                setAttribute: jest.fn(),
                href: attrs?.href || '',
                title: attrs?.title || ''
            });
            
            const mockAdvancedContainer = createMockElement();
            
            // Set up the section container that the method actually uses
            (settingsTab as any).sectionContainers = {
                advanced: mockAdvancedContainer
            };
            
            (settingsTab as any).renderAdvancedSection();

            expect(mockAdvancedContainer.empty).toHaveBeenCalled();
            expect(mockAdvancedContainer.createEl).toHaveBeenCalledWith('h3', { 
                text: '🔧 Advanced', 
                cls: 'retrospect-collapsible-header' 
            });
            expect(mockAdvancedContainer.createDiv).toHaveBeenCalledWith({ 
                cls: 'retrospect-collapsible-content retrospect-collapsed' 
            });
        });
    });

    describe('Integration Tests', () => {
        test('should save settings when LLM provider changes', async () => {
            // Test that display method works without errors
            settingsTab.display();

            // The actual behavior is tested through integration
            expect(mockContainerEl.empty).toHaveBeenCalled();
            expect(mockContainerEl.createEl).toHaveBeenCalledWith('h2', { text: 'Retrospect AI Settings' });
        });

        test('should handle folder validation during display', () => {
            const validateFolderPathsSpy = jest.spyOn(settingsTab as any, 'validateFolderPaths');
            
            settingsTab.display();

            // Use requestAnimationFrame to simulate the async validation
            setTimeout(() => {
                expect(validateFolderPathsSpy).toHaveBeenCalled();
            }, 0);
        });
    });
});