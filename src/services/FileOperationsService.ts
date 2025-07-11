// src/services/FileOperationsService.ts

import { App, TFile, TFolder, moment } from "obsidian";
import { BaseService } from "./BaseService";

/**
 * File operations service configuration
 */
export interface FileOperationsConfig {
    daysToInclude: number;
    excludePrivate: boolean;
    periodicNoteFolders: string[];
    reflectionFolder: string;
}

/**
 * File operations service for handling journal files
 * Handles file discovery, content extraction, and summary creation
 */
export class FileOperationsService extends BaseService {
    private config: FileOperationsConfig;

    constructor(app: App, config: FileOperationsConfig) {
        super(app);
        this.config = config;
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

        let combinedContent = "";

        for (const file of files) {
            const content = await this.app.vault.read(file);

            // Skip if private (contains #private tag)
            if (this.config.excludePrivate && content.includes("#private")) {
                continue;
            }

            combinedContent += `\n## ${file.basename}\n${content}\n`;
        }

        return combinedContent;
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
        try {
            const summaryFile = await this.app.vault.create(summaryPath, summaryContent);
            return summaryFile;
        } catch (error) {
            if (error.message.includes("already exists")) {
                throw new Error("Summary for this week already exists. Delete it first or wait for next week.");
            } else {
                throw error;
            }
        }
    }

    /**
     * Check if reflection folder exists and create if needed
     * 
     * @returns True if folder exists or was created successfully
     */
    async ensureReflectionFolderExists(): Promise<boolean> {
        this.ensureReady();

        const summariesFolder = this.app.vault.getAbstractFileByPath(this.config.reflectionFolder);
        
        if (!summariesFolder) {
            try {
                await this.app.vault.createFolder(this.config.reflectionFolder);
                return true;
            } catch (error) {
                console.error(`Failed to create reflection folder: ${this.config.reflectionFolder}`, error);
                return false;
            }
        }

        return true;
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
                console.error(`Error accessing periodic note folder "${trimmedPath}":`, error);
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
        
        try {
            return await this.app.vault.create(finalPath, content);
        } catch (error) {
            console.error("Error creating analysis report:", error);
            throw error;
        }
    }

    /**
     * Initialize the file operations service
     */
    protected async onInitialize(): Promise<void> {
        // Validate configuration
        if (!this.config.reflectionFolder) {
            throw new Error("Reflection folder is not configured");
        }

        if (this.config.daysToInclude < 1) {
            throw new Error("Days to include must be at least 1");
        }

        console.log(`File operations service initialized - scanning ${this.config.daysToInclude} days`);
    }

    /**
     * Dispose the file operations service
     */
    protected async onDispose(): Promise<void> {
        console.log("File operations service disposed");
    }
}