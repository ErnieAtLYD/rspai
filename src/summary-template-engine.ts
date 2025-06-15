/**
 * Summary Template Engine
 * Provides flexible template management for generating different types of summaries
 * with customizable sections, formatting, and conditional content.
 */

import {
  SummaryTemplate,
  TemplateSection,
  SectionFilter,
  SummaryOptions,
  Insight,
  Recommendation,
  TrendAnalysis,
  SummaryMetric,
  TimelineEvent,
  GeneratedSummary,
  SummaryContext
} from './summary-generation-interfaces';

/**
 * Template variable for dynamic content replacement
 */
export interface TemplateVariable {
  name: string;
  value: unknown;
  type: 'string' | 'number' | 'date' | 'array' | 'object';
  formatter?: (value: unknown) => string;
}

/**
 * Template rendering context
 */
export interface TemplateRenderContext {
  variables: Map<string, TemplateVariable>;
  insights: Insight[];
  recommendations: Recommendation[];
  trends: TrendAnalysis[];
  metrics: SummaryMetric[];
  timeline?: TimelineEvent[];
  options: SummaryOptions;
  summaryContext: SummaryContext;
}

/**
 * Template rendering result
 */
export interface TemplateRenderResult {
  content: string;
  sectionsRendered: string[];
  variablesUsed: string[];
  warnings: string[];
  renderTime: number;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingVariables: string[];
  unusedSections: string[];
}

/**
 * Default template configurations
 */
