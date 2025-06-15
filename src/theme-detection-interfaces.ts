/**
 * Theme Detection Interfaces for Pattern Detection Engine
 * Builds on the existing NLP infrastructure to provide advanced theme detection,
 * document clustering, and topic modeling capabilities.
 */

import { ProcessedDocument, FeatureVector } from './nlp-interfaces';

/**
 * Configuration for theme detection algorithms
 */
export interface ThemeDetectionConfig {
  // Clustering parameters
  minClusterSize: number;
  maxClusters: number;
  similarityThreshold: number; // 0-1 scale
  clusteringMethod: 'kmeans' | 'hierarchical' | 'dbscan';
  
  // Topic modeling parameters
  minTopicWords: number;
  maxTopicWords: number;
  topicCoherenceThreshold: number;
  enableTemporalAnalysis: boolean;
  
  // Confidence scoring
  minConfidenceScore: number;
  evidenceWeighting: EvidenceWeighting;
  
  // Filtering and ranking
  minThemeFrequency: number;
  maxThemes: number;
  enableCategoryFiltering: boolean;
  excludedCategories: ThemeCategory[];
  
  // Performance settings
  enableCaching: boolean;
  batchProcessing: boolean;
  maxProcessingTime: number; // milliseconds
}

/**
 * Weighting configuration for evidence scoring
 */
export interface EvidenceWeighting {
  recencyWeight: number; // How much to weight recent occurrences
  frequencyWeight: number; // How much to weight frequency of occurrence
  contextWeight: number; // How much to weight contextual relevance
  lengthWeight: number; // How much to weight content length
  qualityWeight: number; // How much to weight content quality
}

/**
 * Categories for theme classification
 */
export type ThemeCategory = 
  | 'work' 
  | 'personal' 
  | 'health' 
  | 'productivity' 
  | 'learning' 
  | 'relationships' 
  | 'goals' 
  | 'habits' 
  | 'emotions' 
  | 'projects' 
  | 'ideas' 
  | 'reflection' 
  | 'planning' 
  | 'other';

/**
 * A detected theme with all associated metadata
 */
export interface DetectedTheme {
  id: string;
  title: string;
  description: string;
  category: ThemeCategory;
  
  // Core metrics
  confidence: number; // 0-1 scale
  frequency: number; // Number of occurrences
  strength: number; // Overall theme strength (0-1)
  coherence: number; // Topic coherence score (0-1)
  
  // Keywords and concepts
  keywords: ThemeKeyword[];
  concepts: string[];
  relatedTerms: string[];
  
  // Evidence and examples
  evidence: ThemeEvidence[];
  representativeExcerpts: string[];
  
  // Temporal information
  firstOccurrence: Date;
  lastOccurrence: Date;
  timespan: number; // Days between first and last occurrence
  temporalPattern: TemporalPattern;
  
  // Relationships
  relatedThemes: ThemeRelationship[];
  parentTheme?: string; // ID of parent theme if this is a sub-theme
  subThemes: string[]; // IDs of sub-themes
  
  // Clustering information
  clusterId?: string;
  clusterCohesion: number; // How well this theme fits its cluster
  
  // Metadata
  createdAt: Date;
  lastUpdated: Date;
  version: number;
}

/**
 * Keywords associated with a theme
 */
export interface ThemeKeyword {
  term: string;
  weight: number; // Importance within the theme (0-1)
  frequency: number; // Frequency across all documents
  tfIdfScore: number; // TF-IDF score
  contexts: string[]; // Sample contexts where this keyword appears
  category: 'primary' | 'secondary' | 'supporting';
}

/**
 * Evidence supporting a detected theme
 */
export interface ThemeEvidence {
  documentId: string;
  documentPath: string;
  excerpt: string;
  context: string; // Broader context around the excerpt
  relevanceScore: number; // How relevant this evidence is (0-1)
  position: EvidencePosition;
  timestamp: Date;
  wordCount: number;
  sentimentScore?: number; // Optional sentiment analysis
}

/**
 * Position information for evidence
 */
export interface EvidencePosition {
  paragraphIndex: number;
  sentenceIndex: number;
  startChar: number;
  endChar: number;
  lineNumber: number;
}

/**
 * Temporal patterns for theme occurrence
 */
