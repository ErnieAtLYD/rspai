/**
 * Comprehensive TypeScript interfaces for Markdown content parsing
 * Supports all content types found in Obsidian notes including frontmatter,
 * headings, lists, tables, code blocks, callouts, and more.
 */

/**
 * YAML frontmatter data structure
 */
export interface FrontmatterData {
  [key: string]: string | number | boolean | string[] | number[] | Date | null;
}

/**
 * Position information for content elements
 */
export interface ContentPosition {
  startLine: number;
  endLine: number;
  startChar: number;
  endChar: number;
}

/**
 * Base interface for all markdown content elements
 */
export interface MarkdownElement {
  type: string;
  content: string;
  position: ContentPosition;
  metadata?: Record<string, unknown>;
}

/**
 * Heading levels and content
 */
export interface MarkdownHeading extends MarkdownElement {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  tags: string[];
  id?: string; // For heading IDs
}

/**
 * Paragraph content with inline formatting
 */
export interface MarkdownParagraph extends MarkdownElement {
  type: 'paragraph';
  text: string;
  inlineElements: InlineElement[];
  tags: string[];
}

/**
 * List items and structure
 */
export interface MarkdownList extends MarkdownElement {
  type: 'list';
  listType: 'ordered' | 'unordered' | 'task';
  items: ListItem[];
  level: number;
}

export interface ListItem {
  content: string;
  checked?: boolean; // For task lists
  level: number;
  tags: string[];
  subItems?: ListItem[];
  inlineElements: InlineElement[];
}

/**
 * Code blocks with language and content
 */
export interface MarkdownCodeBlock extends MarkdownElement {
  type: 'codeblock';
  language: string;
  code: string;
  filename?: string;
  lineNumbers?: boolean;
}

/**
 * Inline code spans
 */
export interface MarkdownInlineCode extends MarkdownElement {
  type: 'inlinecode';
  code: string;
}

/**
 * Tables with headers and data
 */
export interface MarkdownTable extends MarkdownElement {
  type: 'table';
  headers: string[];
  rows: string[][];
  alignment: ('left' | 'center' | 'right' | 'none')[];
}

/**
 * Obsidian-specific callouts
 */
export interface MarkdownCallout extends Omit<MarkdownElement, 'content'> {
  type: 'callout';
  calloutType: 'note' | 'tip' | 'info' | 'warning' | 'danger' | 'abstract' | 'todo' | 'success' | 'question' | 'failure' | 'bug' | 'example' | 'quote';
  title?: string;
  foldable?: boolean;
  folded?: boolean;
  content: MarkdownElement[];
  rawContent: string; // Original string content
}

/**
 * Blockquotes
 */
export interface MarkdownBlockquote extends Omit<MarkdownElement, 'content'> {
  type: 'blockquote';
  content: MarkdownElement[];
  rawContent: string; // Original string content
  level: number;
}

/**
 * Horizontal rules/dividers
 */
export interface MarkdownHorizontalRule extends MarkdownElement {
  type: 'horizontalrule';
}

/**
 * HTML comments (including privacy markers)
 */
export interface MarkdownComment extends MarkdownElement {
  type: 'comment';
  commentText: string;
  isPrivacyMarker: boolean;
  privacyTag?: string;
  markerType?: 'start' | 'end';
}

/**
 * Inline elements within paragraphs and list items
 */
export type InlineElement = 
  | InlineText
  | InlineLink
  | InlineImage
  | InlineCode
  | InlineBold
  | InlineItalic
  | InlineStrikethrough
  | InlineHighlight
  | InlineTag
  | InlineWikiLink;

export interface InlineText {
  type: 'text';
  content: string;
}

export interface InlineLink {
  type: 'link';
  text: string;
  url: string;
  title?: string;
}

export interface InlineImage {
  type: 'image';
  alt: string;
  src: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface InlineCode {
  type: 'inlinecode';
  code: string;
}

export interface InlineBold {
  type: 'bold';
  content: InlineElement[];
}

export interface InlineItalic {
  type: 'italic';
  content: InlineElement[];
}

export interface InlineStrikethrough {
  type: 'strikethrough';
  content: InlineElement[];
}

export interface InlineHighlight {
  type: 'highlight';
  content: InlineElement[];
}

export interface InlineTag {
  type: 'tag';
  tag: string;
}

export interface InlineWikiLink {
  type: 'wikilink';
  target: string;
  display?: string;
  isEmbed?: boolean;
}

/**
 * Complete parsed markdown document
 */
export interface ParsedMarkdown {
  frontmatter?: FrontmatterData;
  elements: MarkdownElement[];
  metadata: DocumentMetadata;
}

/**
 * Document-level metadata
 */
export interface DocumentMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  lastModified: Date;
  wordCount: number;
  characterCount: number;
  headingCount: number;
  linkCount: number;
  tagCount: number;
  codeBlockCount: number;
  tableCount: number;
  listCount: number;
  imageCount: number;
  calloutCount: number;
  privacyTagsFound: string[];
  hasPrivacyMarkers: boolean;
  estimatedReadingTime: number; // in minutes
}

