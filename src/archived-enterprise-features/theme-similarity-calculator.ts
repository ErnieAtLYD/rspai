/**
 * Theme Similarity Calculator
 * Provides various similarity calculation methods for theme detection
 */

import {
  ThemeSimilarityCalculator,
  DetectedTheme,
  DocumentCluster,
  TopicModel
} from './theme-detection-interfaces';

import {
  ProcessedDocument,
  FeatureVector
} from './nlp-interfaces';

/**
 * Implementation of similarity calculations for theme detection
 */
export class CoreThemeSimilarityCalculator implements ThemeSimilarityCalculator {
  
  calculateDocumentSimilarity(docA: ProcessedDocument, docB: ProcessedDocument): number {
    return this.calculateCosineSimilarity(docA.features, docB.features);
  }

  calculateThemeSimilarity(themeA: DetectedTheme, themeB: DetectedTheme): number {
    // Multi-faceted similarity calculation
    const keywordSimilarity = this.calculateKeywordSimilarity(themeA, themeB);
    const categorySimilarity = themeA.category === themeB.category ? 1.0 : 0.0;
    const temporalSimilarity = this.calculateTemporalSimilarity(themeA, themeB);
    const evidenceSimilarity = this.calculateEvidenceSimilarity(themeA, themeB);
    
    // Weighted combination
    return (
      keywordSimilarity * 0.4 +
      categorySimilarity * 0.2 +
      temporalSimilarity * 0.2 +
      evidenceSimilarity * 0.2
    );
  }

  calculateClusterSimilarity(clusterA: DocumentCluster, clusterB: DocumentCluster): number {
    return this.calculateCosineSimilarity(clusterA.centroid, clusterB.centroid);
  }

  calculateTopicSimilarity(topicA: TopicModel, topicB: TopicModel): number {
    // Calculate similarity based on word overlap and weights
    const wordsA = new Map(topicA.words.map(w => [w.word, w.weight]));
    const wordsB = new Map(topicB.words.map(w => [w.word, w.weight]));
    
    const allWords = new Set([...wordsA.keys(), ...wordsB.keys()]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (const word of allWords) {
      const weightA = wordsA.get(word) || 0;
      const weightB = wordsB.get(word) || 0;
      
      dotProduct += weightA * weightB;
      normA += weightA * weightA;
      normB += weightB * weightB;
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  // Private helper methods

  private calculateCosineSimilarity(featuresA: FeatureVector, featuresB: FeatureVector): number {
    // Get all unique terms
    const allTerms = new Set([
      ...featuresA.tfIdf.keys(),
      ...featuresB.tfIdf.keys()
    ]);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of allTerms) {
      const scoreA = featuresA.tfIdf.get(term) || 0;
      const scoreB = featuresB.tfIdf.get(term) || 0;

      dotProduct += scoreA * scoreB;
      normA += scoreA * scoreA;
      normB += scoreB * scoreB;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private calculateKeywordSimilarity(themeA: DetectedTheme, themeB: DetectedTheme): number {
    const keywordsA = new Set(themeA.keywords.map(k => k.term.toLowerCase()));
    const keywordsB = new Set(themeB.keywords.map(k => k.term.toLowerCase()));
    
    const intersection = new Set([...keywordsA].filter(k => keywordsB.has(k)));
    const union = new Set([...keywordsA, ...keywordsB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTemporalSimilarity(themeA: DetectedTheme, themeB: DetectedTheme): number {
    // Calculate overlap in time periods
    const startA = themeA.firstOccurrence.getTime();
    const endA = themeA.lastOccurrence.getTime();
    const startB = themeB.firstOccurrence.getTime();
    const endB = themeB.lastOccurrence.getTime();
    
    const overlapStart = Math.max(startA, startB);
    const overlapEnd = Math.min(endA, endB);
    
    if (overlapStart >= overlapEnd) return 0;
    
    const overlapDuration = overlapEnd - overlapStart;
    const totalDuration = Math.max(endA, endB) - Math.min(startA, startB);
    
    return totalDuration > 0 ? overlapDuration / totalDuration : 0;
  }

  private calculateEvidenceSimilarity(themeA: DetectedTheme, themeB: DetectedTheme): number {
    // Calculate similarity based on shared documents in evidence
    const docsA = new Set(themeA.evidence.map(e => e.documentId));
    const docsB = new Set(themeB.evidence.map(e => e.documentId));
    
    const intersection = new Set([...docsA].filter(d => docsB.has(d)));
    const union = new Set([...docsA, ...docsB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  calculateJaccardSimilarity<T>(setA: Set<T>, setB: Set<T>): number {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate semantic similarity using word embeddings (placeholder)
   */
  calculateSemanticSimilarity(textA: string, textB: string): number {
    // Placeholder for semantic similarity using embeddings
    // In a real implementation, you would use word embeddings or sentence transformers
    const wordsA = textA.toLowerCase().split(/\s+/);
    const wordsB = textB.toLowerCase().split(/\s+/);
    
    return this.calculateJaccardSimilarity(new Set(wordsA), new Set(wordsB));
  }

  /**
   * Calculate edit distance (Levenshtein) between two strings
   */
  calculateEditDistance(strA: string, strB: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= strB.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= strA.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= strB.length; i++) {
      for (let j = 1; j <= strA.length; j++) {
        if (strB.charAt(i - 1) === strA.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[strB.length][strA.length];
  }

  /**
   * Normalize edit distance to similarity score (0-1)
   */
  calculateEditSimilarity(strA: string, strB: string): number {
    const distance = this.calculateEditDistance(strA, strB);
    const maxLength = Math.max(strA.length, strB.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }
} 