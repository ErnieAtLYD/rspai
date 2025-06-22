/**
 * Evidence Linking System
 * Creates connections between summary statements and their supporting evidence and source data.
 * Provides citation tracking, inline formatting, evidence summaries, and visualization options.
 */

import {
  Insight,
  InsightEvidence,
  SummaryOptions,
  SummaryContext
} from './summary-generation-interfaces';

/**
 * Citation style configuration
 */
export interface CitationStyle {
  format: 'apa' | 'mla' | 'chicago' | 'ieee' | 'custom';
  inlineFormat: 'parenthetical' | 'superscript' | 'footnote' | 'endnote';
  showPageNumbers: boolean;
  showTimestamps: boolean;
  showRelevanceScore: boolean;
  abbreviateAuthors: boolean;
  maxInlineCitations: number;
}

/**
 * Evidence link between text and source
 */
export interface EvidenceLink {
  id: string;
  textId: string; // ID of the generated text element
  evidenceId: string; // ID of the evidence
  linkType: 'direct' | 'supporting' | 'contradicting' | 'contextual';
  strength: number; // 0-1 scale
  position: TextPosition;
  citationText: string;
  generatedAt: Date;
}

/**
 * Position in generated text
 */
export interface TextPosition {
  sectionId: string;
  paragraphIndex: number;
  sentenceIndex: number;
  startChar: number;
  endChar: number;
  textSpan: string;
}

/**
 * Citation reference
 */
export interface CitationReference {
  id: string;
  shortForm: string; // e.g., "[1]", "(Smith, 2023)"
  fullForm: string; // Complete citation
  evidenceId: string;
  sourceType: 'document' | 'theme' | 'pattern' | 'statistic' | 'trend';
  sourceId: string;
  relevanceScore: number;
  timestamp: Date;
  documentPath?: string;
  excerpt?: string;
  context?: string;
}

/**
 * Evidence summary at different detail levels
 */
export interface EvidenceSummary {
  id: string;
  level: 'minimal' | 'brief' | 'detailed' | 'comprehensive';
  title: string;
  summary: string;
  evidenceCount: number;
  sourceCount: number;
  confidenceScore: number;
  timeframe: {
    start: Date;
    end: Date;
  };
  categories: string[];
  keyFindings: string[];
  citations: CitationReference[];
  visualizations?: EvidenceVisualization[];
}

/**
 * Evidence visualization options
 */
export interface EvidenceVisualization {
  id: string;
  type: 'network' | 'timeline' | 'heatmap' | 'flow' | 'tree' | 'matrix';
  title: string;
  description: string;
  data: EvidenceVisualizationData;
  config: VisualizationConfig;
  interactive: boolean;
  exportable: boolean;
}

/**
 * Visualization data structure
 */
export interface EvidenceVisualizationData {
  nodes?: VisualizationNode[];
  edges?: VisualizationEdge[];
  timeline?: TimelinePoint[];
  matrix?: MatrixCell[][];
  hierarchy?: HierarchyNode[];
  metadata: Record<string, unknown>;
}

/**
 * Visualization node
 */
export interface VisualizationNode {
  id: string;
  label: string;
  type: 'insight' | 'evidence' | 'source' | 'theme' | 'pattern';
  size: number;
  color: string;
  position?: { x: number; y: number };
  metadata: Record<string, unknown>;
}

/**
 * Visualization edge
 */
export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: 'supports' | 'contradicts' | 'relates' | 'derives';
  color: string;
  label?: string;
}

/**
 * Timeline point for evidence
 */
export interface TimelinePoint {
  id: string;
  date: Date;
  title: string;
  description: string;
  evidenceIds: string[];
  importance: number;
  category: string;
}

/**
 * Matrix cell for evidence relationships
 */
export interface MatrixCell {
  row: string;
  column: string;
  value: number;
  label?: string;
  color?: string;
}

/**
 * Hierarchy node for evidence structure
 */
export interface HierarchyNode {
  id: string;
  label: string;
  children?: HierarchyNode[];
  value: number;
  metadata: Record<string, unknown>;
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  width: number;
  height: number;
  theme: 'light' | 'dark' | 'auto';
  showLabels: boolean;
  showLegend: boolean;
  interactive: boolean;
  zoomable: boolean;
  exportFormats: ('png' | 'svg' | 'pdf' | 'json')[];
  colorScheme: string[];
}

/**
 * Evidence linking configuration
 */
