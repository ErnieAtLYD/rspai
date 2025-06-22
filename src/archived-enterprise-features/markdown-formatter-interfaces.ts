// src/markdown-formatter-interfaces.ts
// Markdown Formatting and Customization Interfaces
// Comprehensive type definitions for formatting generated summaries into markdown and other formats

import {
	GeneratedSummary,
	Insight,
	TrendAnalysis,
	SummaryMetric,
} from "./summary-generation-interfaces";
import { GeneratedRecommendation } from "./recommendation-generation-interfaces";

// Core formatting types
export type MarkdownElementType =
	| "heading"
	| "paragraph"
	| "list"
	| "table"
	| "blockquote"
	| "code-block"
	| "horizontal-rule"
	| "emphasis"
	| "strong"
	| "link"
	| "image"
	| "callout";

export type ListType = "ordered" | "unordered" | "task";
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type TableAlignment = "left" | "center" | "right";
export type CalloutType =
	| "note"
	| "tip"
	| "warning"
	| "error"
	| "success"
	| "info"
	| "quote";

// Export format types
export type ExportFormat =
	| "markdown"
	| "html"
	| "pdf"
	| "docx"
	| "plain-text"
	| "json";

// User customization preferences
export interface MarkdownFormattingPreferences {
	// Structure preferences
	useHeadings: boolean;
	maxHeadingLevel: HeadingLevel;
	includeTableOfContents: boolean;
	includeMetadata: boolean;

	// Content preferences
	summaryLength: "brief" | "standard" | "detailed" | "comprehensive";
	detailLevel: "minimal" | "standard" | "verbose";
	includeEvidence: boolean;
	includeRecommendations: boolean;
	includeTrends: boolean;
	includeMetrics: boolean;

	// Formatting style
	useCallouts: boolean;
	useEmphasis: boolean;
	useTables: boolean;
	useTaskLists: boolean;
	bulletStyle: "-" | "*" | "+";
	numberedListStyle: "1." | "1)" | "(1)";

	// Section inclusion
	includedSections: SectionType[];
	sectionOrder: SectionType[];
	customSections: CustomSection[];

	// Visual preferences
	useHorizontalRules: boolean;
	includeTimestamps: boolean;
	includeWordCount: boolean;
	includeReadingTime: boolean;

	// Export preferences
	preferredExportFormat: ExportFormat;
	includeSourceLinks: boolean;
	includeFootnotes: boolean;

	// Styling preferences
	styles?: MarkdownStyles;
}

export type SectionType =
	| "executive-summary"
	| "key-insights"
	| "recommendations"
	| "trends"
	| "metrics"
	| "evidence"
	| "timeline"
	| "conclusion"
	| "appendix"
	| "custom";

export interface CustomSection {
	id: string;
	title: string;
	content: string;
	position: number;
	enabled: boolean;
}

// Markdown generation configuration
export interface MarkdownGenerationConfig {
	preferences: MarkdownFormattingPreferences;
	templateId?: string;
	customTemplate?: MarkdownTemplate;

	// Processing options
	enablePreview: boolean;
	enableValidation: boolean;
	enableOptimization: boolean;

	// Output options
	outputPath?: string;
	filename?: string;
	includeMetadata: boolean;

	// Performance options
	maxContentLength: number;
	enableCaching: boolean;
	cacheTimeout: number;
}

// Markdown template system
export interface MarkdownTemplate {
	id: string;
	name: string;
	description: string;

	// Template structure
	sections: TemplateSection[];
	header?: string;
	footer?: string;

	// Styling
	styles: MarkdownStyles;

	// Metadata
	category: "personal" | "business" | "academic" | "technical" | "creative";
	tags: string[];
	version: string;
	author?: string;

	// Usage
	isDefault: boolean;
	isCustom: boolean;
	usageCount: number;
	lastUsed?: Date;
}

export interface TemplateSection {
	id: string;
	title: string;
	type: SectionType;

	// Content configuration
	contentTypes: ContentType[];
	maxItems?: number;
	minItems?: number;

	// Formatting
	headingLevel: HeadingLevel;
	useCallout?: boolean;
	calloutType?: CalloutType;

	// Conditional inclusion
	required: boolean;
	condition?: string;

	// Ordering
	order: number;
	subSections?: TemplateSection[];
}

export type ContentType =
	| "insights"
	| "recommendations"
	| "trends"
	| "metrics"
	| "evidence"
	| "timeline"
	| "summary"
	| "custom-text";

