import { Logger } from './logger';
import { 
  PromptTemplate, 
  RenderedPrompt,
  AIError,
  AIErrorType 
} from './ai-interfaces';

/**
 * Template rendering context
 */
export interface TemplateContext {
  variables: Record<string, any>;
  functions?: Record<string, (...args: any[]) => any>;
  filters?: Record<string, (value: any) => string>;
}

/**
 * Template validation result
 */
export interface TemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingVariables: string[];
  unusedVariables: string[];
}

/**
 * Prompt template engine for consistent AI interactions
 */
export class PromptTemplateEngine {
  private templates: Map<string, PromptTemplate> = new Map();
  private cache: Map<string, RenderedPrompt> = new Map();
  private readonly maxCacheSize: number = 1000;

  constructor(
    private logger: Logger,
    private enableCaching: boolean = true
  ) {}

  /**
   * Register a prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.validateTemplate(template);
    this.templates.set(template.id, template);
    this.logger.debug(`Registered template: ${template.id}`);
  }

  /**
   * Register multiple templates
   */
  registerTemplates(templates: PromptTemplate[]): void {
    templates.forEach(template => this.registerTemplate(template));
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  /**
   * Get templates by tag
   */
  getTemplatesByTag(tag: string): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.tags.includes(tag));
  }

  /**
   * Render a template with variables
   */
  render(templateId: string, variables: Record<string, any> = {}): RenderedPrompt {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Template not found: ${templateId}`
      );
    }

    // Check cache first
    const cacheKey = this.getCacheKey(templateId, variables);
    if (this.enableCaching && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      this.logger.debug(`Using cached render for template: ${templateId}`);
      return cached;
    }

    // Validate variables
    this.validateVariables(template, variables);

    // Render template
    const content = this.renderTemplate(template.template, variables);

    const result: RenderedPrompt = {
      content,
      variables,
      templateId,
      renderedAt: new Date()
    };

    // Cache result
    if (this.enableCaching) {
      this.cacheResult(cacheKey, result);
    }

    this.logger.debug(`Rendered template: ${templateId}`);
    return result;
  }

  /**
   * Validate a template
   */
  validateTemplate(template: PromptTemplate): TemplateValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.template) errors.push('Template content is required');
    if (!template.category) errors.push('Template category is required');
    if (!template.version) errors.push('Template version is required');

    // Check for duplicate variable names
    const variableNames = template.variables.map(v => v.name);
    const duplicates = variableNames.filter((name, index) => 
      variableNames.indexOf(name) !== index
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate variable names: ${duplicates.join(', ')}`);
    }

    // Find variables used in template
    const usedVariables = this.extractVariables(template.template);
    const definedVariables = template.variables.map(v => v.name);

    // Check for missing variable definitions
    const missingVariables = usedVariables.filter(name => 
      !definedVariables.includes(name)
    );

    // Check for unused variable definitions
    const unusedVariables = definedVariables.filter(name => 
      !usedVariables.includes(name)
    );

    if (missingVariables.length > 0) {
      errors.push(`Variables used but not defined: ${missingVariables.join(', ')}`);
    }

    if (unusedVariables.length > 0) {
      warnings.push(`Variables defined but not used: ${unusedVariables.join(', ')}`);
    }

    const result: TemplateValidation = {
      valid: errors.length === 0,
      errors,
      warnings,
      missingVariables,
      unusedVariables
    };

    if (!result.valid) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Template validation failed: ${errors.join(', ')}`
      );
    }

    return result;
  }

  /**
   * Validate variables against template requirements
   */
  private validateVariables(template: PromptTemplate, variables: Record<string, any>): void {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];

      // Check required variables
      if (variable.required && (value === undefined || value === null)) {
        errors.push(`Required variable missing: ${variable.name}`);
        continue;
      }

      // Type validation
      if (value !== undefined && value !== null) {
        const actualType = this.getValueType(value);
        if (actualType !== variable.type) {
          errors.push(
            `Variable ${variable.name} expected type ${variable.type}, got ${actualType}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Variable validation failed: ${errors.join(', ')}`
      );
    }
  }

  /**
   * Render template content with variables
   */
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let result = template;

    // Replace simple variables {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = variables[varName];
      if (value === undefined || value === null) {
        return match; // Keep placeholder if variable not provided
      }
      return String(value);
    });

    // Replace conditional blocks {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
      const value = variables[varName];
      return this.isTruthy(value) ? content : '';
    });

    // Replace conditional blocks with else {{#if variable}}...{{#else}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/if\}\}/g, 
      (match, varName, ifContent, elseContent) => {
        const value = variables[varName];
        return this.isTruthy(value) ? ifContent : elseContent;
      }
    );

    // Replace loops {{#each array}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, varName, content) => {
      const array = variables[varName];
      if (!Array.isArray(array)) {
        return '';
      }
      return array.map((item, index) => {
        let itemContent = content;
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        // Replace {{@index}} with current index
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        // Replace {{item.property}} if item is object
        if (typeof item === 'object' && item !== null) {
          itemContent = itemContent.replace(/\{\{item\.(\w+)\}\}/g, (_itemMatch: string, prop: string) => {
            return String((item as any)[prop] || '');
          });
        }
        return itemContent;
      }).join('');
    });

    // Replace filters {{variable|filter}}
    result = result.replace(/\{\{(\w+)\|(\w+)\}\}/g, (match, varName, filterName) => {
      const value = variables[varName];
      if (value === undefined || value === null) {
        return match;
      }
      return this.applyFilter(value, filterName);
    });

    return result.trim();
  }

  /**
   * Extract variable names from template
   */
  private extractVariables(template: string): string[] {
    const variables = new Set<string>();
    
    // Simple variables {{variable}}
    const simpleMatches = template.match(/\{\{(\w+)\}\}/g);
    if (simpleMatches) {
      simpleMatches.forEach(match => {
        const varName = match.replace(/\{\{|\}\}/g, '');
        if (!varName.startsWith('#') && !varName.startsWith('/') && varName !== 'this' && !varName.startsWith('@')) {
          variables.add(varName);
        }
      });
    }

    // Conditional variables {{#if variable}}
    const conditionalMatches = template.match(/\{\{#if\s+(\w+)\}\}/g);
    if (conditionalMatches) {
      conditionalMatches.forEach(match => {
        const varName = match.replace(/\{\{#if\s+|\}\}/g, '');
        variables.add(varName);
      });
    }

    // Loop variables {{#each array}}
    const loopMatches = template.match(/\{\{#each\s+(\w+)\}\}/g);
    if (loopMatches) {
      loopMatches.forEach(match => {
        const varName = match.replace(/\{\{#each\s+|\}\}/g, '');
        variables.add(varName);
      });
    }

    // Filtered variables {{variable|filter}}
    const filterMatches = template.match(/\{\{(\w+)\|\w+\}\}/g);
    if (filterMatches) {
      filterMatches.forEach(match => {
        const varName = match.replace(/\{\{|\|\w+\}\}/g, '');
        variables.add(varName);
      });
    }

    return Array.from(variables);
  }

  /**
   * Get the type of a value
   */
  private getValueType(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'object';
    return typeof value;
  }

  /**
   * Check if value is truthy for conditionals
   */
  private isTruthy(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  }

  /**
   * Apply a filter to a value
   */
  private applyFilter(value: any, filterName: string): string {
    switch (filterName) {
      case 'upper':
        return String(value).toUpperCase();
      case 'lower':
        return String(value).toLowerCase();
      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'length':
        return String(Array.isArray(value) ? value.length : String(value).length);
      case 'json':
        return JSON.stringify(value);
      case 'escape':
        return String(value).replace(/[<>&"']/g, (char) => {
          const escapeMap: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;'
          };
          return escapeMap[char] || char;
        });
      default:
        this.logger.warn(`Unknown filter: ${filterName}`);
        return String(value);
    }
  }

  /**
   * Generate cache key for template and variables
   */
  private getCacheKey(templateId: string, variables: Record<string, any>): string {
    const sortedVars = Object.keys(variables)
      .sort()
      .reduce((result, key) => {
        result[key] = variables[key];
        return result;
      }, {} as Record<string, any>);
    
    return `${templateId}:${JSON.stringify(sortedVars)}`;
  }

  /**
   * Cache rendered result
   */
  private cacheResult(key: string, result: RenderedPrompt): void {
    // Implement LRU cache behavior
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Template cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    // This would need hit/miss tracking for accurate hit rate
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0 // Placeholder - would need proper tracking
    };
  }

  /**
   * Remove a template
   */
  removeTemplate(id: string): boolean {
    const removed = this.templates.delete(id);
    if (removed) {
      // Clear related cache entries
      const keysToRemove = Array.from(this.cache.keys())
        .filter(key => key.startsWith(`${id}:`));
      keysToRemove.forEach(key => this.cache.delete(key));
      this.logger.debug(`Removed template: ${id}`);
    }
    return removed;
  }

  /**
   * Update a template
   */
  updateTemplate(template: PromptTemplate): void {
    this.validateTemplate(template);
    
    // Clear related cache entries
    const keysToRemove = Array.from(this.cache.keys())
      .filter(key => key.startsWith(`${template.id}:`));
    keysToRemove.forEach(key => this.cache.delete(key));
    
    this.templates.set(template.id, template);
    this.logger.debug(`Updated template: ${template.id}`);
  }

  /**
   * Export templates to JSON
   */
  exportTemplates(): string {
    const templates = Array.from(this.templates.values());
    return JSON.stringify(templates, null, 2);
  }

  /**
   * Import templates from JSON
   */
  importTemplates(json: string): void {
    try {
      const templates: PromptTemplate[] = JSON.parse(json);
      if (!Array.isArray(templates)) {
        throw new Error('Invalid template format: expected array');
      }
      this.registerTemplates(templates);
      this.logger.info(`Imported ${templates.length} templates`);
    } catch (error) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Failed to import templates: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
} 