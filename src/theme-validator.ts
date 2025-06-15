/**
 * Theme Validator
 * Provides validation and quality assessment for themes, clusters, and topic models
 */

import {
  ThemeValidator,
  DetectedTheme,
  DocumentCluster,
  TopicModel,
  ThemeValidationResult,
  ClusterValidationResult,
  TopicValidationResult,
  ValidationIssue,
  ClusterQualityMetrics,
  TopicQualityMetrics
} from './theme-detection-interfaces';

import { ProcessedDocument } from './nlp-interfaces';

/**
 * Core implementation of theme validation
 */
export class CoreThemeValidator implements ThemeValidator {

  validateTheme(theme: DetectedTheme, documents: ProcessedDocument[]): ThemeValidationResult {
    const issues: ValidationIssue[] = [];
    let qualityScore = 1.0;

    // Check confidence threshold
    if (theme.confidence < 0.5) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: `Theme confidence (${theme.confidence.toFixed(2)}) is below recommended threshold (0.5)`,
        severity: 'medium',
        suggestion: 'Consider gathering more evidence or refining theme keywords'
      });
      qualityScore -= 0.2;
    }

    // Check frequency
    if (theme.frequency < 3) {
      issues.push({
        type: 'warning',
        category: 'frequency',
        message: `Theme frequency (${theme.frequency}) is very low`,
        severity: 'low',
        suggestion: 'Verify this represents a genuine pattern rather than noise'
      });
      qualityScore -= 0.1;
    }

    // Check coherence
    if (theme.coherence < 0.4) {
      issues.push({
        type: 'warning',
        category: 'coherence',
        message: `Theme coherence (${theme.coherence.toFixed(2)}) is below recommended threshold (0.4)`,
        severity: 'high',
        suggestion: 'Review and refine theme keywords for better coherence'
      });
      qualityScore -= 0.3;
    }

    // Check keyword quality
    if (theme.keywords.length < 3) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: 'Theme has very few keywords, may be too narrow',
        severity: 'medium',
        suggestion: 'Consider expanding keyword set or merging with similar themes'
      });
      qualityScore -= 0.15;
    }

    // Check evidence quality
    const lowQualityEvidence = theme.evidence.filter(e => e.relevanceScore < 0.5).length;
    if (lowQualityEvidence > theme.evidence.length * 0.5) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: 'More than half of the evidence has low relevance scores',
        severity: 'medium',
        suggestion: 'Review evidence selection criteria and filtering'
      });
      qualityScore -= 0.2;
    }

    // Check temporal consistency
    if (theme.timespan > 0 && theme.evidence.length > 1) {
      const temporalGaps = this.checkTemporalGaps(theme);
      if (temporalGaps.length > 0) {
        issues.push({
          type: 'warning',
          category: 'temporal',
          message: `Theme has ${temporalGaps.length} significant temporal gaps`,
          severity: 'low',
          suggestion: 'Verify theme consistency across time periods'
        });
        qualityScore -= 0.1;
      }
    }

    // Check for potential overlaps
    const duplicateKeywords = this.findDuplicateKeywords(theme);
    if (duplicateKeywords.length > 0) {
      issues.push({
        type: 'warning',
        category: 'overlap',
        message: `Theme has ${duplicateKeywords.length} duplicate or very similar keywords`,
        severity: 'low',
        suggestion: 'Remove duplicate keywords to improve clarity'
      });
      qualityScore -= 0.05;
    }

    const suggestions = this.generateThemeSuggestions(theme, issues);

    return {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      confidence: Math.max(0, Math.min(1, qualityScore)),
      issues,
      suggestions,
      qualityScore: Math.max(0, qualityScore)
    };
  }

  validateCluster(cluster: DocumentCluster, documents: ProcessedDocument[]): ClusterValidationResult {
    const issues: ValidationIssue[] = [];
    const clusterDocs = documents.filter(doc => cluster.documents.includes(doc.id));

    // Check cluster size
    if (cluster.size < 3) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: `Cluster size (${cluster.size}) is very small`,
        severity: 'medium',
        suggestion: 'Consider merging with similar clusters or requiring larger minimum cluster size'
      });
    }

    // Check coherence
    if (cluster.coherence < 0.3) {
      issues.push({
        type: 'error',
        category: 'coherence',
        message: `Cluster coherence (${cluster.coherence.toFixed(2)}) is below minimum threshold (0.3)`,
        severity: 'high',
        suggestion: 'Recalculate cluster or adjust clustering parameters'
      });
    }

    // Check silhouette score
    if (cluster.silhouetteScore < 0.2) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: `Cluster silhouette score (${cluster.silhouetteScore.toFixed(2)}) indicates poor separation`,
        severity: 'medium',
        suggestion: 'Review clustering algorithm parameters or document preprocessing'
      });
    }

    // Validate document availability
    const missingDocs = cluster.documents.filter(id => !clusterDocs.find(doc => doc.id === id));
    if (missingDocs.length > 0) {
      issues.push({
        type: 'error',
        category: 'quality',
        message: `Cluster references ${missingDocs.length} missing documents`,
        severity: 'high',
        suggestion: 'Update cluster document references or provide missing documents'
      });
    }

    const qualityMetrics: ClusterQualityMetrics = {
      silhouetteScore: cluster.silhouetteScore,
      intraClusterDistance: cluster.intraClusterDistance,
      interClusterDistance: cluster.interClusterDistance,
      cohesion: cluster.coherence,
      separation: cluster.interClusterDistance - cluster.intraClusterDistance
    };

    const suggestions = this.generateClusterSuggestions(cluster, issues);

    return {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      coherence: cluster.coherence,
      issues,
      suggestions,
      qualityMetrics
    };
  }

  validateTopicModel(model: TopicModel, documents: ProcessedDocument[]): TopicValidationResult {
    const issues: ValidationIssue[] = [];

    // Check topic coherence
    if (model.coherence < 0.3) {
      issues.push({
        type: 'warning',
        category: 'coherence',
        message: `Topic coherence (${model.coherence.toFixed(2)}) is below recommended threshold (0.3)`,
        severity: 'high',
        suggestion: 'Adjust topic modeling parameters or increase training data'
      });
    }

    // Check word count
    if (model.words.length < 5) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: `Topic has only ${model.words.length} words, may be too narrow`,
        severity: 'medium',
        suggestion: 'Increase minimum words per topic or review topic extraction'
      });
    }

    // Check word probability distribution
    const totalProbability = model.words.reduce((sum, w) => sum + w.probability, 0);
    if (Math.abs(totalProbability - 1.0) > 0.1) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: `Word probabilities don't sum to 1.0 (sum: ${totalProbability.toFixed(2)})`,
        severity: 'low',
        suggestion: 'Normalize word probabilities'
      });
    }

    // Check for dominant words
    const topWordWeight = model.words[0]?.weight || 0;
    if (topWordWeight > 0.8) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: 'Topic is dominated by a single word, may lack diversity',
        severity: 'medium',
        suggestion: 'Review topic modeling parameters to encourage word diversity'
      });
    }

    // Check document associations
    const highProbDocs = model.documents.filter(d => d.probability > 0.5).length;
    if (highProbDocs === 0) {
      issues.push({
        type: 'warning',
        category: 'quality',
        message: 'No documents have high probability for this topic',
        severity: 'medium',
        suggestion: 'Review topic-document associations or topic quality'
      });
    }

    const qualityMetrics: TopicQualityMetrics = {
      coherence: model.coherence,
      perplexity: model.perplexity,
      likelihood: model.likelihood
    };

    const suggestions = this.generateTopicSuggestions(model, issues);

    return {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      coherence: model.coherence,
      issues,
      suggestions,
      qualityMetrics
    };
  }

  // Private helper methods

  private checkTemporalGaps(theme: DetectedTheme): Array<{ start: Date; end: Date; duration: number }> {
    const gaps: Array<{ start: Date; end: Date; duration: number }> = [];
    
    if (theme.evidence.length < 2) return gaps;

    const sortedEvidence = theme.evidence
      .slice()
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 0; i < sortedEvidence.length - 1; i++) {
      const current = sortedEvidence[i];
      const next = sortedEvidence[i + 1];
      const gapDays = (next.timestamp.getTime() - current.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      
      // Consider gaps longer than 30 days as significant
      if (gapDays > 30) {
        gaps.push({
          start: current.timestamp,
          end: next.timestamp,
          duration: gapDays
        });
      }
    }

    return gaps;
  }

  private findDuplicateKeywords(theme: DetectedTheme): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const keyword of theme.keywords) {
      const normalized = keyword.term.toLowerCase().trim();
      if (seen.has(normalized)) {
        duplicates.push(keyword.term);
      } else {
        seen.add(normalized);
      }
    }

    return duplicates;
  }

  private generateThemeSuggestions(theme: DetectedTheme, issues: ValidationIssue[]): string[] {
    const suggestions: string[] = [];

    if (theme.confidence < 0.7) {
      suggestions.push('Consider gathering more supporting evidence to increase confidence');
    }

    if (theme.keywords.length > 20) {
      suggestions.push('Theme may be too broad - consider splitting into sub-themes');
    }

    if (theme.frequency < 5) {
      suggestions.push('Low frequency theme - verify it represents a meaningful pattern');
    }

    if (issues.some(i => i.category === 'coherence')) {
      suggestions.push('Review and refine keywords to improve theme coherence');
    }

    if (theme.evidence.length > 50) {
      suggestions.push('Large evidence set - consider sampling representative examples');
    }

    return suggestions;
  }

  private generateClusterSuggestions(cluster: DocumentCluster, issues: ValidationIssue[]): string[] {
    const suggestions: string[] = [];

    if (cluster.size < 5) {
      suggestions.push('Small cluster - consider merging with similar clusters');
    }

    if (cluster.coherence < 0.5) {
      suggestions.push('Low coherence - review clustering parameters or document preprocessing');
    }

    if (cluster.silhouetteScore < 0.3) {
      suggestions.push('Poor cluster separation - adjust clustering algorithm or similarity threshold');
    }

    if (issues.some(i => i.type === 'error')) {
      suggestions.push('Address critical errors before using this cluster for theme detection');
    }

    return suggestions;
  }

  private generateTopicSuggestions(model: TopicModel, issues: ValidationIssue[]): string[] {
    const suggestions: string[] = [];

    if (model.coherence < 0.5) {
      suggestions.push('Low coherence - increase training iterations or adjust parameters');
    }

    if (model.words.length < 8) {
      suggestions.push('Few words in topic - consider increasing words per topic');
    }

    if (model.documents.length === 0) {
      suggestions.push('No associated documents - review topic-document assignment');
    }

    const avgProbability = model.documents.reduce((sum, d) => sum + d.probability, 0) / model.documents.length;
    if (avgProbability < 0.3) {
      suggestions.push('Low document-topic probabilities - review topic modeling quality');
    }

    return suggestions;
  }

  /**
   * Validate a collection of themes for consistency and quality
   */
  validateThemeCollection(themes: DetectedTheme[], documents: ProcessedDocument[]): {
    overallQuality: number;
    issues: ValidationIssue[];
    suggestions: string[];
    themeValidations: Array<{ themeId: string; validation: ThemeValidationResult }>;
  } {
    const themeValidations = themes.map(theme => ({
      themeId: theme.id,
      validation: this.validateTheme(theme, documents)
    }));

    const collectionIssues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Check for theme overlaps
    const overlaps = this.findThemeOverlaps(themes);
    if (overlaps.length > 0) {
      collectionIssues.push({
        type: 'warning',
        category: 'overlap',
        message: `Found ${overlaps.length} potential theme overlaps`,
        severity: 'medium',
        suggestion: 'Review similar themes for potential merging'
      });
    }

    // Check coverage
    const uniqueDocuments = new Set(themes.flatMap(t => t.evidence.map(e => e.documentId))).size;
    const coverage = uniqueDocuments / documents.length;

    if (coverage < 0.5) {
      collectionIssues.push({
        type: 'warning',
        category: 'quality',
        message: `Theme collection covers only ${(coverage * 100).toFixed(1)}% of documents`,
        severity: 'medium',
        suggestion: 'Consider adjusting detection parameters to improve coverage'
      });
    }

    // Calculate overall quality
    const validThemes = themeValidations.filter(tv => tv.validation.isValid).length;
    const avgQuality = themeValidations.reduce((sum, tv) => sum + tv.validation.qualityScore, 0) / themes.length;
    const overallQuality = (validThemes / themes.length) * avgQuality;

    // Generate collection-level suggestions
    if (themes.length > 50) {
      suggestions.push('Large number of themes - consider increasing minimum frequency threshold');
    }

    if (validThemes / themes.length < 0.8) {
      suggestions.push('Many invalid themes detected - review detection parameters');
    }

    return {
      overallQuality,
      issues: collectionIssues,
      suggestions,
      themeValidations
    };
  }

  private findThemeOverlaps(themes: DetectedTheme[]): Array<{ themeA: string; themeB: string; similarity: number }> {
    const overlaps: Array<{ themeA: string; themeB: string; similarity: number }> = [];

    for (let i = 0; i < themes.length; i++) {
      for (let j = i + 1; j < themes.length; j++) {
        const similarity = this.calculateThemeOverlap(themes[i], themes[j]);
        if (similarity > 0.7) {
          overlaps.push({
            themeA: themes[i].id,
            themeB: themes[j].id,
            similarity
          });
        }
      }
    }

    return overlaps;
  }

  private calculateThemeOverlap(themeA: DetectedTheme, themeB: DetectedTheme): number {
    const keywordsA = new Set(themeA.keywords.map(k => k.term.toLowerCase()));
    const keywordsB = new Set(themeB.keywords.map(k => k.term.toLowerCase()));
    
    const intersection = new Set([...keywordsA].filter(k => keywordsB.has(k)));
    const union = new Set([...keywordsA, ...keywordsB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
} 