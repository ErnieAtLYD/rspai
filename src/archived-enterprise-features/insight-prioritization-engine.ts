/**
 * Insight Prioritization Engine
 * Implements sophisticated algorithms to rank and select the most relevant insights
 * for inclusion in summaries based on multiple scoring criteria.
 */

import { 
  Insight, 
  InsightCategory, 
  InsightType, 
  SummaryOptions, 
  PriorityWeighting,
  SummaryContext,
  DateRange
} from './summary-generation-interfaces';
import { AIModelAdapter } from './ai-interfaces';

/**
 * Configuration for insight prioritization
 */
export interface PrioritizationConfig {
  // Scoring weights
  weights: PriorityWeighting;
  
  // Filtering options
  minConfidenceThreshold: number;
  minImportanceThreshold: number;
  maxInsights: number;
  
  // Redundancy control
  enableRedundancyFiltering: boolean;
  similarityThreshold: number; // 0-1 scale
  maxSimilarInsights: number;
  
  // Category balancing
  enableCategoryBalancing: boolean;
  categoryLimits: Record<InsightCategory, number>;
  categoryMinimums: Record<InsightCategory, number>;
  
  // Type balancing
  enableTypeBalancing: boolean;
  typeLimits: Record<InsightType, number>;
  typeMinimums: Record<InsightType, number>;
  
  // Temporal considerations
  enableTemporalScoring: boolean;
  recencyDecayFactor: number; // How quickly older insights lose relevance
  temporalWindowDays: number; // Days to consider for recency scoring
  
  // Quality thresholds
  minActionabilityScore: number;
  minNoveltyScore: number;
  requireEvidence: boolean;
  minEvidenceCount: number;
  
  // Advanced options
  enableDiversityBoost: boolean;
  diversityWeight: number;
  enableContextualRelevance: boolean;
  contextWeight: number;
}

/**
 * Scoring breakdown for an insight
 */
export interface InsightScore {
  insightId: string;
  totalScore: number;
  
  // Component scores (0-1 scale)
  confidenceScore: number;
  importanceScore: number;
  actionabilityScore: number;
  noveltyScore: number;
  recencyScore: number;
  frequencyScore: number;
  evidenceScore: number;
  diversityScore: number;
  contextualScore: number;
  
  // Weighted scores
  weightedConfidence: number;
  weightedImportance: number;
  weightedActionability: number;
  weightedNovelty: number;
  weightedRecency: number;
  weightedFrequency: number;
  
  // Metadata
  category: InsightCategory;
  type: InsightType;
  rank: number;
  selected: boolean;
  rejectionReason?: string;
}

/**
 * Prioritization result with detailed analysis
 */
export interface PrioritizationResult {
  selectedInsights: Insight[];
  allScores: InsightScore[];
  rejectedInsights: Array<{
    insight: Insight;
    score: InsightScore;
    reason: string;
  }>;
  
  // Analysis metadata
  totalInsightsAnalyzed: number;
  averageScore: number;
  scoreDistribution: Record<string, number>; // Score ranges and counts
  
  // Category distribution
  categoryDistribution: Record<InsightCategory, number>;
  typeDistribution: Record<InsightType, number>;
  
  // Quality metrics
  averageConfidence: number;
  averageImportance: number;
  averageActionability: number;
  diversityIndex: number;
  
  // Processing metadata
  processingTime: number;
  configUsed: PrioritizationConfig;
  warnings: string[];
}

/**
 * Main insight prioritization engine
 */
export class InsightPrioritizationEngine {
  private config: PrioritizationConfig;
  private aiModel?: AIModelAdapter;

  constructor(config: Partial<PrioritizationConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
  }