/**
 * Parsing configuration options
 */
export interface MarkdownParseConfig {
  // Content parsing options
  parseFrontmatter: boolean;
  parseInlineElements: boolean;
  preserveWhitespace: boolean;
  
  // Obsidian-specific features
  parseCallouts: boolean;
  parseWikiLinks: boolean;
  parseTags: boolean;
  
  // Privacy and filtering
  detectPrivacyMarkers: boolean;
  privacyTags: string[];
  
  // Performance options
  maxFileSize: number; // in bytes
  enableCaching: boolean;
  
  // Output options
  includePositions: boolean;
  includeMetadata: boolean;
  generateWordCount: boolean;
}

/**
 * Default parsing configuration
 */
export const DEFAULT_PARSE_CONFIG: MarkdownParseConfig = {
  parseFrontmatter: true,
  parseInlineElements: true,
  preserveWhitespace: false,
  parseCallouts: true,
  parseWikiLinks: true,
  parseTags: true,
  detectPrivacyMarkers: true,
  privacyTags: ['#private', '#confidential', '#noai'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  enableCaching: true,
  includePositions: true,
  includeMetadata: true,
  generateWordCount: true
};

/**
 * Parsing result with success/error information
 */
export interface ParseResult {
  success: boolean;
  data?: ParsedMarkdown;
  error?: ParseError;
  warnings: string[];
  processingTime: number; // in milliseconds
}

/**
 * Parsing error information
 */
export interface ParseError {
  code: string;
  message: string;
  line?: number;
  column?: number;
  context?: string;
}

/**
 * Content extraction options for different analysis types
 */
export interface ContentExtractionOptions {
  // What content to extract
  includeHeadings: boolean;
  includeParagraphs: boolean;
  includeLists: boolean;
  includeCodeBlocks: boolean;
  includeTables: boolean;
  includeCallouts: boolean;
  includeComments: boolean;
  
  // Content filtering
  excludePrivateContent: boolean;
  minWordCount: number;
  maxWordCount: number;
  
  // Output format
  preserveStructure: boolean;
  flattenContent: boolean;
  includeMetadata: boolean;
}

/**
 * Extracted content for AI analysis
 */
export interface ExtractedContent {
  text: string;
  structure: ContentStructure;
  metadata: ContentMetadata;
  privacy: PrivacyAnalysis;
}

/**
 * Document structure analysis
 */
export interface ContentStructure {
  headingHierarchy: HeadingNode[];
  sections: ContentSection[];
  lists: ListStructure[];
  codeBlocks: CodeBlockInfo[];
  tables: TableInfo[];
  callouts: CalloutInfo[];
}

export interface HeadingNode {
  level: number;
  text: string;
  id?: string;
  children: HeadingNode[];
  contentLength: number;
  tags: string[];
}

export interface ContentSection {
  heading?: string;
  headingLevel?: number;
  content: string;
  wordCount: number;
  tags: string[];
  hasPrivacyMarkers: boolean;
}

export interface ListStructure {
  type: 'ordered' | 'unordered' | 'task';
  itemCount: number;
  maxDepth: number;
  completedTasks?: number;
  totalTasks?: number;
}

export interface CodeBlockInfo {
  language: string;
  lineCount: number;
  characterCount: number;
}

export interface TableInfo {
  columnCount: number;
  rowCount: number;
  hasHeaders: boolean;
}

export interface CalloutInfo {
  type: string;
  title?: string;
  wordCount: number;
}

/**
 * Content metadata for analysis
 */
export interface ContentMetadata {
  totalWords: number;
  totalCharacters: number;
  readingTime: number;
  complexity: ContentComplexity;
  topics: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  language?: string;
}

export interface ContentComplexity {
  score: number; // 1-10
  factors: {
    vocabularyComplexity: number;
    sentenceLength: number;
    structuralComplexity: number;
    technicalContent: number;
  };
}

/**
 * Privacy analysis results
 */
export interface PrivacyAnalysis {
  hasPrivateContent: boolean;
  privacyTags: string[];
  privateContentPercentage: number;
  redactedSections: number;
  excludedContent: string[];
  privacyScore: number; // 1-10, higher = more private
}

/**
 * Cache entry for parsed content
 */
export interface ParsedContentCache {
  filePath: string;
  lastModified: number;
  contentHash: string;
  parsedContent: ParsedMarkdown;
  extractedContent?: ExtractedContent;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Parser performance metrics
 */
export interface ParserMetrics {
  totalFilesProcessed: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  largestFileProcessed: number;
  memoryUsage: number;
} 