import { App, TFile } from 'obsidian';
import { SummaryNoteCreator } from '../../src/summary-note-creator';
import { Logger, LogLevel } from '../../src/logger';
import { ProcessingResult } from '../../src/markdown-processing-service';

// Create a simplified mock setup for testing
describe('Summary Note Creation - Task 10 Verification', () => {
    let mockApp: any;
    let mockFile: any;
    let summaryCreator: SummaryNoteCreator;
    let mockLogger: Logger;
    let mockProcessingResult: any;

    beforeEach(() => {
        // Mock Obsidian app
        mockApp = {
            vault: {
                getAbstractFileByPath: jest.fn(),
                create: jest.fn(),
                modify: jest.fn(),
                read: jest.fn().mockResolvedValue('Test file content for AI analysis'),
                adapter: {
                    exists: jest.fn().mockResolvedValue(false),
                    write: jest.fn(),
                    mkdir: jest.fn().mockResolvedValue(undefined),
                    stat: jest.fn()
                },
                createFolder: jest.fn().mockResolvedValue(undefined)
            },
            workspace: {
                getActiveFile: jest.fn()
            }
        };

        // Mock TFile
        mockFile = {
            path: 'test-note.md',
            name: 'test-note.md',
            basename: 'test-note',
            extension: 'md',
            stat: { mtime: Date.now(), ctime: Date.now(), size: 1000 }
        };

        // Mock ProcessingResult with minimal structure
        mockProcessingResult = {
            success: true,
            filePath: 'test-note.md',
            parsedContent: {
                elements: [
                    { type: 'heading', content: 'Test Heading' },
                    { type: 'paragraph', content: 'Test paragraph content' }
                ],
                metadata: {
                    filePath: 'test-note.md',
                    fileName: 'test-note.md',
                    fileSize: 1000,
                    lastModified: new Date(),
                    wordCount: 50,
                    characterCount: 300,
                    headingCount: 1,
                    linkCount: 0,
                    tagCount: 1,
                    codeBlockCount: 0,
                    tableCount: 0,
                    listCount: 0,
                    imageCount: 0,
                    calloutCount: 0,
                    privacyTagsFound: [],
                    hasPrivacyMarkers: false,
                    estimatedReadingTime: 1
                }
            },
            metadata: {
                wordCount: 50,
                characterCount: 300,
                readingTime: 1,
                tags: [{ normalized: 'test-tag' }],
                frontmatter: { raw: {}, normalized: {}, typeMap: {}, validationErrors: [] },
                lastModified: new Date(),
                createdDate: new Date(),
                title: 'Test Note',
                aliases: [],
                links: [],
                backlinks: [],
                embeds: [],
                headings: [],
                blocks: [],
                sections: [],
                attachments: [],
                outgoingLinks: [],
                incomingLinks: []
            },
            sections: [
                {
                    id: 'intro',
                    title: 'Introduction',
                    content: 'Test content',
                    normalizedContent: 'test content',
                    level: 1,
                    category: 'introduction',
                    tags: [],
                    wordCount: 2,
                    position: { startLine: 1, endLine: 5, startChar: 0, endChar: 50 },
                    subsections: [],
                    metadata: {
                        hasCode: false,
                        hasLinks: false,
                        hasTags: false,
                        hasObsidianFeatures: false,
                        complexity: 0.2
                    }
                }
            ],
            processingTime: 100,
            errors: [],
            warnings: [],
            skipped: false
        };

        // Create mock logger
        mockLogger = new Logger('Test', false, LogLevel.ERROR);
        
        // Create summary note creator with simplified constructor (no AI service to avoid complex mocking)
        summaryCreator = new SummaryNoteCreator(
            mockApp as App,
            mockLogger
        );

        // Setup default mock behaviors
        mockApp.vault.create.mockResolvedValue(mockFile);
    });

    describe('Basic End-to-End Flow', () => {
        test('should create summary note with basic content', async () => {
            // Test Strategy Item 1: Test the basic end-to-end flow from note analysis to summary creation
            
            const summaryPath = await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                {
                    folderPath: 'Summaries',
                    enableAIInsights: false, // Test basic functionality first
                    overwriteExisting: true
                }
            );

            expect(summaryPath).toContain('Summaries/Summary -');
            expect(summaryPath).toContain('test-note.md');
            expect(mockApp.vault.create).toHaveBeenCalled();
        });

        test('should generate proper filename with date and original name', async () => {
            const summaryPath = await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { folderPath: 'Summaries', enableAIInsights: false }
            );

            expect(summaryPath).toMatch(/Summaries\/Summary - \d{4}-\d{2}-\d{2} - test-note\.md/);
        });
    });

    describe('Content Structure Validation', () => {
        test('should contain all expected sections in summary', async () => {
            // Test Strategy Item 2: Verify summary notes contain all expected sections
            
            let capturedContent = '';
            mockApp.vault.create.mockImplementation((path: string, content: string) => {
                capturedContent = content;
                return Promise.resolve(mockFile);
            });

            await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { enableAIInsights: false }
            );

            // Check for basic sections
            expect(capturedContent).toContain('## 📊 Content Analysis');
            expect(capturedContent).toContain('### 📊 Basic Statistics');
            expect(capturedContent).toContain('- **Word Count:**');
            expect(capturedContent).toContain('- **Reading Time:**');
        });
    });

    describe('Backlinks Functionality', () => {
        test('should create backlinks to original note', async () => {
            // Test Strategy Item 3: Test backlinks functionality
            
            let capturedContent = '';
            mockApp.vault.create.mockImplementation((path: string, content: string) => {
                capturedContent = content;
                return Promise.resolve(mockFile);
            });

            await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { createBacklinks: true, enableAIInsights: false }
            );

            expect(capturedContent).toContain('[[test-note.md]]');
        });
    });

    describe('Frontmatter Generation', () => {
        test('should generate valid frontmatter', async () => {
            // Test Strategy Item 4: Validate frontmatter generation and parsing
            
            let capturedContent = '';
            mockApp.vault.create.mockImplementation((path: string, content: string) => {
                capturedContent = content;
                return Promise.resolve(mockFile);
            });

            await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { enableAIInsights: false }
            );

            expect(capturedContent).toMatch(/^---\n/);
            expect(capturedContent).toContain('type: "summary"');
            expect(capturedContent).toContain('original_file: "test-note.md"');
            expect(capturedContent).toContain('created:');
            expect(capturedContent).toMatch(/---\n\n/);
        });
    });

    describe('Conflict Resolution', () => {
        test('should handle existing files when overwrite is disabled', async () => {
            // Test Strategy Item 5: Test conflict resolution with existing notes
            
            mockApp.vault.adapter.exists.mockResolvedValue(true);

            await expect(
                summaryCreator.createSummaryNote(
                    mockFile as TFile,
                    mockProcessingResult as ProcessingResult,
                    { overwriteExisting: false }
                )
            ).rejects.toThrow('Summary note already exists');
        });

        test('should overwrite existing files when enabled', async () => {
            // Test Strategy Item 5: Test conflict resolution with existing notes
            
            mockApp.vault.adapter.exists.mockResolvedValue(true);
            mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);

            await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { overwriteExisting: true, enableAIInsights: false }
            );

            expect(mockApp.vault.modify).toHaveBeenCalled();
        });
    });

    describe('Folder Creation', () => {
        test('should handle folder creation failures', async () => {
            mockApp.vault.createFolder.mockRejectedValue(new Error('Permission denied'));
            
            // Should still attempt to create the file and handle the error gracefully
            await expect(
                summaryCreator.createSummaryNote(
                    mockFile as TFile,
                    mockProcessingResult as ProcessingResult,
                    { enableAIInsights: false }
                )
            ).rejects.toThrow();
        });

        test('should create folder when it does not exist', async () => {
            // Test Strategy Item 6: Verify folder creation works when needed
            
            // Mock that the folder doesn't exist
            mockApp.vault.getAbstractFileByPath.mockReturnValue(null);
            mockApp.vault.adapter.stat.mockRejectedValue(new Error('Folder does not exist'));

            await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { folderPath: 'Custom/Summaries', enableAIInsights: false }
            );

            expect(mockApp.vault.createFolder).toHaveBeenCalledWith('Custom/Summaries');
        });
    });

    describe('Error Handling', () => {
        test('should handle graceful fallbacks', async () => {
            // Test Strategy Item 14: Verify graceful fallback when AI service is unavailable
            
            let capturedContent = '';
            mockApp.vault.create.mockImplementation((path: string, content: string) => {
                capturedContent = content;
                return Promise.resolve(mockFile);
            });

            await summaryCreator.createSummaryNote(
                mockFile as TFile,
                mockProcessingResult as ProcessingResult,
                { 
                    enableAIInsights: false // No AI service provided, should work with basic content
                }
            );

            // Should still create summary with basic content
            expect(capturedContent).toContain('## 📊 Content Analysis');
            expect(mockApp.vault.create).toHaveBeenCalled();
        });
    });

    describe('Performance Optimization', () => {
        test('should handle large documents with size-based optimization', async () => {
            // Test Strategy Item 33: Test size-based optimization
            
            const largeFileMock = {
                ...mockFile,
                stat: { ...mockFile.stat, size: 100000 } // 100KB file
            };

            await summaryCreator.createSummaryNote(
                largeFileMock as TFile,
                mockProcessingResult as ProcessingResult,
                { 
                    enableAIInsights: false,
                    sizeBasedOptimization: true,
                    maxDocumentSize: 50000 // 50KB threshold
                }
            );

            // Should still create summary but may have reduced AI processing
            expect(mockApp.vault.create).toHaveBeenCalled();
        });
    });
});