export interface EvidenceLinkingConfig {
  citationStyle: CitationStyle;
  enableInlineCitations: boolean;
  enableEvidenceSections: boolean;
  enableVisualizations: boolean;
  maxEvidencePerInsight: number;
  minRelevanceThreshold: number;
  groupSimilarEvidence: boolean;
  showConfidenceScores: boolean;
  enableCrossReferences: boolean;
  generateBibliography: boolean;
}

/**
 * Evidence linking result
 */
export interface EvidenceLinkingResult {
  linkedText: string;
  citations: CitationReference[];
  evidenceLinks: EvidenceLink[];
  evidenceSummary: EvidenceSummary;
  visualizations: EvidenceVisualization[];
  bibliography?: string;
  warnings: string[];
  processingTime: number;
}

/**
 * Main Evidence Linking System class
 */
export class EvidenceLinkingSystem {
  private config: EvidenceLinkingConfig;
  private citationCounter = 1;
  private citationMap: Map<string, CitationReference> = new Map();
  private evidenceLinks: Map<string, EvidenceLink[]> = new Map();

  constructor(config: Partial<EvidenceLinkingConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EvidenceLinkingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Link evidence to generated text
   */
  async linkEvidence(
    text: string,
    insights: Insight[],
    context: SummaryContext,
    options: SummaryOptions
  ): Promise<EvidenceLinkingResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Reset counters for new linking session
      this.resetSession();

      // Extract and process evidence from insights
      const allEvidence = this.extractAllEvidence(insights);
      
      // Filter evidence by relevance threshold
      const relevantEvidence = this.filterEvidenceByRelevance(allEvidence);

      // Create citation references
      const citations = this.createCitationReferences(relevantEvidence);

      // Link evidence to text segments
      const evidenceLinks = await this.createEvidenceLinks(text, insights, relevantEvidence);

      // Generate linked text with inline citations
      const linkedText = this.generateLinkedText(text, evidenceLinks, citations);

      // Create evidence summary
      const evidenceSummary = this.createEvidenceSummary(relevantEvidence, insights, context);

      // Generate visualizations
      const visualizations = this.config.enableVisualizations 
        ? await this.generateVisualizations(insights, relevantEvidence, evidenceLinks)
        : [];

      // Generate bibliography if enabled
      const bibliography = this.config.generateBibliography 
        ? this.generateBibliography(citations)
        : undefined;

      return {
        linkedText,
        citations,
        evidenceLinks,
        evidenceSummary,
        visualizations,
        bibliography,
        warnings,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      warnings.push(`Evidence linking failed: ${error}`);
      return this.createFallbackResult(text, insights, warnings, startTime);
    }
  }

  /**
   * Generate evidence summary at specified detail level
   */
  generateEvidenceSummaryAtLevel(
    evidence: InsightEvidence[],
    insights: Insight[],
    level: 'minimal' | 'brief' | 'detailed' | 'comprehensive'
  ): EvidenceSummary {
    const evidenceCount = evidence.length;
    const sourceCount = new Set(evidence.map(e => e.sourceId)).size;
    const confidenceScore = evidence.reduce((sum, e) => sum + e.relevanceScore, 0) / evidenceCount;
    
    const timeframe = this.calculateTimeframe(evidence);
    const categories = this.extractCategories(insights);
    const keyFindings = this.extractKeyFindings(evidence, insights, level);
    const citations = this.createCitationReferences(evidence);

    let title: string;
    let summary: string;

    switch (level) {
      case 'minimal':
        title = `Evidence Summary (${evidenceCount} sources)`;
        summary = `Based on ${evidenceCount} pieces of evidence from ${sourceCount} sources.`;
        break;
      
      case 'brief':
        title = `Evidence Summary: ${categories.slice(0, 2).join(', ')}`;
        summary = this.generateBriefSummary(evidence, insights);
        break;
      
      case 'detailed':
        title = `Detailed Evidence Analysis: ${categories.join(', ')}`;
        summary = this.generateDetailedSummary(evidence, insights);
        break;
      
      case 'comprehensive':
        title = `Comprehensive Evidence Report`;
        summary = this.generateComprehensiveSummary(evidence, insights);
        break;
    }

    return {
      id: `evidence-summary-${Date.now()}`,
      level,
      title,
      summary,
      evidenceCount,
      sourceCount,
      confidenceScore,
      timeframe,
      categories,
      keyFindings,
      citations
    };
  }