const DEFAULT_TEMPLATES: Record<string, SummaryTemplate> = {
  executive: {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview focusing on key insights and strategic recommendations',
    category: 'professional',
    sections: [
      {
        id: 'header',
        name: 'Summary Header',
        description: 'Title, date range, and scope',
        order: 1,
        required: true,
        contentType: 'custom',
        format: 'paragraph',
        includeMetadata: true
      },
      {
        id: 'key-insights',
        name: 'Key Insights',
        description: 'Top 5 most important insights',
        order: 2,
        required: true,
        contentType: 'insights',
        maxItems: 5,
        minItems: 3,
        sortBy: 'importance',
        format: 'list',
        filters: [
          {
            field: 'importance',
            operator: 'greater-than',
            value: 0.7,
            required: true
          }
        ]
      },
      {
        id: 'strategic-recommendations',
        name: 'Strategic Recommendations',
        description: 'High-impact actionable recommendations',
        order: 3,
        required: true,
        contentType: 'recommendations',
        maxItems: 3,
        format: 'list',
        filters: [
          {
            field: 'priority',
            operator: 'in',
            value: ['high', 'urgent'],
            required: true
          }
        ]
      },
      {
        id: 'key-metrics',
        name: 'Key Performance Indicators',
        description: 'Important metrics and trends',
        order: 4,
        required: false,
        contentType: 'metrics',
        maxItems: 4,
        format: 'table'
      }
    ],
    defaultOptions: {
      format: 'executive',
      style: 'formal',
      tone: 'analytical',
      maxInsights: 5,
      includeEvidence: false,
      includeRecommendations: true,
      includeMetadata: false
    },
    version: '1.0.0',
    tags: ['executive', 'professional', 'high-level'],
    isDefault: true,
    customizable: true,
    requiredFields: ['header', 'key-insights'],
    optionalFields: ['strategic-recommendations', 'key-metrics']
  },

  detailed: {
    id: 'detailed-analysis',
    name: 'Detailed Analysis',
    description: 'Comprehensive analysis with full evidence and detailed recommendations',
    category: 'professional',
    sections: [
      {
        id: 'executive-summary',
        name: 'Executive Summary',
        description: 'Brief overview of key findings',
        order: 1,
        required: true,
        contentType: 'custom',
        format: 'paragraph'
      },
      {
        id: 'all-insights',
        name: 'Detailed Insights',
        description: 'All significant insights with evidence',
        order: 2,
        required: true,
        contentType: 'insights',
        format: 'paragraph',
        includeEvidence: true,
        sortBy: 'importance'
      },
      {
        id: 'trend-analysis',
        name: 'Trend Analysis',
        description: 'Temporal patterns and trends',
        order: 3,
        required: false,
        contentType: 'trends',
        format: 'paragraph'
      },
      {
        id: 'recommendations',
        name: 'Detailed Recommendations',
        description: 'Comprehensive action plan',
        order: 4,
        required: true,
        contentType: 'recommendations',
        format: 'paragraph',
        includeEvidence: true
      },
      {
        id: 'timeline',
        name: 'Timeline of Events',
        description: 'Chronological view of important events',
        order: 5,
        required: false,
        contentType: 'timeline',
        format: 'timeline'
      },
      {
        id: 'metrics-dashboard',
        name: 'Metrics Dashboard',
        description: 'Comprehensive metrics and KPIs',
        order: 6,
        required: false,
        contentType: 'metrics',
        format: 'table'
      }
    ],
    defaultOptions: {
      format: 'detailed',
      style: 'formal',
      tone: 'analytical',
      maxInsights: 20,
      includeEvidence: true,
      includeRecommendations: true,
      includeMetadata: true,
      includeTrends: true,
      includeTimeline: true
    },
    version: '1.0.0',
    tags: ['detailed', 'comprehensive', 'analysis'],
    isDefault: false,
    customizable: true,
    requiredFields: ['executive-summary', 'all-insights', 'recommendations'],
    optionalFields: ['trend-analysis', 'timeline', 'metrics-dashboard']
  },

  personal: {
    id: 'personal-reflection',
    name: 'Personal Reflection',
    description: 'Personal-focused summary with emphasis on growth and wellbeing',
    category: 'personal',
    sections: [
      {
        id: 'reflection-intro',
        name: 'Reflection Introduction',
        description: 'Personal greeting and context',
        order: 1,
        required: true,
        contentType: 'custom',
        format: 'paragraph'
      },
      {
        id: 'achievements',
        name: 'Achievements & Wins',
        description: 'Positive accomplishments and progress',
        order: 2,
        required: true,
        contentType: 'insights',
        format: 'list',
        filters: [
          {
            field: 'type',
            operator: 'equals',
            value: 'achievement',
            required: false
          },
          {
            field: 'category',
            operator: 'in',
            value: ['achievements', 'goals', 'productivity'],
            required: false
          }
        ]
      },
      {
        id: 'growth-areas',
        name: 'Growth Opportunities',
        description: 'Areas for improvement and development',
        order: 3,
        required: true,
        contentType: 'insights',
        format: 'paragraph',
        filters: [
          {
            field: 'category',
            operator: 'in',
            value: ['challenges', 'opportunities', 'learning'],
            required: false
          }
        ]
      },
      {
        id: 'personal-recommendations',
        name: 'Personal Action Items',
        description: 'Actionable steps for personal growth',
        order: 4,
        required: true,
        contentType: 'recommendations',
        format: 'list',
        filters: [
          {
            field: 'category',
            operator: 'in',
            value: ['personal-growth', 'health-wellness', 'habit-formation'],
            required: false
          }
        ]
      },
      {
        id: 'wellbeing-metrics',
        name: 'Wellbeing Check',
        description: 'Health and wellness indicators',
        order: 5,
        required: false,
        contentType: 'metrics',
        format: 'list',
        filters: [
          {
            field: 'category',
            operator: 'equals',
            value: 'wellbeing',
            required: true
          }
        ]
      }
    ],
    defaultOptions: {
      format: 'detailed',
      style: 'personal',
      tone: 'encouraging',
      maxInsights: 15,
      includeEvidence: false,
      includeRecommendations: true,
      includeMetadata: false
    },
    version: '1.0.0',
    tags: ['personal', 'reflection', 'growth', 'wellbeing'],
    isDefault: false,
    customizable: true,
    requiredFields: ['reflection-intro', 'achievements', 'growth-areas'],
    optionalFields: ['personal-recommendations', 'wellbeing-metrics']
  }
};

/**
 * Summary Template Engine implementation
 */
export class SummaryTemplateEngine {
  private templates: Map<string, SummaryTemplate>;
  private customTemplates: Map<string, SummaryTemplate>;

