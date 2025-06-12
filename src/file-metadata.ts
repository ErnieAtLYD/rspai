/**
 * Represents metadata for a file in the Obsidian vault
 */
export interface FileMetadata {
  /** Full path to the file within the vault */
  path: string;
  
  /** Filename without the path */
  filename: string;
  
  /** File extension (e.g., 'md', 'txt') */
  extension: string;
  
  /** File creation timestamp */
  createdAt: number;
  
  /** File last modified timestamp */
  modifiedAt: number;
  
  /** File size in bytes */
  size: number;
  
  /** Whether this file is identified as a daily note */
  isDailyNote: boolean;
  
  /** Whether this file is identified as a weekly note */
  isWeeklyNote: boolean;
  
  /** Optional: Detected date from filename (for daily/weekly notes) */
  detectedDate?: Date;
  
  /** Optional: Additional tags or categories */
  tags?: string[];
}

/**
 * Utility functions for working with FileMetadata
 */
export class FileMetadataUtils {
  /**
   * Check if a filename matches daily note pattern (YYYY-MM-DD)
   */
  static isDailyNotePattern(filename: string): boolean {
    const dailyPattern = /^\d{4}-\d{2}-\d{2}\.md$/;
    return dailyPattern.test(filename);
  }
  
  /**
   * Check if a filename matches weekly note pattern (YYYY-W##)
   */
  static isWeeklyNotePattern(filename: string): boolean {
    const weeklyPattern = /^\d{4}-W\d{2}\.md$/;
    return weeklyPattern.test(filename);
  }
  
  /**
   * Extract date from daily note filename
   */
  static extractDateFromDailyNote(filename: string): Date | null {
    const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  }
  
  /**
   * Create FileMetadata from basic file information
   */
  static createFromFile(
    path: string,
    filename: string,
    extension: string,
    createdAt: number,
    modifiedAt: number,
    size: number
  ): FileMetadata {
    const isDailyNote = this.isDailyNotePattern(filename);
    const isWeeklyNote = this.isWeeklyNotePattern(filename);
    const detectedDate = isDailyNote ? this.extractDateFromDailyNote(filename) || undefined : undefined;
    
    return {
      path,
      filename,
      extension,
      createdAt,
      modifiedAt,
      size,
      isDailyNote,
      isWeeklyNote,
      detectedDate,
      tags: []
    };
  }
} 