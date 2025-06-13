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
    
    for (const excludedFolder of settings.excludedFolders) {
      // Use the same logic as PrivacyFilter
      if (filePath.toLowerCase().includes(excludedFolder.toLowerCase())) {
        return excludedFolder;
      }
    }
    
    return undefined;
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
} 