  /**
   * Create evidence visualization
   */
  async generateEvidenceVisualization(
    type: 'network' | 'timeline' | 'heatmap' | 'flow' | 'tree' | 'matrix',
    insights: Insight[],
    evidence: InsightEvidence[],
    evidenceLinks: EvidenceLink[]
  ): Promise<EvidenceVisualization> {
    const config: VisualizationConfig = {
      width: 800,
      height: 600,
      theme: 'light',
      showLabels: true,
      showLegend: true,
      interactive: true,
      zoomable: true,
      exportFormats: ['png', 'svg', 'json'],
      colorScheme: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
    };

    let data: EvidenceVisualizationData;
    let title: string;
    let description: string;

    switch (type) {
      case 'network':
        data = this.createNetworkVisualization(insights, evidence, evidenceLinks);
        title = 'Evidence Network';
        description = 'Network showing relationships between insights and supporting evidence';
        break;

      case 'timeline':
        data = this.createTimelineVisualization(evidence);
        title = 'Evidence Timeline';
        description = 'Chronological view of evidence collection and insights';
        break;

      case 'heatmap':
        data = this.createHeatmapVisualization(insights, evidence);
        title = 'Evidence Heatmap';
        description = 'Intensity map showing evidence distribution across categories';
        break;

      case 'flow':
        data = this.createFlowVisualization(insights, evidence, evidenceLinks);
        title = 'Evidence Flow';
        description = 'Flow diagram showing evidence propagation to insights';
        break;

      case 'tree':
        data = this.createTreeVisualization(insights, evidence);
        title = 'Evidence Hierarchy';
        description = 'Hierarchical view of evidence organization';
        break;

      case 'matrix':
        data = this.createMatrixVisualization(insights, evidence);
        title = 'Evidence Matrix';
        description = 'Matrix showing evidence-insight relationships';
        break;

      default:
        throw new Error(`Unsupported visualization type: ${type}`);
    }

    return {
      id: `viz-${type}-${Date.now()}`,
      type,
      title,
      description,
      data,
      config,
      interactive: true,
      exportable: true
    };
  }

  /**
   * Generate bibliography from citations
   */
  generateBibliography(citations: CitationReference[]): string {
    const sortedCitations = citations.sort((a, b) => a.shortForm.localeCompare(b.shortForm));
    
    const bibliographyEntries = sortedCitations.map(citation => {
      switch (this.config.citationStyle.format) {
        case 'apa':
          return this.formatAPACitation(citation);
        case 'mla':
          return this.formatMLACitation(citation);
        case 'chicago':
          return this.formatChicagoCitation(citation);
        case 'ieee':
          return this.formatIEEECitation(citation);
        default:
          return citation.fullForm;
      }
    });

    return `## Bibliography\n\n${bibliographyEntries.join('\n\n')}`;
  }

  // Private helper methods

  private resetSession(): void {
    this.citationCounter = 1;
    this.citationMap.clear();
    this.evidenceLinks.clear();
  }

  private extractAllEvidence(insights: Insight[]): InsightEvidence[] {
    const allEvidence: InsightEvidence[] = [];
    
    for (const insight of insights) {
      allEvidence.push(...insight.evidence);
    }

    return allEvidence;
  }

  private filterEvidenceByRelevance(evidence: InsightEvidence[]): InsightEvidence[] {
    return evidence.filter(e => e.relevanceScore >= this.config.minRelevanceThreshold);
  }

  private createCitationReferences(evidence: InsightEvidence[]): CitationReference[] {
    const citations: CitationReference[] = [];

    for (const evidenceItem of evidence) {
      const existingCitation = this.citationMap.get(evidenceItem.sourceId);
      
      if (existingCitation) {
        citations.push(existingCitation);
        continue;
      }

      const citation: CitationReference = {
        id: `citation-${this.citationCounter}`,
        shortForm: this.generateShortForm(evidenceItem),
        fullForm: this.generateFullForm(evidenceItem),
        evidenceId: evidenceItem.sourceId,
        sourceType: evidenceItem.type,
        sourceId: evidenceItem.sourceId,
        relevanceScore: evidenceItem.relevanceScore,
        timestamp: evidenceItem.timestamp,
        documentPath: evidenceItem.documentPath,
        excerpt: evidenceItem.excerpt,
        context: evidenceItem.context
      };

      this.citationMap.set(evidenceItem.sourceId, citation);
      citations.push(citation);
      this.citationCounter++;
    }

    return citations;
  }

