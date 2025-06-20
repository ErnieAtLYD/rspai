import { App } from 'obsidian';
import { VaultScanner } from './vault-scanner';
import { PrivacyFilter, PrivacySettings } from './privacy-filter';
import { FileMetadata, FilePrivacyStatus } from './file-metadata';
import { Logger } from './logger';

/**
 * Configuration for privacy-aware scanning
 */
export interface PrivacyAwareScanConfig {
  /** Privacy filter settings */
  privacySettings?: Partial<PrivacySettings>;
  
  /** Whether to read file content for privacy analysis */
  analyzeContent?: boolean;
  
  /** Whether to perform privacy verification on filtered content */
  verifyPrivacy?: boolean;
  
  /** Maximum file size to analyze (in bytes) */
  maxFileSize?: number;
  
  /** Whether to skip files that haven't changed since last privacy analysis */
  usePrivacyCache?: boolean;
}

/**
 * Default configuration for privacy-aware scanning
 */
export const DEFAULT_PRIVACY_SCAN_CONFIG: PrivacyAwareScanConfig = {
  analyzeContent: true,
  verifyPrivacy: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  usePrivacyCache: true
};

/**
 * Results from a privacy-aware scan operation
 */
export interface PrivacyScanResults {
  /** Total files scanned */
  totalFiles: number;
  
  /** Files excluded due to privacy settings */
  excludedFiles: number;
  
  /** Files with content filtered for privacy */
  filteredFiles: number;
  
  /** Files that passed privacy verification */
  verifiedFiles: number;
  
  /** Files that failed privacy verification */
  failedVerification: number;
  
  /** Files skipped due to size limits */
  skippedFiles: number;
  
  /** Total scan duration in milliseconds */
  scanDuration: number;
  
  /** Privacy action summary */
  privacyActions: {
    fileExclusions: number;
    folderExclusions: number;
    sectionRedactions: number;
    contentRedactions: number;
  };
  
  /** Files with verification failures (for debugging) */
  verificationFailures: Array<{
    filePath: string;
    violations: string[];
  }>;
}

/**
 * Privacy-aware file scanner that integrates VaultScanner with PrivacyFilter
 * for comprehensive file processing with privacy protection
 */
export class PrivacyAwareScanner {
  private vaultScanner: VaultScanner;
  private privacyFilter: PrivacyFilter;
  private config: PrivacyAwareScanConfig;

  constructor(
    private app: App,
    private logger: Logger,
    config: PrivacyAwareScanConfig = {}
  ) {
    this.config = { ...DEFAULT_PRIVACY_SCAN_CONFIG, ...config };
    this.vaultScanner = new VaultScanner(app, logger);
    this.privacyFilter = new PrivacyFilter(logger, this.config.privacySettings);
    
    this.logger.debug('PrivacyAwareScanner initialized', {
      analyzeContent: this.config.analyzeContent,
      verifyPrivacy: this.config.verifyPrivacy,
      maxFileSize: this.config.maxFileSize
    });
  }