export interface TemporalPattern {
  pattern: 'increasing' | 'decreasing' | 'stable' | 'periodic' | 'sporadic';
  trend: number; // -1 to 1, negative for decreasing, positive for increasing
  periodicity?: number; // Days between occurrences if periodic
  seasonality?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  peakPeriods: DateRange[];
  quietPeriods: DateRange[];
}

/**
 * Date range for temporal analysis
 */
export interface DateRange {
  start: Date;
  end: Date;
  intensity: number; // Theme intensity during this period (0-1)
}

/**
 * Relationship between themes
 */
export interface ThemeRelationship {
  themeId: string;
  relationshipType: 'similar' | 'opposite' | 'causal' | 'temporal' | 'hierarchical';
  strength: number; // Strength of relationship (0-1)
  description: string;
  evidence: string[]; // Document IDs that support this relationship
}

/**
 * Document cluster for theme detection
 */
export interface DocumentCluster {
  id: string;
  centroid: FeatureVector;
  documents: string[]; // Document IDs
  coherence: number; // Internal cluster coherence (0-1)
  size: number;
  
  // Cluster characteristics
  dominantTopics: string[];
  averageSimilarity: number;
  keywords: string[];
  
  // Temporal information
  timespan: DateRange;
  activityPattern: TemporalPattern;
  
  // Quality metrics
  silhouetteScore: number; // Cluster quality metric
  intraClusterDistance: number;
  interClusterDistance: number;
}

/**
 * Topic model for theme identification
 */
export interface TopicModel {
  id: string;
  words: TopicWord[];
  coherence: number; // Topic coherence score
  prevalence: number; // How prevalent this topic is across documents
  
  // Associated documents
  documents: TopicDocument[];
  
  // Temporal evolution
  evolution: TopicEvolution[];
  
  // Quality metrics
  perplexity?: number;
  likelihood?: number;
}

/**
 * Word in a topic model
 */
export interface TopicWord {
  word: string;
  probability: number; // Probability of this word in the topic
  weight: number; // Weight/importance of this word
  frequency: number; // Frequency across topic documents
}

/**
 * Document associated with a topic
 */
export interface TopicDocument {
  documentId: string;
  probability: number; // Probability that this document belongs to the topic
  contribution: number; // How much this document contributes to the topic
  relevantSections: string[]; // Sections most relevant to the topic
}

/**
 * Evolution of a topic over time
 */
export interface TopicEvolution {
  timeWindow: DateRange;
  prevalence: number; // Topic prevalence during this window
  keywordChanges: string[]; // New or changed keywords
  documentCount: number; // Number of documents in this window
}

/**
 * Result of theme detection analysis
 */
export interface ThemeDetectionResult {
  themes: DetectedTheme[];
  clusters: DocumentCluster[];
  topicModels: TopicModel[];
  
  // Analysis metadata
  analysisId: string;
  documentsAnalyzed: number;
  processingTime: number; // milliseconds
  configUsed: ThemeDetectionConfig;
  
  // Quality metrics
  overallCoherence: number; // Average coherence across all themes
  coverage: number; // Percentage of documents covered by themes
  redundancy: number; // Amount of overlap between themes
  
  // Temporal insights
  temporalSummary: TemporalSummary;
  
  // Warnings and issues
  warnings: string[];
  errors: string[];
  
  // Metadata
  createdAt: Date;
  version: string;
}

/**
 * Summary of temporal patterns across all themes
 */
export interface TemporalSummary {
  totalTimespan: DateRange;
  mostActiveThemes: string[]; // Theme IDs
  emergingThemes: string[]; // Recently appeared themes
  decliningThemes: string[]; // Themes losing prominence
  stableThemes: string[]; // Consistently present themes
  
  // Patterns
  overallTrend: 'diversifying' | 'consolidating' | 'stable';
  seasonalPatterns: SeasonalPattern[];
  activityCycles: ActivityCycle[];
}

/**
 * Seasonal pattern in theme occurrence
 */
export interface SeasonalPattern {
  season: 'spring' | 'summer' | 'fall' | 'winter' | 'weekday' | 'weekend';
  dominantThemes: string[];
  intensity: number; // How pronounced this pattern is
  confidence: number; // Confidence in this pattern
}

/**
 * Activity cycle in theme occurrence
 */
export interface ActivityCycle {
  cycle: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  peakTimes: string[]; // Time descriptions (e.g., "morning", "Monday")
  themes: string[]; // Themes that follow this cycle
  strength: number; // Strength of the cycle
}

