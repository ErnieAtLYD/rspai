import { App, TFile } from "obsidian";
import { Logger } from "./logger";
import { ErrorHandler } from "./error-handler";
import { PrivacyFilter } from "./privacy-filter";
import { MarkdownParser } from "./markdown-parser";
import { ObsidianFeaturesHandler } from "./obsidian-features";
import {
	MetadataExtractor,
	NormalizedMetadata,
	ReferenceGraph,
} from "./metadata-extractor";
import { ParsedMarkdown } from "./markdown-interfaces";

/**
 * Configuration for the markdown processing service
 */
export interface MarkdownProcessingConfig {
	// Privacy settings
	enablePrivacyFilter: boolean;
	privacyTags: string[];

	// Processing settings
	enableMetadataExtraction: boolean;
	enableObsidianFeatures: boolean;
	enableReferenceGraph: boolean;

	// Performance settings
	enableCaching: boolean;
	maxFileSize: number; // in bytes
	batchSize: number;

	// Content processing
	enableSectionDetection: boolean;
	enableContentNormalization: boolean;

	// Profiling settings
	enableProfiling: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PROCESSING_CONFIG: MarkdownProcessingConfig = {
	enablePrivacyFilter: true,
	privacyTags: ["private-ai", "confidential-ai", "no-ai"],
	enableMetadataExtraction: true,
	enableObsidianFeatures: true,
	enableReferenceGraph: true,
	enableCaching: true,
	maxFileSize: 10 * 1024 * 1024, // 10MB
	batchSize: 50,
	enableSectionDetection: true,
	enableContentNormalization: true,
	enableProfiling: false,
};

/**
 * Result of processing a single file
 */
export interface ProcessingResult {
	success: boolean;
	filePath: string;
	parsedContent?: ParsedMarkdown;
	metadata?: NormalizedMetadata;
	sections?: DocumentSection[];
	errors: ProcessingError[];
	warnings: string[];
	processingTime: number;
	skipped: boolean;
	skipReason?: string;
}

/**
 * Result of batch processing
 */
export interface BatchProcessingResult {
	results: ProcessingResult[];
	referenceGraph?: ReferenceGraph;
	summary: {
		totalFiles: number;
		successfulFiles: number;
		skippedFiles: number;
		failedFiles: number;
		totalProcessingTime: number;
		averageProcessingTime: number;
	};
	errors: ProcessingError[];
}

/**
 * Processing error with context
 */
export interface ProcessingError {
	code: string;
	message: string;
	filePath?: string;
	component:
		| "parser"
		| "metadata"
		| "privacy"
		| "features"
		| "sections"
		| "service";
	severity: "error" | "warning" | "info";
	details?: unknown;
	timestamp: Date;
}

/**
 * Document section with categorization
 */
export interface DocumentSection {
	id: string;
	title: string;
	level: number;
	content: string;
	normalizedContent: string;
	category: SectionCategory;
	tags: string[];
	wordCount: number;
	position: {
		startLine: number;
		endLine: number;
		startChar: number;
		endChar: number;
	};
	subsections: DocumentSection[];
	metadata: {
		hasCode: boolean;
		hasLinks: boolean;
		hasTags: boolean;
		hasObsidianFeatures: boolean;
		complexity: number; // 0-1 scale
	};
}

/**
 * Section categories for content analysis
 */
export type SectionCategory =
	| "introduction"
	| "summary"
	| "analysis"
	| "conclusion"
	| "methodology"
	| "results"
	| "discussion"
	| "references"
	| "appendix"
	| "todo"
	| "notes"
	| "code"
	| "data"
	| "other";

/**
 * Comprehensive markdown processing service that integrates all components
 */
export class MarkdownProcessingService {
	private config: MarkdownProcessingConfig;
	private privacyFilter: PrivacyFilter;
	private markdownParser: MarkdownParser;
	private obsidianHandler: ObsidianFeaturesHandler;
	private metadataExtractor: MetadataExtractor;
	private processingCache: Map<string, ProcessingResult> = new Map();
	private fileObjectCache: WeakMap<TFile, ProcessingResult> = new WeakMap();

	constructor(
		private app: App,
		private logger: Logger,
		private errorHandler: ErrorHandler,
		config: Partial<MarkdownProcessingConfig> = {}
	) {
		this.config = { ...DEFAULT_PROCESSING_CONFIG, ...config };
		this.initializeComponents();
	}