describe('Integration with Plugin Commands', () => {
    test('should work with Create Summary Note command flow', async () => {
        // Test Strategy Item 8: Verify the "Create Summary Note" command works properly
        
        // This would be tested at a higher level with the actual plugin command
        // For now, we verify the core functionality works as expected
        
        const mockApp: any = {
            vault: {
                create: jest.fn().mockResolvedValue({}),
                adapter: {
                    exists: jest.fn().mockResolvedValue(false),
                    mkdir: jest.fn().mockResolvedValue(undefined)
                },
                createFolder: jest.fn().mockResolvedValue(undefined)
            }
        };

        const mockFile: any = {
            path: 'test-note.md',
            name: 'test-note.md',
            basename: 'test-note',
            extension: 'md',
            stat: { mtime: Date.now(), ctime: Date.now(), size: 1000 }
        };

        const mockProcessingResult: any = {
            success: true,
            filePath: 'test-note.md',
            metadata: { wordCount: 50, characterCount: 300 },
            sections: [],
            processingTime: 100,
            errors: [],
            warnings: [],
            skipped: false
        };

        const summaryCreator = new SummaryNoteCreator(
            mockApp as App,
            new Logger('Test', false, LogLevel.ERROR)
        );
        
        const summaryPath = await summaryCreator.createSummaryNote(
            mockFile as TFile,
            mockProcessingResult as ProcessingResult,
            {
                overwriteExisting: true,
                enableAIInsights: false,
                writingStyle: 'personal',
                respectPrivacySettings: true
            }
        );

        expect(summaryPath).toBeDefined();
        expect(summaryPath).toContain('.md');
        expect(mockApp.vault.create).toHaveBeenCalled();
    });
}); 