// src/markdown-formatter-factory.ts
/**
 * Factory for creating specialized markdown formatters
 * Provides different styles and formatting options for different use cases
 * Includes specialized formatters for personal, business, academic, technical,
 * minimal, report, blog, and notes use cases
 * Supports template library management and customization
 * Provides validation and import/export functionality
 */


import {
	MarkdownFormatter,
	MarkdownFormatterFactory,
	MarkdownGenerationConfig,
	MarkdownFormattingPreferences,
	MarkdownTemplate,
	MarkdownStyles,
	ValidationResult,
	ImportResult
} from './markdown-formatter-interfaces';

import { CoreMarkdownFormatter } from './markdown-formatter';
import { Logger } from './logger';

export class DefaultMarkdownFormatterFactory implements MarkdownFormatterFactory {
	private logger: Logger;

	constructor(logger?: Logger) {
		this.logger = logger || new Logger('MarkdownFormatterFactory');
	}

	createPersonalFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'standard',
			detailLevel: 'standard',
			useCallouts: true,
			useEmphasis: true,
			useTables: false, // Prefer lists for personal use
			useTaskLists: true,
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'trends'
			],
			sectionOrder: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'trends'
			],
			includeTimestamps: true,
			includeReadingTime: true,
			includeWordCount: false,
			preferredExportFormat: 'markdown',
			includeSourceLinks: true,
			styles: this.getPersonalStyles()
		};

		this.logger.debug('Created personal markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createBusinessFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'detailed',
			detailLevel: 'verbose',
			useCallouts: true,
			useEmphasis: true,
			useTables: true, // Business prefers structured data
			useTaskLists: false,
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'trends',
				'metrics'
			],
			sectionOrder: [
				'executive-summary',
				'metrics',
				'key-insights',
				'recommendations',
				'trends'
			],
			includeTableOfContents: true,
			includeTimestamps: true,
			includeReadingTime: true,
			includeWordCount: true,
			preferredExportFormat: 'pdf',
			includeSourceLinks: true,
			includeFootnotes: true,
			styles: this.getBusinessStyles()
		};

		this.logger.debug('Created business markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createAcademicFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'comprehensive',
			detailLevel: 'verbose',
			useCallouts: false, // Academic prefers formal tone
			useEmphasis: true,
			useTables: true,
			useTaskLists: false,
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'executive-summary',
				'key-insights',
				'evidence',
				'trends',
				'recommendations',
				'conclusion'
			],
			sectionOrder: [
				'executive-summary',
				'key-insights',
				'evidence',
				'trends',
				'recommendations',
				'conclusion'
			],
			includeTableOfContents: true,
			includeTimestamps: true,
			includeReadingTime: true,
			includeWordCount: true,
			includeEvidence: true,
			preferredExportFormat: 'pdf',
			includeSourceLinks: true,
			includeFootnotes: true,
			styles: this.getAcademicStyles()
		};

		this.logger.debug('Created academic markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createTechnicalFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'detailed',
			detailLevel: 'verbose',
			useCallouts: true,
			useEmphasis: true,
			useTables: true,
			useTaskLists: true, // Technical docs often have action items
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'metrics',
				'evidence',
				'appendix'
			],
			sectionOrder: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'metrics',
				'evidence',
				'appendix'
			],
			includeTableOfContents: true,
			includeTimestamps: true,
			includeReadingTime: false,
			includeWordCount: false,
			preferredExportFormat: 'markdown',
			includeSourceLinks: true,
			includeFootnotes: false,
			styles: this.getTechnicalStyles()
		};

		this.logger.debug('Created technical markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createCustomFormatter(config: MarkdownGenerationConfig): MarkdownFormatter {
		this.logger.debug('Created custom markdown formatter with provided config');
		return new CoreMarkdownFormatter(config.preferences, this.logger);
	}

	// Specialized factory methods for specific use cases

	createMinimalFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'brief',
			detailLevel: 'minimal',
			useCallouts: false,
			useEmphasis: false,
			useTables: false,
			useTaskLists: false,
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: ['executive-summary', 'key-insights'],
			sectionOrder: ['executive-summary', 'key-insights'],
			includeTimestamps: false,
			includeReadingTime: false,
			includeWordCount: false,
			includeEvidence: false,
			includeMetrics: false,
			preferredExportFormat: 'plain-text',
			includeSourceLinks: false,
			styles: this.getMinimalStyles()
		};

		this.logger.debug('Created minimal markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createReportFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'comprehensive',
			detailLevel: 'verbose',
			useCallouts: true,
			useEmphasis: true,
			useTables: true,
			useTaskLists: false,
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'executive-summary',
				'metrics',
				'key-insights',
				'trends',
				'recommendations',
				'evidence',
				'conclusion',
				'appendix'
			],
			sectionOrder: [
				'executive-summary',
				'metrics',
				'key-insights',
				'trends',
				'recommendations',
				'evidence',
				'conclusion',
				'appendix'
			],
			includeTableOfContents: true,
			includeTimestamps: true,
			includeReadingTime: true,
			includeWordCount: true,
			preferredExportFormat: 'pdf',
			includeSourceLinks: true,
			includeFootnotes: true,
			useHorizontalRules: true,
			styles: this.getReportStyles()
		};

		this.logger.debug('Created report markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createBlogFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'standard',
			detailLevel: 'standard',
			useCallouts: true,
			useEmphasis: true,
			useTables: false, // Blogs prefer narrative flow
			useTaskLists: false,
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'conclusion'
			],
			sectionOrder: [
				'executive-summary',
				'key-insights',
				'recommendations',
				'conclusion'
			],
			includeTimestamps: false,
			includeReadingTime: true,
			includeWordCount: false,
			preferredExportFormat: 'html',
			includeSourceLinks: false, // Keep it clean for blog
			styles: this.getBlogStyles()
		};

		this.logger.debug('Created blog markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	createNotesFormatter(): MarkdownFormatter {
		const preferences: Partial<MarkdownFormattingPreferences> = {
			summaryLength: 'standard',
			detailLevel: 'standard',
			useCallouts: true,
			useEmphasis: true,
			useTables: false,
			useTaskLists: true, // Notes often have todos
			bulletStyle: '-',
			numberedListStyle: '1.',
			includedSections: [
				'key-insights',
				'recommendations',
				'trends'
			],
			sectionOrder: [
				'key-insights',
				'recommendations',
				'trends'
			],
			includeTimestamps: true,
			includeReadingTime: false,
			includeWordCount: false,
			preferredExportFormat: 'markdown',
			includeSourceLinks: true,
			styles: this.getNotesStyles()
		};

		this.logger.debug('Created notes markdown formatter');
		return new CoreMarkdownFormatter(preferences, this.logger);
	}

	// Style definitions for different formatter types

	private getPersonalStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 2,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'obsidian'
		};
	}

	private getBusinessStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 3, // More spacing for formal documents
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'github' // More professional
		};
	}

	private getAcademicStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '_', // Academic preference
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 2,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'reference', // Academic style
			includeBacklinks: true,
			calloutStyle: 'custom',
			customCalloutPrefix: '**Note:**'
		};
	}

	private getTechnicalStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: 'text', // Default for code blocks
			blockquoteStyle: '> ',
			sectionSpacing: 2,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: true,
			calloutStyle: 'obsidian'
		};
	}

	private getMinimalStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: false, // Minimal
			tableStyle: 'simple',
			codeBlockLanguage: '',
			blockquoteStyle: '>',
			sectionSpacing: 1, // Minimal spacing
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'custom',
			customCalloutPrefix: ''
		};
	}

	private getReportStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 3, // Formal spacing
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'github'
		};
	}

	private getBlogStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 2,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'github'
		};
	}

	private getNotesStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 1, // Compact for notes
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: true, // Good for note-taking
			calloutStyle: 'obsidian'
		};
	}
}

