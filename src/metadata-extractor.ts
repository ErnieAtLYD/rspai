import { Logger } from './logger';
import { MarkdownParser } from './markdown-parser';
import { ParsedMarkdown } from './markdown-interfaces';
import { ObsidianFeaturesHandler, ObsidianFeature } from './obsidian-features';
import { PrivacyFilter } from './privacy-filter';

/**
 * Configuration for metadata extraction
 */
export interface MetadataExtractionConfig {
  // Extraction settings
  extractFrontmatter: boolean;
  extractLinks: boolean;
  extractTags: boolean;
  extractReferences: boolean;
  extractFileMetadata: boolean;
  
  // Normalization settings
  normalizeDates: boolean;
  normalizeLinks: boolean;
  normalizeTags: boolean;
  validateReferences: boolean;
  
  // Privacy settings
  respectPrivacyFilters: boolean;
  excludePrivateMetadata: boolean;
  
  // Performance settings
  enableCaching: boolean;
  maxReferenceDepth: number;
  batchProcessing: boolean;
}

/**
 * Default configuration for metadata extraction
 */
export const DEFAULT_METADATA_CONFIG: MetadataExtractionConfig = {
  extractFrontmatter: true,
  extractLinks: true,
  extractTags: true,
  extractReferences: true,
  extractFileMetadata: true,
  normalizeDates: true,
  normalizeLinks: true,
  normalizeTags: true,
  validateReferences: true,
  respectPrivacyFilters: true,
  excludePrivateMetadata: true,
  enableCaching: true,
  maxReferenceDepth: 3,
  batchProcessing: false
};

/**
 * Normalized metadata structure
 */
export interface NormalizedMetadata {
  // File information
  filePath: string;
  fileName: string;
  fileExtension: string;
  lastModified?: Date;
  createdDate?: Date;
  fileSize?: number;
  
  // Content metadata
  frontmatter: NormalizedFrontmatter;
  tags: NormalizedTag[];
  links: NormalizedLink[];
  references: NormalizedReference[];
  
  // Content analysis
  wordCount: number;
  characterCount: number;
  lineCount: number;
  headingCount: number;
  
  // Obsidian-specific
  obsidianFeatures: ObsidianFeatureSummary;
  
  // Privacy status
  privacyStatus: PrivacyStatus;
  
  // Processing metadata
  extractedAt: Date;
  processingTime: number;
  version: string;
}

/**
 * Normalized frontmatter with type inference
 */
export interface NormalizedFrontmatter {
  raw: Record<string, unknown>;
  normalized: {
    title?: string;
    description?: string;
    author?: string;
    created?: Date;
    modified?: Date;
    published?: Date;
    tags?: string[];
    categories?: string[];
    status?: string;
    priority?: string;
    aliases?: string[];
    cssclass?: string;
    [key: string]: unknown;
  };
  typeMap: Record<string, string>;
  validationErrors: string[];
}

/**
 * Normalized tag with hierarchy information
 */
export interface NormalizedTag {
  raw: string;
  normalized: string;
  hierarchy: string[];
  depth: number;
  parent?: string;
  children: string[];
  isNested: boolean;
  position: {
    startPos: number;
    endPos: number;
    line?: number;
  };
}

/**
 * Normalized link with resolution information
 */
export interface NormalizedLink {
  raw: string;
  type: 'internal' | 'external' | 'embed' | 'wikilink';
  target: string;
  display?: string;
  resolved: {
    isValid: boolean;
    resolvedPath?: string;
    exists?: boolean;
    isAccessible?: boolean;
    errorMessage?: string;
  };
  context: {
    surroundingText: string;
    section?: string;
    heading?: string;
  };
  position: {
    startPos: number;
    endPos: number;
    line?: number;
  };
  metadata: {
    isEmbed: boolean;
    hasAlias: boolean;
    isExternal: boolean;
    fileType?: string;
    protocol?: string;
  };
}

/**
 * Normalized reference between notes
 */
