// src/markdown-formatter.ts
/**
 * Core Markdown Formatter Implementation
 * Handles conversion of generated summaries into formatted markdown and other export formats
 * Includes support for caching, validation, optimization, and metadata generation
 * Provides various formatting options and styles for different use cases
 * Supports template library management and customization
 * Provides validation and import/export functionality
 */
import {
	MarkdownFormatter,
	MarkdownGenerationConfig,
	MarkdownGenerationResult,
	MarkdownFormattingPreferences,
	MarkdownTemplate,
	MarkdownStyles,
	MarkdownElement,
	MarkdownHeading,
	MarkdownList,
	MarkdownTable,
	MarkdownCallout,
	MarkdownMetadata,
	ExportResult,
	ExportFormat,
	ExportOptions,
	PreviewResult,
	PreviewOptions,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	HeadingLevel,
	ListType,
	CalloutType,
} from "./markdown-formatter-interfaces";

import {
	GeneratedSummary,
	Insight,
	TrendAnalysis,
	SummaryMetric,
} from "./summary-generation-interfaces";
import { GeneratedRecommendation } from "./recommendation-generation-interfaces";
import { Logger } from "./logger";

export class CoreMarkdownFormatter implements MarkdownFormatter {
	private preferences: MarkdownFormattingPreferences;
	private cache: Map<string, MarkdownGenerationResult>;
	private templates: Map<string, MarkdownTemplate>;
	private logger: Logger;

	constructor(
		preferences?: Partial<MarkdownFormattingPreferences>,
		logger?: Logger
	) {
		this.preferences = this.mergeWithDefaults(preferences || {});
		this.cache = new Map();
		this.templates = new Map();
		this.logger = logger || new Logger("MarkdownFormatter");

		this.initializeDefaultTemplates();
	}

