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
  FOLDER_EXCLUDED = 'folder_excluded',
  CONTENT_REDACTED = 'content_redacted'
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
    // Early validation - handle null, undefined, or empty content
    if (!content) {
      this.logger.debug('filterContent: No content provided, returning empty string');
      return '';
    }

    // Handle whitespace-only content
    if (content.trim().length === 0) {
      this.logger.debug('filterContent: Whitespace-only content, returning as-is');
      return content;
    }

    // Check if section redaction is enabled
    if (!this.enableSectionRedaction) {
      this.logger.debug('filterContent: Section redaction disabled, checking for full exclusion');
      
      // If section redaction is disabled, check if entire content should be excluded
      if (this.hasExclusionTags(content)) {
        this.logger.debug('filterContent: Content contains exclusion tags, returning redaction placeholder');
        this.logPrivacyAction({
          type: PrivacyActionType.CONTENT_REDACTED,
          filePath: 'unknown', // File path not available in this context
          timestamp: Date.now(),
          metadata: {
            reason: 'Entire content redacted due to privacy tags (section redaction disabled)',
            sectionsRedacted: 1
          }
        });
        return this.redactionPlaceholder;
      }
      
      // No exclusion tags found, return original content
      return content;
    }

    // Section redaction is enabled - process content with redaction strategies
    this.logger.debug('filterContent: Processing content with section redaction enabled');
    
    const originalLength = content.length;
    const filteredContent = this.redactPrivateSections(content);
    const filteredLength = filteredContent.length;

    // Log processing results
    if (filteredLength !== originalLength) {
      this.logger.debug(`filterContent: Content processed, length changed from ${originalLength} to ${filteredLength} characters`);
    } else {
      this.logger.debug('filterContent: Content processed, no changes made');
    }

    // Check if entire content was redacted (edge case handling)
    if (filteredContent.trim() === this.redactionPlaceholder.trim()) {
      this.logger.debug('filterContent: Entire content was redacted');
      this.logPrivacyAction({
        type: PrivacyActionType.CONTENT_REDACTED,
        filePath: 'unknown', // File path not available in this context
        timestamp: Date.now(),
        metadata: {
          reason: 'Entire content redacted through section processing',
          sectionsRedacted: 1
        }
      });
    }

    return filteredContent;
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
      // Create regex pattern for hashtag detection
      // Only match actual hashtags, not words in regular text
      // Pattern: #tag followed by whitespace, punctuation, or end of line
      const tagPattern = new RegExp(`#${this.escapeRegex(tag)}(?=\\s|[.,!?;:]|$)`, 'i');
      
      if (tagPattern.test(content)) {
        this.logger.debug(`Exclusion hashtag detected: #${tag}`);
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
    // Validate action before logging
    if (!action.type || !action.filePath || !action.timestamp) {
      this.logger.warn('Invalid privacy action provided for logging', action);
      return;
    }

    // Add action to log
    this.actionLog.push(action);

    // Log to console for debugging (without exposing private content)
    this.logger.debug(`Privacy action logged: ${action.type}`, {
      filePath: action.filePath,
      timestamp: new Date(action.timestamp).toISOString(),
      metadata: action.metadata
    });

    // Log summary for audit purposes
    this.logPrivacyActionSummary(action);
  }

  /**
   * Log a privacy action summary for audit purposes
   * @param action Privacy action to summarize
   */
  private logPrivacyActionSummary(action: PrivacyActionLog): void {
    let summary = '';
    
    switch (action.type) {
      case PrivacyActionType.FILE_EXCLUDED:
        summary = `File excluded: ${action.filePath} (${action.metadata?.reason || 'privacy tags detected'})`;
        break;
      case PrivacyActionType.FOLDER_EXCLUDED:
        summary = `Folder exclusion: ${action.filePath} (folder: ${action.metadata?.folderPath || 'unknown'})`;
        break;
      case PrivacyActionType.SECTION_REDACTED: {
        const sections = action.metadata?.sectionsRedacted || 1;
        summary = `Section redaction: ${action.filePath} (${sections} section${sections > 1 ? 's' : ''} redacted)`;
        break;
      }
      case PrivacyActionType.CONTENT_REDACTED:
        summary = `Content redaction: ${action.filePath} (${action.metadata?.reason || 'privacy protection applied'})`;
        break;
      default:
        summary = `Privacy action: ${action.type} on ${action.filePath}`;
    }

    this.logger.info(`PRIVACY: ${summary}`);
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
    const violations: string[] = [];
    
    // Early validation
    if (originalContent === null || originalContent === undefined) {
      violations.push('Original content is null or undefined');
    }
    
    if (filteredContent === null || filteredContent === undefined) {
      violations.push('Filtered content is null or undefined');
    }
    
    if (violations.length > 0) {
      return {
        isValid: false,
        violations,
        summary: 'Content validation failed due to null/undefined values'
      };
    }

    // Check 1: Verify no exclusion tags remain in filtered content
    const remainingTags = this.findRemainingPrivacyTags(filteredContent);
    if (remainingTags.length > 0) {
      violations.push(`Privacy tags found in filtered content: ${remainingTags.join(', ')}`);
    }

    // Check 2: Verify content between privacy markers has been redacted
    const unredactedMarkerContent = this.findUnredactedMarkerContent(filteredContent);
    if (unredactedMarkerContent.length > 0) {
      violations.push(`Unredacted content found between privacy markers: ${unredactedMarkerContent.length} instance(s)`);
    }

    // Check 3: Verify private heading sections have been properly redacted
    const unredactedHeadingSections = this.findUnredactedHeadingSections(filteredContent);
    if (unredactedHeadingSections.length > 0) {
      violations.push(`Private heading sections not properly redacted: ${unredactedHeadingSections.length} section(s)`);
    }

    // Check 4: Verify content integrity (filtered content should be subset of original)
    const integrityViolations = this.verifyContentIntegrity(originalContent, filteredContent);
    violations.push(...integrityViolations);

    // Check 5: Verify redaction placeholders are properly formatted
    // Note: Placeholder verification is currently simplified to avoid false positives
    const placeholderViolations = this.verifyRedactionPlaceholders(filteredContent);
    violations.push(...placeholderViolations);

    // Generate summary
    const isValid = violations.length === 0;
    let summary: string;
    
    if (isValid) {
      summary = 'Privacy enforcement verification passed. All privacy markers have been properly respected.';
    } else {
      summary = `Privacy enforcement verification failed with ${violations.length} violation(s). Manual review required.`;
    }

    // Log verification results
    if (isValid) {
      this.logger.info('Privacy verification passed', {
        originalLength: originalContent.length,
        filteredLength: filteredContent.length,
        reductionPercentage: Math.round(((originalContent.length - filteredContent.length) / originalContent.length) * 100)
      });
    } else {
      this.logger.warn('Privacy verification failed', {
        violationCount: violations.length,
        violations: violations.slice(0, 3) // Log first 3 violations to avoid spam
      });
    }

    return {
      isValid,
      violations,
      summary
    };
  }

  /**
   * Find any privacy tags that remain in filtered content
   * @param content Content to check
   * @returns Array of remaining privacy tags
   */
  private findRemainingPrivacyTags(content: string): string[] {
    const remainingTags: string[] = [];
    
    for (const tag of this.exclusionTags) {
      // Use the same regex pattern as hasExclusionTags for consistency
      const tagPattern = new RegExp(`(?:^|\\s)${this.escapeRegex(tag)}(?=\\s|$)`, 'gi');
      const matches = content.match(tagPattern);
      
      if (matches) {
        remainingTags.push(...matches.map(match => match.trim()));
      }
    }
    
    return Array.from(new Set(remainingTags)); // Remove duplicates
  }

  /**
   * Find content between privacy markers that hasn't been redacted
   * @param content Content to check
   * @returns Array of unredacted marker content instances
   */
  private findUnredactedMarkerContent(content: string): string[] {
    const unredactedInstances: string[] = [];
    
    for (const tag of this.exclusionTags) {
      // Check for HTML comment style markers with content
      const htmlPattern = new RegExp(
        `<!--\\s*${this.escapeRegex(tag)}\\s*-->([\\s\\S]*?)<!--\\s*\\/${this.escapeRegex(tag)}\\s*-->`,
        'gi'
      );
      
      let match;
      while ((match = htmlPattern.exec(content)) !== null) {
        const markerContent = match[1].trim();
        // If content between markers is not just our redaction placeholder, it's a violation
        if (markerContent && markerContent !== this.redactionPlaceholder) {
          unredactedInstances.push(`HTML marker content: "${markerContent.substring(0, 50)}..."`);
        }
      }
      
      // Check for markdown style markers with content
      const markdownPattern = new RegExp(
        `${this.escapeRegex(tag)}\\s*start([\\s\\S]*?)${this.escapeRegex(tag)}\\s*end`,
        'gi'
      );
      
      while ((match = markdownPattern.exec(content)) !== null) {
        const markerContent = match[1].trim();
        if (markerContent && markerContent !== this.redactionPlaceholder) {
          unredactedInstances.push(`Markdown marker content: "${markerContent.substring(0, 50)}..."`);
        }
      }
    }
    
    return unredactedInstances;
  }

  /**
   * Find private heading sections that haven't been properly redacted
   * @param content Content to check
   * @returns Array of unredacted heading sections
   */
  private findUnredactedHeadingSections(content: string): string[] {
    const unredactedSections: string[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a heading line with privacy tags
      if (line.match(/^#+\s/) && this.hasExclusionTags(line)) {
        // This heading should have been redacted
        if (!line.includes(this.redactionPlaceholder)) {
          unredactedSections.push(`Heading: "${line.substring(0, 50)}..."`);
        }
        
        // Check if content under this heading exists (it shouldn't)
        const headingLevel = (line.match(/^#+/)?.[0].length) || 1;
        let j = i + 1;
        
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextHeadingMatch = nextLine.match(/^#+/);
          
          if (nextHeadingMatch && nextHeadingMatch[0].length <= headingLevel) {
            // Found a heading of same or higher level, stop checking
            break;
          }
          
          // If there's non-empty content under a private heading, it's a violation
          if (nextLine.trim() && !nextLine.includes(this.redactionPlaceholder)) {
            unredactedSections.push(`Content under private heading: "${nextLine.substring(0, 50)}..."`);
            break; // Only report first instance per section
          }
          
          j++;
        }
      }
    }
    
    return unredactedSections;
  }

  /**
   * Verify content integrity - filtered content should be a valid subset of original
   * @param originalContent Original content
   * @param filteredContent Filtered content
   * @returns Array of integrity violations
   */
  private verifyContentIntegrity(originalContent: string, filteredContent: string): string[] {
    const violations: string[] = [];
    
    // Check 1: Filtered content shouldn't be longer than original (unless placeholders are longer)
    if (filteredContent.length > originalContent.length * 1.5) { // Allow 50% increase for placeholders
      violations.push('Filtered content is significantly longer than original content');
    }
    
    // Check 2: If original content had no privacy tags, filtered should be identical
    if (!this.hasExclusionTags(originalContent) && originalContent !== filteredContent) {
      violations.push('Content without privacy tags was modified during filtering');
    }
    
    // Check 3: Basic structure preservation - line count shouldn't change dramatically
    const originalLines = originalContent.split('\n').length;
    const filteredLines = filteredContent.split('\n').length;
    
    if (Math.abs(originalLines - filteredLines) > originalLines * 0.5) {
      violations.push('Document structure significantly altered during filtering');
    }
    
    return violations;
  }

  /**
   * Verify redaction placeholders are properly formatted
   * @param content Content to check
   * @returns Array of placeholder violations
   */
  private verifyRedactionPlaceholders(content: string): string[] {
    const violations: string[] = [];
    
    // Simplified placeholder verification to avoid false positives
    // Focus on the most obvious malformed patterns only
    
    // Check for incomplete brackets like "[REDACT" without closing "]"
    // But exclude our valid placeholder "[REDACTED]"
    const incompleteBrackets = /\[REDACT(?!ED\])/g;
    const incompleteMatches = content.match(incompleteBrackets) || [];
    
    if (incompleteMatches.length > 0) {
      violations.push(`Found ${incompleteMatches.length} incomplete redaction placeholder(s)`);
    }
    
    return violations;
  }

  /**
   * Perform a comprehensive privacy audit on a file
   * @param filePath Path to the file being audited
   * @param originalContent Original file content
   * @param filteredContent Content after privacy filtering
   * @returns Comprehensive audit report
   */
  auditFilePrivacy(filePath: string, originalContent: string, filteredContent: string): {
    filePath: string;
    shouldBeExcluded: boolean;
    wasFiltered: boolean;
    verificationResult: {
      isValid: boolean;
      violations: string[];
      summary: string;
    };
    statistics: {
      originalLength: number;
      filteredLength: number;
      reductionPercentage: number;
      privacyTagsFound: number;
      redactionPlaceholders: number;
    };
    recommendations: string[];
  } {
    // Determine if file should be excluded entirely
    const shouldBeExcluded = this.shouldExcludeFile(filePath, originalContent);
    
    // Check if content was actually filtered
    const wasFiltered = originalContent !== filteredContent;
    
    // Run verification
    const verificationResult = this.verifyPrivacyEnforcement(originalContent, filteredContent);
    
    // Calculate statistics
    const originalLength = originalContent.length;
    const filteredLength = filteredContent.length;
    const reductionPercentage = originalLength > 0 ? 
      Math.round(((originalLength - filteredLength) / originalLength) * 100) : 0;
    
    const privacyTagsFound = this.exclusionTags.reduce((count, tag) => {
      const pattern = new RegExp(`(?:^|\\s)${this.escapeRegex(tag)}(?=\\s|$)`, 'gi');
      const matches = originalContent.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
    
    const redactionPlaceholders = (filteredContent.match(new RegExp(this.escapeRegex(this.redactionPlaceholder), 'g')) || []).length;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (shouldBeExcluded && !wasFiltered) {
      recommendations.push('File should be excluded entirely from analysis');
    }
    
    if (privacyTagsFound > 0 && !wasFiltered) {
      recommendations.push('File contains privacy tags but was not filtered');
    }
    
    if (!verificationResult.isValid) {
      recommendations.push('Manual review required due to verification failures');
    }
    
    if (reductionPercentage > 50) {
      recommendations.push('High content reduction - verify important information is preserved');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('No issues detected - privacy enforcement appears correct');
    }
    
    // Log audit completion
    this.logger.debug('File privacy audit completed', {
      filePath,
      shouldBeExcluded,
      wasFiltered,
      isValid: verificationResult.isValid,
      reductionPercentage
    });
    
    return {
      filePath,
      shouldBeExcluded,
      wasFiltered,
      verificationResult,
      statistics: {
        originalLength,
        filteredLength,
        reductionPercentage,
        privacyTagsFound,
        redactionPlaceholders
      },
      recommendations
    };
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
   * Get privacy actions filtered by type
   * @param actionType Type of actions to retrieve
   * @returns Array of matching privacy actions
   */
  getActionsByType(actionType: PrivacyActionType): PrivacyActionLog[] {
    return this.actionLog.filter(action => action.type === actionType);
  }

  /**
   * Get privacy actions for a specific file path
   * @param filePath File path to search for
   * @returns Array of privacy actions for the file
   */
  getActionsForFile(filePath: string): PrivacyActionLog[] {
    return this.actionLog.filter(action => action.filePath === filePath);
  }

  /**
   * Get privacy actions within a time range
   * @param startTime Start timestamp (inclusive)
   * @param endTime End timestamp (inclusive)
   * @returns Array of privacy actions within the time range
   */
  getActionsInTimeRange(startTime: number, endTime: number): PrivacyActionLog[] {
    return this.actionLog.filter(action => 
      action.timestamp >= startTime && action.timestamp <= endTime
    );
  }

  /**
   * Generate a comprehensive privacy audit report
   * @param options Report generation options
   * @returns Privacy audit report
   */
  generateAuditReport(options: {
    includeFileList?: boolean;
    timeRange?: { start: number; end: number };
    actionTypes?: PrivacyActionType[];
  } = {}): {
    summary: {
      totalActions: number;
      fileExclusions: number;
      folderExclusions: number;
      sectionRedactions: number;
      contentRedactions: number;
      uniqueFilesAffected: number;
      reportGeneratedAt: string;
    };
    timeRange?: {
      start: string;
      end: string;
    };
    actions?: Array<Omit<PrivacyActionLog, 'timestamp'> & { timestamp: string }>;
    affectedFiles?: string[];
  } {
    let actionsToAnalyze = this.actionLog;

    // Apply time range filter if specified
    if (options.timeRange) {
      actionsToAnalyze = this.getActionsInTimeRange(options.timeRange.start, options.timeRange.end);
    }

    // Apply action type filter if specified
    if (options.actionTypes && options.actionTypes.length > 0) {
      actionsToAnalyze = actionsToAnalyze.filter(action => 
        options.actionTypes?.includes(action.type) ?? false
      );
    }

    // Calculate summary statistics
    const fileExclusions = actionsToAnalyze.filter(a => a.type === PrivacyActionType.FILE_EXCLUDED).length;
    const folderExclusions = actionsToAnalyze.filter(a => a.type === PrivacyActionType.FOLDER_EXCLUDED).length;
    const sectionRedactions = actionsToAnalyze.filter(a => a.type === PrivacyActionType.SECTION_REDACTED).length;
    const contentRedactions = actionsToAnalyze.filter(a => a.type === PrivacyActionType.CONTENT_REDACTED).length;
    
    const uniqueFilesAffected = new Set(actionsToAnalyze.map(a => a.filePath)).size;

    const report: {
      summary: {
        totalActions: number;
        fileExclusions: number;
        folderExclusions: number;
        sectionRedactions: number;
        contentRedactions: number;
        uniqueFilesAffected: number;
        reportGeneratedAt: string;
      };
      timeRange?: { start: string; end: string; };
      actions?: Array<Omit<PrivacyActionLog, 'timestamp'> & { timestamp: string }>;
      affectedFiles?: string[];
    } = {
      summary: {
        totalActions: actionsToAnalyze.length,
        fileExclusions,
        folderExclusions,
        sectionRedactions,
        contentRedactions,
        uniqueFilesAffected,
        reportGeneratedAt: new Date().toISOString()
      }
    };

    // Add time range info if specified
    if (options.timeRange) {
      report.timeRange = {
        start: new Date(options.timeRange.start).toISOString(),
        end: new Date(options.timeRange.end).toISOString()
      };
    }

    // Include actions list if requested
    if (options.includeFileList) {
      report.actions = actionsToAnalyze.map(action => ({
        ...action,
        timestamp: new Date(action.timestamp).toISOString()
      }));
      
      report.affectedFiles = Array.from(new Set(actionsToAnalyze.map(a => a.filePath))).sort();
    }

    this.logger.info('Privacy audit report generated', {
      totalActions: report.summary.totalActions,
      uniqueFiles: report.summary.uniqueFilesAffected
    });

    return report;
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