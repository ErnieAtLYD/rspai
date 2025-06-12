import { App } from 'obsidian';
import { FileMetadata } from './file-metadata';
import { Logger } from './logger';

/**
 * VaultScanner handles scanning and indexing of files in the Obsidian vault
 */
export class VaultScanner {
  private fileIndex: Map<string, FileMetadata>;
  private lastScanTimestamp: number;

  constructor(
    private app: App,
    private logger: Logger
  ) {
    this.fileIndex = new Map();
    this.lastScanTimestamp = 0;
    this.logger.debug('VaultScanner initialized');
  }

  /**
   * Scan the entire vault or a specific path for markdown files
   * @param path Optional path to scan, if not provided scans entire vault
   * @param forceRescan If true, ignores cache and rescans all files
   * @returns Array of FileMetadata objects
   */
  async scanVault(path?: string, forceRescan = false): Promise<FileMetadata[]> {
    const startTime = Date.now();
    this.logger.info(`Starting vault scan${path ? ` for path: ${path}` : ''} (forceRescan: ${forceRescan})`);

    try {
      let files: FileMetadata[];

      // Choose scanning method based on path parameter
      if (path) {
        // Scan specific directory
        files = await this.scanDirectory(path, forceRescan);
      } else {
        // Scan entire vault
        files = await this.scanAllFiles(forceRescan);
      }

      // Update the file index with scanned files
      this.updateFileIndex(files);

      // Clean up deleted files from index (only for full vault scans)
      if (!path) {
        this.cleanupDeletedFiles();
      }

      const duration = Date.now() - startTime;
      this.logger.info(`Vault scan completed in ${duration}ms: ${files.length} files processed`);

      return files;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Vault scan failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Get statistics about the current file index
   * @returns Object with index statistics
   */
  getIndexStats() {
    const totalFiles = this.fileIndex.size;
    const dailyNotes = Array.from(this.fileIndex.values()).filter(f => f.isDailyNote).length;
    const weeklyNotes = Array.from(this.fileIndex.values()).filter(f => f.isWeeklyNote).length;
    const lastScan = this.lastScanTimestamp ? new Date(this.lastScanTimestamp).toISOString() : 'Never';

    return {
      totalFiles,
      dailyNotes,
      weeklyNotes,
      lastScan,
      lastScanTimestamp: this.lastScanTimestamp
    };
  }

  /**
   * Force a complete rescan of the vault, ignoring all cache
   * @param path Optional path to rescan, if not provided rescans entire vault
   * @returns Array of FileMetadata objects
   */
  async forceRescan(path?: string): Promise<FileMetadata[]> {
    this.logger.info('Forcing complete rescan (ignoring cache)');
    return this.scanVault(path, true);
  }

  /**
   * Recursively scan a specific directory for markdown files with intelligent caching
   * @param path Directory path to scan
   * @param forceRescan If true, ignores cache and rescans all files
   * @returns Array of FileMetadata objects
   */
  private async scanDirectory(path: string, forceRescan = false): Promise<FileMetadata[]> {
    this.logger.debug(`Scanning directory: ${path} (forceRescan: ${forceRescan})`);
    const results: FileMetadata[] = [];

    try {
      // Get the folder from the vault
      const folder = this.app.vault.getAbstractFileByPath(path);
      
      if (!folder || !(folder instanceof this.app.vault.adapter.constructor.prototype.constructor)) {
        // If path doesn't exist or isn't a folder, try to get it as a folder
        const abstractFile = this.app.vault.getAbstractFileByPath(path);
        if (!abstractFile) {
          this.logger.warn(`Directory not found: ${path}`);
          return results;
        }
      }

      // Get all files in the vault and filter by path
      const allFiles = this.app.vault.getFiles();
      
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const file of allFiles) {
        // Check if file is in the specified directory or subdirectory
        if (file.path.startsWith(path)) {
          // Only process markdown files
          if (file.extension === 'md') {
            try {
              // Check if we should skip this file (caching logic)
              if (!forceRescan && this.shouldSkipFile(file)) {
                // File hasn't changed, use cached version
                const cachedMetadata = this.fileIndex.get(file.path);
                if (cachedMetadata) {
                  results.push(cachedMetadata);
                  skippedCount++;
                  continue;
                }
              }

              // File is new or changed, process it
              const metadata = await this.createFileMetadata(file);
              results.push(metadata);
              processedCount++;
              this.logger.debug(`Found file: ${file.path}`);
            } catch (error) {
              this.logger.error(`Error processing file ${file.path}`, error);
            }
          }
        }
      }

      this.logger.debug(`Scanned directory ${path}: ${processedCount} processed, ${skippedCount} cached, ${results.length} total files`);
      return results;

    } catch (error) {
      this.logger.error(`Error scanning directory ${path}`, error);
      return results;
    }
  }

  /**
   * Create FileMetadata from an Obsidian TFile
   * @param file Obsidian TFile object
   * @returns FileMetadata object
   */
  private async createFileMetadata(file: any): Promise<FileMetadata> {
    const stat = await this.app.vault.adapter.stat(file.path);
    
    return {
      path: file.path,
      filename: file.name,
      extension: file.extension,
      createdAt: stat?.ctime || Date.now(),
      modifiedAt: stat?.mtime || file.stat.mtime,
      size: stat?.size || file.stat.size,
      isDailyNote: this.isDailyNote(file.name),
      isWeeklyNote: this.isWeeklyNote(file.name),
      detectedDate: this.extractDateFromFilename(file.name),
      tags: [] // Will be populated later when we add content analysis
    };
  }

  /**
   * Check if a filename matches daily note pattern
   * @param filename The filename to check
   * @returns True if it's a daily note
   */
  private isDailyNote(filename: string): boolean {
    // Common daily note patterns: YYYY-MM-DD, YYYY_MM_DD, YYYY.MM.DD
    const dailyPatterns = [
      /^\d{4}-\d{2}-\d{2}\.md$/,
      /^\d{4}_\d{2}_\d{2}\.md$/,
      /^\d{4}\.\d{2}\.\d{2}\.md$/,
      /^\d{4}-\d{1,2}-\d{1,2}\.md$/
    ];
    
    return dailyPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if a filename matches weekly note pattern
   * @param filename The filename to check
   * @returns True if it's a weekly note
   */
  private isWeeklyNote(filename: string): boolean {
    // Common weekly note patterns: YYYY-W##, YYYY_W##, YYYY Week ##
    const weeklyPatterns = [
      /^\d{4}-W\d{1,2}\.md$/,
      /^\d{4}_W\d{1,2}\.md$/,
      /^\d{4} Week \d{1,2}\.md$/i
    ];
    
    return weeklyPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Extract date from filename if it contains a date pattern
   * @param filename The filename to parse
   * @returns Date object or undefined
   */
  private extractDateFromFilename(filename: string): Date | undefined {
    // Try to extract YYYY-MM-DD pattern
    const dateMatch = filename.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Try to extract YYYY_MM_DD pattern
    const underscoreMatch = filename.match(/(\d{4})_(\d{1,2})_(\d{1,2})/);
    if (underscoreMatch) {
      const [, year, month, day] = underscoreMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    return undefined;
  }

  /**
   * Scan all files in the vault with intelligent caching
   * @param forceRescan If true, ignores cache and rescans all files
   * @returns Array of FileMetadata objects
   */
  private async scanAllFiles(forceRescan = false): Promise<FileMetadata[]> {
    this.logger.debug(`Scanning entire vault (forceRescan: ${forceRescan})`);
    const results: FileMetadata[] = [];

    try {
      // Get all markdown files directly from the vault
      const allFiles = this.app.vault.getMarkdownFiles();
      
      this.logger.debug(`Found ${allFiles.length} markdown files in vault`);

      let processedCount = 0;
      let skippedCount = 0;

      for (const file of allFiles) {
        try {
          // Check if we should skip this file (caching logic)
          if (!forceRescan && this.shouldSkipFile(file)) {
            // File hasn't changed, use cached version
            const cachedMetadata = this.fileIndex.get(file.path);
            if (cachedMetadata) {
              results.push(cachedMetadata);
              skippedCount++;
              continue;
            }
          }

          // File is new or changed, process it
          const metadata = await this.createFileMetadata(file);
          results.push(metadata);
          processedCount++;
          this.logger.debug(`Processed file: ${file.path}`);
        } catch (error) {
          this.logger.error(`Error processing file ${file.path}`, error);
        }
      }

      this.logger.info(`Scanned vault: ${processedCount} processed, ${skippedCount} cached, ${results.length} total files`);
      return results;

    } catch (error) {
      this.logger.error('Error scanning vault', error);
      return results;
    }
  }

  /**
   * Check if a file should be skipped during scanning (caching logic)
   * @param file The file to check
   * @returns True if file should be skipped (use cached version)
   */
  private shouldSkipFile(file: any): boolean {
    // If this is the first scan, don't skip anything
    if (this.lastScanTimestamp === 0) {
      return false;
    }

    // Check if we have cached metadata for this file
    const cachedMetadata = this.fileIndex.get(file.path);
    if (!cachedMetadata) {
      return false; // New file, must process
    }

    // Check if file has been modified since last scan
    const fileModifiedTime = file.stat.mtime;
    const cachedModifiedTime = cachedMetadata.modifiedAt;

    // Skip if file hasn't been modified
    return fileModifiedTime <= cachedModifiedTime;
  }

  /**
   * Update the internal file index with new metadata
   * @param files Array of FileMetadata to update in the index
   */
  private updateFileIndex(files: FileMetadata[]): void {
    this.logger.debug(`Updating file index with ${files.length} files`);
    
    let addedCount = 0;
    let updatedCount = 0;

    for (const file of files) {
      const existingFile = this.fileIndex.get(file.path);
      
      if (existingFile) {
        // Check if file has been modified
        if (existingFile.modifiedAt !== file.modifiedAt) {
          this.fileIndex.set(file.path, file);
          updatedCount++;
          this.logger.debug(`Updated file in index: ${file.path}`);
        }
        // If modification time is the same, no need to update
      } else {
        // New file, add to index
        this.fileIndex.set(file.path, file);
        addedCount++;
        this.logger.debug(`Added new file to index: ${file.path}`);
      }
    }

    // Update last scan timestamp
    this.lastScanTimestamp = Date.now();

    this.logger.info(`Index updated: ${addedCount} added, ${updatedCount} updated, ${this.fileIndex.size} total files`);
  }

  /**
   * Remove files from the index that no longer exist in the vault
   * This should be called after scanning to clean up deleted files
   */
  private cleanupDeletedFiles(): void {
    this.logger.debug('Cleaning up deleted files from index');
    
    const currentFiles = this.app.vault.getMarkdownFiles();
    const currentPaths = new Set(currentFiles.map(f => f.path));
    const indexedPaths = Array.from(this.fileIndex.keys());
    
    let deletedCount = 0;
    
    for (const indexedPath of indexedPaths) {
      if (!currentPaths.has(indexedPath)) {
        this.fileIndex.delete(indexedPath);
        deletedCount++;
        this.logger.debug(`Removed deleted file from index: ${indexedPath}`);
      }
    }
    
    if (deletedCount > 0) {
      this.logger.info(`Cleaned up ${deletedCount} deleted files from index`);
    }
  }

  /**
   * Get files that have been modified since the last scan
   * @returns Array of file paths that need to be rescanned
   */
  private getModifiedFiles(): string[] {
    if (this.lastScanTimestamp === 0) {
      // First scan, all files need to be processed
      return [];
    }

    const modifiedFiles: string[] = [];
    const currentFiles = this.app.vault.getMarkdownFiles();

    for (const file of currentFiles) {
      const indexedFile = this.fileIndex.get(file.path);
      
      if (!indexedFile || file.stat.mtime > this.lastScanTimestamp) {
        modifiedFiles.push(file.path);
      }
    }

    this.logger.debug(`Found ${modifiedFiles.length} modified files since last scan`);
    return modifiedFiles;
  }

  /**
   * Get the current file index
   * @returns Map of file paths to FileMetadata
   */
  getFileIndex(): Map<string, FileMetadata> {
    return new Map(this.fileIndex);
  }

  /**
   * Get metadata for a specific file
   * @param path File path
   * @returns FileMetadata or undefined if not found
   */
  getFileMetadata(path: string): FileMetadata | undefined {
    return this.fileIndex.get(path);
  }

  /**
   * Clear the file index
   */
  clearIndex(): void {
    this.fileIndex.clear();
    this.lastScanTimestamp = 0;
    this.logger.debug('File index cleared');
  }

  /**
   * Get the timestamp of the last scan
   * @returns Last scan timestamp
   */
  getLastScanTimestamp(): number {
    return this.lastScanTimestamp;
  }
} 