// Template library implementation
export class MarkdownTemplateLibrary {
	private templates: Map<string, MarkdownTemplate>;
	private logger: Logger;

	constructor(logger?: Logger) {
		this.templates = new Map();
		this.logger = logger || new Logger('MarkdownTemplateLibrary');
		this.initializeDefaultTemplates();
	}

	getTemplate(id: string): MarkdownTemplate | null {
		return this.templates.get(id) || null;
	}

	getAllTemplates(): MarkdownTemplate[] {
		return Array.from(this.templates.values());
	}

	getTemplatesByCategory(category: string): MarkdownTemplate[] {
		return Array.from(this.templates.values())
			.filter(template => template.category === category);
	}

	addTemplate(template: MarkdownTemplate): void {
		this.templates.set(template.id, template);
		this.logger.debug(`Added template: ${template.name}`);
	}

	updateTemplate(id: string, template: Partial<MarkdownTemplate>): boolean {
		const existing = this.templates.get(id);
		if (!existing) {
			return false;
		}

		const updated = { ...existing, ...template };
		this.templates.set(id, updated);
		this.logger.debug(`Updated template: ${id}`);
		return true;
	}

	removeTemplate(id: string): boolean {
		const removed = this.templates.delete(id);
		if (removed) {
			this.logger.debug(`Removed template: ${id}`);
		}
		return removed;
	}

	duplicateTemplate(id: string, newName: string): MarkdownTemplate | null {
		const original = this.templates.get(id);
		if (!original) {
			return null;
		}

		const duplicate: MarkdownTemplate = {
			...original,
			id: `${id}-copy-${Date.now()}`,
			name: newName,
			isCustom: true,
			usageCount: 0,
			lastUsed: undefined
		};

		this.templates.set(duplicate.id, duplicate);
		this.logger.debug(`Duplicated template: ${id} -> ${duplicate.id}`);
		return duplicate;
	}

	validateTemplate(template: MarkdownTemplate): ValidationResult {
		// Use the formatter's validation logic
		const formatter = new CoreMarkdownFormatter();
		return formatter.validateTemplate(template);
	}