  constructor() {
    this.templates = new Map();
    this.customTemplates = new Map();
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates into the engine
   */
  private loadDefaultTemplates(): void {
    Object.values(DEFAULT_TEMPLATES).forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): SummaryTemplate[] {
    return [
      ...Array.from(this.templates.values()),
      ...Array.from(this.customTemplates.values())
    ];
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): SummaryTemplate | null {
    return this.templates.get(templateId) || this.customTemplates.get(templateId) || null;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): SummaryTemplate[] {
    return this.getAvailableTemplates().filter(template => template.category === category);
  }

  /**
   * Get default template for a category
   */
  getDefaultTemplate(category?: string): SummaryTemplate {
    if (category) {
      const categoryTemplates = this.getTemplatesByCategory(category);
      const defaultTemplate = categoryTemplates.find(t => t.isDefault);
      if (defaultTemplate) return defaultTemplate;
    }
    
    // Return first default template or executive template as fallback
    return this.getAvailableTemplates().find(t => t.isDefault) || DEFAULT_TEMPLATES.executive;
  }

  /**
   * Save a custom template
   */
  saveTemplate(template: SummaryTemplate): void {
    const validationResult = this.validateTemplate(template);
    if (!validationResult.isValid) {
      throw new Error(`Invalid template: ${validationResult.errors.join(', ')}`);
    }
    
    this.customTemplates.set(template.id, { ...template });
  }

  /**
   * Delete a custom template
   */
  deleteTemplate(templateId: string): boolean {
    if (this.templates.has(templateId)) {
      throw new Error('Cannot delete built-in template');
    }
    return this.customTemplates.delete(templateId);
  }

  /**
   * Validate template structure and configuration
   */
  validateTemplate(template: SummaryTemplate): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingVariables: string[] = [];
    const unusedSections: string[] = [];

    // Basic validation
    if (!template.id || template.id.trim() === '') {
      errors.push('Template ID is required');
    }
    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }
    if (!template.sections || template.sections.length === 0) {
      errors.push('Template must have at least one section');
    }

