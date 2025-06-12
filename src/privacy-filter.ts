import { Logger } from './logger';

/**
 * Settings interface for privacy filter configuration
 */
export interface PrivacySettings {
  exclusionTags: string[];
  excludedFolders: string[];
  enableSectionRedaction: boolean;
  redactionPlaceholder: string;
  caseSensitiveFolders: boolean;
}

/**
 * Default privacy settings
 */
export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  exclusionTags: ['#private', '#noai', '#confidential'],
  excludedFolders: ['Private', 'Confidential', '.private'],
  enableSectionRedaction: true,
  redactionPlaceholder: '[REDACTED]',
  caseSensitiveFolders: false
};

/**
 * Privacy action types for logging
 */
export enum PrivacyActionType {
  FILE_EXCLUDED = 'file_excluded',
  SECTION_REDACTED = 'section_redacted',
  FOLDER_EXCLUDED = 'folder_excluded'
}

/**
 * Privacy action log entry
 */
export interface PrivacyActionLog {
  type: PrivacyActionType;
  filePath: string;
  timestamp: number;
  metadata?: {
    reason?: string;
    sectionsRedacted?: number;
    folderPath?: string;
  };
}

/**
 * PrivacyFilter handles content filtering and exclusion based on privacy markers
 */
export class PrivacyFilter {
  private exclusionTags: string[];
  private excludedFolders: string[];
  private enableSectionRedaction: boolean;
  private redactionPlaceholder: string;
  private caseSensitiveFolders: boolean;
  private actionLog: PrivacyActionLog[];

  constructor(
    private logger: Logger,
    settings: Partial<PrivacySettings> = {}
  ) {
    const finalSettings = { ...DEFAULT_PRIVACY_SETTINGS, ...settings };
    
    this.exclusionTags = finalSettings.exclusionTags;
    this.excludedFolders = finalSettings.excludedFolders;
    this.enableSectionRedaction = finalSettings.enableSectionRedaction;
    this.redactionPlaceholder = finalSettings.redactionPlaceholder;
    this.caseSensitiveFolders = finalSettings.caseSensitiveFolders;
    this.actionLog = [];

    this.logger.debug('PrivacyFilter initialized', {
      exclusionTags: this.exclusionTags.length,
      excludedFolders: this.excludedFolders.length,
      sectionRedaction: this.enableSectionRedaction
    });
  }

  /**
   * Check if an entire file should be excluded from analysis
   * @param filePath Path to the file
   * @param fileContent Content of the file
   * @returns True if file should be excluded
   */
  shouldExcludeFile(filePath: string, fileContent: string): boolean {
    // Early validation
    if (!filePath || filePath.trim().length === 0) {
      this.logger.debug('File exclusion check: empty file path provided');
      return false; // Don't exclude if path is invalid
    }

    // Strategy 1: Check if file is in an excluded folder (highest priority)
    if (this.isInExcludedFolder(filePath)) {
      this.logPrivacyAction({
        type: PrivacyActionType.FOLDER_EXCLUDED,
        filePath,
        timestamp: Date.now(),
        metadata: {
          reason: 'File located in excluded folder',
          folderPath: this.getMatchingExcludedFolder(filePath)
        }
      });
      return true;
    }

    // Strategy 2: Check if file content contains exclusion tags
    if (fileContent && this.hasExclusionTags(fileContent)) {
      this.logPrivacyAction({
        type: PrivacyActionType.FILE_EXCLUDED,
        filePath,
        timestamp: Date.now(),
        metadata: {
          reason: 'File contains privacy tags',
        }
      });
      return true;
    }

    // File should not be excluded
    this.logger.debug(`File allowed for analysis: ${filePath}`);
    return false;
  }

  /**
   * Get the excluded folder that matches the given file path
   * @param filePath Path to check
   * @returns The matching excluded folder name, or undefined if none match
   */
  private getMatchingExcludedFolder(filePath: string): string | undefined {
    if (!filePath || filePath.trim().length === 0) {
      return undefined;
    }

    const normalizedPath = this.normalizePath(filePath);

    for (const excludedFolder of this.excludedFolders) {
      const normalizedExcludedFolder = this.normalizePath(excludedFolder);
      
      if (this.isPathInFolder(normalizedPath, normalizedExcludedFolder)) {
        return excludedFolder;
      }
    }

    return undefined;
  }

  /**
   * Filter content by removing private sections
   * @param content Original content
   * @returns Filtered content with private sections redacted
   */
  filterContent(content: string): string {
    // TODO: Implementation in subtask 3.6
    throw new Error('Not implemented yet');
  }

  /**
   * Check if content contains any exclusion tags
   * @param content Content to check
   * @returns True if exclusion tags are found
   */
  private hasExclusionTags(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false;
    }