	getDefaultTemplate(): MarkdownTemplate {
		const defaultTemplate = this.templates.get('default');
		if (!defaultTemplate) {
			throw new Error('Default template not found');
		}
		return defaultTemplate;
	}

	importTemplates(templates: MarkdownTemplate[]): ImportResult {
		let imported = 0;
		let skipped = 0;
		const errors: string[] = [];
		const warnings: string[] = [];

		for (const template of templates) {
			try {
				const validation = this.validateTemplate(template);
				
				if (!validation.isValid) {
					errors.push(`Template ${template.id}: ${validation.errors.map(e => e.message).join(', ')}`);
					skipped++;
					continue;
				}

				if (this.templates.has(template.id)) {
					warnings.push(`Template ${template.id} already exists, skipping`);
					skipped++;
					continue;
				}

				this.addTemplate(template);
				imported++;
			} catch (error) {
				errors.push(`Template ${template.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				skipped++;
			}
		}

		this.logger.info(`Import completed: ${imported} imported, ${skipped} skipped`);
		return { imported, skipped, errors, warnings };
	}

	exportTemplates(ids?: string[]): MarkdownTemplate[] {
		if (ids) {
			return ids.map(id => this.templates.get(id)).filter(Boolean) as MarkdownTemplate[];
		}
		return this.getAllTemplates();
	}

	private initializeDefaultTemplates(): void {
		// Default template
		const defaultTemplate: MarkdownTemplate = {
			id: 'default',
			name: 'Default Template',
			description: 'Standard markdown formatting template',
			sections: [
				{
					id: 'executive-summary',
					title: 'Executive Summary',
					type: 'executive-summary',
					contentTypes: ['summary'],
					headingLevel: 2,
					required: true,
					order: 1
				},
				{
					id: 'insights',
					title: 'Key Insights',
					type: 'key-insights',
					contentTypes: ['insights'],
					headingLevel: 2,
					required: true,
					order: 2
				},
				{
					id: 'recommendations',
					title: 'Recommendations',
					type: 'recommendations',
					contentTypes: ['recommendations'],
					headingLevel: 2,
					required: false,
					order: 3
				}
			],
			styles: this.getDefaultStyles(),
			category: 'personal',
			tags: ['default', 'standard'],
			version: '1.0.0',
			isDefault: true,
			isCustom: false,
			usageCount: 0
		};

		// Business template
		const businessTemplate: MarkdownTemplate = {
			id: 'business',
			name: 'Business Report Template',
			description: 'Professional business report formatting',
			header: '# Business Analysis Report\n\n*Generated on {{date}}*',
			footer: '\n\n---\n\n*This report was automatically generated from data analysis.*',
			sections: [
				{
					id: 'executive-summary',
					title: 'Executive Summary',
					type: 'executive-summary',
					contentTypes: ['summary'],
					headingLevel: 2,
					required: true,
					order: 1
				},
				{
					id: 'metrics',
					title: 'Key Metrics',
					type: 'metrics',
					contentTypes: ['metrics'],
					headingLevel: 2,
					required: true,
					order: 2
				},
				{
					id: 'insights',
					title: 'Strategic Insights',
					type: 'key-insights',
					contentTypes: ['insights'],
					headingLevel: 2,
					required: true,
					order: 3
				},
				{
					id: 'recommendations',
					title: 'Action Items',
					type: 'recommendations',
					contentTypes: ['recommendations'],
					headingLevel: 2,
					required: true,
					order: 4
				}
			],
			styles: this.getBusinessStyles(),
			category: 'business',
			tags: ['business', 'professional', 'report'],
			version: '1.0.0',
			isDefault: false,
			isCustom: false,
			usageCount: 0
		};

		this.templates.set('default', defaultTemplate);
		this.templates.set('business', businessTemplate);
		
		this.logger.debug('Initialized default templates');
	}

	private getDefaultStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 2,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'obsidian'
		};
	}

	private getBusinessStyles(): MarkdownStyles {
		return {
			headingStyle: 'atx',
			emphasisStyle: '*',
			strongStyle: '**',
			unorderedListMarker: '-',
			orderedListStyle: '1.',
			taskListStyle: '- [ ]',
			tableAlignment: 'left',
			includeTableHeaders: true,
			tableStyle: 'pipe',
			codeBlockLanguage: '',
			blockquoteStyle: '> ',
			sectionSpacing: 3,
			paragraphSpacing: 1,
			listItemSpacing: 0,
			linkStyle: 'inline',
			includeBacklinks: false,
			calloutStyle: 'github'
		};
	}
}

// Export convenience functions
export function createPersonalFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createPersonalFormatter();
}

export function createBusinessFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createBusinessFormatter();
}

export function createAcademicFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createAcademicFormatter();
}

export function createTechnicalFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createTechnicalFormatter();
}

export function createMinimalFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createMinimalFormatter();
}

export function createReportFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createReportFormatter();
}

export function createBlogFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createBlogFormatter();
}

export function createNotesFormatter(logger?: Logger): MarkdownFormatter {
	const factory = new DefaultMarkdownFormatterFactory(logger);
	return factory.createNotesFormatter();
} 