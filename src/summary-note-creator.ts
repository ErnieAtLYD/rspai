// src/summary-note-creator.ts

import { App, TFile } from "obsidian";
import { Logger } from "./logger";
import { ProcessingResult } from "./markdown-processing-service";
import { AIService } from "./ai-service";
import { NaturalLanguageGenerator, NLGFactory } from "./natural-language-generator";
import { PrivacyFilter } from "./privacy-filter";

export interface SummaryNoteOptions {
	folderPath: string;
	filenameTemplate: string;
	createBacklinks: boolean;
	overwriteExisting: boolean;
	// Enhanced options for AI-powered insights
	enableAIInsights: boolean;
	writingStyle: 'business' | 'personal' | 'academic';
	includeRecommendations: boolean;
	includePatternAnalysis: boolean;
	includeTrendAnalysis: boolean;
	// Privacy options
	respectPrivacySettings: boolean;
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryNoteOptions = {
	folderPath: "Summaries",
	filenameTemplate: "Summary - {{date}} - {{originalName}}",
	createBacklinks: true,
	overwriteExisting: false,
	enableAIInsights: true,
	writingStyle: 'personal',
	includeRecommendations: true,
	includePatternAnalysis: true,
	includeTrendAnalysis: true,
	respectPrivacySettings: true,
};

/**
 * Creates a summary note for a given file.
 * 
 * @param app - The Obsidian app instance.
 * @param logger - The logger instance.
 * @param aiService - The AI service for generating insights.
 * @param privacyFilter - The privacy filter for respecting privacy settings.
 * @param options - The options for the summary note.
 * @returns The path to the created summary note.
 */
export class SummaryNoteCreator {
	private nlgGenerator: NaturalLanguageGenerator;

	constructor(
		private app: App, 
		private logger: Logger,
		private aiService?: AIService,
		private privacyFilter?: PrivacyFilter
	) {
		// Initialize with personal style by default - can be changed per summary
		this.nlgGenerator = NLGFactory.createForPersonal();
	}

	async createSummaryNote(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: Partial<SummaryNoteOptions> = {}
	): Promise<string> {
		const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };

		try {
			// Privacy check: Determine if AI insights should be disabled for this file
			const shouldUseAI = await this.shouldEnableAIForFile(originalFile, opts);
			
			if (opts.enableAIInsights && !shouldUseAI) {
				this.logger.info(`Privacy protection: Disabling AI insights for file: ${originalFile.path}`);
				opts.enableAIInsights = false;
			}

			// Generate filename
			const filename = this.generateFilename(
				originalFile,
				opts.filenameTemplate
			);
			const fullPath = `${opts.folderPath}/${filename}.md`;

			this.logger.info(`Generated filename: ${filename}`);
			this.logger.info(`Full path will be: ${fullPath}`);
			this.logger.info(`Folder path: ${opts.folderPath}`);
			this.logger.info(`AI insights enabled: ${opts.enableAIInsights}`);

			// Ensure folder exists first
			await this.ensureFolderExists(opts.folderPath);

			// Check if file exists
			const exists = await this.fileExists(fullPath);
			this.logger.info(`File exists check: ${exists} for path: ${fullPath}`);
			if (exists && !opts.overwriteExisting) {
				throw new Error(`Summary note already exists: ${fullPath}`);
			}

			// Generate enhanced content with AI insights
			const content = await this.generateEnhancedSummaryContent(
				originalFile,
				analysisResult,
				opts
			);

			// Create or update file using the vault API consistently
			if (exists) {
				// File exists, modify it
				const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
				if (existingFile instanceof TFile) {
					await this.app.vault.modify(existingFile, content);
					this.logger.info(`Updated existing summary note: ${fullPath}`);
				} else {
					// Fallback to adapter write
					await this.app.vault.adapter.write(fullPath, content);
					this.logger.info(`Updated existing summary note via adapter: ${fullPath}`);
				}
			} else {
				// File doesn't exist, create it
				this.logger.info(`Creating new file: ${fullPath}`);
				try {
					await this.app.vault.create(fullPath, content);
					this.logger.info(`Successfully created new summary note: ${fullPath}`);
				} catch (createError) {
					// If vault.create fails, ensure folder exists at filesystem level and try adapter
					this.logger.warn(`vault.create failed, ensuring folder exists at filesystem level: ${createError}`);
					
					try {
						// Make sure folder exists at filesystem level
						await this.app.vault.adapter.mkdir(opts.folderPath);
						this.logger.info(`Created folder at filesystem level: ${opts.folderPath}`);
					} catch (mkdirError) {
						// Folder might already exist, that's ok
						this.logger.info(`Folder creation skipped (might already exist): ${mkdirError.message}`);
					}
					
					// Now try to write the file
					await this.app.vault.adapter.write(fullPath, content);
					this.logger.info(`Successfully created new summary note via adapter: ${fullPath}`);
				}
			}

			return fullPath;
		} catch (error) {
			this.logger.error("Failed to create summary note", error);
			throw error;
		}
	}

