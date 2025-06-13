import { App, TFile } from 'obsidian';
import { Logger } from './logger';
import { PrivacyFilter } from './privacy-filter';
import {
  ParsedMarkdown,
  MarkdownElement,
  MarkdownHeading,
  MarkdownParagraph,
  MarkdownList,
  MarkdownCodeBlock,
  MarkdownTable,
  MarkdownCallout,
  MarkdownBlockquote,
  MarkdownHorizontalRule,
  MarkdownComment,
  ListItem,
  InlineElement,
  InlineText,
  FrontmatterData,
  DocumentMetadata,
  ContentPosition,
  MarkdownParseConfig,
  DEFAULT_PARSE_CONFIG,
  ParseResult
} from './markdown-interfaces';

/**
 * Core Markdown Parser for Obsidian notes
 * Handles all standard markdown plus Obsidian-specific features
 */
export class MarkdownParser {
  private config: MarkdownParseConfig;
  private privacyFilter?: PrivacyFilter;

  constructor(
    private app: App,
    private logger: Logger,
    config: Partial<MarkdownParseConfig> = {},
    privacyFilter?: PrivacyFilter
  ) {
    this.config = { ...DEFAULT_PARSE_CONFIG, ...config };
    this.privacyFilter = privacyFilter;
    
    this.logger.debug('MarkdownParser initialized', {
      config: this.config,
      hasPrivacyFilter: !!this.privacyFilter
    });
  }

