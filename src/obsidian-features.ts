import { Logger } from './logger';

/**
 * Configuration for Obsidian-specific feature detection
 */
export interface ObsidianFeatureConfig {
  // Core Obsidian features
  enableWikiLinks: boolean;
  enableCallouts: boolean;
  enableEmbeds: boolean;
  enableTags: boolean;
  enableMathBlocks: boolean;
  
  // Plugin-specific features (extensible)
  enableDataview: boolean;
  enableTemplater: boolean;
  enableExcalidraw: boolean;
  enableMermaid: boolean;
  enableKanban: boolean;
  
  // Custom pattern detection
  customPatterns: CustomPattern[];
  
  // Performance settings
  maxPatternComplexity: number;
  enablePatternCaching: boolean;
}

/**
 * Custom pattern for detecting plugin-specific markup
 */
export interface CustomPattern {
  name: string;
  description: string;
  pattern: RegExp;
  type: 'inline' | 'block' | 'multiline';
  priority: number;
  handler: (match: RegExpMatchArray, content: string) => ObsidianFeature | null;
}

/**
 * Detected Obsidian-specific feature
 */
export interface ObsidianFeature {
  type: string;
  content: string;
  startPos: number;
  endPos: number;
  metadata?: Record<string, unknown>;
  plugin?: string; // Which plugin this feature belongs to
}

/**
 * Wiki link information
 */
export interface WikiLink {
  target: string;
  display?: string;
  isEmbed: boolean;
  hasAlias: boolean;
  isExternal: boolean;
  startPos: number;
  endPos: number;
}

/**
 * Callout information
 */
export interface CalloutInfo {
  type: string;
  title?: string;
  foldable: boolean;
  folded: boolean;
  content: string;
  startLine: number;
  endLine: number;
}

/**
 * Default configuration for Obsidian features
 */
export const DEFAULT_OBSIDIAN_CONFIG: ObsidianFeatureConfig = {
  enableWikiLinks: true,
  enableCallouts: true,
  enableEmbeds: true,
  enableTags: true,
  enableMathBlocks: true,
  enableDataview: true,
  enableTemplater: false, // Can be resource-intensive
  enableExcalidraw: true,
  enableMermaid: true,
  enableKanban: true,
  customPatterns: [],
  maxPatternComplexity: 1000, // Prevent ReDoS attacks
  enablePatternCaching: true
};

/**
 * Obsidian-specific features handler
 * Designed to be extensible for new plugins and markup patterns
 */
export class ObsidianFeaturesHandler {
  private config: ObsidianFeatureConfig;
  private patternCache: Map<string, ObsidianFeature[]> = new Map();
  private knownPluginPatterns: Map<string, CustomPattern[]> = new Map();

  constructor(
    private logger: Logger,
    config: Partial<ObsidianFeatureConfig> = {}
  ) {
    this.config = { ...DEFAULT_OBSIDIAN_CONFIG, ...config };
    this.initializeKnownPatterns();
    
    this.logger.debug('ObsidianFeaturesHandler initialized', {
      enabledFeatures: this.getEnabledFeatures(),
      customPatterns: this.config.customPatterns.length
    });
  }