export interface NormalizedReference {
  sourceFile: string;
  targetFile: string;
  referenceType: 'link' | 'embed' | 'mention' | 'tag' | 'backlink';
  context: string;
  strength: number; // 0-1 indicating reference strength
  bidirectional: boolean;
  metadata: {
    section?: string;
    heading?: string;
    lineNumber?: number;
    isPrivate?: boolean;
  };
}

/**
 * Summary of Obsidian-specific features
 */
export interface ObsidianFeatureSummary {
  totalFeatures: number;
  featureTypes: Record<string, number>;
  plugins: string[];
  hasCallouts: boolean;
  hasDataview: boolean;
  hasMermaid: boolean;
  hasCustomSyntax: boolean;
  features: ObsidianFeature[];
}

/**
 * Privacy status information
 */
export interface PrivacyStatus {
  isPrivate: boolean;
  hasPrivateContent: boolean;
  privacyTags: string[];
  redactedSections: number;
  privacyLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  canProcess: boolean;
  restrictions: string[];
}

/**
 * Reference graph for note relationships
 */
export interface ReferenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  metrics: GraphMetrics;
}

/**
 * Graph node representing a note
 */
export interface GraphNode {
  id: string;
  filePath: string;
  title: string;
  type: 'note' | 'attachment' | 'external';
  metadata: {
    tags: string[];
    created?: Date;
    modified?: Date;
    wordCount: number;
  };
  connections: {
    incoming: number;
    outgoing: number;
    total: number;
  };
  centrality: {
    degree: number;
    betweenness: number;
    closeness: number;
    pagerank: number;
  };
}

/**
 * Graph edge representing a relationship
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'link' | 'embed' | 'mention' | 'tag';
  weight: number;
  metadata: {
    context: string;
    section?: string;
    bidirectional: boolean;
  };
}

/**
 * Graph cluster for related notes
 */
export interface GraphCluster {
  id: string;
  name: string;
  nodes: string[];
  tags: string[];
  cohesion: number;
  description: string;
}

/**
 * Graph metrics and statistics
 */
export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  clusteringCoefficient: number;
  diameter: number;
  components: number;
  isolatedNodes: number;
}

/**
 * Metadata extraction and normalization engine
 */
export class MetadataExtractor {
  private config: MetadataExtractionConfig;
  private cache: Map<string, NormalizedMetadata> = new Map();
  private referenceGraph: ReferenceGraph | null = null;

  constructor(
    private logger: Logger,
    private markdownParser: MarkdownParser,
    private obsidianHandler: ObsidianFeaturesHandler,
    private privacyFilter?: PrivacyFilter,
    config: Partial<MetadataExtractionConfig> = {}
  ) {
    this.config = { ...DEFAULT_METADATA_CONFIG, ...config };
    
    this.logger.debug('MetadataExtractor initialized', {
      extractionFeatures: this.getEnabledExtractionFeatures(),
      normalizationFeatures: this.getEnabledNormalizationFeatures(),
      privacyEnabled: !!this.privacyFilter
    });
  }

  /**
   * Extract and normalize metadata from a file
   */
  async extractMetadata(
    filePath: string, 
    content: string, 
    fileStats?: { size: number; mtime: Date; ctime: Date }
  ): Promise<NormalizedMetadata> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(filePath, content);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    this.logger.debug(`Extracting metadata for: ${filePath}`);