    // Section validation
    if (template.sections) {
      const sectionIds = new Set<string>();
      const orders = new Set<number>();

      template.sections.forEach((section, index) => {
        // Check for duplicate IDs
        if (sectionIds.has(section.id)) {
          errors.push(`Duplicate section ID: ${section.id}`);
        }
        sectionIds.add(section.id);

        // Check for duplicate orders
        if (orders.has(section.order)) {
          warnings.push(`Duplicate section order: ${section.order}`);
        }
        orders.add(section.order);

        // Validate section structure
        if (!section.name || section.name.trim() === '') {
          errors.push(`Section ${section.id} must have a name`);
        }
        if (section.order < 1) {
          errors.push(`Section ${section.id} order must be positive`);
        }
        if (section.maxItems && section.minItems && section.maxItems < section.minItems) {
          errors.push(`Section ${section.id} maxItems cannot be less than minItems`);
        }

        // Validate filters
        if (section.filters) {
          section.filters.forEach((filter, filterIndex) => {
            if (!filter.field || filter.field.trim() === '') {
              errors.push(`Section ${section.id} filter ${filterIndex} must have a field`);
            }
            if (filter.value === undefined || filter.value === null) {
              warnings.push(`Section ${section.id} filter ${filterIndex} has no value`);
            }
          });
        }
      });

      // Check required fields
      if (template.requiredFields) {
        template.requiredFields.forEach(fieldId => {
          if (!sectionIds.has(fieldId)) {
            errors.push(`Required field ${fieldId} not found in sections`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingVariables,
      unusedSections
    };
  }

  /**
   * Render template with provided context
   */
  renderTemplate(
    template: SummaryTemplate,
    context: TemplateRenderContext
  ): TemplateRenderResult {
    const startTime = Date.now();
    const sectionsRendered: string[] = [];
    const variablesUsed: string[] = [];
    const warnings: string[] = [];

    // Sort sections by order
    const sortedSections = [...template.sections].sort((a, b) => a.order - b.order);

    // Render each section
    const renderedSections = sortedSections.map(section => {
      try {
        const sectionContent = this.renderSection(section, context);
        if (sectionContent.trim()) {
          sectionsRendered.push(section.id);
          return sectionContent;
        }
        return '';
      } catch (error) {
        warnings.push(`Failed to render section ${section.id}: ${error.message}`);
        return '';
      }
    }).filter(content => content.trim() !== '');

    // Combine sections into final content
    const content = renderedSections.join('\n\n');

    // Replace template variables
    const finalContent = this.replaceVariables(content, context.variables, variablesUsed);

    return {
      content: finalContent,
      sectionsRendered,
      variablesUsed,
      warnings,
      renderTime: Date.now() - startTime
    };
  }

  /**
   * Render individual section
   */
  private renderSection(section: TemplateSection, context: TemplateRenderContext): string {
    // Apply filters to get relevant content
    const filteredContent = this.applyFilters(section, context);

    // Generate section content based on type and format
    switch (section.contentType) {
      case 'insights':
        return this.renderInsightsSection(section, filteredContent.insights, context);
      case 'recommendations':
        return this.renderRecommendationsSection(section, filteredContent.recommendations, context);
      case 'trends':
        return this.renderTrendsSection(section, filteredContent.trends, context);
      case 'metrics':
        return this.renderMetricsSection(section, filteredContent.metrics, context);
      case 'timeline':
        return this.renderTimelineSection(section, filteredContent.timeline || [], context);
      case 'custom':
        return this.renderCustomSection(section, context);
      default:
        return '';
    }
  }

  /**
   * Apply filters to content based on section configuration
   */
  private applyFilters(section: TemplateSection, context: TemplateRenderContext): {
    insights: Insight[];
    recommendations: Recommendation[];
    trends: TrendAnalysis[];
    metrics: SummaryMetric[];
    timeline: TimelineEvent[];
  } {
    let insights = [...context.insights];
    let recommendations = [...context.recommendations];
    let trends = [...context.trends];
    let metrics = [...context.metrics];
    let timeline = [...(context.timeline || [])];

    // Apply section filters
    if (section.filters) {
      section.filters.forEach(filter => {
        insights = this.filterArray(insights, filter);
        recommendations = this.filterArray(recommendations, filter);
        trends = this.filterArray(trends, filter);
        metrics = this.filterArray(metrics, filter);
        timeline = this.filterArray(timeline, filter);
      });
    }

    // Apply sorting
    if (section.sortBy) {
      insights = this.sortArray(insights, section.sortBy);
      recommendations = this.sortArray(recommendations, section.sortBy);
      trends = this.sortArray(trends, section.sortBy);
      metrics = this.sortArray(metrics, section.sortBy);
      timeline = this.sortArray(timeline, section.sortBy);
    }

    // Apply item limits
    if (section.maxItems) {
      insights = insights.slice(0, section.maxItems);
      recommendations = recommendations.slice(0, section.maxItems);
      trends = trends.slice(0, section.maxItems);
      metrics = metrics.slice(0, section.maxItems);
      timeline = timeline.slice(0, section.maxItems);
    }

    return { insights, recommendations, trends, metrics, timeline };
  }

  /**
   * Filter array based on filter configuration
   */
  private filterArray<T>(array: T[], filter: SectionFilter): T[] {
    return array.filter(item => {
      const value = this.getNestedProperty(item, filter.field);
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return typeof value === 'string' && value.includes(filter.value);
        case 'greater-than':
          return typeof value === 'number' && value > filter.value;
        case 'less-than':
          return typeof value === 'number' && value < filter.value;
        case 'in':
          return Array.isArray(filter.value) && filter.value.includes(value);
        case 'not-in':
          return Array.isArray(filter.value) && !filter.value.includes(value);
        default:
          return true;
      }
    });
  }

  /**
   * Sort array based on sort field
   */
  private sortArray<T>(array: T[], sortBy: string): T[] {
    return [...array].sort((a, b) => {
      const valueA = this.getNestedProperty(a, sortBy);
      const valueB = this.getNestedProperty(b, sortBy);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return valueB - valueA; // Descending order for numbers
      }
      if (valueA instanceof Date && valueB instanceof Date) {
        return valueB.getTime() - valueA.getTime(); // Descending order for dates
      }
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB); // Ascending order for strings
      }
      return 0;
    });
  }

