// src/services/FileOperationsService.ts

import { App, TFile, TFolder, moment } from "obsidian";
import { BaseService } from "./BaseService";
import { ErrorHandlingService, ErrorContext } from "./ErrorHandlingService";

/**
 * File operations service configuration
 */
export interface FileOperationsConfig {
    daysToInclude: number;
    excludePrivate: boolean;
    periodicNoteFolders: string[];
    reflectionFolder: string;
    // Analysis scope settings
    enabledAnalysisScopes?: boolean;
    analysisScope?: 'whole-life' | 'work-only' | 'custom';
    customAnalysisScope?: {
        name: string;
        includeKeywords: string[];
        excludeKeywords: string[];
        includeFolders: string[];
        excludeFolders: string[];
        includeTags: string[];
        excludeTags: string[];
    };
}

/**
 * File operations service for handling journal files
 * Handles file discovery, content extraction, and summary creation
 */
export class FileOperationsService extends BaseService {
    private config: FileOperationsConfig;
    private errorHandler: ErrorHandlingService;

    constructor(app: App, config: FileOperationsConfig, errorHandler: ErrorHandlingService) {
        super(app);
        this.config = config;
        this.errorHandler = errorHandler;
    }

    /**
     * Update file operations configuration
     * 
     * @param config - New configuration
     */
    updateConfig(config: FileOperationsConfig): void {
        this.ensureNotDisposed();
        this.config = config;
    }

    /**
     * Find recent journal notes based on configuration
     * 
     * @returns Array of recent markdown files
     */
    async findRecentNotes(): Promise<TFile[]> {
        this.ensureReady();

        const cutoffDate = moment().subtract(this.config.daysToInclude, "days");

        // Try folder-based approach first
        const folderFiles = await this.getPeriodicFilesFromFolders();

        if (folderFiles.length > 0) {
            // Apply date filtering to folder-discovered files
            const recentFolderFiles = folderFiles.filter((file) => {
                const fileDate = this.extractDateFromFile(file);
                return fileDate && fileDate.isAfter(cutoffDate);
            });

            return recentFolderFiles;
        }

        // Fallback to current time-based filtering across all files
        const allFiles = this.app.vault.getMarkdownFiles();

        return allFiles.filter((file) => {
            const fileDate = this.extractDateFromFile(file);
            return fileDate && fileDate.isAfter(cutoffDate);
        });
    }

    /**
     * Get content from multiple notes
     * 
     * @param files - Files to extract content from
     * @returns Combined content string
     */
    async getNotesContent(files: TFile[]): Promise<string> {
        this.ensureReady();

        const context: ErrorContext = {
            operation: 'getNotesContent',
            component: 'FileOperationsService',
            timestamp: Date.now(),
            metadata: { fileCount: files.length }
        };

        return await this.errorHandler.executeWithRetry(
            async () => {
                let combinedContent = "";

                for (const file of files) {
                    try {
                        const content = await this.app.vault.read(file);

                        // Skip if private (contains #private tag)
                        if (this.config.excludePrivate && content.includes("#private")) {
                            continue;
                        }

                        // Apply analysis scope filtering if enabled
                        if (this.config.enabledAnalysisScopes && !this.isFileInAnalysisScope(file, content)) {
                            continue;
                        }

                        combinedContent += `\n## ${file.basename}\n${content}\n`;
                    } catch (error) {
                        const fileContext: ErrorContext = {
                            operation: 'readFile',
                            component: 'FileOperationsService',
                            timestamp: Date.now(),
                            metadata: { filePath: file.path, fileName: file.basename }
                        };

                        await this.errorHandler.handleError(
                            error instanceof Error ? error : new Error(String(error)),
                            fileContext,
                            { showNotice: false, logToConsole: true }
                        );
                        
                        // Continue with other files
                        continue;
                    }
                }

                return combinedContent;
            },
            context,
            { maxRetries: 2, retryDelay: 500 }
        );
    }