    try {
      // Check privacy status first
      const privacyStatus = this.assessPrivacyStatus(filePath, content);
      
      if (!privacyStatus.canProcess && this.config.respectPrivacyFilters) {
        return this.createMinimalMetadata(filePath, content, privacyStatus, startTime);
      }

      // Parse markdown content
      const parsedDocument = this.markdownParser.parseContent(content);

      // Extract Obsidian features
      const obsidianFeatures = this.obsidianHandler.extractFeatures(content, filePath);

      // Build normalized metadata
      const metadata: NormalizedMetadata = {
        // File information
        filePath,
        fileName: this.extractFileName(filePath),
        fileExtension: this.extractFileExtension(filePath),
        lastModified: fileStats?.mtime,
        createdDate: fileStats?.ctime,
        fileSize: fileStats?.size,

        // Content metadata
        frontmatter: this.extractAndNormalizeFrontmatter(parsedDocument),
        tags: this.extractAndNormalizeTags(parsedDocument, obsidianFeatures),
        links: this.extractAndNormalizeLinks(parsedDocument, obsidianFeatures, content),
        references: [], // Will be populated in buildReferenceGraph

        // Content analysis
        wordCount: this.countWords(content),
        characterCount: content.length,
        lineCount: content.split('\n').length,
        headingCount: parsedDocument.elements.filter((e: any) => e.type === 'heading').length,

        // Obsidian-specific
        obsidianFeatures: this.summarizeObsidianFeatures(obsidianFeatures),

        // Privacy status
        privacyStatus,

        // Processing metadata
        extractedAt: new Date(),
        processingTime: Date.now() - startTime,
        version: '1.0.0'
      };

      // Cache result
      if (this.config.enableCaching) {
        this.cache.set(cacheKey, metadata);
      }

      this.logger.debug(`Metadata extraction completed for ${filePath}`, {
        processingTime: metadata.processingTime,
        elementCount: parsedDocument.elements.length,
        featureCount: obsidianFeatures.length
      });

      return metadata;

    } catch (error) {
      this.logger.error(`Failed to extract metadata for ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Extract metadata from multiple files and build reference graph
   */
  async extractBatchMetadata(
    files: Array<{ path: string; content: string; stats?: { size: number; mtime: Date; ctime: Date } }>
  ): Promise<{ metadata: NormalizedMetadata[]; referenceGraph: ReferenceGraph }> {
    this.logger.info(`Starting batch metadata extraction for ${files.length} files`);

    const metadata: NormalizedMetadata[] = [];
    
    // Extract metadata for each file
    for (const file of files) {
      try {
        const fileMetadata = await this.extractMetadata(file.path, file.content, file.stats);
        metadata.push(fileMetadata);
      } catch (error) {
        this.logger.warn(`Failed to extract metadata for ${file.path}`, error);
      }
    }

    // Build reference graph
    const referenceGraph = this.buildReferenceGraph(metadata);
    
    // Update metadata with reference information
    this.enrichMetadataWithReferences(metadata, referenceGraph);

    this.logger.info(`Batch metadata extraction completed`, {
      processedFiles: metadata.length,
      totalReferences: referenceGraph.edges.length,
      clusters: referenceGraph.clusters.length
    });

    return { metadata, referenceGraph };
  }

  /**
   * Extract and normalize frontmatter
   */
  private extractAndNormalizeFrontmatter(document: ParsedMarkdown): NormalizedFrontmatter {
    const frontmatterElement = document.elements.find((e: any) => e.type === 'frontmatter');
    
    if (!frontmatterElement) {
      return {
        raw: {},
        normalized: {},
        typeMap: {},
        validationErrors: []
      };
    }

    const raw = frontmatterElement.content || {};
    const normalized: any = {};
    const typeMap: Record<string, string> = {};
    const validationErrors: string[] = [];

    // Normalize common fields
    for (const [key, value] of Object.entries(raw)) {
      const normalizedKey = key.toLowerCase();
      typeMap[key] = typeof value;

      try {
        switch (normalizedKey) {
          case 'title':
          case 'description':
          case 'author':
          case 'status':
          case 'priority':
          case 'cssclass':
            normalized[normalizedKey] = this.normalizeString(value);
            break;

          case 'created':
          case 'modified':
          case 'published':
          case 'date':
            if (this.config.normalizeDates) {
              normalized[normalizedKey] = this.normalizeDate(value);
            } else {
              normalized[normalizedKey] = value;
            }
            break;

          case 'tags':
          case 'categories':
          case 'aliases':
            normalized[normalizedKey] = this.normalizeArray(value);
            break;

          default:
            normalized[key] = value;
        }
      } catch (error) {
        validationErrors.push(`Failed to normalize ${key}: ${error}`);
        normalized[key] = value; // Keep original value on error
      }
    }

    return {
      raw,
      normalized,
      typeMap,
      validationErrors
    };
  }

  /**
   * Extract and normalize tags
   */
  private extractAndNormalizeTags(document: ParsedMarkdown, obsidianFeatures: ObsidianFeature[]): NormalizedTag[] {
    const tags: NormalizedTag[] = [];
    const tagFeatures = obsidianFeatures.filter(f => f.type === 'tag');

    for (const feature of tagFeatures) {
      const tag = this.normalizeTag(feature);
      if (tag) {
        tags.push(tag);
      }
    }

    // Build tag hierarchy
    this.buildTagHierarchy(tags);

    return tags;
  }

  /**
   * Extract and normalize links
   */
  private extractAndNormalizeLinks(
    document: ParsedMarkdown, 
    obsidianFeatures: ObsidianFeature[], 
    content: string
  ): NormalizedLink[] {
    const links: NormalizedLink[] = [];
    
    // Process wiki links and embeds
    const linkFeatures = obsidianFeatures.filter(f => 
      f.type === 'wikilink' || f.type === 'embed'
    );

    for (const feature of linkFeatures) {
      const link = this.normalizeLink(feature, content);
      if (link) {
        links.push(link);
      }
    }

    // Process regular markdown links from document
    const markdownLinks = document.elements.filter((e: any) => 
      e.type === 'paragraph' && (e as any).inlineElements?.some((ie: any) => ie.type === 'link')
    );

    for (const element of markdownLinks) {
      const paragraphElement = element as any;
      for (const inline of paragraphElement.inlineElements || []) {
        if (inline.type === 'link') {
          const link = this.normalizeMarkdownLink(inline, content);
          if (link) {
            links.push(link);
          }
        }
      }
    }

    return links;
  }

  /**
   * Normalize a single tag
   */
  private normalizeTag(feature: ObsidianFeature): NormalizedTag | null {
    if (!feature.metadata?.tag) return null;

    const raw = feature.content;
    const tagName = feature.metadata.tag as string;
    const hierarchy = tagName.split('/');
    const depth = hierarchy.length;
    const isNested = depth > 1;

    return {
      raw,
      normalized: tagName.toLowerCase(),
      hierarchy,
      depth,
      parent: isNested ? hierarchy.slice(0, -1).join('/') : undefined,
      children: [], // Will be populated in buildTagHierarchy
      isNested,
      position: {
        startPos: feature.startPos,
        endPos: feature.endPos
      }
    };
  }

  /**
   * Build tag hierarchy relationships
   */
  private buildTagHierarchy(tags: NormalizedTag[]): void {
    const tagMap = new Map<string, NormalizedTag>();
    
    // Index tags by normalized name
    for (const tag of tags) {
      tagMap.set(tag.normalized, tag);
    }

    // Build parent-child relationships
    for (const tag of tags) {
      if (tag.parent) {
        const parentTag = tagMap.get(tag.parent);
        if (parentTag) {
          parentTag.children.push(tag.normalized);
        }
      }
    }
  }

  /**
   * Normalize a link feature
   */
  private normalizeLink(feature: ObsidianFeature, content: string): NormalizedLink | null {
    if (!feature.metadata?.target) return null;

    const target = feature.metadata.target as string;
    const display = feature.metadata.display as string | undefined;
    const isEmbed = feature.metadata.isEmbed as boolean || false;
    const isExternal = feature.metadata.isExternal as boolean || false;

    const type = isEmbed ? 'embed' : (isExternal ? 'external' : 'wikilink');

    return {
      raw: feature.content,
      type,
      target,
      display,
      resolved: this.resolveLinkTarget(target, isExternal),
      context: this.extractLinkContext(feature, content),
      position: {
        startPos: feature.startPos,
        endPos: feature.endPos
      },
      metadata: {
        isEmbed,
        hasAlias: !!display,
        isExternal,
        fileType: this.extractFileType(target),
        protocol: isExternal ? this.extractProtocol(target) : undefined
      }
    };
  }

  /**
   * Normalize a markdown link
   */
  private normalizeMarkdownLink(inline: any, content: string): NormalizedLink | null {
    const target = inline.url || inline.href;
    const display = inline.text;
    
    if (!target) return null;

    const isExternal = this.isExternalUrl(target);

    return {
      raw: `[${display}](${target})`,
      type: isExternal ? 'external' : 'internal',
      target,
      display,
      resolved: this.resolveLinkTarget(target, isExternal),
      context: this.extractInlineContext(inline, content),
      position: {
        startPos: inline.startPos || 0,
        endPos: inline.endPos || 0
      },
      metadata: {
        isEmbed: false,
        hasAlias: display !== target,
        isExternal,
        fileType: this.extractFileType(target),
        protocol: isExternal ? this.extractProtocol(target) : undefined
      }
    };
  }

  /**
   * Resolve link target
   */
  private resolveLinkTarget(target: string, isExternal: boolean): NormalizedLink['resolved'] {
    if (isExternal) {
      return {
        isValid: this.isValidUrl(target),
        isAccessible: false, // Would need network check
        exists: undefined
      };
    }

    // For internal links, we'd need access to the vault structure
    // For now, return basic validation
    return {
      isValid: target.length > 0,
      exists: undefined, // Would need file system check
      isAccessible: true
    };
  }

  /**
   * Extract context around a link
   */
  private extractLinkContext(feature: ObsidianFeature, content: string): any {
    const contextRadius = 50;
    const start = Math.max(0, feature.startPos - contextRadius);
    const end = Math.min(content.length, feature.endPos + contextRadius);
    
    return {
      surroundingText: content.substring(start, end).trim(),
      section: undefined, // Would need section detection
      heading: undefined  // Would need heading detection
    };
  }

  /**
   * Extract context for inline elements
   */
  private extractInlineContext(inline: any, content: string): any {
    return {
      surroundingText: '', // Would need position information
      section: undefined,
      heading: undefined
    };
  }

  /**
   * Build reference graph from metadata
   */
  private buildReferenceGraph(metadataList: NormalizedMetadata[]): ReferenceGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Create nodes
    for (const metadata of metadataList) {
      const node: GraphNode = {
        id: metadata.filePath,
        filePath: metadata.filePath,
        title: metadata.frontmatter.normalized.title || metadata.fileName,
        type: 'note',
        metadata: {
          tags: metadata.tags.map(t => t.normalized),
          created: metadata.createdDate,
          modified: metadata.lastModified,
          wordCount: metadata.wordCount
        },
        connections: { incoming: 0, outgoing: 0, total: 0 },
        centrality: { degree: 0, betweenness: 0, closeness: 0, pagerank: 0 }
      };
      
      nodes.push(node);
      nodeMap.set(metadata.filePath, node);
    }

    // Create edges from links
    for (const metadata of metadataList) {
      const sourceNode = nodeMap.get(metadata.filePath);
      if (!sourceNode) continue;

      for (const link of metadata.links) {
        if (link.type === 'external') continue;

        const targetPath = this.resolveTargetPath(link.target, metadata.filePath);
        const targetNode = nodeMap.get(targetPath);
        
        if (targetNode) {
          const edge: GraphEdge = {
            id: `${metadata.filePath}->${targetPath}`,
            source: metadata.filePath,
            target: targetPath,
            type: link.type as any,
            weight: this.calculateLinkWeight(link),
            metadata: {
              context: link.context.surroundingText,
              section: link.context.section,
              bidirectional: false
            }
          };

          edges.push(edge);
          sourceNode.connections.outgoing++;
          targetNode.connections.incoming++;
        }
      }
    }

    // Calculate total connections
    for (const node of nodes) {
      node.connections.total = node.connections.incoming + node.connections.outgoing;
      node.centrality.degree = node.connections.total;
    }

    // Build clusters (simplified tag-based clustering)
    const clusters = this.buildTagClusters(metadataList);

    // Calculate metrics
    const metrics = this.calculateGraphMetrics(nodes, edges);

    return { nodes, edges, clusters, metrics };
  }

  /**
   * Build tag-based clusters
   */
  private buildTagClusters(metadataList: NormalizedMetadata[]): GraphCluster[] {
    const tagGroups = new Map<string, string[]>();

    // Group files by tags
    for (const metadata of metadataList) {
      for (const tag of metadata.tags) {
        if (!tagGroups.has(tag.normalized)) {
          tagGroups.set(tag.normalized, []);
        }
        tagGroups.get(tag.normalized)!.push(metadata.filePath);
      }
    }

    // Create clusters for tags with multiple files
    const clusters: GraphCluster[] = [];
    let clusterId = 0;

    for (const [tag, files] of tagGroups) {
      if (files.length > 1) {
        clusters.push({
          id: `cluster-${clusterId++}`,
          name: `Tag: ${tag}`,
          nodes: files,
          tags: [tag],
          cohesion: files.length / metadataList.length,
          description: `Files tagged with ${tag}`
        });
      }
    }

    return clusters;
  }

  /**
   * Calculate graph metrics
   */
  private calculateGraphMetrics(nodes: GraphNode[], edges: GraphEdge[]): GraphMetrics {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    const averageDegree = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;
    const isolatedNodes = nodes.filter(n => n.connections.total === 0).length;

    return {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      clusteringCoefficient: 0, // Would need complex calculation
      diameter: 0, // Would need shortest path calculation
      components: 1, // Simplified
      isolatedNodes
    };
  }

  /**
   * Enrich metadata with reference information
   */
  private enrichMetadataWithReferences(
    metadataList: NormalizedMetadata[], 
    graph: ReferenceGraph
  ): void {
    const edgesBySource = new Map<string, GraphEdge[]>();
    const edgesByTarget = new Map<string, GraphEdge[]>();

    // Index edges
    for (const edge of graph.edges) {
      if (!edgesBySource.has(edge.source)) {
        edgesBySource.set(edge.source, []);
      }
      if (!edgesByTarget.has(edge.target)) {
        edgesByTarget.set(edge.target, []);
      }
      
      edgesBySource.get(edge.source)!.push(edge);
      edgesByTarget.get(edge.target)!.push(edge);
    }

    // Add references to metadata
    for (const metadata of metadataList) {
      const outgoing = edgesBySource.get(metadata.filePath) || [];
      const incoming = edgesByTarget.get(metadata.filePath) || [];

      metadata.references = [
        ...outgoing.map(edge => this.createReference(edge, 'outgoing')),
        ...incoming.map(edge => this.createReference(edge, 'incoming'))
      ];
    }
  }

  /**
   * Create a normalized reference from a graph edge
   */
  private createReference(edge: GraphEdge, direction: 'outgoing' | 'incoming'): NormalizedReference {
    return {
      sourceFile: edge.source,
      targetFile: edge.target,
      referenceType: edge.type,
      context: edge.metadata.context,
      strength: edge.weight,
      bidirectional: edge.metadata.bidirectional,
      metadata: {
        section: edge.metadata.section,
        isPrivate: false // Would need privacy analysis
      }
    };
  }

  /**
   * Helper methods
   */
  private assessPrivacyStatus(filePath: string, content: string): PrivacyStatus {
    if (!this.privacyFilter) {
      return {
        isPrivate: false,
        hasPrivateContent: false,
        privacyTags: [],
        redactedSections: 0,
        privacyLevel: 'public',
        canProcess: true,
        restrictions: []
      };
    }

    const shouldExclude = this.privacyFilter.shouldExcludeFile(filePath, content);
    const filteredContent = this.privacyFilter.filterContent(content);
    const hasPrivateContent = content !== filteredContent;

    return {
      isPrivate: shouldExclude,
      hasPrivateContent,
      privacyTags: [], // Would extract from privacy filter
      redactedSections: hasPrivateContent ? 1 : 0,
      privacyLevel: shouldExclude ? 'confidential' : 'public',
      canProcess: !shouldExclude || !this.config.respectPrivacyFilters,
      restrictions: shouldExclude ? ['excluded by privacy filter'] : []
    };
  }

  private createMinimalMetadata(
    filePath: string, 
    content: string, 
    privacyStatus: PrivacyStatus, 
    startTime: number
  ): NormalizedMetadata {
    return {
      filePath,
      fileName: this.extractFileName(filePath),
      fileExtension: this.extractFileExtension(filePath),
      frontmatter: { raw: {}, normalized: {}, typeMap: {}, validationErrors: [] },
      tags: [],
      links: [],
      references: [],
      wordCount: 0,
      characterCount: 0,
      lineCount: 0,
      headingCount: 0,
      obsidianFeatures: {
        totalFeatures: 0,
        featureTypes: {},
        plugins: [],
        hasCallouts: false,
        hasDataview: false,
        hasMermaid: false,
        hasCustomSyntax: false,
        features: []
      },
      privacyStatus,
      extractedAt: new Date(),
      processingTime: Date.now() - startTime,
      version: '1.0.0'
    };
  }

  private summarizeObsidianFeatures(features: ObsidianFeature[]): ObsidianFeatureSummary {
    const featureTypes: Record<string, number> = {};
    const plugins = new Set<string>();

    for (const feature of features) {
      featureTypes[feature.type] = (featureTypes[feature.type] || 0) + 1;
      if (feature.plugin) {
        plugins.add(feature.plugin);
      }
    }

    return {
      totalFeatures: features.length,
      featureTypes,
      plugins: Array.from(plugins),
      hasCallouts: 'callout' in featureTypes,
      hasDataview: 'dataview-query' in featureTypes || 'dataview-inline' in featureTypes,
      hasMermaid: 'mermaid-diagram' in featureTypes,
      hasCustomSyntax: features.some(f => f.plugin && f.plugin !== 'core'),
      features
    };
  }

  private extractFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private extractFileExtension(filePath: string): string {
    const fileName = this.extractFileName(filePath);
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot + 1) : '';
  }

  private countWords(content: string): number {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private normalizeString(value: unknown): string {
    return String(value || '').trim();
  }

  private normalizeDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    
    if (value instanceof Date) return value;
    
    const dateStr = String(value);
    const parsed = new Date(dateStr);
    
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private normalizeArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(s => s.length > 0);
    }
    
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    
    return [];
  }

  private isExternalUrl(url: string): boolean {
    return /^https?:\/\//.test(url) || url.includes('://');
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private extractFileType(target: string): string | undefined {
    const lastDot = target.lastIndexOf('.');
    return lastDot > 0 ? target.substring(lastDot + 1).toLowerCase() : undefined;
  }

  private extractProtocol(url: string): string | undefined {
    const match = url.match(/^([a-z]+):/);
    return match ? match[1] : undefined;
  }

  private resolveTargetPath(target: string, sourcePath: string): string {
    // Simplified path resolution - would need proper implementation
    return target.endsWith('.md') ? target : `${target}.md`;
  }

  private calculateLinkWeight(link: NormalizedLink): number {
    let weight = 1;
    
    if (link.metadata.isEmbed) weight += 0.5;
    if (link.metadata.hasAlias) weight += 0.2;
    if (link.context.section) weight += 0.3;
    
    return Math.min(weight, 2); // Cap at 2
  }

  private generateCacheKey(filePath: string, content: string): string {
    // Simple hash for caching
    const hash = filePath + content.length + content.substring(0, 100);
    return btoa(hash).substring(0, 16);
  }

  private getEnabledExtractionFeatures(): string[] {
    const features: string[] = [];
    if (this.config.extractFrontmatter) features.push('frontmatter');
    if (this.config.extractLinks) features.push('links');
    if (this.config.extractTags) features.push('tags');
    if (this.config.extractReferences) features.push('references');
    if (this.config.extractFileMetadata) features.push('fileMetadata');
    return features;
  }

  private getEnabledNormalizationFeatures(): string[] {
    const features: string[] = [];
    if (this.config.normalizeDates) features.push('dates');
    if (this.config.normalizeLinks) features.push('links');
    if (this.config.normalizeTags) features.push('tags');
    if (this.config.validateReferences) features.push('references');
    return features;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Metadata extraction cache cleared');
  }

  /**
   * Get current configuration
   */
  getConfig(): MetadataExtractionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MetadataExtractionConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache(); // Clear cache when config changes
    this.logger.info('Metadata extraction configuration updated');
  }

  /**
   * Get reference graph
   */
  getReferenceGraph(): ReferenceGraph | null {
    return this.referenceGraph;
  }
} 