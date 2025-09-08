// tests/AnalysisScope.test.ts

import { TFile } from 'obsidian';
import { FileOperationsService, FileOperationsConfig } from '../src/services/FileOperationsService';
import { ErrorHandlingService } from '../src/services/ErrorHandlingService';

// Mock Obsidian components
jest.mock('obsidian', () => ({
    App: jest.fn(),
    Plugin: jest.fn(),
    TFile: jest.fn(),
    TFolder: jest.fn(),
    moment: jest.fn(() => ({
        subtract: jest.fn().mockReturnThis(),
        isAfter: jest.fn().mockReturnValue(true),
        isValid: jest.fn().mockReturnValue(true),
        format: jest.fn().mockReturnValue('2024-01-01')
    }))
}));

describe('Analysis Scope Functionality', () => {
    let mockApp: any;
    let mockErrorHandler: ErrorHandlingService;
    let fileOpsService: FileOperationsService;

    beforeEach(() => {
        mockApp = {
            vault: {
                read: jest.fn(),
                getMarkdownFiles: jest.fn().mockReturnValue([]),
                getAbstractFileByPath: jest.fn(),
                createFolder: jest.fn(),
                create: jest.fn(),
                adapter: {
                    exists: jest.fn().mockResolvedValue(false)
                }
            }
        };

        mockErrorHandler = {
            executeWithRetry: jest.fn((fn) => fn()),
            handleError: jest.fn()
        } as any;
    });

    describe('Analysis Scope Settings', () => {
        it('should default to whole-life scope when not enabled', () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: false,
                analysisScope: 'whole-life'
            };

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            expect(fileOpsService).toBeDefined();
        });

        it('should handle work-only scope configuration', () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'work-only'
            };

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            expect(fileOpsService).toBeDefined();
        });

        it('should handle custom scope configuration', () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'custom',
                customAnalysisScope: {
                    name: 'Test Scope',
                    includeKeywords: ['test', 'development'],
                    excludeKeywords: ['personal'],
                    includeFolders: ['Work'],
                    excludeFolders: ['Personal'],
                    includeTags: ['work'],
                    excludeTags: ['private']
                }
            };

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            expect(fileOpsService).toBeDefined();
        });
    });

    describe('Work-Only Scope Filtering', () => {
        beforeEach(async () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'work-only'
            };

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            await fileOpsService.initialize();
        });

        it('should include work-related content with work keywords', async () => {
            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const workContent = 'Today I had a meeting with the team about the new project deadline.';
            mockApp.vault.read.mockResolvedValue(workContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(mockFile instanceof TFile).toBe(true);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(workContent);
        });

        it('should include work-related content with work tags', async () => {
            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const workContent = 'Working on the new feature today #work #project';
            mockApp.vault.read.mockResolvedValue(workContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(mockFile instanceof TFile).toBe(true);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(workContent);
        });

        it('should include work-related content from work folders', async () => {
            const mockFile = new TFile('work/daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const content = 'Today was a good day.';
            mockApp.vault.read.mockResolvedValue(content);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(content);
        });

        it('should exclude non-work content', async () => {
            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const personalContent = 'Went to the movies with friends. Had a great time at the restaurant.';
            mockApp.vault.read.mockResolvedValue(personalContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).not.toContain(personalContent);
        });
    });

    describe('Custom Scope Filtering', () => {
        beforeEach(async () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'custom',
                customAnalysisScope: {
                    name: 'Health & Wellness',
                    includeKeywords: ['health', 'exercise', 'nutrition'],
                    excludeKeywords: ['work', 'meeting'],
                    includeFolders: [],
                    excludeFolders: ['Work'],
                    includeTags: [],
                    excludeTags: ['work', 'business']
                }
            };

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            await fileOpsService.initialize();
        });

        it('should include content with included keywords', async () => {
            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const healthContent = 'Did a great exercise today and focused on nutrition.';
            mockApp.vault.read.mockResolvedValue(healthContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(healthContent);
        });

        it('should include content with included tags', async () => {
            // Create a service with only tag filtering
            const tagOnlyConfig: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'custom',
                customAnalysisScope: {
                    name: 'Health Tags',
                    includeKeywords: [],
                    excludeKeywords: [],
                    includeFolders: [],
                    excludeFolders: [],
                    includeTags: ['health', 'fitness'],
                    excludeTags: []
                }
            };

            const tagService = new FileOperationsService(mockApp, tagOnlyConfig, mockErrorHandler);
            await tagService.initialize();

            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const healthContent = 'Great day for fitness #health #fitness';
            mockApp.vault.read.mockResolvedValue(healthContent);

            const result = await tagService.getNotesContent([mockFile]);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(healthContent);
        });

        it('should include content from included folders', async () => {
            // Create a service with only folder filtering
            const folderOnlyConfig: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'custom',
                customAnalysisScope: {
                    name: 'Health Folders',
                    includeKeywords: [],
                    excludeKeywords: [],
                    includeFolders: ['Health'],
                    excludeFolders: [],
                    includeTags: [],
                    excludeTags: []
                }
            };

            const folderService = new FileOperationsService(mockApp, folderOnlyConfig, mockErrorHandler);
            await folderService.initialize();

            const mockFile = new TFile('Health/daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const content = 'Today was a good day.';
            mockApp.vault.read.mockResolvedValue(content);

            const result = await folderService.getNotesContent([mockFile]);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(content);
        });

        it('should exclude content with excluded keywords', async () => {
            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const workContent = 'Had a work meeting today about the project.';
            mockApp.vault.read.mockResolvedValue(workContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).not.toContain(workContent);
        });

        it('should exclude content with excluded tags', async () => {
            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const workContent = 'Working on the project #work #business';
            mockApp.vault.read.mockResolvedValue(workContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).not.toContain(workContent);
        });

        it('should exclude content from excluded folders', async () => {
            const mockFile = new TFile('Work/daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const content = 'Today was a good day.';
            mockApp.vault.read.mockResolvedValue(content);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).not.toContain(content);
        });
    });

    describe('Scope Integration', () => {
        it('should bypass scope filtering when scopes are disabled', async () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: false,
                analysisScope: 'work-only'
            };

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            await fileOpsService.initialize();

            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const personalContent = 'Went to the movies with friends.';
            mockApp.vault.read.mockResolvedValue(personalContent);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(personalContent);
        });

        it('should handle empty custom scope gracefully', async () => {
            const config: FileOperationsConfig = {
                daysToInclude: 7,
                excludePrivate: true,
                periodicNoteFolders: [],
                reflectionFolder: 'Summaries',
                enabledAnalysisScopes: true,
                analysisScope: 'custom',
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

            fileOpsService = new FileOperationsService(mockApp, config, mockErrorHandler);
            await fileOpsService.initialize();

            const mockFile = new TFile('daily/2024-01-01.md');
            mockFile.basename = '2024-01-01';

            const content = 'Any content should be included.';
            mockApp.vault.read.mockResolvedValue(content);

            const result = await fileOpsService.getNotesContent([mockFile]);
            expect(result).toContain('2024-01-01');
            expect(result).toContain(content);
        });
    });
});