    /**
     * Create a summary note in the configured reflection folder
     * 
     * @param summary - Generated summary content
     * @param sourceFiles - Source files to create backlinks to
     * @returns Created summary file
     */
    async createSummaryNote(summary: string, sourceFiles: TFile[]): Promise<TFile> {
        this.ensureReady();

        const date = moment().format("YYYY-MM-DD");
        const summaryPath = `${this.config.reflectionFolder}/Weekly Reflection - ${date}.md`;

        // Create reflection folder if it doesn't exist
        await this.ensureReflectionFolderExists();

        // Create backlinks to source files
        const backlinks = sourceFiles
            .map((file) => `- [[${file.basename}]]`)
            .join("\n");

        const summaryContent = `# Weekly Reflection - ${date}

*Generated on ${moment().format("YYYY-MM-DD [at] HH:mm")}*

${summary}

---

## Source Notes
${backlinks}

---
*This reflection was generated from ${sourceFiles.length} journal entries from the past ${this.config.daysToInclude} days.*
`;

        // Create the summary file
        const context: ErrorContext = {
            operation: 'createSummaryNote',
            component: 'FileOperationsService',
            timestamp: Date.now(),
            metadata: { summaryPath, sourceFileCount: sourceFiles.length }
        };

        return await this.errorHandler.executeWithRetry(
            async () => {
                try {
                    return await this.app.vault.create(summaryPath, summaryContent);
                } catch (error) {
                    if (error instanceof Error && error.message.includes("already exists")) {
                        // Create a more specific RetrospectError for duplicate summaries
                        const { RetrospectError, ErrorType, ErrorCode } = await import('./ErrorHandlingService');
                        const duplicateError = new RetrospectError(
                            ErrorType.USER,
                            ErrorCode.FILE_ALREADY_EXISTS,
                            "Summary for this week already exists. Delete it first or wait for next week.",
                            "A summary for this week already exists. Please delete the existing summary first or wait for next week to generate a new one.",
                            context,
                            true,
                            false
                        );
                        await this.errorHandler.handleError(duplicateError, context, { 
                            showNotice: true, 
                            throwAfterHandling: true 
                        });
                        throw duplicateError;
                    }
                    throw error;
                }
            },
            context,
            { maxRetries: 1 }
        );
    }