export interface MarkdownStyles {
	// Typography
	headingStyle: "atx" | "setext"; // # vs underline
	emphasisStyle: "*" | "_";
	strongStyle: "**" | "__";

	// Lists
	unorderedListMarker: "-" | "*" | "+";
	orderedListStyle: "1." | "1)" | "(1)";
	taskListStyle: "- [ ]" | "* [ ]" | "+ [ ]";

	// Tables
	tableAlignment: TableAlignment;
	includeTableHeaders: boolean;
	tableStyle: "simple" | "grid" | "pipe";

	// Code and quotes
	codeBlockLanguage: string;
	blockquoteStyle: ">" | "> ";

	// Spacing
	sectionSpacing: number; // Number of blank lines between sections
	paragraphSpacing: number;
	listItemSpacing: number;

	// Links and references
	linkStyle: "inline" | "reference";
	includeBacklinks: boolean;

	// Callouts (Obsidian-specific)
	calloutStyle: "obsidian" | "github" | "custom";
	customCalloutPrefix?: string;
}

// Markdown generation interfaces
export interface MarkdownElement {
	type: MarkdownElementType;
	content: string;
	metadata?: Record<string, unknown>;
	children?: MarkdownElement[];
}

export interface MarkdownHeading extends MarkdownElement {
	type: "heading";
	level: HeadingLevel;
	anchor?: string;
}

export interface MarkdownList extends MarkdownElement {
	type: "list";
	listType: ListType;
	items: MarkdownListItem[];
	ordered?: boolean;
	startNumber?: number;
}

export interface MarkdownListItem {
	content: string;
	checked?: boolean; // For task lists
	children?: MarkdownListItem[];
	level: number;
}

export interface MarkdownTable extends MarkdownElement {
	type: "table";
	headers: string[];
	rows: string[][];
	alignment?: TableAlignment[];
	caption?: string;
}

export interface MarkdownCallout extends MarkdownElement {
	type: "callout";
	calloutType: CalloutType;
	title?: string;
	foldable?: boolean;
	folded?: boolean;
}

export interface MarkdownLink {
	text: string;
	url: string;
	title?: string;
	isInternal?: boolean;
}

// Generation result interfaces
export interface MarkdownGenerationResult {
	content: string;
	metadata: MarkdownMetadata;
	elements: MarkdownElement[];

	// Quality metrics
	wordCount: number;
	readingTime: number; // in minutes
	complexity: number; // 0-1 scale

	// Validation results
	isValid: boolean;
	warnings: string[];
	errors: string[];

	// Performance metrics
	generationTime: number;
	cacheHit: boolean;

	// Export options
	availableFormats: ExportFormat[];
	exportResults?: Record<ExportFormat, ExportResult>;
}

export interface MarkdownMetadata {
	title: string;
	generatedAt: Date;
	templateUsed: string;

	// Content statistics
	sectionCount: number;
	insightCount: number;
	recommendationCount: number;
	evidenceCount: number;

	// Source information
	sourceFiles: string[];
	dateRange: {
		start: Date;
		end: Date;
	};

	// Processing information
	processingTime: number;
	aiTokensUsed?: number;

	// User information
	preferences: MarkdownFormattingPreferences;
	customizations: string[];
}

export interface ExportResult {
	format: ExportFormat;
	content: string | Buffer;
	filename: string;
	size: number;
	success: boolean;
	error?: string;
	metadata?: Record<string, unknown>;
}

// Preview system interfaces
export interface PreviewOptions {
	enableLivePreview: boolean;
	previewFormat: ExportFormat;
	highlightChanges: boolean;
	showMetadata: boolean;
	showWordCount: boolean;
	enableScrollSync: boolean;
}

export interface PreviewResult {
	content: string;
	format: ExportFormat;
	metadata: MarkdownMetadata;

	// Preview-specific data
	changes: PreviewChange[];
	lastUpdated: Date;
	isLive: boolean;
}

export interface PreviewChange {
	type: "added" | "removed" | "modified";
	section: string;
	content: string;
	timestamp: Date;
}

// Main formatter interface
export interface MarkdownFormatter {
	// Core formatting methods
	formatSummary(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig
	): Promise<MarkdownGenerationResult>;

	formatInsights(
		insights: Insight[],
		config: MarkdownGenerationConfig
	): Promise<string>;

	formatRecommendations(
		recommendations: GeneratedRecommendation[],
		config: MarkdownGenerationConfig
	): Promise<string>;