	async formatSummary(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig
	): Promise<MarkdownGenerationResult> {
		const startTime = Date.now();
		const cacheKey = this.generateCacheKey(summary, config);

		// Check cache if enabled
		if (config.enableCaching && this.cache.has(cacheKey)) {
			const cached = this.cache.get(cacheKey);
			if (cached) {
				this.logger.debug("Returning cached markdown result");
				return {
					...cached,
					cacheHit: true,
				};
			}
		}

		try {
			// Generate markdown content
			const elements = await this.generateMarkdownElements(
				summary,
				config
			);
			const content = this.renderElements(
				elements,
				config.preferences.styles || this.getDefaultStyles()
			);

			// Calculate metrics
			const wordCount = this.calculateWordCount(content);
			const readingTime = this.calculateReadingTime(content);
			const complexity = this.calculateComplexity(content);

			// Validate if enabled
			let validation: ValidationResult = {
				isValid: true,
				errors: [],
				warnings: [],
				suggestions: [],
			};
			if (config.enableValidation) {
				validation = this.validateMarkdown(content);
			}

			// Optimize if enabled
			let optimizedContent = content;
			if (config.enableOptimization) {
				optimizedContent = this.optimizeContent(
					content,
					config.preferences
				);
			}

			// Generate metadata
			const metadata = this.generateMetadata(
				summary,
				config,
				wordCount,
				readingTime,
				startTime
			);

			// Create result
			const result: MarkdownGenerationResult = {
				content: optimizedContent,
				metadata,
				elements,
				wordCount,
				readingTime,
				complexity,
				isValid: validation.isValid,
				warnings: validation.warnings.map((w) => w.message),
				errors: validation.errors.map((e) => e.message),
				generationTime: Date.now() - startTime,
				cacheHit: false,
				availableFormats: [
					"markdown",
					"html",
					"pdf",
					"docx",
					"plain-text",
					"json",
				],
			};

			// Cache result if enabled
			if (config.enableCaching) {
				this.cache.set(cacheKey, result);

				// Clean cache if needed
				if (this.cache.size > 100) {
					this.cleanCache();
				}
			}

			this.logger.info(
				`Generated markdown summary in ${result.generationTime}ms`
			);
			return result;
		} catch (error) {
			this.logger.error("Error generating markdown summary:", error);
			throw new Error(
				`Failed to generate markdown: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	async formatInsights(
		insights: Insight[],
		config: MarkdownGenerationConfig
	): Promise<string> {
		const styles = config.preferences.styles || this.getDefaultStyles();
		const sections: string[] = [];

		if (config.preferences.useHeadings) {
			sections.push(this.formatHeading("Key Insights", 2, styles));
		}

		if (config.preferences.useTables && insights.length > 3) {
			// Format as table for many insights
			const headers = ["Insight", "Category", "Confidence", "Impact"];
			const rows = insights.map((insight) => [
				insight.title,
				insight.category,
				`${Math.round(insight.confidence * 100)}%`,
				"Medium", // Default impact since not in interface
			]);
			sections.push(this.formatTable(headers, rows, styles));
		} else {
			// Format as list
			const items = insights.map((insight) => {
				let item = `**${insight.title}** - ${insight.description}`;
				if (
					config.preferences.includeEvidence &&
					insight.evidence.length > 0
				) {
					item += ` _(${insight.evidence.length} evidence points)_`;
				}
				return item;
			});
			sections.push(this.formatList(items, "unordered", styles));
		}

		return sections.join("\n\n");
	}

	async formatRecommendations(
		recommendations: GeneratedRecommendation[],
		config: MarkdownGenerationConfig
	): Promise<string> {
		const styles = config.preferences.styles || this.getDefaultStyles();
		const sections: string[] = [];

		if (config.preferences.useHeadings) {
			sections.push(this.formatHeading("Recommendations", 2, styles));
		}

		// Group by urgency if many recommendations
		if (recommendations.length > 5) {
			const grouped = this.groupRecommendationsByUrgency(recommendations);

			for (const [urgency, recs] of Object.entries(grouped)) {
				if (recs.length === 0) continue;

				sections.push(
					this.formatHeading(
						`${
							urgency.charAt(0).toUpperCase() + urgency.slice(1)
						} Priority`,
						3,
						styles
					)
				);

				const items = recs.map((rec) => {
					let item = `**${rec.title}** - ${rec.description}`;
					if (config.preferences.detailLevel !== "minimal") {
						item += ` _(${rec.difficulty} difficulty, ${rec.timeframe} timeframe)_`;
					}
					return item;
				});

				sections.push(this.formatList(items, "ordered", styles));
			}
		} else {
			// Simple list for few recommendations
			const items = recommendations.map((rec) => {
				const item = `**${rec.title}** - ${rec.description}`;
				if (
					config.preferences.useCallouts &&
					rec.urgency === "urgent"
				) {
					return this.formatCallout(
						item,
						"warning",
						"Urgent Action Required"
					);
				}
				return item;
			});
			sections.push(this.formatList(items, "ordered", styles));
		}

		return sections.join("\n\n");
	}

	async formatTrends(
		trends: TrendAnalysis[],
		config: MarkdownGenerationConfig
	): Promise<string> {
		const styles = config.preferences.styles || this.getDefaultStyles();
		const sections: string[] = [];

		if (config.preferences.useHeadings) {
			sections.push(this.formatHeading("Trend Analysis", 2, styles));
		}

		for (const trend of trends) {
			sections.push(this.formatHeading(trend.title, 3, styles));
			sections.push(trend.description);

			if (
				config.preferences.detailLevel !== "minimal" &&
				trend.dataPoints.length > 0
			) {
				const items = trend.dataPoints.map(
					(point) =>
						`${point.label}: ${
							point.value
						} (${point.date.toLocaleDateString()})`
				);
				sections.push(this.formatList(items, "unordered", styles));
			}
		}

		return sections.join("\n\n");
	}

	async formatMetrics(
		metrics: SummaryMetric[],
		config: MarkdownGenerationConfig
	): Promise<string> {
		const styles = config.preferences.styles || this.getDefaultStyles();
		const sections: string[] = [];

		if (config.preferences.useHeadings) {
			sections.push(this.formatHeading("Summary Metrics", 2, styles));
		}

		if (config.preferences.useTables) {
			const headers = ["Metric", "Value", "Change"];
			const rows = metrics.map((metric) => [
				metric.name,
				metric.value.toString(),
				metric.change
					? `${metric.change > 0 ? "+" : ""}${metric.change}%`
					: "N/A",
			]);
			sections.push(this.formatTable(headers, rows, styles));
		} else {
			const items = metrics.map((metric) => {
				let item = `**${metric.name}**: ${metric.value}`;
				if (metric.change !== undefined) {
					const changeIcon =
						metric.change > 0
							? "📈"
							: metric.change < 0
							? "📉"
							: "➡️";
					item += ` ${changeIcon} ${metric.change > 0 ? "+" : ""}${
						metric.change
					}%`;
				}
				return item;
			});
			sections.push(this.formatList(items, "unordered", styles));
		}

		return sections.join("\n\n");
	}

	formatHeading(
		text: string,
		level: HeadingLevel,
		styles: MarkdownStyles
	): string {
		if (styles.headingStyle === "atx") {
			return `${"#".repeat(level)} ${text}`;
		} else {
			// Setext style (only for h1 and h2)
			if (level === 1) {
				return `${text}\n${"=".repeat(text.length)}`;
			} else if (level === 2) {
				return `${text}\n${"-".repeat(text.length)}`;
			} else {
				// Fall back to atx for h3+
				return `${"#".repeat(level)} ${text}`;
			}
		}
	}

	formatList(
		items: string[],
		type: ListType,
		styles: MarkdownStyles
	): string {
		const lines: string[] = [];

		for (let i = 0; i < items.length; i++) {
			let prefix: string;

			switch (type) {
				case "ordered":
					prefix = styles.orderedListStyle.replace(
						"1",
						(i + 1).toString()
					);
					break;
				case "unordered":
					prefix = styles.unorderedListMarker;
					break;
				case "task":
					prefix = styles.taskListStyle;
					break;
			}

			lines.push(`${prefix} ${items[i]}`);
		}

		return lines.join("\n");
	}

	formatTable(
		headers: string[],
		rows: string[][],
		styles: MarkdownStyles
	): string {
		if (styles.tableStyle === "pipe") {
			const lines: string[] = [];

			// Header row
			lines.push(`| ${headers.join(" | ")} |`);

			// Separator row
			const separators = headers.map(() => {
				switch (styles.tableAlignment) {
					case "left":
						return ":---";
					case "center":
						return ":---:";
					case "right":
						return "---:";
					default:
						return "---";
				}
			});
			lines.push(`| ${separators.join(" | ")} |`);

			// Data rows
			for (const row of rows) {
				lines.push(`| ${row.join(" | ")} |`);
			}

			return lines.join("\n");
		}

		// Simple table format (fallback)
		const lines: string[] = [];
		lines.push(headers.join("\t"));
		for (const row of rows) {
			lines.push(row.join("\t"));
		}
		return lines.join("\n");
	}

	formatCallout(content: string, type: CalloutType, title?: string): string {
		const titleText = title || type.charAt(0).toUpperCase() + type.slice(1);

		switch (this.preferences.styles?.calloutStyle || "obsidian") {
			case "obsidian":
				return `> [!${type}]${
					title ? ` ${title}` : ""
				}\n> ${content.replace(/\n/g, "\n> ")}`;
			case "github": {
				const emoji = this.getCalloutEmoji(type);
				return `> ${emoji} **${titleText}**\n> \n> ${content.replace(
					/\n/g,
					"\n> "
				)}`;
			}
			case "custom": {
				const prefix =
					this.preferences.styles?.customCalloutPrefix || ">";
				return `${prefix} ${titleText}: ${content}`;
			}
			default:
				return `> **${titleText}**: ${content}`;
		}
	}

	formatLink(text: string, url: string, title?: string): string {
		if (this.preferences.styles?.linkStyle === "reference") {
			// Reference-style links would need additional tracking
			return `[${text}][ref]`;
		} else {
			// Inline style
			const titleAttr = title ? ` "${title}"` : "";
			return `[${text}](${url}${titleAttr})`;
		}
	}

	async applyTemplate(
		content: string,
		template: MarkdownTemplate
	): Promise<string> {
		// Template application logic would go here
		// For now, return content with template header/footer
		const parts: string[] = [];

		if (template.header) {
			parts.push(template.header);
		}

		parts.push(content);

		if (template.footer) {
			parts.push(template.footer);
		}

		return parts.join("\n\n");
	}

	validateTemplate(template: MarkdownTemplate): ValidationResult {
		const errors: ValidationError[] = [];
		const warnings: ValidationWarning[] = [];
		const suggestions: string[] = [];

		// Basic validation
		if (!template.id || template.id.trim() === "") {
			errors.push({
				type: "structure",
				message: "Template must have a valid ID",
				severity: "error",
			});
		}

		if (!template.name || template.name.trim() === "") {
			errors.push({
				type: "structure",
				message: "Template must have a name",
				severity: "error",
			});
		}

		if (template.sections.length === 0) {
			warnings.push({
				type: "structure",
				message: "Template has no sections defined",
				suggestion:
					"Add at least one section to make the template useful",
			});
		}

		// Validate sections
		for (const section of template.sections) {
			if (!section.title || section.title.trim() === "") {
				errors.push({
					type: "structure",
					message: `Section ${section.id} must have a title`,
					severity: "error",
				});
			}

			if (section.headingLevel < 1 || section.headingLevel > 6) {
				errors.push({
					type: "structure",
					message: `Section ${section.id} has invalid heading level: ${section.headingLevel}`,
					severity: "error",
				});
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			suggestions,
		};
	}

	async exportToFormat(
		content: string,
		format: ExportFormat,
		options: ExportOptions = {}
	): Promise<ExportResult> {
		try {
			switch (format) {
				case "markdown":
					return this.exportToMarkdown(content, options);
				case "html":
					return this.exportToHTML(content, options);
				case "plain-text":
					return this.exportToPlainText(content, options);
				case "json":
					return this.exportToJSON(content, options);
				case "pdf":
				case "docx":
					// These would require additional libraries
					throw new Error(`Export to ${format} not yet implemented`);
				default:
					throw new Error(`Unsupported export format: ${format}`);
			}
		} catch (error) {
			return {
				format,
				content: "",
				filename: options.filename || `export.${format}`,
				size: 0,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async generatePreview(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig,
		options: PreviewOptions
	): Promise<PreviewResult> {
		const result = await this.formatSummary(summary, config);

		return {
			content: result.content,
			format: options.previewFormat,
			metadata: result.metadata,
			changes: [], // Would track changes in live preview
			lastUpdated: new Date(),
			isLive: options.enableLivePreview,
		};
	}

	calculateReadingTime(content: string): number {
		const wordsPerMinute = 200; // Average reading speed
		const wordCount = this.calculateWordCount(content);
		return Math.ceil(wordCount / wordsPerMinute);
	}

	calculateComplexity(content: string): number {
		// Simple complexity calculation based on various factors
		let complexity = 0;

		// Factor in sentence length
		const sentences = content
			.split(/[.!?]+/)
			.filter((s) => s.trim().length > 0);
		const avgSentenceLength =
			sentences.reduce((sum, s) => sum + s.split(" ").length, 0) /
			sentences.length;
		complexity += Math.min(avgSentenceLength / 20, 0.3); // Max 0.3 for sentence length

		// Factor in vocabulary complexity (simplified)
		const words = content.toLowerCase().match(/\b\w+\b/g) || [];
		const uniqueWords = new Set(words);
		const vocabularyRatio = uniqueWords.size / words.length;
		complexity += vocabularyRatio * 0.4; // Max 0.4 for vocabulary

		// Factor in structure complexity
		const headings = (content.match(/^#+\s/gm) || []).length;
		const lists = (content.match(/^[\s]*[-*+]\s/gm) || []).length;
		const tables = (content.match(/\|.*\|/g) || []).length;
		const structureScore =
			((headings + lists + tables) / content.length) * 1000;
		complexity += Math.min(structureScore, 0.3); // Max 0.3 for structure

		return Math.min(complexity, 1); // Cap at 1.0
	}

	validateMarkdown(content: string): ValidationResult {
		const errors: ValidationError[] = [];
		const warnings: ValidationWarning[] = [];
		const suggestions: string[] = [];

		// Check for common markdown issues
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNum = i + 1;

			// Check for malformed headers
			if (line.match(/^#{7,}/)) {
				errors.push({
					type: "syntax",
					message: "Headers cannot have more than 6 levels",
					line: lineNum,
					severity: "error",
				});
			}

			// Check for malformed links
			if (
				line.includes("[") &&
				line.includes("]") &&
				!line.match(/\[.*\]\(.*\)/)
			) {
				warnings.push({
					type: "syntax",
					message: "Possible malformed link",
					suggestion: "Ensure links follow [text](url) format",
				});
			}

			// Check for very long lines
			if (line.length > 120) {
				warnings.push({
					type: "style",
					message: "Line is very long",
					suggestion:
						"Consider breaking long lines for better readability",
				});
			}
		}

		// Check for accessibility issues
		const headings = content.match(/^#+\s(.+)$/gm) || [];
		if (headings.length === 0) {
			warnings.push({
				type: "accessibility",
				message: "Document has no headings",
				suggestion:
					"Add headings to improve document structure and accessibility",
			});
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			suggestions,
		};
	}

	optimizeContent(
		content: string,
		preferences: MarkdownFormattingPreferences
	): string {
		let optimized = content;

		// Remove excessive blank lines
		optimized = optimized.replace(/\n{3,}/g, "\n\n");

		// Normalize list formatting
		if (preferences.bulletStyle) {
			optimized = optimized.replace(
				/^[\s]*[*+]\s/gm,
				`${preferences.bulletStyle} `
			);
		}

		// Normalize emphasis
		if (preferences.styles?.emphasisStyle) {
			const style = preferences.styles.emphasisStyle;
			const otherStyle = style === "*" ? "_" : "*";
			optimized = optimized.replace(
				new RegExp(
					`${otherStyle}([^${otherStyle}]+)${otherStyle}`,
					"g"
				),
				`${style}$1${style}`
			);
		}

		// Add reading time if requested
		if (preferences.includeReadingTime) {
			const readingTime = this.calculateReadingTime(optimized);
			optimized = `*Reading time: ${readingTime} minute${
				readingTime !== 1 ? "s" : ""
			}*\n\n${optimized}`;
		}

		// Add word count if requested
		if (preferences.includeWordCount) {
			const wordCount = this.calculateWordCount(optimized);
			optimized = `*Word count: ${wordCount} words*\n\n${optimized}`;
		}

		return optimized;
	}

	updatePreferences(
		preferences: Partial<MarkdownFormattingPreferences>
	): void {
		this.preferences = { ...this.preferences, ...preferences };
		this.cache.clear(); // Clear cache when preferences change
	}

	getPreferences(): MarkdownFormattingPreferences {
		return { ...this.preferences };
	}

	resetToDefaults(): void {
		this.preferences = this.mergeWithDefaults({});
		this.cache.clear();
	}

	// Private helper methods

	private async generateMarkdownElements(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig
	): Promise<MarkdownElement[]> {
		const elements: MarkdownElement[] = [];
		const prefs = config.preferences;

		// Title
		if (prefs.useHeadings) {
			elements.push({
				type: "heading",
				content: summary.title || "Summary Report",
				level: 1,
				metadata: { level: 1 },
			} as MarkdownHeading);
		}

		// Executive summary
		if (
			prefs.includedSections.includes("executive-summary") &&
			summary.executiveSummary
		) {
			if (prefs.useHeadings) {
				elements.push({
					type: "heading",
					content: "Executive Summary",
					level: 2,
					metadata: { level: 2 },
				} as MarkdownHeading);
			}

			elements.push({
				type: "paragraph",
				content: summary.executiveSummary,
			});
		}

		// Insights
		if (
			prefs.includedSections.includes("key-insights") &&
			summary.insights.length > 0
		) {
			const insightContent = await this.formatInsights(
				summary.insights,
				config
			);
			elements.push({
				type: "paragraph",
				content: insightContent,
			});
		}

		// Recommendations
		if (
			prefs.includedSections.includes("recommendations") &&
			summary.recommendations.length > 0
		) {
			// Convert Recommendation[] to GeneratedRecommendation[] if needed
			const generatedRecs = summary.recommendations.map((rec) => {
				// If it's already a GeneratedRecommendation, return as is
				if ("type" in rec && "urgency" in rec) {
					return rec as unknown as GeneratedRecommendation;
				}
				// Otherwise convert from Recommendation to GeneratedRecommendation
				return {
					id: `rec-${Date.now()}-${Math.random()}`,
					title: rec.title,
					description: rec.description,
					type: "action" as const,
					category: rec.category,
					urgency: "medium" as const,
					difficulty: "moderate" as const,
					timeframe: "short-term" as const,
					directness: "recommendation" as const,
					confidence: rec.confidence,
					relevanceScore: 0.8,
					impactPotential: 0.7,
					feasibilityScore: 0.8,
					sourceInsights: [],
					evidence: [],
					actionSteps: rec.actionSteps || [],
					risks: [],
					prerequisites: [],
					alternatives: [],
					successMetrics: [],
					trackingMethods: [],
					reviewTimeframe: "1 month",
					generatedAt: new Date(),
					generationMethod: "template" as const,
					tags: [],
				} as GeneratedRecommendation;
			});

			const recContent = await this.formatRecommendations(
				generatedRecs,
				config
			);
			elements.push({
				type: "paragraph",
				content: recContent,
			});
		}

		// Trends
		if (
			prefs.includedSections.includes("trends") &&
			summary.trends.length > 0
		) {
			const trendContent = await this.formatTrends(
				summary.trends,
				config
			);
			elements.push({
				type: "paragraph",
				content: trendContent,
			});
		}

		// Metrics
		if (
			prefs.includedSections.includes("metrics") &&
			summary.keyMetrics.length > 0
		) {
			const metricContent = await this.formatMetrics(
				summary.keyMetrics,
				config
			);
			elements.push({
				type: "paragraph",
				content: metricContent,
			});
		}

		return elements;
	}

	private renderElements(
		elements: MarkdownElement[],
		styles: MarkdownStyles
	): string {
		const sections: string[] = [];

		for (const element of elements) {
			switch (element.type) {
				case "heading": {
					const heading = element as MarkdownHeading;
					sections.push(
						this.formatHeading(
							element.content,
							heading.level,
							styles
						)
					);
					break;
				}
				case "paragraph":
					sections.push(element.content);
					break;
				case "list": {
					const list = element as MarkdownList;
					const items = list.items.map((item) => item.content);
					sections.push(
						this.formatList(items, list.listType, styles)
					);
					break;
				}
				case "table": {
					const table = element as MarkdownTable;
					sections.push(
						this.formatTable(table.headers, table.rows, styles)
					);
					break;
				}
				case "callout": {
					const callout = element as MarkdownCallout;
					sections.push(
						this.formatCallout(
							element.content,
							callout.calloutType,
							callout.title
						)
					);
					break;
				}
				case "horizontal-rule":
					sections.push("---");
					break;
				default:
					sections.push(element.content);
			}
		}

		return sections.join("\n\n");
	}

	private generateMetadata(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig,
		wordCount: number,
		readingTime: number,
		startTime: number
	): MarkdownMetadata {
		return {
			title: summary.title || "Summary Report",
			generatedAt: new Date(),
			templateUsed: config.templateId || "default",
			sectionCount: config.preferences.includedSections.length,
			insightCount: summary.insights.length,
			recommendationCount: summary.recommendations.length,
			evidenceCount: summary.insights.reduce(
				(sum, insight) => sum + insight.evidence.length,
				0
			),
			sourceFiles: [], // Not available in current interface
			dateRange: summary.dateRange || {
				start: new Date(),
				end: new Date(),
			},
			processingTime: Date.now() - startTime,
			aiTokensUsed: summary.tokensUsed,
			preferences: config.preferences,
			customizations: [],
		};
	}

	private generateCacheKey(
		summary: GeneratedSummary,
		config: MarkdownGenerationConfig
	): string {
		const summaryHash = this.hashObject({
			title: summary.title,
			insightCount: summary.insights.length,
			recommendationCount: summary.recommendations.length,
			lastModified: summary.generatedAt,
		});

		const configHash = this.hashObject({
			preferences: config.preferences,
			templateId: config.templateId,
		});

		return `${summaryHash}-${configHash}`;
	}

	private hashObject(obj: unknown): string {
		return btoa(JSON.stringify(obj)).slice(0, 16);
	}

	private calculateWordCount(content: string): number {
		return (content.match(/\b\w+\b/g) || []).length;
	}

	private groupRecommendationsByUrgency(
		recommendations: GeneratedRecommendation[]
	): Record<string, GeneratedRecommendation[]> {
		const grouped: Record<string, GeneratedRecommendation[]> = {
			urgent: [],
			high: [],
			medium: [],
			low: [],
		};

		for (const rec of recommendations) {
			grouped[rec.urgency].push(rec);
		}

		return grouped;
	}

	private getCalloutEmoji(type: CalloutType): string {
		const emojiMap: Record<CalloutType, string> = {
			note: "📝",
			tip: "💡",
			warning: "⚠️",
			error: "❌",
			success: "✅",
			info: "ℹ️",
			quote: "💬",
		};
		return emojiMap[type] || "📝";
	}

	private exportToMarkdown(
		content: string,
		options: ExportOptions
	): ExportResult {
		const filename = options.filename || "export.md";
		return {
			format: "markdown",
			content,
			filename,
			size: Buffer.byteLength(content, "utf8"),
			success: true,
		};
	}

	private exportToHTML(
		content: string,
		options: ExportOptions
	): ExportResult {
		// Simple markdown to HTML conversion
		let html = content
			.replace(/^# (.+)$/gm, "<h1>$1</h1>")
			.replace(/^## (.+)$/gm, "<h2>$1</h2>")
			.replace(/^### (.+)$/gm, "<h3>$1</h3>")
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			.replace(/\*(.+?)\*/g, "<em>$1</em>")
			.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
			.replace(/\n\n/g, "</p><p>")
			.replace(/^- (.+)$/gm, "<li>$1</li>");

		html = `<p>${html}</p>`;
		html = html.replace(/<\/li><\/p><p><li>/g, "</li><li>");
		html = html
			.replace(/<p><li>/g, "<ul><li>")
			.replace(/<\/li><\/p>/g, "</li></ul>");

		const filename = options.filename || "export.html";
		return {
			format: "html",
			content: html,
			filename,
			size: Buffer.byteLength(html, "utf8"),
			success: true,
		};
	}

	private exportToPlainText(
		content: string,
		options: ExportOptions
	): ExportResult {
		// Strip markdown formatting
		const plainText = content
			.replace(/^#+\s/gm, "")
			.replace(/\*\*(.+?)\*\*/g, "$1")
			.replace(/\*(.+?)\*/g, "$1")
			.replace(/\[(.+?)\]\(.+?\)/g, "$1")
			.replace(/^[-*+]\s/gm, "• ");

		const filename = options.filename || "export.txt";
		return {
			format: "plain-text",
			content: plainText,
			filename,
			size: Buffer.byteLength(plainText, "utf8"),
			success: true,
		};
	}

	private exportToJSON(
		content: string,
		options: ExportOptions
	): ExportResult {
		const jsonData = {
			content,
			exportedAt: new Date().toISOString(),
			format: "markdown",
			metadata: {
				wordCount: this.calculateWordCount(content),
				readingTime: this.calculateReadingTime(content),
			},
		};

		const jsonString = JSON.stringify(jsonData, null, 2);
		const filename = options.filename || "export.json";

		return {
			format: "json",
			content: jsonString,
			filename,
			size: Buffer.byteLength(jsonString, "utf8"),
			success: true,
		};
	}

	private cleanCache(): void {
		// Simple LRU cache cleanup - remove oldest entries
		const entries = Array.from(this.cache.entries());
		const toRemove = entries.slice(0, Math.floor(entries.length / 2));

		for (const [key] of toRemove) {
			this.cache.delete(key);
		}

		this.logger.debug(`Cleaned cache, removed ${toRemove.length} entries`);
	}

	private mergeWithDefaults(
		preferences: Partial<MarkdownFormattingPreferences>
	): MarkdownFormattingPreferences {
		return {
			useHeadings: true,
			maxHeadingLevel: 6,
			includeTableOfContents: false,
			includeMetadata: true,
			summaryLength: "standard",
			detailLevel: "standard",
			includeEvidence: true,
			includeRecommendations: true,
			includeTrends: true,
			includeMetrics: true,
			useCallouts: true,
			useEmphasis: true,
			useTables: true,
			useTaskLists: false,
			bulletStyle: "-",
			numberedListStyle: "1.",
			includedSections: [
				"executive-summary",
				"key-insights",
				"recommendations",
				"trends",
				"metrics",
			],
			sectionOrder: [
				"executive-summary",
				"key-insights",
				"recommendations",
				"trends",
				"metrics",
			],
			customSections: [],
			useHorizontalRules: false,
			includeTimestamps: true,
			includeWordCount: false,
			includeReadingTime: false,
			preferredExportFormat: "markdown",
			includeSourceLinks: true,
			includeFootnotes: false,
			styles: this.getDefaultStyles(),
			...preferences,
		};
	}

	private getDefaultStyles(): MarkdownStyles {
		return {
			headingStyle: "atx",
			emphasisStyle: "*",
			strongStyle: "**",
			unorderedListMarker: "-",
			orderedListStyle: "1.",
			taskListStyle: "- [ ]",
			tableAlignment: "left",
			includeTableHeaders: true,
			tableStyle: "pipe",
			codeBlockLanguage: "",
			blockquoteStyle: "> ",
			sectionSpacing: 2,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: "inline",
			includeBacklinks: false,
			calloutStyle: "obsidian",
		};
	}

	private initializeDefaultTemplates(): void {
		// Initialize with a basic default template
		const defaultTemplate: MarkdownTemplate = {
			id: "default",
			name: "Default Template",
			description: "Standard markdown formatting template",
			sections: [
				{
					id: "executive-summary",
					title: "Executive Summary",
					type: "executive-summary",
					contentTypes: ["summary"],
					headingLevel: 2,
					required: true,
					order: 1,
				},
				{
					id: "insights",
					title: "Key Insights",
					type: "key-insights",
					contentTypes: ["insights"],
					headingLevel: 2,
					required: true,
					order: 2,
				},
				{
					id: "recommendations",
					title: "Recommendations",
					type: "recommendations",
					contentTypes: ["recommendations"],
					headingLevel: 2,
					required: false,
					order: 3,
				},
			],
			styles: this.getDefaultStyles(),
			category: "personal",
			tags: ["default", "standard"],
			version: "1.0.0",
			isDefault: true,
			isCustom: false,
			usageCount: 0,
		};

		this.templates.set("default", defaultTemplate);
	}
}