  /**
   * Initialize patterns for known plugins
   */
  private initializeKnownPatterns(): void {
    // Dataview patterns
    if (this.config.enableDataview) {
      this.knownPluginPatterns.set('dataview', [
        {
          name: 'dataview-query',
          description: 'Dataview query blocks',
          pattern: /```dataview\n([\s\S]*?)\n```/g,
          type: 'block',
          priority: 100,
          handler: this.handleDataviewQuery.bind(this)
        },
        {
          name: 'dataview-inline',
          description: 'Inline dataview queries',
          pattern: /`=\s*([^`]+)`/g,
          type: 'inline',
          priority: 90,
          handler: this.handleDataviewInline.bind(this)
        }
      ]);
    }

    // Mermaid patterns
    if (this.config.enableMermaid) {
      this.knownPluginPatterns.set('mermaid', [
        {
          name: 'mermaid-diagram',
          description: 'Mermaid diagram blocks',
          pattern: /```mermaid\n([\s\S]*?)\n```/g,
          type: 'block',
          priority: 100,
          handler: this.handleMermaidDiagram.bind(this)
        }
      ]);
    }

    // Excalidraw patterns
    if (this.config.enableExcalidraw) {
      this.knownPluginPatterns.set('excalidraw', [
        {
          name: 'excalidraw-embed',
          description: 'Excalidraw drawing embeds',
          pattern: /!\[\[([^|\]]+\.excalidraw)(\|[^\]]+)?\]\]/g,
          type: 'inline',
          priority: 95,
          handler: this.handleExcalidrawEmbed.bind(this)
        }
      ]);
    }

    // Kanban patterns
    if (this.config.enableKanban) {
      this.knownPluginPatterns.set('kanban', [
        {
          name: 'kanban-board',
          description: 'Kanban board syntax',
          pattern: /```kanban\n([\s\S]*?)\n```/g,
          type: 'block',
          priority: 100,
          handler: this.handleKanbanBoard.bind(this)
        }
      ]);
    }

    // Add custom patterns from config
    this.config.customPatterns.forEach(pattern => {
      const pluginName = pattern.name.split('-')[0] || 'custom';
      if (!this.knownPluginPatterns.has(pluginName)) {
        this.knownPluginPatterns.set(pluginName, []);
      }
      this.knownPluginPatterns.get(pluginName)!.push(pattern);
    });
  }

  /**
   * Extract all Obsidian-specific features from content
   */
  extractFeatures(content: string, filePath?: string): ObsidianFeature[] {
    // Check cache first
    const cacheKey = this.generateCacheKey(content);
    if (this.config.enablePatternCaching && this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    const features: ObsidianFeature[] = [];

    // Extract core Obsidian features
    if (this.config.enableWikiLinks) {
      features.push(...this.extractWikiLinks(content));
    }

    if (this.config.enableCallouts) {
      features.push(...this.extractCallouts(content));
    }

    if (this.config.enableEmbeds) {
      features.push(...this.extractEmbeds(content));
    }

    if (this.config.enableTags) {
      features.push(...this.extractTags(content));
    }

    if (this.config.enableMathBlocks) {
      features.push(...this.extractMathBlocks(content));
    }

    // Extract plugin-specific features
    features.push(...this.extractPluginFeatures(content));

    // Sort by position for consistent processing
    features.sort((a, b) => a.startPos - b.startPos);

    // Cache results
    if (this.config.enablePatternCaching) {
      this.patternCache.set(cacheKey, features);
    }

    this.logger.debug(`Extracted ${features.length} Obsidian features`, {
      filePath,
      featureTypes: this.groupFeaturesByType(features)
    });

    return features;
  }

  /**
   * Extract wiki links from content
   */
  private extractWikiLinks(content: string): ObsidianFeature[] {
    const features: ObsidianFeature[] = [];
    
    // Pattern for wiki links: [[target|display]] or [[target]]
    const wikiLinkPattern = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    
    let match;
    while ((match = wikiLinkPattern.exec(content)) !== null) {
      const target = match[1].trim();
      const display = match[3]?.trim();
      const isEmbed = false; // Regular wiki links are not embeds
      
      features.push({
        type: 'wikilink',
        content: match[0],
        startPos: match.index,
        endPos: match.index + match[0].length,
        metadata: {
          target,
          display,
          isEmbed,
          hasAlias: !!display,
          isExternal: this.isExternalLink(target)
        }
      });
    }

    return features;
  }

  /**
   * Extract embeds from content
   */
  private extractEmbeds(content: string): ObsidianFeature[] {
    const features: ObsidianFeature[] = [];
    
    // Pattern for embeds: ![[target|display]] or ![[target]]
    const embedPattern = /!\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
    
    let match;
    while ((match = embedPattern.exec(content)) !== null) {
      const target = match[1].trim();
      const display = match[3]?.trim();
      
      features.push({
        type: 'embed',
        content: match[0],
        startPos: match.index,
        endPos: match.index + match[0].length,
        metadata: {
          target,
          display,
          isEmbed: true,
          fileType: this.getFileType(target),
          isImage: this.isImageFile(target),
          isNote: this.isNoteFile(target)
        }
      });
    }

    return features;
  }

  /**
   * Extract callouts from content
   */
  private extractCallouts(content: string): ObsidianFeature[] {
    const features: ObsidianFeature[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const calloutMatch = line.match(/^>\s*\[!(\w+)\]([+-]?)\s*(.*)?$/);
      
      if (calloutMatch) {
        const calloutType = calloutMatch[1].toLowerCase();
        const foldable = calloutMatch[2] === '+' || calloutMatch[2] === '-';
        const folded = calloutMatch[2] === '-';
        const title = calloutMatch[3] || undefined;
        
        // Find the end of the callout
        let endLine = i;
        const calloutLines = [line];
        
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (nextLine.trim().startsWith('>')) {
            calloutLines.push(nextLine);
            endLine = j;
          } else if (nextLine.trim() === '') {
            // Empty line might be part of callout
            calloutLines.push(nextLine);
            endLine = j;
          } else {
            break;
          }
        }
        
        const startPos = content.indexOf(line);
        const endPos = startPos + calloutLines.join('\n').length;
        
        features.push({
          type: 'callout',
          content: calloutLines.join('\n'),
          startPos,
          endPos,
          metadata: {
            calloutType,
            title,
            foldable,
            folded,
            startLine: i + 1,
            endLine: endLine + 1
          }
        });
        
        // Skip processed lines
        i = endLine;
      }
    }

    return features;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): ObsidianFeature[] {
    const features: ObsidianFeature[] = [];
    
    // Pattern for tags: #tag or #nested/tag
    const tagPattern = /#[\w-]+(?:\/[\w-]+)*/g;
    
    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      const tag = match[0];
      const isNested = tag.includes('/');
      const parts = tag.split('/');
      
      features.push({
        type: 'tag',
        content: tag,
        startPos: match.index,
        endPos: match.index + tag.length,
        metadata: {
          tag: tag.substring(1), // Remove the #
          isNested,
          parts: parts.map(p => p.replace('#', '')),
          depth: parts.length
        }
      });
    }

    return features;
  }

  /**
   * Extract math blocks from content
   */
  private extractMathBlocks(content: string): ObsidianFeature[] {
    const features: ObsidianFeature[] = [];
    
    // Block math: $$...$$
    const blockMathPattern = /\$\$([\s\S]*?)\$\$/g;
    let match;
    while ((match = blockMathPattern.exec(content)) !== null) {
      features.push({
        type: 'math-block',
        content: match[0],
        startPos: match.index,
        endPos: match.index + match[0].length,
        metadata: {
          mathContent: match[1].trim(),
          isBlock: true
        }
      });
    }
    
    // Inline math: $...$
    const inlineMathPattern = /\$([^$\n]+)\$/g;
    while ((match = inlineMathPattern.exec(content)) !== null) {
      features.push({
        type: 'math-inline',
        content: match[0],
        startPos: match.index,
        endPos: match.index + match[0].length,
        metadata: {
          mathContent: match[1].trim(),
          isBlock: false
        }
      });
    }

    return features;
  }

  /**
   * Extract features from known plugins
   */
  private extractPluginFeatures(content: string): ObsidianFeature[] {
    const features: ObsidianFeature[] = [];

    for (const [pluginName, patterns] of this.knownPluginPatterns) {
      for (const pattern of patterns) {
        try {
          // Reset regex lastIndex to avoid issues with global patterns
          pattern.pattern.lastIndex = 0;
          
          let match;
          while ((match = pattern.pattern.exec(content)) !== null) {
            const feature = pattern.handler(match, content);
            if (feature) {
              feature.plugin = pluginName;
              features.push(feature);
            }
            
            // Prevent infinite loops with zero-width matches
            if (match.index === pattern.pattern.lastIndex) {
              pattern.pattern.lastIndex++;
            }
          }
        } catch (error) {
          this.logger.warn(`Error processing pattern ${pattern.name}`, error);
        }
      }
    }

    return features;
  }

  /**
   * Handler for Dataview query blocks
   */
  private handleDataviewQuery(match: RegExpMatchArray, content: string): ObsidianFeature | null {
    const query = match[1].trim();
    
    return {
      type: 'dataview-query',
      content: match[0],
      startPos: match.index || 0,
      endPos: (match.index || 0) + match[0].length,
      metadata: {
        query,
        queryType: this.detectDataviewQueryType(query)
      }
    };
  }

  /**
   * Handler for inline Dataview queries
   */
  private handleDataviewInline(match: RegExpMatchArray, content: string): ObsidianFeature | null {
    const expression = match[1].trim();
    
    return {
      type: 'dataview-inline',
      content: match[0],
      startPos: match.index || 0,
      endPos: (match.index || 0) + match[0].length,
      metadata: {
        expression,
        isInline: true
      }
    };
  }

  /**
   * Handler for Mermaid diagrams
   */
  private handleMermaidDiagram(match: RegExpMatchArray, content: string): ObsidianFeature | null {
    const diagramContent = match[1].trim();
    
    return {
      type: 'mermaid-diagram',
      content: match[0],
      startPos: match.index || 0,
      endPos: (match.index || 0) + match[0].length,
      metadata: {
        diagramContent,
        diagramType: this.detectMermaidType(diagramContent)
      }
    };
  }

  /**
   * Handler for Excalidraw embeds
   */
  private handleExcalidrawEmbed(match: RegExpMatchArray, content: string): ObsidianFeature | null {
    const filename = match[1];
    const params = match[2]?.substring(1); // Remove the |
    
    return {
      type: 'excalidraw-embed',
      content: match[0],
      startPos: match.index || 0,
      endPos: (match.index || 0) + match[0].length,
      metadata: {
        filename,
        params,
        isDrawing: true
      }
    };
  }

  /**
   * Handler for Kanban boards
   */
  private handleKanbanBoard(match: RegExpMatchArray, content: string): ObsidianFeature | null {
    const boardContent = match[1].trim();
    
    return {
      type: 'kanban-board',
      content: match[0],
      startPos: match.index || 0,
      endPos: (match.index || 0) + match[0].length,
      metadata: {
        boardContent,
        columnCount: this.countKanbanColumns(boardContent)
      }
    };
  }

  /**
   * Helper methods for feature detection
   */
  private isExternalLink(target: string): boolean {
    return target.startsWith('http://') || target.startsWith('https://') || target.includes('://');
  }

  private getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  }

  private isImageFile(filename: string): boolean {
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
    const ext = this.getFileType(filename);
    return imageExts.includes(ext);
  }

  private isNoteFile(filename: string): boolean {
    const ext = this.getFileType(filename);
    return ext === 'md' || !filename.includes('.');
  }

  private detectDataviewQueryType(query: string): string {
    if (query.toLowerCase().startsWith('table')) return 'table';
    if (query.toLowerCase().startsWith('list')) return 'list';
    if (query.toLowerCase().startsWith('task')) return 'task';
    if (query.toLowerCase().startsWith('calendar')) return 'calendar';
    return 'unknown';
  }

  private detectMermaidType(content: string): string {
    const firstLine = content.split('\n')[0].trim().toLowerCase();
    if (firstLine.includes('graph')) return 'graph';
    if (firstLine.includes('flowchart')) return 'flowchart';
    if (firstLine.includes('sequencediagram')) return 'sequence';
    if (firstLine.includes('gantt')) return 'gantt';
    if (firstLine.includes('pie')) return 'pie';
    return 'unknown';
  }

  private countKanbanColumns(content: string): number {
    const lines = content.split('\n');
    let columnCount = 0;
    for (const line of lines) {
      if (line.trim().startsWith('##')) {
        columnCount++;
      }
    }
    return columnCount;
  }

  private generateCacheKey(content: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private groupFeaturesByType(features: ObsidianFeature[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const feature of features) {
      groups[feature.type] = (groups[feature.type] || 0) + 1;
    }
    return groups;
  }

  private getEnabledFeatures(): string[] {
    const enabled: string[] = [];
    if (this.config.enableWikiLinks) enabled.push('wikilinks');
    if (this.config.enableCallouts) enabled.push('callouts');
    if (this.config.enableEmbeds) enabled.push('embeds');
    if (this.config.enableTags) enabled.push('tags');
    if (this.config.enableMathBlocks) enabled.push('math');
    if (this.config.enableDataview) enabled.push('dataview');
    if (this.config.enableMermaid) enabled.push('mermaid');
    if (this.config.enableExcalidraw) enabled.push('excalidraw');
    if (this.config.enableKanban) enabled.push('kanban');
    return enabled;
  }

  /**
   * Add a custom pattern for new plugin support
   */
  addCustomPattern(pattern: CustomPattern): void {
    this.config.customPatterns.push(pattern);
    
    const pluginName = pattern.name.split('-')[0] || 'custom';
    if (!this.knownPluginPatterns.has(pluginName)) {
      this.knownPluginPatterns.set(pluginName, []);
    }
    this.knownPluginPatterns.get(pluginName)!.push(pattern);
    
    // Clear cache since patterns changed
    this.patternCache.clear();
    
    this.logger.info(`Added custom pattern: ${pattern.name}`, { pluginName });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ObsidianFeatureConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeKnownPatterns();
    this.patternCache.clear();
    
    this.logger.info('Obsidian features configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): ObsidianFeatureConfig {
    return { ...this.config };
  }

  /**
   * Clear pattern cache
   */
  clearCache(): void {
    this.patternCache.clear();
    this.logger.debug('Pattern cache cleared');
  }
} 