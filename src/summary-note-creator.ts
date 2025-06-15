// src/summary-note-creator.ts

import { App, TFile } from "obsidian";
import { Logger } from "./logger";
import { ProcessingResult } from "./markdown-processing-service";

export interface SummaryNoteOptions {
	folderPath: string;
	filenameTemplate: string;
	createBacklinks: boolean;
	overwriteExisting: boolean;
}

export const DEFAULT_SUMMARY_OPTIONS: SummaryNoteOptions = {
	folderPath: "Summaries",
	filenameTemplate: "Summary - {{date}} - {{originalName}}",
	createBacklinks: true,
	overwriteExisting: false,
};

/**
 * Creates a summary note for a given file.
 * 
 * @param app - The Obsidian app instance.
 * @param logger - The logger instance.
 * @param options - The options for the summary note.
 * @returns The path to the created summary note.
 */
export class SummaryNoteCreator {
	constructor(private app: App, private logger: Logger) {}

	async createSummaryNote(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: Partial<SummaryNoteOptions> = {}
	): Promise<string> {
		const opts = { ...DEFAULT_SUMMARY_OPTIONS, ...options };

		try {
			// Generate filename
			const filename = this.generateFilename(
				originalFile,
				opts.filenameTemplate
			);
			const fullPath = `${opts.folderPath}/${filename}.md`;

			this.logger.info(`Generated filename: ${filename}`);
			this.logger.info(`Full path will be: ${fullPath}`);
			this.logger.info(`Folder path: ${opts.folderPath}`);

			// Ensure folder exists first
			await this.ensureFolderExists(opts.folderPath);

			// Check if file exists
			const exists = await this.fileExists(fullPath);
			this.logger.info(`File exists check: ${exists} for path: ${fullPath}`);
			if (exists && !opts.overwriteExisting) {
				throw new Error(`Summary note already exists: ${fullPath}`);
			}

			// Generate content
			const content = this.generateSummaryContent(
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

	private generateSummaryContent(
		originalFile: TFile,
		analysisResult: ProcessingResult,
		options: SummaryNoteOptions
	): string {
		const now = new Date();
		const originalLink = options.createBacklinks
			? `[[${originalFile.path}]]`
			: originalFile.path;

		// Generate frontmatter
		const frontmatter = [
			"---",
			`title: "Summary of ${originalFile.basename}"`,
			`original_file: "${originalFile.path}"`,
			`created: ${now.toISOString()}`,
			`type: "summary"`,
			`tags: ["summary", "analysis"]`,
			"---",
			"",
		].join("\n");

		// Generate main content
		const content = [
			`# Summary of ${originalFile.basename}`,
			"",
			`**Original Note:** ${originalLink}`,
			`**Generated:** ${now.toLocaleString()}`,
			"",
			"## Analysis Results",
			"",
			this.formatAnalysisResults(analysisResult),
			"",
			"---",
			"",
			"*This summary was automatically generated by RetrospectAI*",
		].join("\n");

		return frontmatter + content;
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
				sections.push(`- **Tags:** ${result.metadata.tags.join(", ")}`);
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