	formatTrends(
		trends: TrendAnalysis[],
		config: MarkdownGenerationConfig
	): Promise<string>;

	formatMetrics(
		metrics: SummaryMetric[],
		config: MarkdownGenerationConfig
	): Promise<string>;

	// Element formatting methods
	formatHeading(
		text: string,
		level: HeadingLevel,
		styles: MarkdownStyles
	): string;
	formatList(items: string[], type: ListType, styles: MarkdownStyles): string;
	formatTable(
		headers: string[],
		rows: string[][],
		styles: MarkdownStyles
	): string;
	formatCallout(content: string, type: CalloutType, title?: string): string;
	formatLink(text: string, url: string, title?: string): string;

	// Template methods
	applyTemplate(content: string, template: MarkdownTemplate): Promise<string>;
	validateTemplate(template: MarkdownTemplate): ValidationResult;

	// Export methods
	exportToFormat(
		content: string,
		format: ExportFormat,
		options?: ExportOptions
	): Promise<ExportResult>;

	// Preview methods
	generatePreview(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig,
		options: PreviewOptions
	): Promise<PreviewResult>;

	// Utility methods
	calculateReadingTime(content: string): number;
	calculateComplexity(content: string): number;
	validateMarkdown(content: string): ValidationResult;
	optimizeContent(
		content: string,
		preferences: MarkdownFormattingPreferences
	): string;

	// Configuration methods
	updatePreferences(
		preferences: Partial<MarkdownFormattingPreferences>
	): void;
	getPreferences(): MarkdownFormattingPreferences;
	resetToDefaults(): void;
}

export interface ExportOptions {
	filename?: string;
	includeMetadata?: boolean;
	includeStyles?: boolean;
	compression?: boolean;
	quality?: number; // For image formats
	pageSize?: "A4" | "Letter" | "Legal"; // For PDF
	margins?: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
}

export interface ValidationResult {
	isValid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
	suggestions: string[];
}

export interface ValidationError {
	type: "syntax" | "structure" | "content" | "formatting";
	message: string;
	line?: number;
	column?: number;
	severity: "error" | "warning" | "info";
}

export interface ValidationWarning {
	type:
		| "style"
		| "accessibility"
		| "performance"
		| "compatibility"
		| "syntax"
		| "structure";
	message: string;
	suggestion?: string;
}

// Factory and utility interfaces
export interface MarkdownFormatterFactory {
	createPersonalFormatter(): MarkdownFormatter;
	createBusinessFormatter(): MarkdownFormatter;
	createAcademicFormatter(): MarkdownFormatter;
	createTechnicalFormatter(): MarkdownFormatter;
	createCustomFormatter(config: MarkdownGenerationConfig): MarkdownFormatter;
}

export interface MarkdownTemplateLibrary {
	// Template management
	getTemplate(id: string): MarkdownTemplate | null;
	getAllTemplates(): MarkdownTemplate[];
	getTemplatesByCategory(category: string): MarkdownTemplate[];

	// Template operations
	addTemplate(template: MarkdownTemplate): void;
	updateTemplate(id: string, template: Partial<MarkdownTemplate>): boolean;
	removeTemplate(id: string): boolean;

	// Template utilities
	duplicateTemplate(id: string, newName: string): MarkdownTemplate | null;
	validateTemplate(template: MarkdownTemplate): ValidationResult;
	getDefaultTemplate(): MarkdownTemplate;

	// Import/export
	importTemplates(templates: MarkdownTemplate[]): ImportResult;
	exportTemplates(ids?: string[]): MarkdownTemplate[];
}

export interface ImportResult {
	imported: number;
	skipped: number;
	errors: string[];
	warnings: string[];
}

// Analytics and metrics
export interface MarkdownFormattingAnalytics {
	// Usage statistics
	totalFormattingOperations: number;
	averageFormattingTime: number;
	mostUsedTemplates: string[];
	mostUsedFormats: ExportFormat[];

	// Content statistics
	averageWordCount: number;
	averageReadingTime: number;
	averageComplexity: number;

	// User preferences
	preferenceDistribution: Record<string, number>;
	customizationUsage: Record<string, number>;

	// Performance metrics
	cacheHitRate: number;
	averageExportTime: Record<ExportFormat, number>;
	errorRate: number;

	// Quality metrics
	validationPassRate: number;
	averageWarningCount: number;
	userSatisfactionScore?: number;
}