  /**
   * Scan vault with privacy analysis
   * @param path Optional path to scan, if not provided scans entire vault
   * @param forceRescan If true, ignores cache and rescans all files
   * @returns Privacy-aware scan results
   */
  async scanVaultWithPrivacy(path?: string, forceRescan = false): Promise<{
    files: FileMetadata[];
    results: PrivacyScanResults;
  }> {
    const startTime = Date.now();
    this.logger.info(`Starting privacy-aware vault scan${path ? ` for path: ${path}` : ''}`);

    try {
      // First, get basic file metadata from VaultScanner
      const basicFiles = await this.vaultScanner.scanVault(path, forceRescan);
      
      // Initialize results tracking
      const results: PrivacyScanResults = {
        totalFiles: basicFiles.length,
        excludedFiles: 0,
        filteredFiles: 0,
        verifiedFiles: 0,
        failedVerification: 0,
        skippedFiles: 0,
        scanDuration: 0,
        privacyActions: {
          fileExclusions: 0,
          folderExclusions: 0,
          sectionRedactions: 0,
          contentRedactions: 0
        },
        verificationFailures: []
      };

      // Process each file with privacy analysis
      const processedFiles: FileMetadata[] = [];
      
      for (const file of basicFiles) {
        try {
          const processedFile = await this.processFileWithPrivacy(file, results);
          processedFiles.push(processedFile);
        } catch (error) {
          this.logger.error(`Error processing file ${file.path} with privacy analysis`, error);
          // Add file without privacy analysis on error
          processedFiles.push(file);
        }
      }

      // Get privacy action summary from PrivacyFilter
      const privacyReport = this.privacyFilter.generateAuditReport();
      results.privacyActions = {
        fileExclusions: privacyReport.summary.fileExclusions,
        folderExclusions: privacyReport.summary.folderExclusions,
        sectionRedactions: privacyReport.summary.sectionRedactions,
        contentRedactions: privacyReport.summary.contentRedactions
      };

      results.scanDuration = Date.now() - startTime;
      
      this.logger.info('Privacy-aware scan completed', {
        totalFiles: results.totalFiles,
        excludedFiles: results.excludedFiles,
        filteredFiles: results.filteredFiles,
        duration: results.scanDuration
      });

      return {
        files: processedFiles,
        results
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Privacy-aware scan failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Process a single file with privacy analysis
   * @param file Basic file metadata
   * @param results Results object to update
   * @returns File metadata with privacy information
   */
  private async processFileWithPrivacy(
    file: FileMetadata, 
    results: PrivacyScanResults
  ): Promise<FileMetadata> {
    // Check if we should skip content analysis
    if (!this.config.analyzeContent) {
      return file;
    }

    // Check file size limits
    if (this.config.maxFileSize && file.size > this.config.maxFileSize) {
      this.logger.debug(`Skipping large file: ${file.path} (${file.size} bytes)`);
      results.skippedFiles++;
      return file;
    }

    // Check privacy cache if enabled
    if (this.config.usePrivacyCache && this.shouldSkipPrivacyAnalysis(file)) {
      this.logger.debug(`Using cached privacy analysis for: ${file.path}`);
      return file;
    }

    try {
      // Read file content
      const fileContent = await this.readFileContent(file.path);
      
      // Perform privacy analysis
      const privacyStatus = await this.analyzeFilePrivacy(file.path, fileContent, results);
      
      // Add privacy information to file metadata
      const processedFile: FileMetadata = {
        ...file,
        privacy: privacyStatus
      };

      return processedFile;

    } catch (error) {
      this.logger.error(`Error reading/analyzing file ${file.path}`, error);
      return file;
    }
  }

  /**
   * Analyze file privacy and update results
   * @param filePath Path to the file
   * @param content File content
   * @param results Results object to update
   * @returns Privacy status for the file
   */
  private async analyzeFilePrivacy(
    filePath: string, 
    content: string, 
    results: PrivacyScanResults
  ): Promise<FilePrivacyStatus> {
    const analysisStartTime = Date.now();
    
    // Check if entire file should be excluded
    const shouldExclude = this.privacyFilter.shouldExcludeFile(filePath, content);
    
    if (shouldExclude) {
      results.excludedFiles++;
      
      // Determine exclusion reason
      let exclusionReason: 'privacy_tags' | 'excluded_folder' | 'user_setting' = 'privacy_tags';
      let excludedFolder: string | undefined;
      
      // Check if it's folder-based exclusion
      const matchingFolder = this.getMatchingExcludedFolder(filePath);
      if (matchingFolder) {
        exclusionReason = 'excluded_folder';
        excludedFolder = matchingFolder;
      }
      
      return {
        isExcluded: true,
        exclusionReason,
        isFiltered: false,
        excludedFolder,
        privacyAnalyzedAt: analysisStartTime
      };
    }

    // File is not excluded, check if content needs filtering
    const originalLength = content.length;
    const filteredContent = this.privacyFilter.filterContent(content);
    const filteredLength = filteredContent.length;
    const isFiltered = originalLength !== filteredLength;
    
    if (isFiltered) {
      results.filteredFiles++;
    }

    // Find privacy tags in content
    const privacyTagsFound = this.findPrivacyTagsInContent(content);

    // Perform privacy verification if enabled
    let verificationPassed = true;
    if (this.config.verifyPrivacy) {
      const verification = this.privacyFilter.verifyPrivacyEnforcement(content, filteredContent);
      verificationPassed = verification.isValid;
      
      if (verificationPassed) {
        results.verifiedFiles++;
      } else {
        results.failedVerification++;
        results.verificationFailures.push({
          filePath,
          violations: verification.violations
        });
        
        this.logger.warn(`Privacy verification failed for ${filePath}`, {
          violationCount: verification.violations.length,
          summary: verification.summary
        });
      }
    }

    return {
      isExcluded: false,
      isFiltered,
      originalLength,
      filteredLength,
      privacyTagsFound: privacyTagsFound.length > 0 ? privacyTagsFound : undefined,
      privacyAnalyzedAt: analysisStartTime
    };
  }

  /**
   * Read file content from the vault
   * @param filePath Path to the file
   * @returns File content as string
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      return await this.app.vault.read(file as any);
    } catch (error) {
      this.logger.error(`Failed to read file content: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Check if privacy analysis should be skipped for a file (caching logic)
   * @param file File metadata
   * @returns True if analysis should be skipped
   */
  private shouldSkipPrivacyAnalysis(file: FileMetadata): boolean {
    // If file doesn't have privacy analysis, don't skip
    if (!file.privacy || !file.privacy.privacyAnalyzedAt) {
      return false;
    }

    // If file was modified after privacy analysis, don't skip
    if (file.modifiedAt > file.privacy.privacyAnalyzedAt) {
      return false;
    }

    // File hasn't changed since privacy analysis, can skip
    return true;
  }

  /**
   * Get the excluded folder that matches the given file path
   * @param filePath Path to check
   * @returns The matching excluded folder name, or undefined if none match
   */
  private getMatchingExcludedFolder(filePath: string): string | undefined {
    const settings = this.privacyFilter.getSettings();
    
    if (!filePath || filePath.trim().length === 0) {
      return undefined;
    }

    const normalizedPath = this.normalizePath(filePath);

    for (const excludedFolder of settings.excludedFolders) {
      const normalizedExcludedFolder = this.normalizePath(excludedFolder);
      
      if (this.isPathInFolder(normalizedPath, normalizedExcludedFolder, settings.caseSensitiveFolders)) {
        return excludedFolder;
      }
    }

    return undefined;
  }

  /**
   * Normalize a file path for consistent comparison
   * @param path Path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    if (!path) {
      return '';
    }
    
    // Convert backslashes to forward slashes for consistent comparison
    let normalized = path.replace(/\\/g, '/');
    
    // Remove leading slash if present
    if (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }
    
    // Remove trailing slash if present
    if (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    
    return normalized;
  }

  /**
   * Check if a file path is within a specific folder
   * @param filePath Normalized file path
   * @param folderPath Normalized folder path
   * @param caseSensitive Whether comparison should be case sensitive
   * @returns True if file is in the folder
   */
  private isPathInFolder(filePath: string, folderPath: string, caseSensitive: boolean): boolean {
    if (!folderPath) {
      return false;
    }

    // Apply case sensitivity based on settings
    const compareFilePath = caseSensitive ? filePath : filePath.toLowerCase();
    const compareFolderPath = caseSensitive ? folderPath : folderPath.toLowerCase();

    // Exact folder match (file directly in the folder)
    if (compareFilePath.startsWith(compareFolderPath + '/')) {
      return true;
    }

    // Check if the file path starts with the folder name
    // Handle case where folder path is the entire path
    if (compareFilePath === compareFolderPath) {
      return true;
    }

    // Check if any part of the path matches the excluded folder
    const pathParts = compareFilePath.split('/');
    const folderParts = compareFolderPath.split('/');

    // Check if folder path appears anywhere in the file path
    for (let i = 0; i <= pathParts.length - folderParts.length; i++) {
      let match = true;
      for (let j = 0; j < folderParts.length; j++) {
        if (pathParts[i + j] !== folderParts[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find privacy tags in content
   * @param content File content
   * @returns Array of privacy tags found
   */
  private findPrivacyTagsInContent(content: string): string[] {
    const settings = this.privacyFilter.getSettings();
    const foundTags: string[] = [];
    
    for (const tag of settings.exclusionTags) {
      const tagPattern = new RegExp(`(?:^|\\s)${this.escapeRegex(tag)}(?=\\s|$)`, 'gi');
      if (tagPattern.test(content)) {
        foundTags.push(tag);
      }
    }
    
    return foundTags;
  }

  /**
   * Escape special regex characters in a string
   * @param str String to escape
   * @returns Escaped string safe for regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get files that are excluded from analysis
   * @returns Array of excluded file metadata
   */
  async getExcludedFiles(): Promise<FileMetadata[]> {
    const { files } = await this.scanVaultWithPrivacy();
    return files.filter(file => file.privacy?.isExcluded);
  }

  /**
   * Get files that have been privacy-filtered
   * @returns Array of filtered file metadata
   */
  async getFilteredFiles(): Promise<FileMetadata[]> {
    const { files } = await this.scanVaultWithPrivacy();
    return files.filter(file => file.privacy?.isFiltered);
  }

  /**
   * Get comprehensive privacy audit for the vault
   * @returns Privacy audit report
   */
  async getPrivacyAudit(): Promise<{
    scanResults: PrivacyScanResults;
    privacyReport: any;
    recommendations: string[];
  }> {
    const { results } = await this.scanVaultWithPrivacy();
    const privacyReport = this.privacyFilter.generateAuditReport({ includeFileList: true });
    
    // Generate recommendations based on scan results
    const recommendations: string[] = [];
    
    if (results.failedVerification > 0) {
      recommendations.push(`${results.failedVerification} files failed privacy verification - manual review recommended`);
    }
    
    if (results.skippedFiles > 0) {
      recommendations.push(`${results.skippedFiles} files skipped due to size limits - consider increasing maxFileSize if needed`);
    }
    
    if (results.excludedFiles === 0 && results.filteredFiles === 0) {
      recommendations.push('No privacy protection detected - consider adding privacy tags or organizing sensitive files in excluded folders');
    }
    
    const exclusionRate = (results.excludedFiles / results.totalFiles) * 100;
    if (exclusionRate > 50) {
      recommendations.push(`High exclusion rate (${exclusionRate.toFixed(1)}%) - verify privacy settings are not too restrictive`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Privacy configuration appears optimal');
    }
    
    return {
      scanResults: results,
      privacyReport,
      recommendations
    };
  }

  /**
   * Update privacy settings and clear cache
   * @param settings New privacy settings
   */
  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    this.privacyFilter.updateSettings(settings);
    this.config.privacySettings = { ...this.config.privacySettings, ...settings };
    this.logger.info('Privacy settings updated, cache will be refreshed on next scan');
  }

  /**
   * Get current privacy settings
   * @returns Current privacy settings
   */
  getPrivacySettings(): PrivacySettings {
    return this.privacyFilter.getSettings();
  }

  /**
   * Get the underlying VaultScanner instance
   * @returns VaultScanner instance
   */
  getVaultScanner(): VaultScanner {
    return this.vaultScanner;
  }

  /**
   * Get the underlying PrivacyFilter instance
   * @returns PrivacyFilter instance
   */
  getPrivacyFilter(): PrivacyFilter {
    return this.privacyFilter;
  }

  // ========================================
  // PERFORMANCE OPTIMIZATION METHODS
  // ========================================

  /**
   * Batch process multiple files with privacy analysis for better performance
   * @param files Array of file metadata to process
   * @param forceRescan If true, ignores cache and rescans all files
   * @returns Privacy-aware scan results
   */
  async scanVaultWithPrivacyBatch(files: FileMetadata[], forceRescan = false): Promise<{
    files: FileMetadata[];
    results: PrivacyScanResults;
  }> {
    const startTime = Date.now();
    this.logger.info(`Starting batch privacy-aware scan for ${files.length} files`);

    try {
      // Initialize results tracking
      const results: PrivacyScanResults = {
        totalFiles: files.length,
        excludedFiles: 0,
        filteredFiles: 0,
        verifiedFiles: 0,
        failedVerification: 0,
        skippedFiles: 0,
        scanDuration: 0,
        privacyActions: {
          fileExclusions: 0,
          folderExclusions: 0,
          sectionRedactions: 0,
          contentRedactions: 0
        },
        verificationFailures: []
      };

      // Optimize privacy filter for batch processing
      this.privacyFilter.optimizeForLargeVault();

      // Process files in batches for better performance
      const batchSize = this.config.privacySettings?.batchSize || 50;
      const processedFiles: FileMetadata[] = [];
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await this.processBatchWithPrivacy(batch, results, forceRescan);
        processedFiles.push(...batchResults);
      }

      // Get privacy action summary from PrivacyFilter
      const privacyReport = this.privacyFilter.generateAuditReport();
      results.privacyActions = {
        fileExclusions: privacyReport.summary.fileExclusions,
        folderExclusions: privacyReport.summary.folderExclusions,
        sectionRedactions: privacyReport.summary.sectionRedactions,
        contentRedactions: privacyReport.summary.contentRedactions
      };

      results.scanDuration = Date.now() - startTime;
      
      this.logger.info('Batch privacy-aware scan completed', {
        totalFiles: results.totalFiles,
        excludedFiles: results.excludedFiles,
        filteredFiles: results.filteredFiles,
        duration: results.scanDuration,
        cacheStats: this.privacyFilter.getCacheStats()
      });

      return {
        files: processedFiles,
        results
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Batch privacy-aware scan failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Process a batch of files with privacy analysis
   * @param batch Array of files to process
   * @param results Results object to update
   * @param forceRescan Whether to force rescan
   * @returns Processed file metadata
   */
  private async processBatchWithPrivacy(
    batch: FileMetadata[], 
    results: PrivacyScanResults,
    forceRescan: boolean
  ): Promise<FileMetadata[]> {
    const processedFiles: FileMetadata[] = [];
    
    // Prepare batch requests for privacy filter
    const batchRequests: Array<{
      filePath: string;
      content: string;
      operation: 'shouldExclude' | 'filterContent';
      fileHash?: string;
    }> = [];

    // Read file contents and prepare batch requests
    for (const file of batch) {
      try {
        // Check if we should skip this file
        if (this.shouldSkipPrivacyAnalysis(file)) {
          processedFiles.push(file);
          continue;
        }

        // Read file content
        const content = await this.readFileContent(file.path);
        if (!content) {
          processedFiles.push(file);
          continue;
        }

        // Generate file hash for caching
        const fileHash = this.generateFileHash(file);

        // Add to batch requests
        batchRequests.push({
          filePath: file.path,
          content,
          operation: 'shouldExclude',
          fileHash
        });

      } catch (error) {
        this.logger.error(`Error preparing file ${file.path} for batch processing`, error);
        processedFiles.push(file);
      }
    }

    // Process batch with privacy filter
    if (batchRequests.length > 0) {
      try {
        const batchResults = await this.privacyFilter.processBatch(batchRequests);
        
        // Process results
        for (let i = 0; i < batchRequests.length; i++) {
          const request = batchRequests[i];
          const shouldExclude = batchResults[i] as boolean;
          
          // Find corresponding file
          const file = batch.find(f => f.path === request.filePath);
          if (!file) continue;

          // Update file with privacy information
          const updatedFile = { ...file };
          
          if (shouldExclude) {
            updatedFile.privacy = {
              isExcluded: true,
              exclusionReason: 'privacy_tags',
              isFiltered: false,
              privacyTagsFound: this.findPrivacyTagsInContent(request.content),
              excludedFolder: this.getMatchingExcludedFolder(file.path),
              privacyAnalyzedAt: Date.now()
            };
            results.excludedFiles++;
          } else {
            // Filter content if not excluded
            const filteredContent = this.privacyFilter.filterContentOptimized(
              request.content, 
              request.fileHash
            );
            
            updatedFile.privacy = {
              isExcluded: false,
              exclusionReason: undefined,
              isFiltered: filteredContent !== request.content,
              originalLength: request.content.length,
              filteredLength: filteredContent.length,
              privacyTagsFound: this.findPrivacyTagsInContent(request.content),
              privacyAnalyzedAt: Date.now()
            };
            
            if (filteredContent !== request.content) {
              results.filteredFiles++;
            }
          }

          processedFiles.push(updatedFile);
        }
      } catch (error) {
        this.logger.error('Batch privacy processing failed', error);
        // Fallback to individual processing
        for (const file of batch) {
          const processedFile = await this.processFileWithPrivacy(file, results);
          processedFiles.push(processedFile);
        }
      }
    }

    return processedFiles;
  }

  /**
   * Generate a hash for file metadata for caching purposes
   */
  private generateFileHash(file: FileMetadata): string {
    const hashData = `${file.path}_${file.size}_${file.modifiedAt}`;
    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      const char = hashData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get performance metrics from privacy filter
   */
  getPerformanceMetrics(): any {
    return this.privacyFilter.getPerformanceMetrics();
  }

  /**
   * Get cache statistics from privacy filter
   */
  getCacheStats(): any {
    return this.privacyFilter.getCacheStats();
  }

  /**
   * Clear privacy filter cache
   */
  clearCache(): void {
    this.privacyFilter.clearCache();
  }

  /**
   * Optimize scanner for large vault processing
   */
  optimizeForLargeVault(): void {
    this.privacyFilter.optimizeForLargeVault();
    this.config.maxFileSize = Math.max(this.config.maxFileSize || 0, 50 * 1024 * 1024); // 50MB
    this.config.usePrivacyCache = true;
    
    this.logger.info("Privacy-aware scanner optimized for large vault", {
      maxFileSize: this.config.maxFileSize,
      cacheEnabled: this.config.usePrivacyCache
    });
  }
} 