  private async createEvidenceLinks(
    text: string,
    insights: Insight[],
    evidence: InsightEvidence[]
  ): Promise<EvidenceLink[]> {
    const links: EvidenceLink[] = [];
    const sentences = this.splitIntoSentences(text);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const relatedInsights = this.findRelatedInsights(sentence, insights);
      
      for (const insight of relatedInsights) {
        const insightEvidence = insight.evidence.filter(e => 
          evidence.some(ev => ev.sourceId === e.sourceId)
        );

        for (const evidenceItem of insightEvidence) {
          const link: EvidenceLink = {
            id: `link-${Date.now()}-${Math.random()}`,
            textId: `sentence-${i}`,
            evidenceId: evidenceItem.sourceId,
            linkType: this.determineLinkType(sentence, evidenceItem),
            strength: evidenceItem.relevanceScore,
            position: this.calculateTextPosition(sentence, i, text),
            citationText: this.generateInlineCitation(evidenceItem),
            generatedAt: new Date()
          };

          links.push(link);
        }
      }
    }

    return links;
  }

  private generateLinkedText(
    originalText: string,
    evidenceLinks: EvidenceLink[],
    citations: CitationReference[]
  ): string {
    if (!this.config.enableInlineCitations) {
      return originalText;
    }

    const sentences = this.splitIntoSentences(originalText);
    
    // Group links by sentence
    const linksBySentence = new Map<number, EvidenceLink[]>();
    for (const link of evidenceLinks) {
      const sentenceIndex = parseInt(link.textId.replace('sentence-', ''));
      if (!linksBySentence.has(sentenceIndex)) {
        linksBySentence.set(sentenceIndex, []);
      }
      const links = linksBySentence.get(sentenceIndex);
      if (links) {
        links.push(link);
      }
    }

    // Add citations to sentences
    for (const [sentenceIndex, links] of Array.from(linksBySentence.entries())) {
      if (sentenceIndex < sentences.length) {
        const citationTexts = links
          .slice(0, this.config.citationStyle.maxInlineCitations)
          .map((link: EvidenceLink) => {
            const citation = citations.find(c => c.evidenceId === link.evidenceId);
            return citation ? citation.shortForm : '';
          })
          .filter(Boolean);

        if (citationTexts.length > 0) {
          const citationString = this.formatInlineCitations(citationTexts);
          sentences[sentenceIndex] = sentences[sentenceIndex].trim() + ' ' + citationString;
        }
      }
    }

    return sentences.join(' ');
  }

  private createEvidenceSummary(
    evidence: InsightEvidence[],
    insights: Insight[],
    context: SummaryContext
  ): EvidenceSummary {
    return this.generateEvidenceSummaryAtLevel(evidence, insights, 'detailed');
  }

  private async generateVisualizations(
    insights: Insight[],
    evidence: InsightEvidence[],
    evidenceLinks: EvidenceLink[]
  ): Promise<EvidenceVisualization[]> {
    const visualizations: EvidenceVisualization[] = [];

    try {
      // Generate network visualization
      const network = await this.generateEvidenceVisualization(
        'network', insights, evidence, evidenceLinks
      );
      visualizations.push(network);

      // Generate timeline visualization
      const timeline = await this.generateEvidenceVisualization(
        'timeline', insights, evidence, evidenceLinks
      );
      visualizations.push(timeline);

      // Generate matrix visualization
      const matrix = await this.generateEvidenceVisualization(
        'matrix', insights, evidence, evidenceLinks
      );
      visualizations.push(matrix);
    } catch (error) {
      console.warn('Failed to generate some visualizations:', error);
    }

    return visualizations;
  }

  private createNetworkVisualization(
    insights: Insight[],
    evidence: InsightEvidence[],
    evidenceLinks: EvidenceLink[]
  ): EvidenceVisualizationData {
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];

    // Create insight nodes
    for (const insight of insights) {
      nodes.push({
        id: insight.id,
        label: insight.title,
        type: 'insight',
        size: insight.importance * 20 + 10,
        color: '#1f77b4',
        metadata: { category: insight.category, confidence: insight.confidence }
      });
    }

    // Create evidence nodes
    for (const evidenceItem of evidence) {
      nodes.push({
        id: evidenceItem.sourceId,
        label: evidenceItem.context,
        type: 'evidence',
        size: evidenceItem.relevanceScore * 15 + 5,
        color: '#ff7f0e',
        metadata: { type: evidenceItem.type, relevance: evidenceItem.relevanceScore }
      });
    }

    // Create edges from evidence links
    for (const link of evidenceLinks) {
      const insight = insights.find(i => i.evidence.some(e => e.sourceId === link.evidenceId));
      if (insight) {
        edges.push({
          id: link.id,
          source: link.evidenceId,
          target: insight.id,
          weight: link.strength,
          type: 'supports',
          color: '#2ca02c',
          label: `${(link.strength * 100).toFixed(0)}%`
        });
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        generatedAt: new Date()
      }
    };
  }

  private createTimelineVisualization(evidence: InsightEvidence[]): EvidenceVisualizationData {
    const timeline: TimelinePoint[] = evidence
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((evidenceItem, index) => ({
        id: `timeline-${index}`,
        date: evidenceItem.timestamp,
        title: evidenceItem.context,
        description: evidenceItem.excerpt,
        evidenceIds: [evidenceItem.sourceId],
        importance: evidenceItem.relevanceScore,
        category: evidenceItem.type
      }));

    return {
      timeline,
      metadata: {
        timespan: {
          start: timeline[0]?.date,
          end: timeline[timeline.length - 1]?.date
        },
        pointCount: timeline.length
      }
    };
  }

  private createHeatmapVisualization(
    insights: Insight[],
    evidence: InsightEvidence[]
  ): EvidenceVisualizationData {
    const categories = Array.from(new Set(insights.map(i => i.category)));
    const evidenceTypes = Array.from(new Set(evidence.map(e => e.type)));
    
    const matrix: MatrixCell[][] = [];

    for (let i = 0; i < categories.length; i++) {
      const row: MatrixCell[] = [];
      for (let j = 0; j < evidenceTypes.length; j++) {
        const category = categories[i];
        const evidenceType = evidenceTypes[j];
        
        const relevantInsights = insights.filter(insight => insight.category === category);
        const relevantEvidence = relevantInsights.flatMap(insight => 
          insight.evidence.filter(e => e.type === evidenceType)
        );
        
        const value = relevantEvidence.length > 0 
          ? relevantEvidence.reduce((sum, e) => sum + e.relevanceScore, 0) / relevantEvidence.length
          : 0;

        row.push({
          row: category,
          column: evidenceType,
          value,
          label: `${relevantEvidence.length} items`,
          color: this.getHeatmapColor(value)
        });
      }
      matrix.push(row);
    }

    return {
      matrix,
      metadata: {
        categories,
        evidenceTypes,
        dimensions: { rows: categories.length, columns: evidenceTypes.length }
      }
    };
  }

  private createFlowVisualization(
    insights: Insight[],
    evidence: InsightEvidence[],
    evidenceLinks: EvidenceLink[]
  ): EvidenceVisualizationData {
    // Similar to network but with flow-specific layout
    return this.createNetworkVisualization(insights, evidence, evidenceLinks);
  }

  private createTreeVisualization(
    insights: Insight[],
    evidence: InsightEvidence[]
  ): EvidenceVisualizationData {
    const hierarchy: HierarchyNode[] = [];
    const categories = Array.from(new Set(insights.map(i => i.category)));

    for (const category of categories) {
      const categoryInsights = insights.filter(i => i.category === category);
      const children: HierarchyNode[] = categoryInsights.map(insight => ({
        id: insight.id,
        label: insight.title,
        value: insight.importance,
        metadata: { confidence: insight.confidence, evidenceCount: insight.evidence.length }
      }));

      hierarchy.push({
        id: category,
        label: category,
        children,
        value: categoryInsights.reduce((sum, i) => sum + i.importance, 0),
        metadata: { insightCount: categoryInsights.length }
      });
    }

    return {
      hierarchy,
      metadata: {
        categoryCount: categories.length,
        totalInsights: insights.length
      }
    };
  }

  private createMatrixVisualization(
    insights: Insight[],
    evidence: InsightEvidence[]
  ): EvidenceVisualizationData {
    return this.createHeatmapVisualization(insights, evidence);
  }

  // Citation formatting methods

  private generateShortForm(evidence: InsightEvidence): string {
    switch (this.config.citationStyle.inlineFormat) {
      case 'parenthetical':
        return `(${this.citationCounter})`;
      case 'superscript':
        return `[${this.citationCounter}]`;
      case 'footnote':
        return `^${this.citationCounter}`;
      case 'endnote':
        return `{${this.citationCounter}}`;
      default:
        return `[${this.citationCounter}]`;
    }
  }

  private generateFullForm(evidence: InsightEvidence): string {
    const timestamp = this.config.citationStyle.showTimestamps 
      ? ` (${evidence.timestamp.toLocaleDateString()})`
      : '';
    
    const relevance = this.config.citationStyle.showRelevanceScore
      ? ` [Relevance: ${(evidence.relevanceScore * 100).toFixed(0)}%]`
      : '';

    return `${evidence.context}${timestamp}${relevance}. ${evidence.excerpt}`;
  }

  private formatAPACitation(citation: CitationReference): string {
    const year = citation.timestamp.getFullYear();
    return `${citation.context} (${year}). ${citation.excerpt}`;
  }

  private formatMLACitation(citation: CitationReference): string {
    return `${citation.context}. "${citation.excerpt}"`;
  }

  private formatChicagoCitation(citation: CitationReference): string {
    return `${citation.context}, "${citation.excerpt}," accessed ${citation.timestamp.toLocaleDateString()}.`;
  }

  private formatIEEECitation(citation: CitationReference): string {
    return `${citation.context}, "${citation.excerpt}," ${citation.timestamp.getFullYear()}.`;
  }

  private formatInlineCitations(citationTexts: string[]): string {
    if (citationTexts.length === 1) {
      return citationTexts[0];
    } else if (citationTexts.length === 2) {
      return `${citationTexts[0]}, ${citationTexts[1]}`;
    } else {
      return `${citationTexts.slice(0, -1).join(', ')}, and ${citationTexts[citationTexts.length - 1]}`;
    }
  }

  // Utility methods

  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private findRelatedInsights(sentence: string, insights: Insight[]): Insight[] {
    const sentenceLower = sentence.toLowerCase();
    return insights.filter(insight => {
      const titleWords = insight.title.toLowerCase().split(/\s+/);
      const descWords = insight.description.toLowerCase().split(/\s+/);
      const allWords = [...titleWords, ...descWords];
      
      return allWords.some(word => word.length > 3 && sentenceLower.includes(word));
    });
  }

  private determineLinkType(sentence: string, evidence: InsightEvidence): 'direct' | 'supporting' | 'contradicting' | 'contextual' {
    // Simple heuristic - could be enhanced with NLP
    if (evidence.relevanceScore > 0.8) return 'direct';
    if (evidence.relevanceScore > 0.6) return 'supporting';
    return 'contextual';
  }

  private calculateTextPosition(sentence: string, sentenceIndex: number, fullText: string): TextPosition {
    const sentences = this.splitIntoSentences(fullText);
    const startChar = sentences.slice(0, sentenceIndex).join('. ').length;
    const endChar = startChar + sentence.length;

    return {
      sectionId: 'main',
      paragraphIndex: 0,
      sentenceIndex,
      startChar,
      endChar,
      textSpan: sentence
    };
  }

  private generateInlineCitation(evidence: InsightEvidence): string {
    return this.generateShortForm(evidence);
  }

  private calculateTimeframe(evidence: InsightEvidence[]): { start: Date; end: Date } {
    const timestamps = evidence.map(e => e.timestamp).sort((a, b) => a.getTime() - b.getTime());
    return {
      start: timestamps[0] || new Date(),
      end: timestamps[timestamps.length - 1] || new Date()
    };
  }

  private extractCategories(insights: Insight[]): string[] {
    return Array.from(new Set(insights.map(i => i.category)));
  }

  private extractKeyFindings(
    evidence: InsightEvidence[],
    insights: Insight[],
    level: string
  ): string[] {
    const maxFindings = level === 'minimal' ? 2 : level === 'brief' ? 5 : level === 'detailed' ? 10 : 20;
    
    return evidence
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxFindings)
      .map(e => e.excerpt);
  }

  private generateBriefSummary(evidence: InsightEvidence[], insights: Insight[]): string {
    const topEvidence = evidence.slice(0, 3);
    return `Analysis based on ${evidence.length} pieces of evidence reveals key patterns in ${this.extractCategories(insights).join(', ')}. ${topEvidence.map(e => e.excerpt).join(' ')}`;
  }

  private generateDetailedSummary(evidence: InsightEvidence[], insights: Insight[]): string {
    const categories = this.extractCategories(insights);
    const timeframe = this.calculateTimeframe(evidence);
    const avgRelevance = evidence.reduce((sum, e) => sum + e.relevanceScore, 0) / evidence.length;
    
    return `Comprehensive analysis of ${evidence.length} evidence items spanning ${timeframe.start.toLocaleDateString()} to ${timeframe.end.toLocaleDateString()}. Evidence covers ${categories.join(', ')} with average relevance score of ${(avgRelevance * 100).toFixed(0)}%. Key findings include: ${evidence.slice(0, 5).map(e => e.excerpt).join('; ')}.`;
  }

  private generateComprehensiveSummary(evidence: InsightEvidence[], insights: Insight[]): string {
    const detailed = this.generateDetailedSummary(evidence, insights);
    const sourceTypes = Array.from(new Set(evidence.map(e => e.type)));
    const documentCount = new Set(evidence.map(e => e.documentPath)).size;
    
    return `${detailed} Evidence sources include ${sourceTypes.join(', ')} from ${documentCount} documents. Insights demonstrate strong correlation patterns with confidence levels ranging from ${Math.min(...insights.map(i => i.confidence))} to ${Math.max(...insights.map(i => i.confidence))}.`;
  }

  private getHeatmapColor(value: number): string {
    const intensity = Math.floor(value * 255);
    return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
  }

  private createFallbackResult(
    text: string,
    insights: Insight[],
    warnings: string[],
    startTime: number
  ): EvidenceLinkingResult {
    const allEvidence = this.extractAllEvidence(insights);
    
    return {
      linkedText: text,
      citations: [],
      evidenceLinks: [],
      evidenceSummary: this.generateEvidenceSummaryAtLevel(allEvidence, insights, 'minimal'),
      visualizations: [],
      warnings,
      processingTime: Date.now() - startTime
    };
  }

  private mergeWithDefaults(config: Partial<EvidenceLinkingConfig>): EvidenceLinkingConfig {
    return {
      citationStyle: {
        format: 'apa',
        inlineFormat: 'parenthetical',
        showPageNumbers: false,
        showTimestamps: true,
        showRelevanceScore: false,
        abbreviateAuthors: true,
        maxInlineCitations: 3
      },
      enableInlineCitations: true,
      enableEvidenceSections: true,
      enableVisualizations: true,
      maxEvidencePerInsight: 5,
      minRelevanceThreshold: 0.3,
      groupSimilarEvidence: true,
      showConfidenceScores: true,
      enableCrossReferences: true,
      generateBibliography: true,
      ...config
    };
  }
}