	/**
	 * Initialize all processing components
	 */
	private initializeComponents(): void {
		try {
			// Initialize privacy filter
			this.privacyFilter = new PrivacyFilter(this.logger, {
				exclusionTags: this.config.privacyTags,
			});

			// Initialize markdown parser
			this.markdownParser = new MarkdownParser(
				this.app,
				this.logger,
				{},
				this.config.enablePrivacyFilter ? this.privacyFilter : undefined
			);

			// Initialize Obsidian features handler
			this.obsidianHandler = new ObsidianFeaturesHandler(this.logger);

			// Initialize metadata extractor
			this.metadataExtractor = new MetadataExtractor(
				this.logger,
				this.markdownParser,
				this.obsidianHandler,
				this.config.enablePrivacyFilter ? this.privacyFilter : undefined
			);

			this.logger.info(
				"Markdown processing service initialized successfully"
			);
		} catch (error) {
			this.logger.error(
				"Failed to initialize markdown processing service",
				error
			);
			throw error;
		}
	}

	/**
	 * Process a single markdown file
	 */
	async processFile(filePath: string): Promise<ProcessingResult> {
		const startTime = Date.now();
		const profileKey = `processFile:${filePath.split("/").pop()}`;

		// Start performance profiling
		if (this.config.enableProfiling) {
			console.time(profileKey);
		}

		const result: ProcessingResult = {
			success: false,
			filePath,
			errors: [],
			warnings: [],
			processingTime: 0,
			skipped: false,
		};

		try {
			// Check cache first (string-based cache for file paths)
			if (
				this.config.enableCaching &&
				this.processingCache.has(filePath)
			) {
				const cached = this.processingCache.get(filePath);
				if (cached) {
					this.logger.debug(`Using cached result for ${filePath}`);
					if (this.config.enableProfiling) {
						console.timeEnd(profileKey);
					}
					return cached;
				}
			}

			// Try WeakMap cache for TFile objects
			const file = this.app.vault.getAbstractFileByPath(
				filePath
			) as TFile;
			if (file && this.fileObjectCache.has(file)) {
				const cached = this.fileObjectCache.get(file);
				if (cached) {
					this.logger.debug(
						`Using WeakMap cached result for ${filePath}`
					);
					if (this.config.enableProfiling) {
						console.timeEnd(profileKey);
					}
					return cached;
				}
			}

			// Check file size limit
			if (file?.stat.size && file.stat.size > this.config.maxFileSize) {
				result.skipped = true;
				result.skipReason = `File size (${file.stat.size} bytes) exceeds limit (${this.config.maxFileSize} bytes)`;
				this.logger.debug(`Skipping ${filePath}: ${result.skipReason}`);
				if (this.config.enableProfiling) {
					console.timeEnd(profileKey);
				}
				return result;
			}

			// Read file content
			let content: string;
			try {
				if (this.config.enableProfiling) {
					console.time(`${profileKey}:fileRead`);
				}
				content = await this.app.vault.read(file);
				if (this.config.enableProfiling) {
					console.timeEnd(`${profileKey}:fileRead`);
				}
			} catch (error) {
				result.errors.push({
					code: "FILE_READ_ERROR",
					message: "Failed to read file",
					filePath,
					component: "service",
					severity: "error",
					details: error,
					timestamp: new Date(),
				});
				if (this.config.enableProfiling) {
					console.timeEnd(profileKey);
				}
				return result;
			}

			// Apply privacy filter
			if (this.config.enablePrivacyFilter) {
				try {
					const shouldExclude = this.privacyFilter.shouldExcludeFile(
						filePath,
						content
					);
					if (shouldExclude) {
						result.skipped = true;
						result.skipReason = "File excluded by privacy filter";
						this.logger.debug(
							`Skipping ${filePath}: ${result.skipReason}`
						);
						if (this.config.enableProfiling) {
							console.timeEnd(profileKey);
						}
						return result;
					}

					// Filter content
					content = this.privacyFilter.filterContent(content);
				} catch (error) {
					result.warnings.push(`Privacy filtering failed: ${error}`);
				}
			}

			// Parse markdown
			try {
				const parseResult = await this.markdownParser.parseFile(file);
				if (!parseResult.success || !parseResult.data) {
					result.errors.push({
						code: "PARSING_FAILED",
						message: "Failed to parse markdown",
						filePath,
						component: "parser",
						severity: "error",
						details: parseResult.error,
						timestamp: new Date(),
					});
					if (this.config.enableProfiling) {
						console.timeEnd(profileKey);
					}
					return result;
				}
				result.parsedContent = parseResult.data;
			} catch (error) {
				result.errors.push({
					code: "PARSING_FAILED",
					message: "Failed to parse markdown",
					filePath,
					component: "parser",
					severity: "error",
					details: error,
					timestamp: new Date(),
				});
				if (this.config.enableProfiling) {
					console.timeEnd(profileKey);
				}
				return result;
			}

			// Extract metadata
			if (this.config.enableMetadataExtraction) {
				try {
					result.metadata =
						await this.metadataExtractor.extractMetadata(
							filePath,
							content,
							{
								size: file.stat.size,
								mtime: new Date(file.stat.mtime),
								ctime: new Date(file.stat.ctime),
							}
						);
				} catch (error) {
					result.errors.push({
						code: "METADATA_EXTRACTION_FAILED",
						message: "Failed to extract metadata",
						filePath,
						component: "metadata",
						severity: "warning",
						details: error,
						timestamp: new Date(),
					});
				}
			}

			// Detect sections
			if (this.config.enableSectionDetection && result.parsedContent) {
				try {
					result.sections = await this.detectSections(
						result.parsedContent,
						content
					);
				} catch (error) {
					result.errors.push({
						code: "SECTION_DETECTION_FAILED",
						message: "Failed to detect sections",
						filePath,
						component: "sections",
						severity: "warning",
						details: error,
						timestamp: new Date(),
					});
				}
			}

			result.success = true;
			result.processingTime = Date.now() - startTime;

			// Cache result in both caches
			if (this.config.enableCaching) {
				this.processingCache.set(filePath, result);
				if (file) {
					this.fileObjectCache.set(file, result);
				}
			}

			this.logger.debug(
				`Successfully processed ${filePath} in ${result.processingTime}ms`
			);
			if (this.config.enableProfiling) {
				console.timeEnd(profileKey);
			}
			return result;
		} catch (error) {
			result.errors.push({
				code: "PROCESSING_FAILED",
				message: "Unexpected error during processing",
				filePath,
				component: "service",
				severity: "error",
				details: error,
				timestamp: new Date(),
			});
			result.processingTime = Date.now() - startTime;
			this.logger.error(`Failed to process ${filePath}`, error);
			if (this.config.enableProfiling) {
				console.timeEnd(profileKey);
			}
			return result;
		}
	}