  /**
   * Get nested property value from object
   */
  private getNestedProperty(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Render insights section
   */
  private renderInsightsSection(
    section: TemplateSection,
    insights: Insight[],
    context: TemplateRenderContext
  ): string {
    if (insights.length === 0) return '';

    const sectionHeader = `## ${section.name}\n`;
    
    switch (section.format) {
      case 'list': {
        const listItems = insights.map(insight => {
          let item = `- **${insight.title}**: ${insight.description}`;
          if (section.includeEvidence && insight.evidence.length > 0) {
            item += `\n  - *Evidence: ${insight.evidence[0].excerpt}*`;
          }
          return item;
        });
        return sectionHeader + listItems.join('\n');
      }

      case 'paragraph': {
        const paragraphs = insights.map(insight => {
          let paragraph = `**${insight.title}**\n\n${insight.description}`;
          if (section.includeEvidence && insight.evidence.length > 0) {
            paragraph += `\n\n*Supporting evidence: ${insight.evidence[0].excerpt}*`;
          }
          return paragraph;
        });
        return sectionHeader + paragraphs.join('\n\n');
      }

      case 'table': {
        const headers = '| Insight | Importance | Category | Trend |';
        const separator = '|---------|------------|----------|-------|';
        const rows = insights.map(insight => 
          `| ${insight.title} | ${(insight.importance * 100).toFixed(0)}% | ${insight.category} | ${insight.trend} |`
        );
        return sectionHeader + [headers, separator, ...rows].join('\n');
      }

      default:
        return sectionHeader + insights.map(i => i.description).join('\n\n');
    }
  }

  /**
   * Render recommendations section
   */
  private renderRecommendationsSection(
    section: TemplateSection,
    recommendations: Recommendation[],
    context: TemplateRenderContext
  ): string {
    if (recommendations.length === 0) return '';

    const sectionHeader = `## ${section.name}\n`;
    
    switch (section.format) {
      case 'list': {
        const listItems = recommendations.map((rec, index) => {
          let item = `${index + 1}. **${rec.title}** (${rec.priority} priority)\n   ${rec.description}`;
          if (rec.actionSteps.length > 0) {
            item += `\n   - Next step: ${rec.actionSteps[0].description}`;
          }
          return item;
        });
        return sectionHeader + listItems.join('\n\n');
      }

      case 'paragraph': {
        const paragraphs = recommendations.map(rec => {
          let paragraph = `**${rec.title}** (${rec.priority} priority)\n\n${rec.description}`;
          paragraph += `\n\n*Expected outcome: ${rec.expectedOutcome}*`;
          if (rec.actionSteps.length > 0) {
            paragraph += `\n\n**Action steps:**\n${rec.actionSteps.map((step, i) => `${i + 1}. ${step.description}`).join('\n')}`;
          }
          return paragraph;
        });
        return sectionHeader + paragraphs.join('\n\n');
      }

      default:
        return sectionHeader + recommendations.map(r => `- ${r.title}: ${r.description}`).join('\n');
    }
  }

  /**
   * Render trends section
   */
  private renderTrendsSection(
    section: TemplateSection,
    trends: TrendAnalysis[],
    context: TemplateRenderContext
  ): string {
    if (trends.length === 0) return '';

    const sectionHeader = `## ${section.name}\n`;
    
    const trendItems = trends.map(trend => {
      return `**${trend.title}** (${trend.direction}, ${trend.significance} significance)\n${trend.description}`;
    });

    return sectionHeader + trendItems.join('\n\n');
  }

  /**
   * Render metrics section
   */
  private renderMetricsSection(
    section: TemplateSection,
    metrics: SummaryMetric[],
    context: TemplateRenderContext
  ): string {
    if (metrics.length === 0) return '';

    const sectionHeader = `## ${section.name}\n`;
    
    switch (section.format) {
      case 'table': {
        const headers = '| Metric | Value | Change | Category |';
        const separator = '|--------|-------|--------|----------|';
        const rows = metrics.map(metric => {
          const change = metric.change ? `${metric.change > 0 ? '+' : ''}${metric.change}` : 'N/A';
          return `| ${metric.name} | ${metric.value}${metric.unit || ''} | ${change} | ${metric.category} |`;
        });
        return sectionHeader + [headers, separator, ...rows].join('\n');
      }

      case 'list': {
        const listItems = metrics.map(metric => {
          const change = metric.change ? ` (${metric.change > 0 ? '+' : ''}${metric.change})` : '';
          return `- **${metric.name}**: ${metric.value}${metric.unit || ''}${change}`;
        });
        return sectionHeader + listItems.join('\n');
      }

      default:
        return sectionHeader + metrics.map(m => `${m.name}: ${m.value}${m.unit || ''}`).join('\n');
    }
  }

  /**
   * Render timeline section
   */
  private renderTimelineSection(
    section: TemplateSection,
    timeline: TimelineEvent[],
    context: TemplateRenderContext
  ): string {
    if (timeline.length === 0) return '';

    const sectionHeader = `## ${section.name}\n`;
    
    const timelineItems = timeline
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(event => {
        const date = event.date.toLocaleDateString();
        return `**${date}** - ${event.title}\n${event.description}`;
      });

    return sectionHeader + timelineItems.join('\n\n');
  }

  /**
   * Render custom section
   */
  private renderCustomSection(
    section: TemplateSection,
    context: TemplateRenderContext
  ): string {
    const sectionHeader = `## ${section.name}\n`;
    
    // Custom sections can be handled based on section ID
    switch (section.id) {
      case 'header':
        return this.renderHeaderSection(context);
      case 'executive-summary':
        return this.renderExecutiveSummarySection(context);
      case 'reflection-intro':
        return this.renderReflectionIntroSection(context);
      default:
        return sectionHeader + `Custom section: ${section.description}`;
    }
  }

  /**
   * Render header section
   */
  private renderHeaderSection(context: TemplateRenderContext): string {
    const { options } = context;
    const dateRange = `${options.dateRange.start.toLocaleDateString()} - ${options.dateRange.end.toLocaleDateString()}`;
    
    return `# {{title}}\n\n**Period:** ${dateRange}\n**Scope:** ${options.scope}\n**Generated:** {{generatedAt}}\n`;
  }

  /**
   * Render executive summary section
   */
  private renderExecutiveSummarySection(context: TemplateRenderContext): string {
    return `## Executive Summary\n\n{{executiveSummary}}\n`;
  }

  /**
   * Render reflection intro section
   */
  private renderReflectionIntroSection(context: TemplateRenderContext): string {
    const dateRange = `${context.options.dateRange.start.toLocaleDateString()} - ${context.options.dateRange.end.toLocaleDateString()}`;
    return `# Personal Reflection\n\n*${dateRange}*\n\nHere's your personal summary for this period, focusing on your growth, achievements, and opportunities ahead.\n`;
  }

  /**
   * Replace template variables in content
   */
  private replaceVariables(
    content: string,
    variables: Map<string, TemplateVariable>,
    variablesUsed: string[]
  ): string {
    let result = content;
    
    // Replace {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, variableName) => {
      const variable = variables.get(variableName);
      if (variable) {
        variablesUsed.push(variableName);
        if (variable.formatter) {
          return variable.formatter(variable.value);
        }
        return String(variable.value);
      }
      return match; // Keep original if variable not found
    });

    return result;
  }

  /**
   * Create template variables from summary context
   */
  createTemplateVariables(
    summary: Partial<GeneratedSummary>,
    context: SummaryContext
  ): Map<string, TemplateVariable> {
    const variables = new Map<string, TemplateVariable>();

    // Basic variables
    variables.set('title', {
      name: 'title',
      value: summary.title || 'Summary Report',
      type: 'string'
    });

    variables.set('generatedAt', {
      name: 'generatedAt',
      value: new Date(),
      type: 'date',
      formatter: (date: Date) => date.toLocaleString()
    });

    variables.set('executiveSummary', {
      name: 'executiveSummary',
      value: summary.executiveSummary || 'Executive summary will be generated based on insights.',
      type: 'string'
    });

    variables.set('insightCount', {
      name: 'insightCount',
      value: summary.insights?.length || 0,
      type: 'number'
    });

    variables.set('recommendationCount', {
      name: 'recommendationCount',
      value: summary.recommendations?.length || 0,
      type: 'number'
    });

    variables.set('documentsAnalyzed', {
      name: 'documentsAnalyzed',
      value: summary.documentsAnalyzed || 0,
      type: 'number'
    });

    return variables;
  }
} 