    // Check each exclusion tag
    for (const tag of this.exclusionTags) {
      // Create regex pattern for tag detection
      // Use word boundaries that work properly with hashtags
      // Matches tag at start of line or after whitespace, followed by whitespace or end of line
      const tagPattern = new RegExp(`(?:^|\\s)${this.escapeRegex(tag)}(?=\\s|$)`, 'i');
      
      if (tagPattern.test(content)) {
        this.logger.debug(`Exclusion tag detected: ${tag}`);
        return true;
      }
    }

    return false;
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
   * Check if a file path is within excluded folders
   * @param path File path to check
   * @returns True if path is in excluded folder
   */
  private isInExcludedFolder(path: string): boolean {
    if (!path || path.trim().length === 0) {
      return false;
    }

    if (this.excludedFolders.length === 0) {
      return false;
    }

    // Normalize the path for consistent comparison
    const normalizedPath = this.normalizePath(path);

    // Check each excluded folder
    for (const excludedFolder of this.excludedFolders) {
      const normalizedExcludedFolder = this.normalizePath(excludedFolder);
      
      // Check if the file path starts with the excluded folder path
      // This handles both direct files in the folder and nested files
      if (this.isPathInFolder(normalizedPath, normalizedExcludedFolder)) {
        this.logger.debug(`File excluded due to folder: ${excludedFolder}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize a file path for consistent comparison
   * @param path Path to normalize
   * @returns Normalized path
   */
  private normalizePath(path: string): string {
    // Remove leading/trailing whitespace and slashes
    let normalized = path.trim().replace(/^\/+|\/+$/g, '');
    
    // Convert backslashes to forward slashes for consistency
    normalized = normalized.replace(/\\/g, '/');
    
    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');
    
    return normalized;
  }

  /**
   * Check if a file path is within a specific folder
   * @param filePath Normalized file path
   * @param folderPath Normalized folder path
   * @returns True if file is in the folder
   */
  private isPathInFolder(filePath: string, folderPath: string): boolean {
    if (!folderPath) {
      return false;
    }

    // Apply case sensitivity based on settings
    const compareFilePath = this.caseSensitiveFolders ? filePath : filePath.toLowerCase();
    const compareFolderPath = this.caseSensitiveFolders ? folderPath : folderPath.toLowerCase();

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
   * Redact private sections from content
   * @param content Original content
   * @returns Content with private sections redacted
   */
  private redactPrivateSections(content: string): string {
    if (!content || content.trim().length === 0) {
      return content;
    }

    if (!this.enableSectionRedaction) {
      // If section redaction is disabled, return content as-is
      // (full file exclusion should be handled at a higher level)
      return content;
    }

    let processedContent = content;
    let sectionsRedacted = 0;

    // Strategy 1: Redact content between privacy markers (do this first)
    processedContent = this.redactContentBetweenMarkers(processedContent, (count) => {
      sectionsRedacted += count;
    });

    // Strategy 2: Redact heading sections with privacy tags (do this before paragraphs)
    processedContent = this.redactPrivateHeadingSections(processedContent, (count) => {
      sectionsRedacted += count;
    });

    // Strategy 3: Redact paragraphs containing privacy tags (do this last)
    processedContent = this.redactPrivateParagraphs(processedContent, (count) => {
      sectionsRedacted += count;
    });

    // Log redaction action if any sections were redacted
    if (sectionsRedacted > 0) {
      this.logger.debug(`Redacted ${sectionsRedacted} private sections`);
    }

    return processedContent;
  }

  /**
   * Redact individual paragraphs that contain privacy tags
   * @param content Content to process
   * @param onRedaction Callback when sections are redacted
   * @returns Content with private paragraphs redacted
   */
  private redactPrivateParagraphs(content: string, onRedaction: (count: number) => void): string {
    const paragraphs = content.split(/\n\s*\n/); // Split on double newlines
    let redactedCount = 0;

    const processedParagraphs = paragraphs.map(paragraph => {
      if (this.hasExclusionTags(paragraph)) {
        redactedCount++;
        // Preserve paragraph structure but redact content
        const lines = paragraph.split('\n');
        const firstLine = lines[0];
        
        // If it's a heading, preserve the heading structure
        if (firstLine.match(/^#+\s/)) {
          return `${firstLine.match(/^#+\s/)?.[0] || ''}${this.redactionPlaceholder}`;
        }
        
        // For regular paragraphs, replace with placeholder
        return this.redactionPlaceholder;
      }
      return paragraph;
    });

    onRedaction(redactedCount);
    return processedParagraphs.join('\n\n');
  }

  /**
   * Redact content between explicit privacy markers
   * @param content Content to process
   * @param onRedaction Callback when sections are redacted
   * @returns Content with marked sections redacted
   */
  private redactContentBetweenMarkers(content: string, onRedaction: (count: number) => void): string {
    let processedContent = content;
    let redactedCount = 0;

    // Pattern for content between privacy markers
    // Supports formats like:
    // <!-- #private -->
    // content here
    // <!-- /#private -->
    for (const tag of this.exclusionTags) {
      // HTML comment style markers
      const htmlPattern = new RegExp(
        `<!--\\s*${this.escapeRegex(tag)}\\s*-->[\\s\\S]*?<!--\\s*\\/${this.escapeRegex(tag)}\\s*-->`,
        'gi'
      );
      
      // Markdown style markers
      const markdownPattern = new RegExp(
        `${this.escapeRegex(tag)}\\s*start[\\s\\S]*?${this.escapeRegex(tag)}\\s*end`,
        'gi'
      );

      // Replace HTML comment style
      const htmlMatches = processedContent.match(htmlPattern);
      if (htmlMatches) {
        redactedCount += htmlMatches.length;
        processedContent = processedContent.replace(htmlPattern, `<!-- ${this.redactionPlaceholder} -->`);
      }

      // Replace markdown style
      const markdownMatches = processedContent.match(markdownPattern);
      if (markdownMatches) {
        redactedCount += markdownMatches.length;
        processedContent = processedContent.replace(markdownPattern, this.redactionPlaceholder);
      }
    }

    onRedaction(redactedCount);
    return processedContent;
  }

  /**
   * Redact entire heading sections that contain privacy tags
   * @param content Content to process
   * @param onRedaction Callback when sections are redacted
   * @returns Content with private heading sections redacted
   */
  private redactPrivateHeadingSections(content: string, onRedaction: (count: number) => void): string {
    const lines = content.split('\n');
    const processedLines: string[] = [];
    let redactedCount = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      
      // Check if this is a heading line with privacy tags
      if (line.match(/^#+\s/) && this.hasExclusionTags(line)) {
        redactedCount++;
        
        // Get the heading level
        const headingLevel = (line.match(/^#+/)?.[0].length) || 1;
        
        // Add redacted heading
        const headingPrefix = '#'.repeat(headingLevel);
        processedLines.push(`${headingPrefix} ${this.redactionPlaceholder}`);
        
        // Skip all content until the next heading of same or higher level
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextHeadingMatch = nextLine.match(/^#+/);
          
          if (nextHeadingMatch && nextHeadingMatch[0].length <= headingLevel) {
            // Found a heading of same or higher level, stop redacting
            break;
          }
          
          // Skip this line (it's part of the private section)
          i++;
        }
        
        // Don't increment i here, as we want to process the next heading
        continue;
      }
      
      // Regular line, keep as-is
      processedLines.push(line);
      i++;
    }

    onRedaction(redactedCount);
    return processedLines.join('\n');
  }

  /**
   * Log a privacy action without exposing private content
   * @param action Privacy action to log
   */
  private logPrivacyAction(action: PrivacyActionLog): void {
    // TODO: Implementation in subtask 3.7
    throw new Error('Not implemented yet');
  }

  /**
   * Verify that privacy enforcement is working correctly
   * @param originalContent Original content before filtering
   * @param filteredContent Content after filtering
   * @returns Verification report
   */
  verifyPrivacyEnforcement(originalContent: string, filteredContent: string): {
    isValid: boolean;
    violations: string[];
    summary: string;
  } {
    // TODO: Implementation in subtask 3.8
    throw new Error('Not implemented yet');
  }

  /**
   * Get privacy action logs
   * @returns Array of privacy actions
   */
  getActionLog(): PrivacyActionLog[] {
    return [...this.actionLog]; // Return copy for safety
  }

  /**
   * Clear the action log
   */
  clearActionLog(): void {
    this.actionLog = [];
    this.logger.debug('Privacy action log cleared');
  }

  /**
   * Update privacy settings
   * @param settings New settings to apply
   */
  updateSettings(settings: Partial<PrivacySettings>): void {
    if (settings.exclusionTags) {
      this.exclusionTags = settings.exclusionTags;
    }
    if (settings.excludedFolders) {
      this.excludedFolders = settings.excludedFolders;
    }
    if (settings.enableSectionRedaction !== undefined) {
      this.enableSectionRedaction = settings.enableSectionRedaction;
    }
    if (settings.redactionPlaceholder) {
      this.redactionPlaceholder = settings.redactionPlaceholder;
    }
    if (settings.caseSensitiveFolders !== undefined) {
      this.caseSensitiveFolders = settings.caseSensitiveFolders;
    }

    this.logger.info('Privacy settings updated');
  }

  /**
   * Get current privacy settings
   * @returns Current settings
   */
  getSettings(): PrivacySettings {
    return {
      exclusionTags: [...this.exclusionTags],
      excludedFolders: [...this.excludedFolders],
      enableSectionRedaction: this.enableSectionRedaction,
      redactionPlaceholder: this.redactionPlaceholder,
      caseSensitiveFolders: this.caseSensitiveFolders
    };
  }
} 