/**
 * Factory for creating evidence linking systems with common configurations
 */
export class EvidenceLinkingFactory {
  /**
   * Create evidence linking system for academic papers
   */
  static createForAcademic(): EvidenceLinkingSystem {
    return new EvidenceLinkingSystem({
      citationStyle: {
        format: 'apa',
        inlineFormat: 'parenthetical',
        showPageNumbers: true,
        showTimestamps: true,
        showRelevanceScore: false,
        abbreviateAuthors: false,
        maxInlineCitations: 5
      },
      enableInlineCitations: true,
      enableEvidenceSections: true,
      enableVisualizations: false,
      minRelevanceThreshold: 0.5,
      generateBibliography: true
    });
  }

  /**
   * Create evidence linking system for business reports
   */
  static createForBusiness(): EvidenceLinkingSystem {
    return new EvidenceLinkingSystem({
      citationStyle: {
        format: 'custom',
        inlineFormat: 'superscript',
        showPageNumbers: false,
        showTimestamps: true,
        showRelevanceScore: true,
        abbreviateAuthors: true,
        maxInlineCitations: 3
      },
      enableInlineCitations: true,
      enableEvidenceSections: true,
      enableVisualizations: true,
      minRelevanceThreshold: 0.4,
      generateBibliography: false
    });
  }

  /**
   * Create evidence linking system for personal summaries
   */
  static createForPersonal(): EvidenceLinkingSystem {
    return new EvidenceLinkingSystem({
      citationStyle: {
        format: 'custom',
        inlineFormat: 'footnote',
        showPageNumbers: false,
        showTimestamps: false,
        showRelevanceScore: false,
        abbreviateAuthors: true,
        maxInlineCitations: 2
      },
      enableInlineCitations: false,
      enableEvidenceSections: true,
      enableVisualizations: true,
      minRelevanceThreshold: 0.3,
      generateBibliography: false
    });
  }
} 