  /**
   * Set AI model for enhanced analysis
   */
  setAIModel(model: AIModelAdapter): void {
    this.aiModel = model;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PrioritizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Main prioritization method
   */
  async prioritizeInsights(
    insights: Insight[],
    context: SummaryContext,
    options: SummaryOptions
  ): Promise<PrioritizationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Initial filtering
      const filteredInsights = this.applyInitialFilters(insights, warnings);
      
      // Step 2: Calculate base scores
      const scoredInsights = await this.calculateInsightScores(
        filteredInsights, 
        context, 
        options
      );
      
      // Step 3: Apply contextual relevance scoring
      if (this.config.enableContextualRelevance) {
        await this.applyContextualScoring(scoredInsights, context);
      }
      
      // Step 4: Handle redundancy filtering
      if (this.config.enableRedundancyFiltering) {
        this.filterRedundantInsights(scoredInsights, insights, warnings);
      }
      
      // Step 5: Apply category and type balancing
      const balancedInsights = this.applyBalancing(scoredInsights, warnings);
      
      // Step 6: Final selection and ranking
      const selectedInsights = this.selectTopInsights(balancedInsights);
      
      // Step 7: Generate result analysis
      const result = this.generateResult(
        insights,
        scoredInsights,
        selectedInsights,
        Date.now() - startTime,
        warnings
      );

      return result;
    } catch (error) {
      throw new Error(`Insight prioritization failed: ${error.message}`);
    }
  }

  /**
   * Apply initial filtering based on thresholds
   */
  private applyInitialFilters(insights: Insight[], warnings: string[]): Insight[] {
    const filtered = insights.filter(insight => {
      // Confidence threshold
      if (insight.confidence < this.config.minConfidenceThreshold) {
        return false;
      }
      
      // Importance threshold
      if (insight.importance < this.config.minImportanceThreshold) {
        return false;
      }
      
      // Actionability threshold
      if (insight.actionability < this.config.minActionabilityScore) {
        return false;
      }
      
      // Novelty threshold
      if (insight.novelty < this.config.minNoveltyScore) {
        return false;
      }
      
      // Evidence requirement
      if (this.config.requireEvidence && 
          insight.evidence.length < this.config.minEvidenceCount) {
        return false;
      }
      
      return true;
    });

    if (filtered.length < insights.length) {
      warnings.push(
        `Filtered out ${insights.length - filtered.length} insights due to threshold requirements`
      );
    }

    return filtered;
  }

  /**
   * Calculate comprehensive scores for insights
   */
  private async calculateInsightScores(
    insights: Insight[],
    context: SummaryContext,
    options: SummaryOptions
  ): Promise<InsightScore[]> {
    const scores: InsightScore[] = [];
    const now = new Date();

    for (const insight of insights) {
      // Base component scores
      const confidenceScore = insight.confidence;
      const importanceScore = insight.importance;
      const actionabilityScore = insight.actionability;
      const noveltyScore = insight.novelty;
      
      // Recency score
      const recencyScore = this.calculateRecencyScore(insight.timeframe, now);
      
      // Frequency score (based on evidence count and related insights)
      const frequencyScore = this.calculateFrequencyScore(insight);
      
      // Evidence quality score
      const evidenceScore = this.calculateEvidenceScore(insight);
      
      // Diversity score (calculated later in batch)
      const diversityScore = 0; // Will be updated in diversity calculation
      
      // Contextual score (calculated later if enabled)
      const contextualScore = 0; // Will be updated in contextual scoring
      
      // Apply weights
      const weights = this.config.weights;
      const weightedConfidence = confidenceScore * weights.confidence;
      const weightedImportance = importanceScore * weights.impact;
      const weightedActionability = actionabilityScore * weights.actionability;
      const weightedNovelty = noveltyScore * weights.novelty;
      const weightedRecency = recencyScore * weights.recency;
      const weightedFrequency = frequencyScore * weights.frequency;
      
      // Calculate total score
      const totalScore = (
        weightedConfidence +
        weightedImportance +
        weightedActionability +
        weightedNovelty +
        weightedRecency +
        weightedFrequency
      ) / Object.values(weights).reduce((sum, w) => sum + w, 0);

      const score: InsightScore = {
        insightId: insight.id,
        totalScore,
        confidenceScore,
        importanceScore,
        actionabilityScore,
        noveltyScore,
        recencyScore,
        frequencyScore,
        evidenceScore,
        diversityScore,
        contextualScore,
        weightedConfidence,
        weightedImportance,
        weightedActionability,
        weightedNovelty,
        weightedRecency,
        weightedFrequency,
        category: insight.category,
        type: insight.type,
        rank: 0, // Will be set after sorting
        selected: false,
        rejectionReason: undefined
      };

      scores.push(score);
    }

    // Calculate diversity scores if enabled
    if (this.config.enableDiversityBoost) {
      this.calculateDiversityScores(scores, insights);
    }

    // Sort by total score and assign ranks
    scores.sort((a, b) => b.totalScore - a.totalScore);
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });

    return scores;
  }

  /**
   * Calculate recency score based on temporal distance
   */
  private calculateRecencyScore(timeframe: DateRange, now: Date): number {
    if (!this.config.enableTemporalScoring) {
      return 0.5; // Neutral score if temporal scoring disabled
    }

    const endDate = timeframe.end;
    const daysDiff = Math.abs(now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Apply exponential decay
    const decayFactor = this.config.recencyDecayFactor;
    const windowDays = this.config.temporalWindowDays;
    
    if (daysDiff > windowDays) {
      return 0.1; // Very old insights get minimal recency score
    }
    
    return Math.exp(-decayFactor * daysDiff / windowDays);
  }

  /**
   * Calculate frequency score based on evidence and related insights
   */
  private calculateFrequencyScore(insight: Insight): number {
    const evidenceCount = insight.evidence.length;
    const relatedCount = insight.relatedInsights.length;
    
    // Normalize based on typical ranges
    const evidenceScore = Math.min(evidenceCount / 10, 1.0); // Max at 10 pieces of evidence
    const relatedScore = Math.min(relatedCount / 5, 1.0); // Max at 5 related insights
    
    return (evidenceScore * 0.7 + relatedScore * 0.3);
  }

  /**
   * Calculate evidence quality score
   */
  private calculateEvidenceScore(insight: Insight): number {
    if (insight.evidence.length === 0) {
      return 0;
    }

    const avgRelevance = insight.evidence.reduce(
      (sum, evidence) => sum + evidence.relevanceScore, 0
    ) / insight.evidence.length;

    // Factor in evidence diversity (different types)
    const evidenceTypes = new Set(insight.evidence.map(e => e.type));
    const diversityBonus = Math.min(evidenceTypes.size / 4, 0.2); // Max 20% bonus

    return Math.min(avgRelevance + diversityBonus, 1.0);
  }

  /**
   * Calculate diversity scores for all insights
   */
  private calculateDiversityScores(scores: InsightScore[], insights: Insight[]): void {
    for (const score of scores) {
      // Calculate diversity based on category and type distribution
      const categoryCount = scores.filter(s => s.category === score.category).length;
      const typeCount = scores.filter(s => s.type === score.type).length;
      
      // Higher diversity score for less common categories/types
      const categoryDiversity = 1.0 - (categoryCount / scores.length);
      const typeDiversity = 1.0 - (typeCount / scores.length);
      
      score.diversityScore = (categoryDiversity + typeDiversity) / 2;
      
      // Apply diversity weight to total score
      if (this.config.enableDiversityBoost) {
        score.totalScore += score.diversityScore * this.config.diversityWeight;
      }
    }
  }

  /**
   * Apply contextual relevance scoring
   */
  private async applyContextualScoring(
    scores: InsightScore[], 
    context: SummaryContext
  ): Promise<void> {
    for (const score of scores) {
      const relevance = this.calculateContextualRelevance(score, context);
      score.contextualScore = relevance;
      
      // Apply context weight to total score
      score.totalScore += score.contextualScore * this.config.contextWeight;
    }
    
    // Re-sort after contextual scoring
    scores.sort((a, b) => b.totalScore - a.totalScore);
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });
  }

  /**
   * Calculate contextual relevance for an insight
   */
  private calculateContextualRelevance(
    score: InsightScore, 
    context: SummaryContext
  ): number {
    // Purpose alignment
    const purposeAlignment = this.calculatePurposeAlignment(score, context.purpose);
    
    // Audience relevance
    const audienceRelevance = this.calculateAudienceRelevance(score, context.audience);
    
    const relevanceScore = (purposeAlignment + audienceRelevance) / 2;
    return relevanceScore;
  }

  /**
   * Filter redundant insights based on similarity
   */
  private filterRedundantInsights(
    scores: InsightScore[], 
    insights: Insight[], 
    warnings: string[]
  ): void {
    const insightMap = new Map(insights.map(i => [i.id, i]));
    const toRemove = new Set<string>();
    
    for (let i = 0; i < scores.length; i++) {
      if (toRemove.has(scores[i].insightId)) continue;
      
      for (let j = i + 1; j < scores.length; j++) {
        if (toRemove.has(scores[j].insightId)) continue;
        
        const insightA = insightMap.get(scores[i].insightId);
        const insightB = insightMap.get(scores[j].insightId);
        
        if (insightA && insightB) {
          const similarity = this.calculateInsightSimilarity(insightA, insightB);
          
          if (similarity > this.config.similarityThreshold) {
            // Keep the higher-scored insight
            const toRemoveId = scores[i].totalScore >= scores[j].totalScore 
              ? scores[j].insightId 
              : scores[i].insightId;
            
            toRemove.add(toRemoveId);
            
            // Mark as rejected
            const rejectedScore = scores.find(s => s.insightId === toRemoveId);
            if (rejectedScore) {
              rejectedScore.selected = false;
              rejectedScore.rejectionReason = `Too similar to insight ${
                toRemoveId === scores[j].insightId ? scores[i].insightId : scores[j].insightId
              } (similarity: ${similarity.toFixed(2)})`;
            }
          }
        }
      }
    }

    if (toRemove.size > 0) {
      warnings.push(`Filtered out ${toRemove.size} redundant insights`);
    }
  }

  /**
   * Calculate similarity between two insights
   */
  private calculateInsightSimilarity(insightA: Insight, insightB: Insight): number {
    const titleSim = this.calculateTextSimilarity(insightA.title, insightB.title);
    const descSim = this.calculateTextSimilarity(insightA.description, insightB.description);
    const keywordOverlap = this.calculateArrayOverlap(insightA.keywords, insightB.keywords);
    const categorySim = insightA.category === insightB.category ? 1.0 : 0.0;
    
    return (titleSim * 0.4 + descSim * 0.3 + keywordOverlap * 0.2 + categorySim * 0.1);
  }

  /**
   * Apply category and type balancing
   */
  private applyBalancing(scores: InsightScore[], warnings: string[]): InsightScore[] {
    let balanced = [...scores];
    
    if (this.config.enableCategoryBalancing) {
      balanced = this.applyCategoryBalancing(balanced, warnings);
    }
    
    if (this.config.enableTypeBalancing) {
      balanced = this.applyTypeBalancing(balanced, warnings);
    }
    
    return balanced;
  }

  /**
   * Apply category balancing rules
   */
  private applyCategoryBalancing(scores: InsightScore[], warnings: string[]): InsightScore[] {
    const categoryGroups = new Map<InsightCategory, InsightScore[]>();
    
    // Group by category
    for (const score of scores) {
      if (!categoryGroups.has(score.category)) {
        categoryGroups.set(score.category, []);
      }
      categoryGroups.get(score.category)!.push(score);
    }
    
    const balanced: InsightScore[] = [];
    
    // Apply category limits and minimums
    for (const [category, categoryScores] of categoryGroups) {
      const limit = this.config.categoryLimits[category] || categoryScores.length;
      const minimum = this.config.categoryMinimums[category] || 0;
      
      // Sort by score within category
      categoryScores.sort((a, b) => b.totalScore - a.totalScore);
      
      // Take top scores up to limit, but ensure minimum
      const toTake = Math.max(minimum, Math.min(limit, categoryScores.length));
      balanced.push(...categoryScores.slice(0, toTake));
      
      if (toTake < categoryScores.length) {
        warnings.push(
          `Limited ${category} insights to ${toTake} (from ${categoryScores.length})`
        );
      }
    }
    
    return balanced;
  }

  /**
   * Apply type balancing rules
   */
  private applyTypeBalancing(scores: InsightScore[], warnings: string[]): InsightScore[] {
    const typeGroups = new Map<InsightType, InsightScore[]>();
    
    // Group by type
    for (const score of scores) {
      if (!typeGroups.has(score.type)) {
        typeGroups.set(score.type, []);
      }
      typeGroups.get(score.type)!.push(score);
    }
    
    const balanced: InsightScore[] = [];
    
    // Apply type limits and minimums
    for (const [type, typeScores] of typeGroups) {
      const limit = this.config.typeLimits[type] || typeScores.length;
      const minimum = this.config.typeMinimums[type] || 0;
      
      // Sort by score within type
      typeScores.sort((a, b) => b.totalScore - a.totalScore);
      
      // Take top scores up to limit, but ensure minimum
      const toTake = Math.max(minimum, Math.min(limit, typeScores.length));
      balanced.push(...typeScores.slice(0, toTake));
      
      if (toTake < typeScores.length) {
        warnings.push(
          `Limited ${type} insights to ${toTake} (from ${typeScores.length})`
        );
      }
    }
    
    return balanced;
  }

  /**
   * Select top insights based on final scores
   */
  private selectTopInsights(scores: InsightScore[]): InsightScore[] {
    // Sort by total score
    scores.sort((a, b) => b.totalScore - a.totalScore);
    
    // Select top N insights
    const selected = scores.slice(0, this.config.maxInsights);
    
    // Mark as selected
    selected.forEach(score => {
      score.selected = true;
    });
    
    // Mark remaining as not selected
    scores.slice(this.config.maxInsights).forEach(score => {
      score.selected = false;
      score.rejectionReason = score.rejectionReason || 'Below selection threshold';
    });
    
    return selected;
  }

  /**
   * Generate comprehensive result analysis
   */
  private generateResult(
    originalInsights: Insight[],
    allScores: InsightScore[],
    selectedScores: InsightScore[],
    processingTime: number,
    warnings: string[]
  ): PrioritizationResult {
    const selectedInsights = originalInsights.filter(
      insight => selectedScores.some(score => score.insightId === insight.id)
    );
    
    const rejectedInsights = allScores
      .filter(score => !score.selected)
      .map(score => ({
        insight: originalInsights.find(i => i.id === score.insightId)!,
        score,
        reason: score.rejectionReason || 'Unknown'
      }));

    // Calculate distributions
    const categoryDistribution: Record<InsightCategory, number> = {} as any;
    const typeDistribution: Record<InsightType, number> = {} as any;
    
    for (const score of selectedScores) {
      categoryDistribution[score.category] = (categoryDistribution[score.category] || 0) + 1;
      typeDistribution[score.type] = (typeDistribution[score.type] || 0) + 1;
    }

    // Calculate quality metrics
    const averageConfidence = selectedScores.reduce((sum, s) => sum + s.confidenceScore, 0) / selectedScores.length;
    const averageImportance = selectedScores.reduce((sum, s) => sum + s.importanceScore, 0) / selectedScores.length;
    const averageActionability = selectedScores.reduce((sum, s) => sum + s.actionabilityScore, 0) / selectedScores.length;
    
    // Calculate diversity index (Shannon diversity)
    const categoryValues = Object.values(categoryDistribution);
    const total = categoryValues.reduce((sum, count) => sum + count, 0);
    const diversityIndex = -categoryValues.reduce((sum, count) => {
      const p = count / total;
      return sum + (p > 0 ? p * Math.log2(p) : 0);
    }, 0);

    return {
      selectedInsights,
      allScores,
      rejectedInsights,
      totalInsightsAnalyzed: originalInsights.length,
      averageScore: allScores.reduce((sum, s) => sum + s.totalScore, 0) / allScores.length,
      scoreDistribution: this.calculateScoreDistribution(allScores),
      categoryDistribution,
      typeDistribution,
      averageConfidence,
      averageImportance,
      averageActionability,
      diversityIndex,
      processingTime,
      configUsed: this.config,
      warnings
    };
  }

  /**
   * Helper methods for similarity calculations
   */
  private calculateTextSimilarity(textA: string, textB: string): number {
    // Simple Jaccard similarity
    const wordsA = new Set(textA.toLowerCase().split(/\s+/));
    const wordsB = new Set(textB.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(word => wordsB.has(word)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  private calculateArrayOverlap(arrayA: string[], arrayB: string[]): number {
    const setA = new Set(arrayA);
    const setB = new Set(arrayB);
    
    const intersection = new Set([...setA].filter(item => setB.has(item)));
    const union = new Set([...setA, ...setB]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculatePurposeAlignment(score: InsightScore, purpose: string): number {
    // Map insight categories to purpose alignment scores
    const purposeAlignments: Record<string, Record<InsightCategory, number>> = {
      'daily-review': {
        'productivity': 0.9,
        'habits': 0.8,
        'goals': 0.7,
        'wellbeing': 0.6,
        'challenges': 0.8,
        'achievements': 0.9,
        'learning': 0.5,
        'relationships': 0.4,
        'opportunities': 0.6,
        'patterns': 0.7,
        'trends': 0.5,
        'concerns': 0.8
      },
      'weekly-summary': {
        'productivity': 0.8,
        'habits': 0.9,
        'goals': 0.9,
        'wellbeing': 0.7,
        'challenges': 0.7,
        'achievements': 0.8,
        'learning': 0.7,
        'relationships': 0.6,
        'opportunities': 0.8,
        'patterns': 0.9,
        'trends': 0.8,
        'concerns': 0.6
      },
      'monthly-report': {
        'productivity': 0.7,
        'habits': 0.6,
        'goals': 0.9,
        'wellbeing': 0.8,
        'challenges': 0.6,
        'achievements': 0.9,
        'learning': 0.8,
        'relationships': 0.7,
        'opportunities': 0.9,
        'patterns': 0.8,
        'trends': 0.9,
        'concerns': 0.5
      },
      'project-review': {
        'productivity': 0.9,
        'habits': 0.4,
        'goals': 0.8,
        'wellbeing': 0.3,
        'challenges': 0.9,
        'achievements': 0.8,
        'learning': 0.9,
        'relationships': 0.5,
        'opportunities': 0.8,
        'patterns': 0.6,
        'trends': 0.7,
        'concerns': 0.8
      }
    };
    
    return purposeAlignments[purpose]?.[score.category] || 0.5;
  }

  private calculateAudienceRelevance(score: InsightScore, audience: string): number {
    // Map insight types to audience relevance scores
    const audienceRelevances: Record<string, Record<InsightType, number>> = {
      'self': {
        'observation': 0.8,
        'correlation': 0.7,
        'causation': 0.8,
        'prediction': 0.9,
        'recommendation': 0.9,
        'warning': 0.9,
        'opportunity': 0.8,
        'achievement': 0.7,
        'pattern': 0.8,
        'anomaly': 0.6
      },
      'team': {
        'observation': 0.6,
        'correlation': 0.8,
        'causation': 0.7,
        'prediction': 0.8,
        'recommendation': 0.9,
        'warning': 0.8,
        'opportunity': 0.9,
        'achievement': 0.8,
        'pattern': 0.7,
        'anomaly': 0.5
      },
      'manager': {
        'observation': 0.5,
        'correlation': 0.6,
        'causation': 0.7,
        'prediction': 0.9,
        'recommendation': 0.8,
        'warning': 0.9,
        'opportunity': 0.9,
        'achievement': 0.9,
        'pattern': 0.6,
        'anomaly': 0.7
      }
    };
    
    return audienceRelevances[audience]?.[score.type] || 0.5;
  }

  private calculateScoreDistribution(scores: InsightScore[]): Record<string, number> {
    const distribution: Record<string, number> = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0
    };
    
    for (const score of scores) {
      const totalScore = score.totalScore;
      if (totalScore < 0.2) distribution['0.0-0.2']++;
      else if (totalScore < 0.4) distribution['0.2-0.4']++;
      else if (totalScore < 0.6) distribution['0.4-0.6']++;
      else if (totalScore < 0.8) distribution['0.6-0.8']++;
      else distribution['0.8-1.0']++;
    }
    
    return distribution;
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(config: Partial<PrioritizationConfig>): PrioritizationConfig {
    const defaultWeights: PriorityWeighting = {
      recency: 0.15,
      frequency: 0.15,
      confidence: 0.25,
      impact: 0.25,
      novelty: 0.1,
      actionability: 0.1
    };

    const defaultCategoryLimits: Record<InsightCategory, number> = {
      'productivity': 5,
      'wellbeing': 3,
      'relationships': 2,
      'learning': 3,
      'goals': 4,
      'habits': 3,
      'challenges': 3,
      'opportunities': 3,
      'patterns': 4,
      'trends': 2,
      'achievements': 3,
      'concerns': 2
    };

    const defaultTypeLimits: Record<InsightType, number> = {
      'observation': 3,
      'correlation': 2,
      'causation': 2,
      'prediction': 3,
      'recommendation': 5,
      'warning': 2,
      'opportunity': 3,
      'achievement': 2,
      'pattern': 3,
      'anomaly': 1
    };

    return {
      weights: { ...defaultWeights, ...config.weights },
      minConfidenceThreshold: config.minConfidenceThreshold || 0.3,
      minImportanceThreshold: config.minImportanceThreshold || 0.3,
      maxInsights: config.maxInsights || 20,
      enableRedundancyFiltering: config.enableRedundancyFiltering ?? true,
      similarityThreshold: config.similarityThreshold || 0.7,
      maxSimilarInsights: config.maxSimilarInsights || 2,
      enableCategoryBalancing: config.enableCategoryBalancing ?? true,
      categoryLimits: { ...defaultCategoryLimits, ...config.categoryLimits },
      categoryMinimums: config.categoryMinimums || {} as Record<InsightCategory, number>,
      enableTypeBalancing: config.enableTypeBalancing ?? true,
      typeLimits: { ...defaultTypeLimits, ...config.typeLimits },
      typeMinimums: config.typeMinimums || {} as Record<InsightType, number>,
      enableTemporalScoring: config.enableTemporalScoring ?? true,
      recencyDecayFactor: config.recencyDecayFactor || 0.1,
      temporalWindowDays: config.temporalWindowDays || 90,
      minActionabilityScore: config.minActionabilityScore || 0.2,
      minNoveltyScore: config.minNoveltyScore || 0.1,
      requireEvidence: config.requireEvidence ?? false,
      minEvidenceCount: config.minEvidenceCount || 1,
      enableDiversityBoost: config.enableDiversityBoost ?? true,
      diversityWeight: config.diversityWeight || 0.1,
      enableContextualRelevance: config.enableContextualRelevance ?? true,
      contextWeight: config.contextWeight || 0.15
    };
  }
}

/**
 * Factory function for creating prioritization engine with common configurations
 */
export class PrioritizationEngineFactory {
  /**
   * Create engine optimized for daily reviews
   */
  static createForDailyReview(): InsightPrioritizationEngine {
    return new InsightPrioritizationEngine({
      maxInsights: 10,
      weights: {
        recency: 0.3,
        frequency: 0.1,
        confidence: 0.2,
        impact: 0.2,
        novelty: 0.1,
        actionability: 0.1
      },
      enableTemporalScoring: true,
      temporalWindowDays: 7,
      enableCategoryBalancing: true,
      categoryLimits: {
        'productivity': 3,
        'habits': 2,
        'goals': 2,
        'wellbeing': 2,
        'challenges': 2,
        'achievements': 2,
        'learning': 1,
        'relationships': 1,
        'opportunities': 1,
        'patterns': 2,
        'trends': 1,
        'concerns': 1
      }
    });
  }

  /**
   * Create engine optimized for weekly summaries
   */
  static createForWeeklySummary(): InsightPrioritizationEngine {
    return new InsightPrioritizationEngine({
      maxInsights: 15,
      weights: {
        recency: 0.2,
        frequency: 0.2,
        confidence: 0.2,
        impact: 0.2,
        novelty: 0.1,
        actionability: 0.1
      },
      enableTemporalScoring: true,
      temporalWindowDays: 14,
      enableCategoryBalancing: true
    });
  }

  /**
   * Create engine optimized for monthly reports
   */
  static createForMonthlyReport(): InsightPrioritizationEngine {
    return new InsightPrioritizationEngine({
      maxInsights: 25,
      weights: {
        recency: 0.1,
        frequency: 0.15,
        confidence: 0.25,
        impact: 0.3,
        novelty: 0.1,
        actionability: 0.1
      },
      enableTemporalScoring: true,
      temporalWindowDays: 60,
      enableCategoryBalancing: true,
      enableDiversityBoost: true,
      diversityWeight: 0.15
    });
  }

  /**
   * Create engine optimized for project reviews
   */
  static createForProjectReview(): InsightPrioritizationEngine {
    return new InsightPrioritizationEngine({
      maxInsights: 20,
      weights: {
        recency: 0.15,
        frequency: 0.1,
        confidence: 0.25,
        impact: 0.25,
        novelty: 0.15,
        actionability: 0.1
      },
      enableCategoryBalancing: true,
      categoryLimits: {
        'productivity': 5,
        'challenges': 4,
        'achievements': 3,
        'learning': 3,
        'opportunities': 3,
        'goals': 2,
        'habits': 1,
        'wellbeing': 1,
        'relationships': 1,
        'patterns': 2,
        'trends': 2,
        'concerns': 3
      }
    });
  }
} 