    /**
     * Check if reflection folder exists and create if needed
     * 
     * @returns True if folder exists or was created successfully
     */
    async ensureReflectionFolderExists(): Promise<boolean> {
        this.ensureReady();

        const context: ErrorContext = {
            operation: 'ensureReflectionFolderExists',
            component: 'FileOperationsService',
            timestamp: Date.now(),
            metadata: { folderPath: this.config.reflectionFolder }
        };

        try {
            const summariesFolder = this.app.vault.getAbstractFileByPath(this.config.reflectionFolder);
            
            if (!summariesFolder) {
                return await this.errorHandler.executeWithRetry(
                    async () => {
                        await this.app.vault.createFolder(this.config.reflectionFolder);
                        return true;
                    },
                    context,
                    { maxRetries: 2, retryDelay: 500 }
                );
            }

            return true;
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                context,
                { showNotice: false, logToConsole: true }
            );
            return false;
        }
    }

    /**
     * Get periodic files from configured folders
     * 
     * @returns Array of markdown files from configured folders
     */
    private async getPeriodicFilesFromFolders(): Promise<TFile[]> {
        const periodicFiles: TFile[] = [];

        // If no periodic note folders are configured or empty, return empty array
        if (!this.config.periodicNoteFolders || this.config.periodicNoteFolders.length === 0) {
            return periodicFiles;
        }

        // Process each configured folder
        for (const folderPath of this.config.periodicNoteFolders) {
            if (!folderPath || folderPath.trim() === "") {
                continue; // Skip empty folder paths
            }

            const trimmedPath = folderPath.trim();

            try {
                // Check if the folder exists
                const folder = this.app.vault.getAbstractFileByPath(trimmedPath);

                if (!folder || !(folder instanceof TFolder)) {
                    // Folder doesn't exist, handle gracefully
                    continue;
                }

                // Get all files in the folder (including subfolders)
                const allFiles = this.app.vault.getMarkdownFiles();

                // Filter files that are within the specified folder
                const folderFiles = allFiles.filter((file) => {
                    return (
                        file.path.startsWith(trimmedPath + "/") ||
                        file.path === trimmedPath ||
                        (trimmedPath === "" && !file.path.includes("/"))
                    );
                });

                periodicFiles.push(...folderFiles);
            } catch (error) {
                // Handle any errors gracefully
                const folderContext: ErrorContext = {
                    operation: 'getPeriodicFilesFromFolders',
                    component: 'FileOperationsService',
                    timestamp: Date.now(),
                    metadata: { folderPath: trimmedPath }
                };

                await this.errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    folderContext,
                    { showNotice: false, logToConsole: true }
                );
            }
        }

        return periodicFiles;
    }

    /**
     * Extract date from file using filename parsing with fallback to creation time
     * 
     * @param file - The file to extract date from
     * @returns The extracted date or null if no valid date found
     */
    private extractDateFromFile(file: TFile): moment.Moment | null {
        // Try to parse date from filename first
        const filenameDate = this.parseDateFromFilename(file.basename);
        if (filenameDate && filenameDate.isValid()) {
            return filenameDate;
        }

        // Fallback to file creation time
        const creationDate = moment(file.stat.ctime);
        return creationDate.isValid() ? creationDate : null;
    }

    /**
     * Parse date from filename using common journal date formats
     * 
     * @param filename - The filename (without extension) to parse
     * @returns The parsed date or null if no date pattern found
     */
    private parseDateFromFilename(filename: string): moment.Moment | null {
        // Common date patterns in journal filenames
        const datePatterns = [
            // ISO format: YYYY-MM-DD
            /(\d{4}-\d{2}-\d{2})/,
            // US format: MM-DD-YYYY or MM/DD/YYYY
            /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
            // European format: DD-MM-YYYY or DD/MM/YYYY
            /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
            // Compact format: YYYYMMDD
            /(\d{8})/,
            // Year and day of year: YYYY-DDD
            /(\d{4}-\d{3})/,
            // Month and year: YYYY-MM
            /(\d{4}-\d{2})$/,
        ];

        for (const pattern of datePatterns) {
            const match = filename.match(pattern);
            if (match) {
                const dateStr = match[1];
                
                // Try different moment parsing formats based on the pattern
                let parsedDate: moment.Moment | null = null;

                if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // ISO format: YYYY-MM-DD
                    parsedDate = moment(dateStr, "YYYY-MM-DD");
                } else if (dateStr.match(/^\d{8}$/)) {
                    // Compact format: YYYYMMDD
                    parsedDate = moment(dateStr, "YYYYMMDD");
                } else if (dateStr.match(/^\d{4}-\d{3}$/)) {
                    // Year and day of year: YYYY-DDD
                    parsedDate = moment(dateStr, "YYYY-DDD");
                } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
                    // Month and year: YYYY-MM (assume first day of month)
                    parsedDate = moment(dateStr + "-01", "YYYY-MM-DD");
                } else if (dateStr.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/)) {
                    // Try both US (MM/DD/YYYY) and European (DD/MM/YYYY) formats
                    const usDate = moment(dateStr, ["M/D/YYYY", "MM/DD/YYYY", "M-D-YYYY", "MM-DD-YYYY"], true);
                    const euDate = moment(dateStr, ["D/M/YYYY", "DD/MM/YYYY", "D-M-YYYY", "DD-MM-YYYY"], true);
                    
                    // Prefer the format that results in a more recent date (likely more accurate)
                    if (usDate.isValid() && euDate.isValid()) {
                        parsedDate = usDate.isAfter(euDate) ? usDate : euDate;
                    } else if (usDate.isValid()) {
                        parsedDate = usDate;
                    } else if (euDate.isValid()) {
                        parsedDate = euDate;
                    }
                }

                if (parsedDate && parsedDate.isValid()) {
                    return parsedDate;
                }
            }
        }

        return null;
    }

    /**
     * Create an analysis report file
     */
    async createAnalysisReport(fileName: string, content: string): Promise<TFile> {
        this.ensureReady();
        
        // Ensure analysis folder exists
        const analysisFolder = `${this.config.reflectionFolder}/Analysis`;
        if (!await this.app.vault.adapter.exists(analysisFolder)) {
            await this.app.vault.createFolder(analysisFolder);
        }
        
        const filePath = `${analysisFolder}/${fileName}.md`;
        
        // Check if file already exists and modify name if needed
        let finalPath = filePath;
        let counter = 1;
        while (await this.app.vault.adapter.exists(finalPath)) {
            const baseName = fileName.replace(/\s*\(\d+\)$/, '');
            finalPath = `${analysisFolder}/${baseName} (${counter}).md`;
            counter++;
        }
        
        const context: ErrorContext = {
            operation: 'createAnalysisReport',
            component: 'FileOperationsService',
            timestamp: Date.now(),
            metadata: { fileName, finalPath }
        };

        return await this.errorHandler.executeWithRetry(
            async () => {
                return await this.app.vault.create(finalPath, content);
            },
            context,
            { maxRetries: 2, retryDelay: 500 }
        );
    }

    /**
     * Initialize the file operations service
     */
    protected async onInitialize(): Promise<void> {

        try {
            // Validate configuration
            if (!this.config.reflectionFolder) {
                const configError = new Error("Reflection folder is not configured");
                console.error('FileOperationsService initialization error:', configError.message);
                throw configError;
            }

            if (this.config.daysToInclude < 1) {
                const configError = new Error("Days to include must be at least 1");
                console.error('FileOperationsService initialization error:', configError.message);
                throw configError;
            }

            // Log successful initialization to console during initialization
            console.log(`FileOperationsService initialized - scanning ${this.config.daysToInclude} days`);
        } catch (error) {
            console.error('FileOperationsService initialization failed:', error);
            throw error;
        }
    }

    /**
     * Check if a file and its content should be included in analysis scope
     * 
     * @param file - The file to check
     * @param content - The file content
     * @returns True if the file should be included in analysis
     */
    private isFileInAnalysisScope(file: TFile, content: string): boolean {
        if (!this.config.enabledAnalysisScopes) {
            return true; // No scope filtering
        }

        const scope = this.config.analysisScope || 'whole-life';

        switch (scope) {
            case 'whole-life':
                return true;
            
            case 'work-only':
                return this.isWorkRelatedContent(file, content);
            
            case 'custom':
                return this.isCustomScopeContent(file, content);
            
            default:
                return true;
        }
    }

    /**
     * Check if content is work-related (for work-only scope)
     * 
     * @param file - The file to check
     * @param content - The file content
     * @returns True if content is work-related
     */
    private isWorkRelatedContent(file: TFile, content: string): boolean {
        const workKeywords = [
            'work', 'job', 'project', 'meeting', 'task', 'deadline',
            'client', 'team', 'boss', 'colleague', 'office', 'business',
            'development', 'coding', 'programming', 'bug', 'feature',
            'review', 'standup', 'sprint', 'agile', 'scrum'
        ];

        const workTags = ['work', 'job', 'project', 'meeting', 'task', 'business'];
        
        const contentLower = content.toLowerCase();
        const filePathLower = file.path.toLowerCase();

        // Check for work keywords in content
        const hasWorkKeywords = workKeywords.some(keyword => 
            contentLower.includes(keyword)
        );

        // Check for work tags using regex to match whole tags
        const workTagsPattern = new RegExp(`#(${workTags.join('|')})\\b`, 'i');
        const hasWorkTags = workTagsPattern.test(content);

        // Check if file is in work-related folders (exact match on folder names)
        const workFolders = ['work', 'job', 'project', 'business'];
        const pathSegments = filePathLower.split(/[\\/]/); // Handles both '/' and '\' as separators
        const isInWorkFolder = pathSegments.some(segment => workFolders.includes(segment));

        return hasWorkKeywords || hasWorkTags || isInWorkFolder;
    }

    /**
     * Check if content matches custom scope criteria
     * 
     * @param file - The file to check
     * @param content - The file content
     * @returns True if content matches custom scope
     */
    private isCustomScopeContent(file: TFile, content: string): boolean {
        const customScope = this.config.customAnalysisScope;
        if (!customScope) {
            return true; // No custom scope defined, include all
        }

        const contentLower = content.toLowerCase();

        // Check folder inclusion/exclusion
        if (customScope.includeFolders.length > 0) {
            const filePathSegments = file.path.split(/[\\/]/).map(seg => seg.toLowerCase());
            const isInIncludedFolder = customScope.includeFolders.some(folder => {
                const folderSegments = folder.split(/[\\/]/).map(seg => seg.toLowerCase());
                // Check if folderSegments is a prefix of filePathSegments
                if (folderSegments.length > filePathSegments.length) return false;
                for (let i = 0; i < folderSegments.length; i++) {
                    if (filePathSegments[i] !== folderSegments[i]) return false;
                }
                return true;
            });
            if (!isInIncludedFolder) {
                return false;
            }
        }

        if (customScope.excludeFolders.length > 0) {
            const filePathSegments = file.path.split(/[/\\]/).map(seg => seg.toLowerCase());
            const isInExcludedFolder = customScope.excludeFolders.some(folder => {
                const folderSegments = folder.split(/[/\\]/).map(seg => seg.toLowerCase());
                // Check if folderSegments is a prefix of filePathSegments
                if (folderSegments.length > filePathSegments.length) return false;
                for (let i = 0; i < folderSegments.length; i++) {
                    if (filePathSegments[i] !== folderSegments[i]) return false;
                }
                return true;
            });
            if (isInExcludedFolder) {
                return false;
            }
        }

        // Check tag inclusion/exclusion
        if (customScope.includeTags.length > 0) {
            const hasIncludedTag = customScope.includeTags.some(tag => {
                const tagPattern = new RegExp(`\\B#${tag}\\b`, 'i');
                return tagPattern.test(content);
            });
            if (!hasIncludedTag) {
                return false;
            }
        }

        if (customScope.excludeTags.length > 0) {
            const hasExcludedTag = customScope.excludeTags.some(tag => {
                const tagPattern = new RegExp(`\\B#${tag}\\b`, 'i');
                return tagPattern.test(content);
            });
            if (hasExcludedTag) {
                return false;
            }
        }

        // Check keyword inclusion/exclusion
        if (customScope.includeKeywords.length > 0) {
            const hasIncludedKeyword = customScope.includeKeywords.some(keyword => {
                // Escape special regex characters in the keyword
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Create a regex to match the whole word, case-insensitive
                const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
                return regex.test(content);
            });
            if (!hasIncludedKeyword) {
                return false;
            }
        }

        if (customScope.excludeKeywords.length > 0) {
            const hasExcludedKeyword = customScope.excludeKeywords.some(keyword => {
                // Escape special regex characters in the keyword
                const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Create a regex with word boundaries, case-insensitive
                const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
                return regex.test(contentLower);
            });
            if (hasExcludedKeyword) {
                return false;
            }
        }

        return true;
    }

    /**
     * Dispose the file operations service
     */
    protected async onDispose(): Promise<void> {
        // Use console logging instead of error handler during disposal
        // since the ErrorHandlingService may be disposed first
        console.log("FileOperationsService disposed");
    }
}