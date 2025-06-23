import { App, TFile } from 'obsidian';
import { DailyNoteContent, ParseResult } from './markdown-interfaces';

/**
 * Simple parser for daily note content
 */
export class MarkdownParser {
  constructor(private app: App) {}

  /**
   * Parse a daily note file
   */
  async parseFile(file: TFile): Promise<ParseResult> {
    try {
      const content = await this.app.vault.read(file);
      const parsed = this.parseContent(content, file.basename);
      
      return {
        success: true,
        data: parsed
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse content into structured data
   */
  private parseContent(content: string, filename: string): DailyNoteContent {
    // Extract date from filename (assumes YYYY-MM-DD format)
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : filename;

    // Count words
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    // Extract tags
    const tagMatches = content.match(/#[\w-]+/g);
    const tags = tagMatches || [];

    // Extract mood (look for mood: or feeling: patterns)
    const moodMatch = content.match(/(?:mood|feeling):\s*([^\n]+)/i);
    const mood = moodMatch ? moodMatch[1].trim() : undefined;

    // Extract tasks
    const taskMatches = content.match(/^[\s]*[-*+]\s*\[[ x]\]\s*(.+)$/gm);
    const taskItems = taskMatches || [];
    const completedTasks = taskItems.filter(task => task.includes('[x]')).length;
    const totalTasks = taskItems.length;

    return {
      date,
      content,
      wordCount,
      mood,
      tags,
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        items: taskItems.map(task => task.replace(/^[\s]*[-*+]\s*\[[ x]\]\s*/, ''))
      }
    };
  }

} 