	/**
	 * Determine if AI insights should be enabled for a specific file based on privacy settings
	 */
	private async shouldEnableAIForFile(
		originalFile: TFile,
		options: SummaryNoteOptions
	): Promise<boolean> {
		// If privacy settings should not be respected, allow AI
		if (!options.respectPrivacySettings) {
			return true;
		}

		// If no privacy filter is available, allow AI (fail open)
		if (!this.privacyFilter) {
			this.logger.debug("No privacy filter available, allowing AI insights");
			return true;
		}

		try {
			// Read the file content to check for privacy markers
			const content = await this.app.vault.read(originalFile);
			
			// Check if the file should be excluded from AI processing
			const shouldExclude = this.privacyFilter.shouldExcludeFile(originalFile.path, content);
			
			if (shouldExclude) {
				this.logger.info(`Privacy filter: File ${originalFile.path} marked as private, disabling AI insights`);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.warn(`Error checking privacy settings for file ${originalFile.path}:`, error);
			// Fail safe: if we can't check privacy, don't use AI
			return false;
		}
	}

	private generateFilename(originalFile: TFile, template: string): string {
		const now = new Date();
		const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
		const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
		const originalName = originalFile.basename;

		return template
			.replace("{{date}}", dateStr)
			.replace("{{time}}", timeStr)
			.replace("{{datetime}}", `${dateStr} ${timeStr}`)
			.replace("{{originalName}}", originalName)
			.replace(/[<>:"/\\|?*]/g, "-"); // Remove invalid filename characters
	}

	private async generateEnhancedSummaryContent(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: SummaryNoteOptions
	): Promise<string> {
		const now = new Date();
		const originalLink = options.createBacklinks
			? `[[${originalFile.path}]]`
			: originalFile.path;

		// Set up NLG generator based on writing style preference
		this.setupNLGGenerator(options.writingStyle);

		// Generate frontmatter
		const frontmatter = [
			"---",
			`title: "Summary of ${originalFile.basename}"`,
			`original_file: "${originalFile.path}"`,
			`created: ${now.toISOString()}`,
			`type: "summary"`,
			`writing_style: "${options.writingStyle}"`,
			`ai_enhanced: ${options.enableAIInsights}`,
			`tags: ["summary", "analysis", "retrospect-ai"]`,
			"---",
			"",
		].join("\n");

		// Generate main content sections
		const contentSections: string[] = [];

		// Header
		contentSections.push(`# Summary of ${originalFile.basename}`);
		contentSections.push("");
		contentSections.push(`**Original Note:** ${originalLink}`);
		contentSections.push(`**Generated:** ${now.toLocaleString()}`);
		contentSections.push("");

		// Executive Summary (AI-powered if available)
		if (options.enableAIInsights && this.aiService) {
			const executiveSummary = await this.generateExecutiveSummary(originalFile, analysisResult);
			if (executiveSummary) {
				contentSections.push("## 🎯 Executive Summary");
				contentSections.push("");
				contentSections.push(executiveSummary);
				contentSections.push("");
			}
		}

		// Key Insights (AI-powered)
		if (options.enableAIInsights && this.aiService) {
			const insights = await this.generateKeyInsights(originalFile, analysisResult);
			if (insights.length > 0) {
				contentSections.push("## 💡 Key Insights");
				contentSections.push("");
				insights.forEach((insight, index) => {
					contentSections.push(`### ${index + 1}. ${insight.title}`);
					contentSections.push(insight.description);
					if (insight.evidence && insight.evidence.length > 0) {
						contentSections.push("**Evidence:**");
						insight.evidence.forEach(evidence => {
							contentSections.push(`- ${evidence}`);
						});
					}
					contentSections.push("");
				});
			}
		}

		// Content Analysis
		contentSections.push("## 📊 Content Analysis");
		contentSections.push("");
		contentSections.push(this.formatAnalysisResults(analysisResult));
		contentSections.push("");

		// Pattern Analysis (AI-powered)
		if (options.includePatternAnalysis && options.enableAIInsights && this.aiService) {
			const patterns = await this.generatePatternAnalysis(originalFile, analysisResult);
			if (patterns.length > 0) {
				contentSections.push("## 🔍 Pattern Analysis");
				contentSections.push("");
				patterns.forEach(pattern => {
					contentSections.push(`### ${pattern.title}`);
					contentSections.push(pattern.description);
					contentSections.push(`**Confidence:** ${Math.round(pattern.confidence * 100)}%`);
					if (pattern.evidence && pattern.evidence.length > 0) {
						contentSections.push("**Supporting Evidence:**");
						pattern.evidence.forEach(evidence => {
							contentSections.push(`- ${evidence}`);
						});
					}
					contentSections.push("");
				});
			}
		}

		// Recommendations (AI-powered)
		if (options.includeRecommendations && options.enableAIInsights && this.aiService) {
			const recommendations = await this.generateRecommendations(originalFile, analysisResult);
			if (recommendations.length > 0) {
				contentSections.push("## 🚀 Recommendations");
				contentSections.push("");
				recommendations.forEach((rec, index) => {
					contentSections.push(`### ${index + 1}. ${rec.title || 'Recommendation'}`);
					contentSections.push(rec.description);
					if (rec.actionSteps && rec.actionSteps.length > 0) {
						contentSections.push("**Action Steps:**");
						rec.actionSteps.forEach((step, stepIndex) => {
							contentSections.push(`${stepIndex + 1}. ${step.description}`);
						});
					}
					contentSections.push("");
				});
			}
		}

		// Connection Opportunities
		const connections = this.generateConnectionOpportunities(analysisResult);
		if (connections.length > 0) {
			contentSections.push("## 🔗 Connection Opportunities");
			contentSections.push("");
			contentSections.push("Based on the content analysis, consider connecting this note with:");
			contentSections.push("");
			connections.forEach(connection => {
				contentSections.push(`- **${connection.type}**: ${connection.description}`);
			});
			contentSections.push("");
		}

		// Footer
		contentSections.push("---");
		contentSections.push("");
		contentSections.push("*This summary was automatically generated by RetrospectAI*");
		if (options.enableAIInsights) {
			contentSections.push(`*Writing style: ${options.writingStyle} | AI insights: enabled*`);
		}

		const content = contentSections.join("\n");
		return frontmatter + content;
	}

	private setupNLGGenerator(style: 'business' | 'personal' | 'academic'): void {
		switch (style) {
			case 'business':
				this.nlgGenerator = NLGFactory.createForBusiness(this.aiService?.getSettings().openaiConfig ? undefined : undefined);
				break;
			case 'academic':
				this.nlgGenerator = NLGFactory.createForAcademic(this.aiService?.getSettings().openaiConfig ? undefined : undefined);
				break;
			case 'personal':
			default:
				this.nlgGenerator = NLGFactory.createForPersonal(this.aiService?.getSettings().openaiConfig ? undefined : undefined);
				break;
		}
	}

	private async generateExecutiveSummary(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<string | null> {
		if (!this.aiService) return null;

		try {
			const content = await this.app.vault.read(originalFile);
			const aiAnalysis = await this.aiService.analyzePersonalContent(content, {
				generateSummary: true,
				analysisDepth: 'standard'
			});

			if (aiAnalysis.success && aiAnalysis.summary) {
				return aiAnalysis.summary;
			}
		} catch (error) {
			this.logger.warn("Failed to generate executive summary:", error);
		}

		return null;
	}

	private async generateKeyInsights(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title: string; description: string; evidence?: string[] }>> {
		if (!this.aiService) return [];

		try {
			const content = await this.app.vault.read(originalFile);
			const aiAnalysis = await this.aiService.analyzePersonalContent(content, {
				extractPatterns: true,
				analysisDepth: 'comprehensive'
			});

			if (aiAnalysis.success && aiAnalysis.insights) {
				return aiAnalysis.insights.map((insight, index) => ({
					title: `Insight ${index + 1}`,
					description: insight,
					evidence: []
				}));
			}
		} catch (error) {
			this.logger.warn("Failed to generate key insights:", error);
		}

		return [];
	}

	private async generatePatternAnalysis(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title: string; description: string; confidence: number; evidence?: string[] }>> {
		if (!this.aiService) return [];

		try {
			const content = await this.app.vault.read(originalFile);
			const patterns = await this.aiService.extractPatterns(content);

			return patterns.map(pattern => ({
				title: pattern.title,
				description: pattern.description,
				confidence: pattern.confidence,
				evidence: pattern.evidence
			}));
		} catch (error) {
			this.logger.warn("Failed to generate pattern analysis:", error);
		}

		return [];
	}

	private async generateRecommendations(
		originalFile: TFile,
		analysisResult: ProcessingResult
	): Promise<Array<{ title?: string; description: string; actionSteps?: Array<{ description: string }> }>> {
		if (!this.aiService) return [];

		try {
			const content = await this.app.vault.read(originalFile);
			const aiAnalysis = await this.aiService.analyzePersonalContent(content, {
				suggestActions: true,
				analysisDepth: 'comprehensive'
			});

			if (aiAnalysis.success && aiAnalysis.recommendations) {
				return aiAnalysis.recommendations.map(rec => ({
					description: rec,
					actionSteps: []
				}));
			}
		} catch (error) {
			this.logger.warn("Failed to generate recommendations:", error);
		}

		return [];
	}

	private generateConnectionOpportunities(analysisResult: ProcessingResult): Array<{ type: string; description: string }> {
		const connections: Array<{ type: string; description: string }> = [];

		// Analyze content for connection opportunities
		if (analysisResult.metadata?.tags && analysisResult.metadata.tags.length > 0) {
			const tagStrings = analysisResult.metadata.tags.slice(0, 3).map(tag => 
				typeof tag === 'string' ? tag : tag.normalized
			);
			connections.push({
				type: "Tag-based connections",
				description: `Notes with similar tags: ${tagStrings.join(", ")}`
			});
		}

		if (analysisResult.sections && analysisResult.sections.length > 0) {
			const categories = [...new Set(analysisResult.sections.map(s => s.category).filter(c => c !== 'other'))];
			if (categories.length > 0) {
				connections.push({
					type: "Content category connections",
					description: `Notes in categories: ${categories.slice(0, 3).join(", ")}`
				});
			}
		}

		if (analysisResult.metadata?.links && analysisResult.metadata.links.length > 0) {
			connections.push({
				type: "Linked notes",
				description: `Explore connections through ${analysisResult.metadata.links.length} internal links`
			});
		}

		// Add temporal connections
		connections.push({
			type: "Temporal connections",
			description: "Notes created around the same time period for context"
		});

		return connections;
	}

	private formatAnalysisResults(result: ProcessingResult): string {
		if (!result.success) {
			return "❌ **Analysis Failed**\n\nThe analysis could not be completed due to errors.";
		}

		if (result.skipped) {
			return `⏭️ **Analysis Skipped**\n\nReason: ${
				result.skipReason || "Unknown"
			}`;
		}

		const sections: string[] = [];

		// Basic stats
		sections.push("### 📊 Basic Statistics");
		if (result.metadata) {
			sections.push(`- **Word Count:** ${result.metadata.wordCount}`);
			sections.push(
				`- **Character Count:** ${result.metadata.characterCount}`
			);
			sections.push(
				`- **Reading Time:** ~${Math.ceil(
					result.metadata.wordCount / 200
				)} minutes`
			);
		}
		sections.push(`- **Processing Time:** ${result.processingTime}ms`);
		sections.push("");

		// Content structure
		if (result.parsedContent && result.parsedContent.elements.length > 0) {
			sections.push("### 🏗️ Content Structure");

			const elementTypes = result.parsedContent.elements.reduce(
				(acc, el) => {
					acc[el.type] = (acc[el.type] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			Object.entries(elementTypes).forEach(([type, count]) => {
				sections.push(`- **${this.capitalizeFirst(type)}:** ${count}`);
			});
			sections.push("");
		}

		// Sections
		if (result.sections && result.sections.length > 0) {
			sections.push("### 📝 Document Sections");
			result.sections.forEach((section, index) => {
				sections.push(
					`${index + 1}. **${section.title}** (Level ${
						section.level
					})`
				);
				if (section.wordCount > 0) {
					sections.push(`   - ${section.wordCount} words`);
				}
				if (section.category !== "other") {
					sections.push(`   - Category: ${section.category}`);
				}
			});
			sections.push("");
		}

		// Metadata insights
		if (result.metadata) {
			sections.push("### 🔍 Content Insights");

					if (result.metadata.tags && result.metadata.tags.length > 0) {
			// Handle both string arrays and NormalizedTag objects
			const tagStrings = result.metadata.tags.map(tag => 
				typeof tag === 'string' ? tag : tag.normalized
			);
			sections.push(`- **Tags:** ${tagStrings.join(", ")}`);
		}

			if (result.metadata.links && result.metadata.links.length > 0) {
				sections.push(
					`- **Internal Links:** ${result.metadata.links.length}`
				);
			}

			sections.push("");
		}

		// Warnings
		if (result.warnings.length > 0) {
			sections.push("### ⚠️ Warnings");
			result.warnings.forEach((warning) => {
				sections.push(`- ${warning}`);
			});
			sections.push("");
		}

		return sections.join("\n");
	}

	private async fileExists(path: string): Promise<boolean> {
		this.logger.info(`Checking if file exists: ${path}`);
		
		try {
			// Try vault API first
			const file = this.app.vault.getAbstractFileByPath(path);
			this.logger.info(`Vault API result: ${file ? file.constructor.name : 'null'}`);
			
			if (file instanceof TFile) {
				this.logger.info(`File exists via vault API: ${path}`);
				return true;
			}
			
			// Fallback to adapter - but only check for files, not folders
			const stat = await this.app.vault.adapter.stat(path);
			this.logger.info(`Adapter stat result: ${JSON.stringify(stat)}`);
			
			// Check if it's actually a file (not a folder)
			if (stat && stat.type === 'file') {
				this.logger.info(`File exists via adapter: ${path}`);
				return true;
			} else {
				this.logger.info(`Path exists but is not a file: ${path} (type: ${stat?.type || 'unknown'})`);
				return false;
			}
		} catch (error) {
			this.logger.info(`File does not exist: ${path} (${error.message})`);
			return false;
		}
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		this.logger.info(`Ensuring folder exists: ${folderPath}`);
		
		try {
			// Check if folder exists using vault API first
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (folder) {
				this.logger.info(`Folder already exists via vault API: ${folderPath}`);
				return; // Folder already exists
			}
			
			// Try adapter stat as fallback
			await this.app.vault.adapter.stat(folderPath);
			this.logger.info(`Folder exists via adapter stat: ${folderPath}`);
		} catch {
			// Folder doesn't exist, create it
			this.logger.info(`Folder doesn't exist, creating: ${folderPath}`);
			try {
				await this.app.vault.createFolder(folderPath);
				this.logger.info(`Successfully created folder: ${folderPath}`);
			} catch (folderError) {
				// If createFolder fails, try creating parent folders recursively
				this.logger.warn(`createFolder failed, trying recursive creation: ${folderError}`);
				await this.createFolderRecursively(folderPath);
				this.logger.info(`Successfully created folder recursively: ${folderPath}`);
			}
		}
	}

	private async createFolderRecursively(folderPath: string): Promise<void> {
		const parts = folderPath.split('/').filter(part => part.length > 0);
		let currentPath = '';
		
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			
			try {
				const exists = this.app.vault.getAbstractFileByPath(currentPath);
				if (!exists) {
					await this.app.vault.createFolder(currentPath);
					this.logger.info(`Created folder part: ${currentPath}`);
				}
			} catch (error) {
				// If vault API fails, try adapter
				try {
					await this.app.vault.adapter.stat(currentPath);
				} catch {
					await this.app.vault.adapter.mkdir(currentPath);
					this.logger.info(`Created folder part via adapter: ${currentPath}`);
				}
			}
		}
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}