	/**
	 * Process multiple files in batch
	 */
	async processBatch(filePaths: string[]): Promise<BatchProcessingResult> {
		const startTime = Date.now();
		const results: ProcessingResult[] = [];
		const errors: ProcessingError[] = [];

		this.logger.info(
			`Starting batch processing of ${filePaths.length} files`
		);

		// Process files in batches
		for (let i = 0; i < filePaths.length; i += this.config.batchSize) {
			const batch = filePaths.slice(i, i + this.config.batchSize);

			const batchPromises = batch.map(async (filePath) => {
				try {
					return await this.processFile(filePath);
				} catch (error) {
					const errorResult: ProcessingResult = {
						success: false,
						filePath,
						errors: [
							{
								code: "BATCH_PROCESSING_ERROR",
								message: "Error in batch processing",
								filePath,
								component: "service",
								severity: "error",
								details: error,
								timestamp: new Date(),
							},
						],
						warnings: [],
						processingTime: 0,
						skipped: false,
					};
					return errorResult;
				}
			});

			const batchResults = await Promise.all(batchPromises);
			results.push(...batchResults);

			// Collect errors
			batchResults.forEach((result) => {
				errors.push(...result.errors);
			});

			this.logger.debug(
				`Processed batch ${
					Math.floor(i / this.config.batchSize) + 1
				}/${Math.ceil(filePaths.length / this.config.batchSize)}`
			);
		}

		// Build reference graph if enabled
		let referenceGraph: ReferenceGraph | undefined;
		if (
			this.config.enableReferenceGraph &&
			this.config.enableMetadataExtraction
		) {
			try {
				const metadataList = results
					.filter((r) => r.success && r.metadata)
					.map((r) => r.metadata as NormalizedMetadata);

				if (metadataList.length > 0) {
					const batchResult =
						await this.metadataExtractor.extractBatchMetadata(
							metadataList.map((m) => ({
								path: m.filePath,
								content: "", // Content already processed
								stats: {
									size: m.fileSize || 0,
									mtime: m.lastModified || new Date(),
									ctime: m.createdDate || new Date(),
								},
							}))
						);
					referenceGraph = batchResult.referenceGraph;
				}
			} catch (error) {
				errors.push({
					code: "REFERENCE_GRAPH_FAILED",
					message: "Failed to build reference graph",
					component: "metadata",
					severity: "warning",
					details: error,
					timestamp: new Date(),
				});
			}
		}

		const totalProcessingTime = Date.now() - startTime;
		const successfulFiles = results.filter((r) => r.success).length;
		const skippedFiles = results.filter((r) => r.skipped).length;
		const failedFiles = results.length - successfulFiles - skippedFiles;

		const summary = {
			totalFiles: results.length,
			successfulFiles,
			skippedFiles,
			failedFiles,
			totalProcessingTime,
			averageProcessingTime: totalProcessingTime / results.length,
		};

		this.logger.info(
			`Batch processing completed: ${successfulFiles}/${results.length} files processed successfully in ${totalProcessingTime}ms`
		);

		return {
			results,
			referenceGraph,
			summary,
			errors,
		};
	}