/**
 * Theme detection engine interface
 */
export interface ThemeDetectionEngine {
  // Configuration
  configure(config: Partial<ThemeDetectionConfig>): void;
  getConfig(): ThemeDetectionConfig;
  
  // Main detection methods
  detectThemes(documents: ProcessedDocument[]): Promise<ThemeDetectionResult>;
  updateThemes(newDocuments: ProcessedDocument[], existingResult?: ThemeDetectionResult): Promise<ThemeDetectionResult>;
  
  // Clustering methods
  clusterDocuments(documents: ProcessedDocument[]): Promise<DocumentCluster[]>;
  refineCluster(cluster: DocumentCluster, documents: ProcessedDocument[]): Promise<DocumentCluster>;
  
  // Topic modeling methods
  buildTopicModel(documents: ProcessedDocument[], numTopics?: number): Promise<TopicModel[]>;
  evaluateTopicCoherence(model: TopicModel, documents: ProcessedDocument[]): number;
  
  // Theme analysis methods
  analyzeThemeRelationships(themes: DetectedTheme[]): Promise<ThemeRelationship[]>;
  analyzeTemporalPatterns(themes: DetectedTheme[]): Promise<TemporalSummary>;
  categorizeTheme(theme: DetectedTheme, documents: ProcessedDocument[]): Promise<ThemeCategory>;
  
  // Utility methods
  calculateThemeConfidence(theme: DetectedTheme, evidence: ThemeEvidence[]): number;
  extractThemeKeywords(documents: ProcessedDocument[], maxKeywords?: number): Promise<ThemeKeyword[]>;
  findSimilarThemes(theme: DetectedTheme, existingThemes: DetectedTheme[]): ThemeRelationship[];
  
  // Cache and performance
  clearCache(): void;
  getPerformanceMetrics(): ThemeDetectionMetrics;
}

/**
 * Performance metrics for theme detection
 */
export interface ThemeDetectionMetrics {
  averageProcessingTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  documentsProcessed: number;
  themesDetected: number;
  clustersCreated: number;
  
  // Quality metrics
  averageThemeConfidence: number;
  averageClusterCoherence: number;
  averageTopicCoherence: number;
  
  // Performance breakdown
  clusteringTime: number;
  topicModelingTime: number;
  themeExtractionTime: number;
  relationshipAnalysisTime: number;
}

/**
 * Similarity calculation methods for theme detection
 */
export interface ThemeSimilarityCalculator {
  calculateDocumentSimilarity(docA: ProcessedDocument, docB: ProcessedDocument): number;
  calculateThemeSimilarity(themeA: DetectedTheme, themeB: DetectedTheme): number;
  calculateClusterSimilarity(clusterA: DocumentCluster, clusterB: DocumentCluster): number;
  calculateTopicSimilarity(topicA: TopicModel, topicB: TopicModel): number;
}

/**
 * Theme validation and quality assessment
 */
export interface ThemeValidator {
  validateTheme(theme: DetectedTheme, documents: ProcessedDocument[]): ThemeValidationResult;
  validateCluster(cluster: DocumentCluster, documents: ProcessedDocument[]): ClusterValidationResult;
  validateTopicModel(model: TopicModel, documents: ProcessedDocument[]): TopicValidationResult;
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  suggestions: string[];
  qualityScore: number; // 0-1 scale
}

/**
 * Cluster validation result
 */
export interface ClusterValidationResult {
  isValid: boolean;
  coherence: number;
  issues: ValidationIssue[];
  suggestions: string[];
  qualityMetrics: ClusterQualityMetrics;
}

/**
 * Topic validation result
 */
export interface TopicValidationResult {
  isValid: boolean;
  coherence: number;
  issues: ValidationIssue[];
  suggestions: string[];
  qualityMetrics: TopicQualityMetrics;
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  type: 'warning' | 'error';
  category: 'coherence' | 'frequency' | 'overlap' | 'temporal' | 'quality';
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

/**
 * Quality metrics for clusters
 */
export interface ClusterQualityMetrics {
  silhouetteScore: number;
  intraClusterDistance: number;
  interClusterDistance: number;
  cohesion: number;
  separation: number;
}

/**
 * Quality metrics for topics
 */
export interface TopicQualityMetrics {
  coherence: number;
  perplexity?: number;
  likelihood?: number;
  wordIntrusion?: number;
  topicIntrusion?: number;
} 