  /**
   * Parse a file from the Obsidian vault
   * @param file TFile instance to parse
   * @returns Promise<ParseResult>
   */
  async parseFile(file: TFile): Promise<ParseResult> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Parsing file: ${file.path}`);
      
      // Check file size limits
      if (file.stat.size > this.config.maxFileSize) {
        throw new Error(`File too large: ${file.stat.size} bytes (max: ${this.config.maxFileSize})`);
      }

      // Read file content
      const content = await this.app.vault.read(file);
      
      // Apply privacy filtering if enabled
      let processedContent = content;
      if (this.privacyFilter) {
        // Check if entire file should be excluded
        if (this.privacyFilter.shouldExcludeFile(file.path, content)) {
          this.logger.info(`File excluded by privacy filter: ${file.path}`);
          return {
            success: false,
            error: {
              code: 'PRIVACY_EXCLUDED',
              message: 'File excluded by privacy settings'
            },
            warnings: [],
            processingTime: Date.now() - startTime
          };
        }
        
        // Filter content for privacy
        processedContent = this.privacyFilter.filterContent(content);
      }

      // Parse the content
      const parsedMarkdown = this.parseContent(processedContent, file);
      
      const processingTime = Date.now() - startTime;
      this.logger.debug(`File parsed successfully: ${file.path}`, {
        processingTime,
        elementCount: parsedMarkdown.elements.length,
        wordCount: parsedMarkdown.metadata.wordCount
      });

      return {
        success: true,
        data: parsedMarkdown,
        warnings: [],
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Failed to parse file: ${file.path}`, error);
      
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown parsing error'
        },
        warnings: [],
        processingTime
      };
    }
  }

  /**
   * Parse markdown content string
   * @param content Raw markdown content
   * @param file Optional TFile for metadata
   * @returns ParsedMarkdown
   */
  parseContent(content: string, file?: TFile): ParsedMarkdown {
    const lines = content.split('\n');
    const elements: MarkdownElement[] = [];
    let currentLine = 0;

    // Extract frontmatter if enabled
    let frontmatter: FrontmatterData | undefined;
    if (this.config.parseFrontmatter) {
      const frontmatterResult = this.extractFrontmatter(lines);
      frontmatter = frontmatterResult.data;
      currentLine = frontmatterResult.endLine;
    }

    // Parse content elements
    while (currentLine < lines.length) {
      const element = this.parseNextElement(lines, currentLine);
      if (element) {
        elements.push(element.element);
        currentLine = element.nextLine;
      } else {
        currentLine++;
      }
    }

    // Generate document metadata
    const metadata = this.generateDocumentMetadata(content, elements, file);

    return {
      frontmatter,
      elements,
      metadata
    };
  }

  /**
   * Extract YAML frontmatter from the beginning of the document
   * @param lines Document lines
   * @returns Frontmatter data and end line
   */
  private extractFrontmatter(lines: string[]): { data?: FrontmatterData; endLine: number } {
    if (lines.length === 0 || lines[0].trim() !== '---') {
      return { endLine: 0 };
    }

    let endLine = 1;
    const yamlLines: string[] = [];

    // Find the closing ---
    while (endLine < lines.length) {
      if (lines[endLine].trim() === '---') {
        endLine++; // Skip the closing ---
        break;
      }
      yamlLines.push(lines[endLine]);
      endLine++;
    }

    if (yamlLines.length === 0) {
      return { endLine: 0 };
    }

    try {
      // Simple YAML parsing for common cases
      const frontmatter: FrontmatterData = {};
      
      for (const line of yamlLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const key = trimmed.substring(0, colonIndex).trim();
        const valueStr = trimmed.substring(colonIndex + 1).trim();

        // Parse different value types
        let value: string | number | boolean | string[] | Date | null = valueStr;

        if (valueStr === 'null' || valueStr === '~') {
          value = null;
        } else if (valueStr === 'true') {
          value = true;
        } else if (valueStr === 'false') {
          value = false;
        } else if (/^\d+$/.test(valueStr)) {
          value = parseInt(valueStr, 10);
        } else if (/^\d+\.\d+$/.test(valueStr)) {
          value = parseFloat(valueStr);
        } else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
          // Simple array parsing
          const arrayContent = valueStr.slice(1, -1);
          value = arrayContent.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
        } else if (/^\d{4}-\d{2}-\d{2}/.test(valueStr)) {
          // Date parsing
          value = new Date(valueStr);
        } else {
          // Remove quotes if present
          value = valueStr.replace(/^["']|["']$/g, '');
        }

        frontmatter[key] = value;
      }

      this.logger.debug('Frontmatter extracted', { keys: Object.keys(frontmatter) });
      return { data: frontmatter, endLine };

    } catch (error) {
      this.logger.warn('Failed to parse frontmatter', error);
      return { endLine };
    }
  }

  /**
   * Parse the next markdown element from the current position
   * @param lines Document lines
   * @param startLine Current line index
   * @returns Parsed element and next line index
   */
  private parseNextElement(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } | null {
    if (startLine >= lines.length) return null;

    const line = lines[startLine];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      return null;
    }

    // HTML Comments (including privacy markers)
    if (trimmed.startsWith('<!--')) {
      return this.parseComment(lines, startLine);
    }

    // Headings
    if (trimmed.match(/^#{1,6}\s/)) {
      return this.parseHeading(lines, startLine);
    }

    // Horizontal rules
    if (trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      return this.parseHorizontalRule(lines, startLine);
    }

    // Code blocks
    if (trimmed.startsWith('```')) {
      return this.parseCodeBlock(lines, startLine);
    }

    // Tables (check for pipe characters)
    if (trimmed.includes('|') && this.isTableRow(trimmed)) {
      return this.parseTable(lines, startLine);
    }

    // Blockquotes
    if (trimmed.startsWith('>')) {
      return this.parseBlockquote(lines, startLine);
    }

    // Lists
    if (this.isListItem(trimmed)) {
      return this.parseList(lines, startLine);
    }

    // Callouts (Obsidian-specific)
    if (trimmed.match(/^>\s*\[!/)) {
      return this.parseCallout(lines, startLine);
    }

    // Default to paragraph
    return this.parseParagraph(lines, startLine);
  }

  /**
   * Parse a heading element
   */
  private parseHeading(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const line = lines[startLine];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (!match) {
      // Fallback to paragraph if heading parsing fails
      return this.parseParagraph(lines, startLine);
    }

    const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    const text = match[2].trim();
    
    // Extract tags from heading
    const tags = this.extractTagsFromText(text);
    
    const position: ContentPosition = {
      startLine: startLine + 1, // 1-indexed
      endLine: startLine + 1,
      startChar: 0,
      endChar: line.length
    };

    const heading: MarkdownHeading = {
      type: 'heading',
      content: line,
      position,
      level,
      text,
      tags
    };

    return { element: heading, nextLine: startLine + 1 };
  }

  /**
   * Parse a paragraph element
   */
  private parseParagraph(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const paragraphLines: string[] = [];
    let currentLine = startLine;

    // Collect consecutive non-empty lines that aren't other elements
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      const trimmed = line.trim();

      // Stop at empty line or start of other elements
      if (!trimmed || 
          trimmed.match(/^#{1,6}\s/) || 
          trimmed.startsWith('```') ||
          trimmed.startsWith('<!--') ||
          trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/) ||
          trimmed.startsWith('>') ||
          this.isListItem(trimmed) ||
          (trimmed.includes('|') && this.isTableRow(trimmed))) {
        break;
      }

      paragraphLines.push(line);
      currentLine++;
    }

    const content = paragraphLines.join('\n');
    const text = paragraphLines.join(' ').trim();
    
    // Extract tags and inline elements
    const tags = this.extractTagsFromText(text);
    const inlineElements = this.config.parseInlineElements ? this.parseInlineElements(text) : [];

    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: paragraphLines[paragraphLines.length - 1]?.length || 0
    };

    const paragraph: MarkdownParagraph = {
      type: 'paragraph',
      content,
      position,
      text,
      inlineElements,
      tags
    };

    return { element: paragraph, nextLine: currentLine };
  }

  /**
   * Parse a list element
   */
  private parseList(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const items: ListItem[] = [];
    let currentLine = startLine;
    let listType: 'ordered' | 'unordered' | 'task' = 'unordered';
    let baseLevel = 0;

    // Determine list type from first item
    const firstLine = lines[startLine].trim();
    if (firstLine.match(/^\d+\./)) {
      listType = 'ordered';
    } else if (firstLine.match(/^[-*+]\s*\[[ x]\]/)) {
      listType = 'task';
    }

    // Calculate base indentation level
    baseLevel = this.getIndentationLevel(lines[startLine]);

    while (currentLine < lines.length) {
      const line = lines[currentLine];
      const trimmed = line.trim();

      if (!trimmed) {
        currentLine++;
        continue;
      }

      if (!this.isListItem(trimmed)) {
        break;
      }

      const item = this.parseListItem(line, baseLevel);
      if (item) {
        items.push(item);
      }
      currentLine++;
    }

    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: lines[currentLine - 1]?.length || 0
    };

    const list: MarkdownList = {
      type: 'list',
      content: lines.slice(startLine, currentLine).join('\n'),
      position,
      listType,
      items,
      level: baseLevel
    };

    return { element: list, nextLine: currentLine };
  }

  /**
   * Parse a single list item
   */
  private parseListItem(line: string, baseLevel: number): ListItem | null {
    const level = this.getIndentationLevel(line) - baseLevel;
    const trimmed = line.trim();

    // Task list item
    const taskMatch = trimmed.match(/^[-*+]\s*\[([x ])\]\s*(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1] === 'x';
      const content = taskMatch[2];
      const tags = this.extractTagsFromText(content);
      const inlineElements = this.config.parseInlineElements ? this.parseInlineElements(content) : [];

      return {
        content,
        checked,
        level,
        tags,
        inlineElements
      };
    }

    // Regular list item
    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s*(.*)$/);
    if (listMatch) {
      const content = listMatch[2];
      const tags = this.extractTagsFromText(content);
      const inlineElements = this.config.parseInlineElements ? this.parseInlineElements(content) : [];

      return {
        content,
        level,
        tags,
        inlineElements
      };
    }

    return null;
  }

  /**
   * Parse a code block element
   */
  private parseCodeBlock(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const firstLine = lines[startLine];
    const languageMatch = firstLine.match(/^```(\w+)?/);
    const language = languageMatch?.[1] || '';

    let currentLine = startLine + 1;
    const codeLines: string[] = [];

    // Find closing ```
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      if (line.trim() === '```') {
        currentLine++; // Skip closing ```
        break;
      }
      codeLines.push(line);
      currentLine++;
    }

    const code = codeLines.join('\n');
    const content = lines.slice(startLine, currentLine).join('\n');

    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: lines[currentLine - 1]?.length || 0
    };

    const codeBlock: MarkdownCodeBlock = {
      type: 'codeblock',
      content,
      position,
      language,
      code
    };

    return { element: codeBlock, nextLine: currentLine };
  }

  /**
   * Parse a table element
   */
  private parseTable(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const tableLines: string[] = [];
    let currentLine = startLine;

    // Collect all table rows
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      const trimmed = line.trim();

      if (!trimmed || !this.isTableRow(trimmed)) {
        break;
      }

      tableLines.push(line);
      currentLine++;
    }

    if (tableLines.length < 2) {
      // Not a valid table, treat as paragraph
      return this.parseParagraph(lines, startLine);
    }

    // Parse headers (first row)
    const headers = this.parseTableRow(tableLines[0]);
    
    // Parse alignment row (second row) if it exists
    const alignment = this.parseTableAlignment(tableLines[1]);
    
    // Parse data rows
    const rows: string[][] = [];
    for (let i = 2; i < tableLines.length; i++) {
      const row = this.parseTableRow(tableLines[i]);
      if (row.length > 0) {
        rows.push(row);
      }
    }

    const content = tableLines.join('\n');
    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: tableLines[tableLines.length - 1]?.length || 0
    };

    const table: MarkdownTable = {
      type: 'table',
      content,
      position,
      headers,
      rows,
      alignment
    };

    return { element: table, nextLine: currentLine };
  }

  /**
   * Parse a comment element (including privacy markers)
   */
  private parseComment(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const line = lines[startLine];
    let currentLine = startLine;
    let commentText = '';

    // Single line comment
    const singleLineMatch = line.match(/<!--\s*(.*?)\s*-->/);
    if (singleLineMatch) {
      commentText = singleLineMatch[1];
      currentLine = startLine + 1;
    } else {
      // Multi-line comment
      const commentLines: string[] = [];
      let foundEnd = false;

      while (currentLine < lines.length) {
        const currentLineText = lines[currentLine];
        commentLines.push(currentLineText);

        if (currentLineText.includes('-->')) {
          foundEnd = true;
          currentLine++;
          break;
        }
        currentLine++;
      }

      if (foundEnd) {
        const fullComment = commentLines.join('\n');
        const match = fullComment.match(/<!--\s*([\s\S]*?)\s*-->/);
        commentText = match?.[1] || '';
      }
    }

    // Check if this is a privacy marker
    const isPrivacyMarker = this.config.detectPrivacyMarkers && 
      this.config.privacyTags.some(tag => commentText.includes(tag));
    
    let privacyTag: string | undefined;
    let markerType: 'start' | 'end' | undefined;

    if (isPrivacyMarker) {
      for (const tag of this.config.privacyTags) {
        if (commentText.includes(tag)) {
          privacyTag = tag;
          markerType = commentText.includes('/') ? 'end' : 'start';
          break;
        }
      }
    }

    const content = lines.slice(startLine, currentLine).join('\n');
    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: lines[currentLine - 1]?.length || 0
    };

    const comment: MarkdownComment = {
      type: 'comment',
      content,
      position,
      commentText,
      isPrivacyMarker,
      privacyTag,
      markerType
    };

    return { element: comment, nextLine: currentLine };
  }

  /**
   * Parse a horizontal rule element
   */
  private parseHorizontalRule(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const line = lines[startLine];
    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: startLine + 1,
      startChar: 0,
      endChar: line.length
    };

    const rule: MarkdownHorizontalRule = {
      type: 'horizontalrule',
      content: line,
      position
    };

    return { element: rule, nextLine: startLine + 1 };
  }

  /**
   * Parse a blockquote element
   */
  private parseBlockquote(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const quoteLines: string[] = [];
    let currentLine = startLine;
    let level = 0;

    // Collect consecutive blockquote lines
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      const trimmed = line.trim();

      if (!trimmed.startsWith('>')) {
        break;
      }

      // Count quote level
      const quoteMatch = trimmed.match(/^(>+)/);
      if (quoteMatch) {
        level = Math.max(level, quoteMatch[1].length);
      }

      quoteLines.push(line);
      currentLine++;
    }

    // Parse content within blockquote
    const innerContent = quoteLines.map(line => 
      line.replace(/^>\s*/, '').replace(/^>/, '')
    ).join('\n');

    // Recursively parse the inner content
    const innerElements = this.parseContent(innerContent).elements;

    const content = quoteLines.join('\n');
    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: quoteLines[quoteLines.length - 1]?.length || 0
    };

    const blockquote: MarkdownBlockquote = {
      type: 'blockquote',
      rawContent: content,
      position,
      content: innerElements,
      level
    };

    return { element: blockquote as unknown as MarkdownElement, nextLine: currentLine };
  }

  /**
   * Parse a callout element (Obsidian-specific)
   */
  private parseCallout(lines: string[], startLine: number): { element: MarkdownElement; nextLine: number } {
    const firstLine = lines[startLine];
    const calloutMatch = firstLine.match(/^>\s*\[!(\w+)\]([+-]?)\s*(.*)?$/);
    
    if (!calloutMatch) {
      // Fallback to blockquote
      return this.parseBlockquote(lines, startLine);
    }

    const calloutType = calloutMatch[1].toLowerCase() as any;
    const foldable = calloutMatch[2] === '+' || calloutMatch[2] === '-';
    const folded = calloutMatch[2] === '-';
    const title = calloutMatch[3] || undefined;

    const calloutLines: string[] = [firstLine];
    let currentLine = startLine + 1;

    // Collect callout content
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      const trimmed = line.trim();

      if (!trimmed.startsWith('>')) {
        break;
      }

      calloutLines.push(line);
      currentLine++;
    }

    // Parse inner content
    const innerContent = calloutLines.slice(1).map(line => 
      line.replace(/^>\s*/, '').replace(/^>/, '')
    ).join('\n');

    const innerElements = innerContent.trim() ? this.parseContent(innerContent).elements : [];

    const content = calloutLines.join('\n');
    const position: ContentPosition = {
      startLine: startLine + 1,
      endLine: currentLine,
      startChar: 0,
      endChar: calloutLines[calloutLines.length - 1]?.length || 0
    };

    const callout: MarkdownCallout = {
      type: 'callout',
      rawContent: content,
      position,
      calloutType,
      title,
      foldable,
      folded,
      content: innerElements
    };

    return { element: callout as unknown as MarkdownElement, nextLine: currentLine };
  }

  /**
   * Parse inline elements within text
   */
  private parseInlineElements(text: string): InlineElement[] {
    const elements: InlineElement[] = [];

    // This is a simplified inline parser - in a full implementation,
    // you'd want a more sophisticated parser that handles nested elements
    
    // For now, we'll extract basic elements as simple text
    // TODO: Implement proper inline parsing for links, bold, italic, etc.
    
    // Simple text fallback for now
    elements.push({
      type: 'text',
      content: text
    } as InlineText);

    return elements;
  }

  /**
   * Extract tags from text content
   */
  private extractTagsFromText(text: string): string[] {
    const tagPattern = /#[\w-]+/g;
    const matches = text.match(tagPattern);
    return matches || [];
  }

  /**
   * Check if a line is a list item
   */
  private isListItem(line: string): boolean {
    return /^([-*+]|\d+\.)\s/.test(line.trim()) || 
           /^[-*+]\s*\[[ x]\]/.test(line.trim());
  }

  /**
   * Check if a line is a table row
   */
  private isTableRow(line: string): boolean {
    return line.includes('|') && line.trim().length > 0;
  }

  /**
   * Get indentation level of a line
   */
  private getIndentationLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Parse a table row into cells
   */
  private parseTableRow(line: string): string[] {
    return line.split('|')
      .map(cell => cell.trim())
      .filter((cell, index, array) => {
        // Remove empty cells at start/end (from leading/trailing |)
        return !(cell === '' && (index === 0 || index === array.length - 1));
      });
  }

  /**
   * Parse table alignment from separator row
   */
  private parseTableAlignment(line: string): ('left' | 'center' | 'right' | 'none')[] {
    const cells = this.parseTableRow(line);
    return cells.map(cell => {
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      if (cell.endsWith(':')) return 'right';
      if (cell.startsWith(':')) return 'left';
      return 'none';
    });
  }

  /**
   * Generate document metadata
   */
  private generateDocumentMetadata(content: string, elements: MarkdownElement[], file?: TFile): DocumentMetadata {
    const words = content.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const characterCount = content.length;
    
    // Count different element types
    const headingCount = elements.filter(e => e.type === 'heading').length;
    const linkCount = elements.filter(e => e.type === 'link').length;
    const codeBlockCount = elements.filter(e => e.type === 'codeblock').length;
    const tableCount = elements.filter(e => e.type === 'table').length;
    const listCount = elements.filter(e => e.type === 'list').length;
    const imageCount = elements.filter(e => e.type === 'image').length;
    const calloutCount = elements.filter(e => e.type === 'callout').length;

    // Extract all tags
    const allTags = new Set<string>();
    elements.forEach(element => {
      if ('tags' in element && Array.isArray((element as any).tags)) {
        ((element as any).tags as string[]).forEach((tag: string) => allTags.add(tag));
      }
    });

    // Find privacy tags
    const privacyTagsFound = Array.from(allTags).filter(tag => 
      this.config.privacyTags.includes(tag)
    );

    // Check for privacy markers
    const hasPrivacyMarkers = elements.some(element => 
      element.type === 'comment' && (element as MarkdownComment).isPrivacyMarker
    );

    // Estimate reading time (average 200 words per minute)
    const estimatedReadingTime = Math.ceil(wordCount / 200);

    return {
      filePath: file?.path || '',
      fileName: file?.name || '',
      fileSize: file?.stat.size || content.length,
      lastModified: file?.stat.mtime ? new Date(file.stat.mtime) : new Date(),
      wordCount,
      characterCount,
      headingCount,
      linkCount,
      tagCount: allTags.size,
      codeBlockCount,
      tableCount,
      listCount,
      imageCount,
      calloutCount,
      privacyTagsFound,
      hasPrivacyMarkers,
      estimatedReadingTime
    };
  }
} 