	/**
	 * Detect and categorize sections in a document
	 */
	private async detectSections(
		document: ParsedMarkdown,
		content: string
	): Promise<DocumentSection[]> {
		const sections: DocumentSection[] = [];
		const lines = content.split("\n");

		// Find all headings
		const headings = document.elements.filter(
			(el) => el.type === "heading"
		);

		for (let i = 0; i < headings.length; i++) {
			const heading = headings[i];
			const nextHeading = headings[i + 1];

			// Determine section boundaries
			const startLine = heading.position.startLine;
			const endLine = nextHeading
				? nextHeading.position.startLine - 1
				: lines.length - 1;

			// Extract section content
			const sectionLines = lines.slice(startLine, endLine + 1);
			const sectionContent = sectionLines.join("\n");

			// Create section
			const section: DocumentSection = {
				id: `section-${i}`,
				title: this.extractHeadingText(heading),
				level: (heading as unknown as { level: number }).level || 1,
				content: sectionContent,
				normalizedContent: this.normalizeContent(sectionContent),
				category: this.categorizeSection(heading, sectionContent),
				tags: this.extractSectionTags(sectionContent),
				wordCount: this.countWords(sectionContent),
				position: {
					startLine,
					endLine,
					startChar: heading.position.startChar,
					endChar: nextHeading
						? nextHeading.position.startChar - 1
						: content.length,
				},
				subsections: [],
				metadata: {
					hasCode: /```/.test(sectionContent),
					hasLinks: /\[.*?\]\(.*?\)|\[\[.*?\]\]/.test(sectionContent),
					hasTags: /#\w+/.test(sectionContent),
					hasObsidianFeatures: /!\[\[.*?\]\]|> \[!/.test(
						sectionContent
					),
					complexity: this.calculateSectionComplexity(sectionContent),
				},
			};

			sections.push(section);
		}

		// Build section hierarchy
		this.buildSectionHierarchy(sections);

		return sections;
	}

	/**
	 * Extract heading text from heading element
	 */
	private extractHeadingText(heading: { content?: string }): string {
		if (heading.content && typeof heading.content === "string") {
			return heading.content.replace(/^#+\s*/, "").trim();
		}
		return "Untitled Section";
	}

	/**
	 * Categorize a section based on its heading and content
	 */
	private categorizeSection(
		heading: { content?: string },
		content: string
	): SectionCategory {
		const title = this.extractHeadingText(heading).toLowerCase();

		// Check for common section patterns
		if (title.includes("introduction") || title.includes("intro"))
			return "introduction";
		if (title.includes("summary") || title.includes("overview"))
			return "summary";
		if (title.includes("analysis") || title.includes("analyze"))
			return "analysis";
		if (title.includes("conclusion") || title.includes("conclude"))
			return "conclusion";
		if (title.includes("method") || title.includes("approach"))
			return "methodology";
		if (title.includes("result") || title.includes("finding"))
			return "results";
		if (title.includes("discussion") || title.includes("discuss"))
			return "discussion";
		if (title.includes("reference") || title.includes("citation"))
			return "references";
		if (title.includes("appendix") || title.includes("supplement"))
			return "appendix";
		if (title.includes("todo") || title.includes("task")) return "todo";
		if (title.includes("note") || title.includes("observation"))
			return "notes";

		// Check content patterns
		if (content.includes("```") && content.split("```").length > 2)
			return "code";
		if (/\|\s*\w+\s*\|/.test(content)) return "data";

		return "other";
	}

	/**
	 * Extract tags from section content
	 */
	private extractSectionTags(content: string): string[] {
		const tagRegex = /#(\w+(?:\/\w+)*)/g;
		const tags: string[] = [];
		let match;

		while ((match = tagRegex.exec(content)) !== null) {
			tags.push(match[1]);
		}

		return [...new Set(tags)]; // Remove duplicates
	}

	/**
	 * Normalize content for analysis
	 */
	private normalizeContent(content: string): string {
		return (
			content
				// Remove markdown formatting
				.replace(/[*_`~]/g, "")
				// Remove links but keep text
				.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
				.replace(/\[\[([^\]]+)\]\]/g, "$1")
				// Remove headings markers
				.replace(/^#+\s*/gm, "")
				// Remove code blocks
				.replace(/```[\s\S]*?```/g, "")
				// Remove HTML comments
				.replace(/<!--[\s\S]*?-->/g, "")
				// Normalize whitespace
				.replace(/\s+/g, " ")
				.trim()
		);
	}

	/**
	 * Count words in content
	 */
	private countWords(content: string): number {
		return content
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
	}

	/**
	 * Calculate section complexity (0-1 scale)
	 */
	private calculateSectionComplexity(content: string): number {
		let complexity = 0;

		// Base complexity from word count
		const wordCount = this.countWords(content);
		complexity += Math.min(wordCount / 1000, 0.3); // Max 0.3 for word count

		// Add complexity for various features
		if (/```/.test(content)) complexity += 0.2; // Code blocks
		if (/\[.*?\]\(.*?\)/.test(content)) complexity += 0.1; // Links
		if (/#\w+/.test(content)) complexity += 0.1; // Tags
		if (/!\[\[.*?\]\]/.test(content)) complexity += 0.1; // Embeds
		if (/> \[!/.test(content)) complexity += 0.1; // Callouts
		if (/\|\s*\w+\s*\|/.test(content)) complexity += 0.1; // Tables

		return Math.min(complexity, 1); // Cap at 1
	}

	/**
	 * Build hierarchical structure for sections
	 */
	private buildSectionHierarchy(sections: DocumentSection[]): void {
		const stack: DocumentSection[] = [];

		for (const section of sections) {
			// Find parent section
			while (
				stack.length > 0 &&
				stack[stack.length - 1].level >= section.level
			) {
				stack.pop();
			}

			// Add as subsection if there's a parent
			if (stack.length > 0) {
				stack[stack.length - 1].subsections.push(section);
			}

			stack.push(section);
		}
	}

	/**
	 * Get processing statistics
	 */
	getStatistics(): {
		cacheSize: number;
		totalProcessedFiles: number;
		averageProcessingTime: number;
	} {
		const results = Array.from(this.processingCache.values());
		const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);

		return {
			cacheSize: this.processingCache.size,
			totalProcessedFiles: results.length,
			averageProcessingTime:
				results.length > 0 ? totalTime / results.length : 0,
		};
	}

	/**
	 * Clear processing cache
	 */
	clearCache(): void {
		this.processingCache.clear();
		this.metadataExtractor.clearCache();
		this.logger.debug("Processing cache cleared");
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<MarkdownProcessingConfig>): void {
		this.config = { ...this.config, ...config };
		this.logger.debug("Configuration updated", config);
	}

	/**
	 * Get current configuration
	 */
	getConfig(): MarkdownProcessingConfig {
		return { ...this.config };
	}

	/**
	 * Get reference graph
	 */
	getReferenceGraph(): ReferenceGraph | null {
		return this.metadataExtractor.getReferenceGraph();
	}

	/**
	 * Get the privacy filter instance for external use
	 */
	getPrivacyFilter(): PrivacyFilter | undefined {
		return this.config.enablePrivacyFilter ? this.privacyFilter : undefined;
	}
}
