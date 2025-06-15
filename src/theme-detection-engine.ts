/**
 * Theme Detection Engine Implementation
 * Builds on the existing NLP infrastructure to provide advanced theme detection,
 * document clustering, and topic modeling capabilities.
 */

import {
  ThemeDetectionEngine,
  ThemeDetectionConfig,
  DetectedTheme,
  ThemeDetectionResult,
  DocumentCluster,
  TopicModel,
  ThemeKeyword,
  ThemeEvidence,
  ThemeRelationship,
  TemporalSummary,
  ThemeCategory,
  ThemeDetectionMetrics,
  TemporalPattern,
  DateRange,
  TopicWord,
  TopicDocument
} from './theme-detection-interfaces';

import {
  ProcessedDocument,
  FeatureVector,
  NLPProcessor
} from './nlp-interfaces';

import { CoreNLPProcessor } from './nlp-processor';

/**
 * Default configuration for theme detection
 */
const DEFAULT_THEME_CONFIG: ThemeDetectionConfig = {
  // Clustering parameters
  minClusterSize: 3,
  maxClusters: 20,
  similarityThreshold: 0.3,
  clusteringMethod: 'hierarchical',
  
  // Topic modeling parameters
  minTopicWords: 5,
  maxTopicWords: 15,
  topicCoherenceThreshold: 0.4,
  enableTemporalAnalysis: true,
  
  // Confidence scoring
  minConfidenceScore: 0.5,
  evidenceWeighting: {
    recencyWeight: 0.3,
    frequencyWeight: 0.25,
    contextWeight: 0.2,
    lengthWeight: 0.15,
    qualityWeight: 0.1
  },
  
  // Filtering and ranking
  minThemeFrequency: 2,
  maxThemes: 50,
  enableCategoryFiltering: false,
  excludedCategories: [],
  
  // Performance settings
  enableCaching: true,
  batchProcessing: true,
  maxProcessingTime: 30000 // 30 seconds
};

/**
 * Core implementation of the theme detection engine
 */
export class CoreThemeDetectionEngine implements ThemeDetectionEngine {
  private config: ThemeDetectionConfig;
  private nlpProcessor: NLPProcessor;
  private cache: Map<string, ThemeDetectionResult>;
  private metrics: ThemeDetectionMetrics;

  constructor(nlpProcessor?: NLPProcessor, config?: Partial<ThemeDetectionConfig>) {
    this.config = { ...DEFAULT_THEME_CONFIG, ...config };
    this.nlpProcessor = nlpProcessor || new CoreNLPProcessor();
    this.cache = new Map();
    this.metrics = this.initializeMetrics();
  }

  configure(config: Partial<ThemeDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ThemeDetectionConfig {
    return { ...this.config };
  }

  async detectThemes(documents: ProcessedDocument[]): Promise<ThemeDetectionResult> {
    const startTime = Date.now();
    const analysisId = this.generateAnalysisId();

    try {
      // Step 1: Document clustering
      const clusters = await this.clusterDocuments(documents);
      
      // Step 2: Topic modeling
      const topicModels = await this.buildTopicModel(documents);
      
      // Step 3: Extract themes from clusters and topics
      const themes = await this.extractThemesFromAnalysis(clusters, topicModels, documents);
      
      // Step 4: Analyze relationships and temporal patterns
      await this.analyzeThemeRelationships(themes);
      const temporalSummary = await this.analyzeTemporalPatterns(themes);
      
      // Step 5: Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(themes, clusters, topicModels);
      
      const processingTime = Date.now() - startTime;
      
      const result: ThemeDetectionResult = {
        themes,
        clusters,
        topicModels,
        analysisId,
        documentsAnalyzed: documents.length,
        processingTime,
        configUsed: this.config,
        ...qualityMetrics,
        temporalSummary,
        warnings: [],
        errors: [],
        createdAt: new Date(),
        version: '1.0.0'
      };

      // Update metrics
      this.updateMetrics(result);
      
      // Cache result if enabled
      if (this.config.enableCaching) {
        this.cache.set(analysisId, result);
      }

      return result;
    } catch (error) {
      throw new Error(`Theme detection failed: ${error.message}`);
    }
  }

  async updateThemes(
    newDocuments: ProcessedDocument[], 
    existingResult?: ThemeDetectionResult
  ): Promise<ThemeDetectionResult> {
    if (!existingResult) {
      return this.detectThemes(newDocuments);
    }

    // Incremental update logic
    const allDocuments = [...this.getDocumentsFromResult(existingResult), ...newDocuments];
    return this.detectThemes(allDocuments);
  }

  async clusterDocuments(documents: ProcessedDocument[]): Promise<DocumentCluster[]> {
    const startTime = Date.now();
    
    if (documents.length < this.config.minClusterSize) {
      return [];
    }

    // Calculate similarity matrix
    const similarityMatrix = this.calculateSimilarityMatrix(documents);
    
    // Perform clustering based on configured method
    let clusters: DocumentCluster[];
    switch (this.config.clusteringMethod) {
      case 'hierarchical':
        clusters = this.performHierarchicalClustering(documents, similarityMatrix);
        break;
      case 'kmeans':
        clusters = this.performKMeansClustering(documents, similarityMatrix);
        break;
      case 'dbscan':
        clusters = this.performDBSCANClustering(documents, similarityMatrix);
        break;
      default:
        clusters = this.performHierarchicalClustering(documents, similarityMatrix);
    }

    // Calculate cluster quality metrics
    clusters = clusters.map(cluster => this.enhanceClusterWithMetrics(cluster, documents));
    
    this.metrics.clusteringTime += Date.now() - startTime;
    this.metrics.clustersCreated += clusters.length;
    
    return clusters;
  }

  async refineCluster(cluster: DocumentCluster, documents: ProcessedDocument[]): Promise<DocumentCluster> {
    // Recalculate cluster centroid and metrics
    const clusterDocuments = documents.filter(doc => cluster.documents.includes(doc.id));
    const centroid = this.calculateClusterCentroid(clusterDocuments);
    
    return {
      ...cluster,
      centroid,
      coherence: this.calculateClusterCoherence(clusterDocuments),
      averageSimilarity: this.calculateAverageIntraClusterSimilarity(clusterDocuments),
      keywords: this.extractClusterKeywords(clusterDocuments)
    };
  }

  async buildTopicModel(documents: ProcessedDocument[], numTopics?: number): Promise<TopicModel[]> {
    const startTime = Date.now();
    
    const targetTopics = numTopics || Math.min(
      Math.max(2, Math.floor(documents.length / 5)), 
      this.config.maxClusters
    );

    // Extract vocabulary and document-term matrix
    const vocabulary = this.buildVocabulary(documents);
    const documentTermMatrix = this.buildDocumentTermMatrix(documents, vocabulary);
    
    // Perform topic modeling using simplified LDA-like approach
    const topics = this.performTopicModeling(documentTermMatrix, vocabulary, targetTopics);
    
    // Enhance topics with coherence scores and document associations
    const enhancedTopics = topics.map(topic => this.enhanceTopicModel(topic, documents));
    
    this.metrics.topicModelingTime += Date.now() - startTime;
    
    return enhancedTopics;
  }

  evaluateTopicCoherence(model: TopicModel, documents: ProcessedDocument[]): number {
    // Simplified coherence calculation based on word co-occurrence
    const topWords = model.words.slice(0, 10).map(w => w.word);
    let coherenceSum = 0;
    let pairCount = 0;

    for (let i = 0; i < topWords.length; i++) {
      for (let j = i + 1; j < topWords.length; j++) {
        const cooccurrence = this.calculateWordCooccurrence(topWords[i], topWords[j], documents);
        coherenceSum += cooccurrence;
        pairCount++;
      }
    }

    return pairCount > 0 ? coherenceSum / pairCount : 0;
  }

  async analyzeThemeRelationships(themes: DetectedTheme[]): Promise<ThemeRelationship[]> {
    const relationships: ThemeRelationship[] = [];
    
    for (let i = 0; i < themes.length; i++) {
      for (let j = i + 1; j < themes.length; j++) {
        const relationship = this.calculateThemeRelationship(themes[i], themes[j]);
        if (relationship.strength > 0.3) {
          relationships.push(relationship);
        }
      }
    }
    
    return relationships;
  }

  async analyzeTemporalPatterns(themes: DetectedTheme[]): Promise<TemporalSummary> {
    if (!this.config.enableTemporalAnalysis || themes.length === 0) {
      return this.createEmptyTemporalSummary();
    }

    const timespan = this.calculateOverallTimespan(themes);
    const trends = this.analyzeThemeTrends(themes);
    
    return {
      totalTimespan: timespan,
      mostActiveThemes: trends.active,
      emergingThemes: trends.emerging,
      decliningThemes: trends.declining,
      stableThemes: trends.stable,
      overallTrend: this.determineOverallTrend(themes),
      seasonalPatterns: [],
      activityCycles: []
    };
  }

  async categorizeTheme(theme: DetectedTheme, documents: ProcessedDocument[]): Promise<ThemeCategory> {
    // Simple keyword-based categorization
    const keywords = theme.keywords.map(k => k.term.toLowerCase());
    
    const categoryKeywords = {
      work: ['work', 'job', 'career', 'meeting', 'project', 'deadline', 'office', 'business'],
      health: ['health', 'exercise', 'diet', 'sleep', 'medical', 'fitness', 'wellness'],
      productivity: ['productivity', 'task', 'goal', 'habit', 'routine', 'efficiency'],
      learning: ['learn', 'study', 'course', 'book', 'education', 'skill', 'knowledge'],
      relationships: ['friend', 'family', 'relationship', 'social', 'people', 'love'],
      emotions: ['feel', 'emotion', 'mood', 'happy', 'sad', 'angry', 'stress', 'anxiety'],
      planning: ['plan', 'future', 'schedule', 'calendar', 'organize', 'prepare']
    };

    let bestCategory: ThemeCategory = 'other';
    let bestScore = 0;

    for (const [category, categoryWords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(k => categoryWords.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as ThemeCategory;
      }
    }

    return bestCategory;
  }

  calculateThemeConfidence(theme: DetectedTheme, evidence: ThemeEvidence[]): number {
    const weights = this.config.evidenceWeighting;
    let totalScore = 0;
    let totalWeight = 0;

    for (const ev of evidence) {
      const recencyScore = this.calculateRecencyScore(ev.timestamp);
      const frequencyScore = Math.min(1, theme.frequency / 10);
      const contextScore = ev.relevanceScore;
      const lengthScore = Math.min(1, ev.wordCount / 100);
      const qualityScore = 0.8; // Simplified quality score

      const weightedScore = 
        recencyScore * weights.recencyWeight +
        frequencyScore * weights.frequencyWeight +
        contextScore * weights.contextWeight +
        lengthScore * weights.lengthWeight +
        qualityScore * weights.qualityWeight;

      totalScore += weightedScore;
      totalWeight += Object.values(weights).reduce((a, b) => a + b, 0);
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  async extractThemeKeywords(documents: ProcessedDocument[], maxKeywords = 20): Promise<ThemeKeyword[]> {
    // Aggregate TF-IDF scores across all documents
    const termScores = new Map<string, { tfIdf: number, frequency: number, contexts: string[] }>();
    
    for (const doc of documents) {
      for (const [term, score] of doc.features.tfIdf) {
        if (!termScores.has(term)) {
          termScores.set(term, { tfIdf: 0, frequency: 0, contexts: [] });
        }
        const current = termScores.get(term);
        if (!current) continue;
        current.tfIdf += score;
        current.frequency += doc.features.termFrequency.get(term) || 0;
        
        // Add context (simplified)
        if (current.contexts.length < 3) {
          current.contexts.push(`...${term}...`);
        }
      }
    }

    // Convert to ThemeKeyword array and sort by TF-IDF
    const keywords: ThemeKeyword[] = Array.from(termScores.entries())
      .map(([term, data]) => ({
        term,
        weight: data.tfIdf / documents.length,
        frequency: data.frequency,
        tfIdfScore: data.tfIdf,
        contexts: data.contexts,
        category: (data.tfIdf > 0.5 ? 'primary' : data.tfIdf > 0.2 ? 'secondary' : 'supporting') as 'primary' | 'secondary' | 'supporting'
      }))
      .sort((a, b) => b.tfIdfScore - a.tfIdfScore)
      .slice(0, maxKeywords);

    return keywords;
  }

  findSimilarThemes(theme: DetectedTheme, existingThemes: DetectedTheme[]): ThemeRelationship[] {
    return existingThemes
      .filter(t => t.id !== theme.id)
      .map(t => this.calculateThemeRelationship(theme, t))
      .filter(r => r.strength > 0.3)
      .sort((a, b) => b.strength - a.strength);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getPerformanceMetrics(): ThemeDetectionMetrics {
    return { ...this.metrics };
  }

  // Private helper methods

  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): ThemeDetectionMetrics {
    return {
      averageProcessingTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      documentsProcessed: 0,
      themesDetected: 0,
      clustersCreated: 0,
      averageThemeConfidence: 0,
      averageClusterCoherence: 0,
      averageTopicCoherence: 0,
      clusteringTime: 0,
      topicModelingTime: 0,
      themeExtractionTime: 0,
      relationshipAnalysisTime: 0
    };
  }

  private calculateSimilarityMatrix(documents: ProcessedDocument[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < documents.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < documents.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const similarity = this.nlpProcessor.calculateSimilarity(documents[i], documents[j]);
          matrix[i][j] = similarity.similarity;
        }
      }
    }
    
    return matrix;
  }

  private performHierarchicalClustering(
    documents: ProcessedDocument[], 
    similarityMatrix: number[][]
  ): DocumentCluster[] {
    // Simplified hierarchical clustering implementation
    const clusters: DocumentCluster[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < documents.length; i++) {
      if (used.has(i)) continue;
      
      const cluster: string[] = [documents[i].id];
      used.add(i);
      
      // Find similar documents
      for (let j = i + 1; j < documents.length; j++) {
        if (used.has(j)) continue;
        
        if (similarityMatrix[i][j] >= this.config.similarityThreshold) {
          cluster.push(documents[j].id);
          used.add(j);
        }
      }
      
      if (cluster.length >= this.config.minClusterSize) {
        clusters.push(this.createCluster(cluster, documents));
      }
    }
    
    return clusters.slice(0, this.config.maxClusters);
  }

  private performKMeansClustering(
    documents: ProcessedDocument[], 
    similarityMatrix: number[][]
  ): DocumentCluster[] {
    // Simplified K-means implementation
    // For now, fall back to hierarchical clustering
    return this.performHierarchicalClustering(documents, similarityMatrix);
  }

  private performDBSCANClustering(
    documents: ProcessedDocument[], 
    similarityMatrix: number[][]
  ): DocumentCluster[] {
    // Simplified DBSCAN implementation
    // For now, fall back to hierarchical clustering
    return this.performHierarchicalClustering(documents, similarityMatrix);
  }

  private createCluster(documentIds: string[], allDocuments: ProcessedDocument[]): DocumentCluster {
    const clusterDocs = allDocuments.filter(doc => documentIds.includes(doc.id));
    const centroid = this.calculateClusterCentroid(clusterDocs);
    
    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      centroid,
      documents: documentIds,
      coherence: this.calculateClusterCoherence(clusterDocs),
      size: documentIds.length,
      dominantTopics: [],
      averageSimilarity: this.calculateAverageIntraClusterSimilarity(clusterDocs),
      keywords: this.extractClusterKeywords(clusterDocs),
      timespan: this.calculateClusterTimespan(clusterDocs),
      activityPattern: this.calculateClusterActivityPattern(clusterDocs),
      silhouetteScore: 0.5, // Simplified
      intraClusterDistance: 0.3,
      interClusterDistance: 0.7
    };
  }

  private calculateClusterCentroid(documents: ProcessedDocument[]): FeatureVector {
    // Calculate average feature vector
    const centroid: FeatureVector = {
      termFrequency: new Map(),
      tfIdf: new Map(),
      unigrams: new Map(),
      bigrams: new Map(),
      trigrams: new Map(),
      documentLength: 0,
      averageSentenceLength: 0,
      vocabularySize: 0,
      uniqueWordRatio: 0
    };

    if (documents.length === 0) return centroid;

    // Aggregate all terms
    const allTerms = new Set<string>();
    documents.forEach(doc => {
      doc.features.termFrequency.forEach((_, term) => allTerms.add(term));
    });

    // Calculate averages
    for (const term of allTerms) {
      let tfSum = 0;
      let tfidfSum = 0;
      let count = 0;

      documents.forEach(doc => {
        if (doc.features.termFrequency.has(term)) {
          tfSum += doc.features.termFrequency.get(term) || 0;
          tfidfSum += doc.features.tfIdf.get(term) || 0;
          count++;
        }
      });

      if (count > 0) {
        centroid.termFrequency.set(term, tfSum / documents.length);
        centroid.tfIdf.set(term, tfidfSum / documents.length);
      }
    }

    // Calculate other metrics
    centroid.documentLength = documents.reduce((sum, doc) => sum + doc.features.documentLength, 0) / documents.length;
    centroid.averageSentenceLength = documents.reduce((sum, doc) => sum + doc.features.averageSentenceLength, 0) / documents.length;
    centroid.vocabularySize = documents.reduce((sum, doc) => sum + doc.features.vocabularySize, 0) / documents.length;
    centroid.uniqueWordRatio = documents.reduce((sum, doc) => sum + doc.features.uniqueWordRatio, 0) / documents.length;

    return centroid;
  }

  private calculateClusterCoherence(documents: ProcessedDocument[]): number {
    if (documents.length < 2) return 1.0;
    
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const similarity = this.nlpProcessor.calculateSimilarity(documents[i], documents[j]);
        totalSimilarity += similarity.similarity;
        pairCount++;
      }
    }
    
    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }

  private calculateAverageIntraClusterSimilarity(documents: ProcessedDocument[]): number {
    return this.calculateClusterCoherence(documents);
  }

  private extractClusterKeywords(documents: ProcessedDocument[]): string[] {
    const termFreq = new Map<string, number>();
    
    documents.forEach(doc => {
      doc.features.termFrequency.forEach((freq, term) => {
        termFreq.set(term, (termFreq.get(term) || 0) + freq);
      });
    });
    
    return Array.from(termFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);
  }

  private calculateClusterTimespan(documents: ProcessedDocument[]): DateRange {
    const dates = documents.map(doc => doc.createdAt).sort();
    return {
      start: dates[0],
      end: dates[dates.length - 1],
      intensity: 1.0
    };
  }

  private calculateClusterActivityPattern(documents: ProcessedDocument[]): TemporalPattern {
    return {
      pattern: 'stable',
      trend: 0,
      peakPeriods: [],
      quietPeriods: []
    };
  }

  private enhanceClusterWithMetrics(cluster: DocumentCluster, documents: ProcessedDocument[]): DocumentCluster {
    return cluster; // Already enhanced in createCluster
  }

  private buildVocabulary(documents: ProcessedDocument[]): string[] {
    const vocab = new Set<string>();
    documents.forEach(doc => {
      doc.features.termFrequency.forEach((_, term) => vocab.add(term));
    });
    return Array.from(vocab);
  }

  private buildDocumentTermMatrix(documents: ProcessedDocument[], vocabulary: string[]): number[][] {
    return documents.map(doc => 
      vocabulary.map(term => doc.features.termFrequency.get(term) || 0)
    );
  }

  private performTopicModeling(
    documentTermMatrix: number[][], 
    vocabulary: string[], 
    numTopics: number
  ): TopicModel[] {
    // Simplified topic modeling - in practice, you'd use LDA or similar
    const topics: TopicModel[] = [];
    
    for (let t = 0; t < numTopics; t++) {
      const words: TopicWord[] = vocabulary
        .map((word, i) => ({
          word,
          probability: Math.random(),
          weight: Math.random(),
          frequency: documentTermMatrix.reduce((sum, doc) => sum + doc[i], 0)
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, this.config.maxTopicWords);

      topics.push({
        id: `topic_${t}`,
        words,
        coherence: Math.random() * 0.5 + 0.3, // Simplified
        prevalence: Math.random(),
        documents: [],
        evolution: []
      });
    }
    
    return topics;
  }

  private enhanceTopicModel(topic: TopicModel, documents: ProcessedDocument[]): TopicModel {
    // Add document associations
    const topicDocuments: TopicDocument[] = documents.map(doc => ({
      documentId: doc.id,
      probability: Math.random(), // Simplified
      contribution: Math.random(),
      relevantSections: []
    }));

    return {
      ...topic,
      documents: topicDocuments,
      coherence: this.evaluateTopicCoherence(topic, documents)
    };
  }

  private calculateWordCooccurrence(word1: string, word2: string, documents: ProcessedDocument[]): number {
    let cooccurrenceCount = 0;
    let totalDocuments = 0;

    for (const doc of documents) {
      const hasWord1 = doc.features.termFrequency.has(word1);
      const hasWord2 = doc.features.termFrequency.has(word2);
      
      if (hasWord1 && hasWord2) {
        cooccurrenceCount++;
      }
      totalDocuments++;
    }

    return totalDocuments > 0 ? cooccurrenceCount / totalDocuments : 0;
  }

  private async extractThemesFromAnalysis(
    clusters: DocumentCluster[],
    topicModels: TopicModel[],
    documents: ProcessedDocument[]
  ): Promise<DetectedTheme[]> {
    const startTime = Date.now();
    const themes: DetectedTheme[] = [];

    // Extract themes from clusters
    for (const cluster of clusters) {
      const theme = await this.createThemeFromCluster(cluster, documents);
      if (theme) {
        themes.push(theme);
      }
    }

    // Extract themes from topic models
    for (const topic of topicModels) {
      const theme = await this.createThemeFromTopic(topic, documents);
      if (theme) {
        themes.push(theme);
      }
    }

    // Deduplicate and merge similar themes
    const deduplicatedThemes = this.deduplicateThemes(themes);

    this.metrics.themeExtractionTime += Date.now() - startTime;
    this.metrics.themesDetected += deduplicatedThemes.length;

    return deduplicatedThemes;
  }

  private async createThemeFromCluster(cluster: DocumentCluster, documents: ProcessedDocument[]): Promise<DetectedTheme | null> {
    const clusterDocs = documents.filter(doc => cluster.documents.includes(doc.id));
    if (clusterDocs.length === 0) return null;

    const keywords = await this.extractThemeKeywords(clusterDocs, 10);
    const evidence = this.extractThemeEvidence(clusterDocs);
    
    const theme: DetectedTheme = {
      id: `theme_cluster_${cluster.id}`,
      title: this.generateThemeTitle(keywords),
      description: this.generateThemeDescription(keywords, evidence),
      category: await this.categorizeTheme({} as DetectedTheme, clusterDocs),
      confidence: this.calculateThemeConfidence({} as DetectedTheme, evidence),
      frequency: clusterDocs.length,
      strength: cluster.coherence,
      coherence: cluster.coherence,
      keywords,
      concepts: keywords.slice(0, 5).map(k => k.term),
      relatedTerms: cluster.keywords,
      evidence,
      representativeExcerpts: this.extractRepresentativeExcerpts(clusterDocs),
      firstOccurrence: cluster.timespan.start,
      lastOccurrence: cluster.timespan.end,
      timespan: Math.ceil((cluster.timespan.end.getTime() - cluster.timespan.start.getTime()) / (1000 * 60 * 60 * 24)),
      temporalPattern: cluster.activityPattern,
      relatedThemes: [],
      subThemes: [],
      clusterId: cluster.id,
      clusterCohesion: cluster.coherence,
      createdAt: new Date(),
      lastUpdated: new Date(),
      version: 1
    };

    return theme;
  }

  private async createThemeFromTopic(topic: TopicModel, documents: ProcessedDocument[]): Promise<DetectedTheme | null> {
    const topicDocs = documents.filter(doc => 
      topic.documents.some(td => td.documentId === doc.id && td.probability > 0.3)
    );
    
    if (topicDocs.length === 0) return null;

    const keywords: ThemeKeyword[] = topic.words.map(w => ({
      term: w.word,
      weight: w.weight,
      frequency: w.frequency,
      tfIdfScore: w.probability,
      contexts: [`...${w.word}...`],
      category: w.weight > 0.7 ? 'primary' : w.weight > 0.4 ? 'secondary' : 'supporting'
    }));

    const evidence = this.extractThemeEvidence(topicDocs);
    
    const theme: DetectedTheme = {
      id: `theme_topic_${topic.id}`,
      title: this.generateThemeTitle(keywords),
      description: this.generateThemeDescription(keywords, evidence),
      category: await this.categorizeTheme({} as DetectedTheme, topicDocs),
      confidence: topic.coherence,
      frequency: topicDocs.length,
      strength: topic.prevalence,
      coherence: topic.coherence,
      keywords,
      concepts: keywords.slice(0, 5).map(k => k.term),
      relatedTerms: topic.words.map(w => w.word),
      evidence,
      representativeExcerpts: this.extractRepresentativeExcerpts(topicDocs),
      firstOccurrence: new Date(Math.min(...topicDocs.map(d => d.createdAt.getTime()))),
      lastOccurrence: new Date(Math.max(...topicDocs.map(d => d.createdAt.getTime()))),
      timespan: 0,
      temporalPattern: { pattern: 'stable', trend: 0, peakPeriods: [], quietPeriods: [] },
      relatedThemes: [],
      subThemes: [],
      clusterCohesion: topic.coherence,
      createdAt: new Date(),
      lastUpdated: new Date(),
      version: 1
    };

    // Calculate timespan
    theme.timespan = Math.ceil((theme.lastOccurrence.getTime() - theme.firstOccurrence.getTime()) / (1000 * 60 * 60 * 24));

    return theme;
  }

  private generateThemeTitle(keywords: ThemeKeyword[]): string {
    const topKeywords = keywords.slice(0, 3).map(k => k.term);
    return topKeywords.join(', ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private generateThemeDescription(keywords: ThemeKeyword[], evidence: ThemeEvidence[]): string {
    const topKeywords = keywords.slice(0, 5).map(k => k.term);
    return `A recurring theme involving ${topKeywords.join(', ')} with ${evidence.length} supporting instances.`;
  }

  private extractThemeEvidence(documents: ProcessedDocument[]): ThemeEvidence[] {
    return documents.map(doc => ({
      documentId: doc.id,
      documentPath: doc.originalPath,
      excerpt: doc.originalContent.substring(0, 200) + '...',
      context: doc.originalContent.substring(0, 500) + '...',
      relevanceScore: 0.8, // Simplified
      position: {
        paragraphIndex: 0,
        sentenceIndex: 0,
        startChar: 0,
        endChar: 200,
        lineNumber: 1
      },
      timestamp: doc.createdAt,
      wordCount: doc.metadata.tokenCount
    }));
  }

  private extractRepresentativeExcerpts(documents: ProcessedDocument[]): string[] {
    return documents
      .slice(0, 3)
      .map(doc => doc.originalContent.substring(0, 150) + '...');
  }

  private deduplicateThemes(themes: DetectedTheme[]): DetectedTheme[] {
    const deduplicated: DetectedTheme[] = [];
    const used = new Set<string>();

    for (const theme of themes) {
      const signature = this.generateThemeSignature(theme);
      if (!used.has(signature)) {
        deduplicated.push(theme);
        used.add(signature);
      }
    }

    return deduplicated;
  }

  private generateThemeSignature(theme: DetectedTheme): string {
    const topKeywords = theme.keywords
      .slice(0, 3)
      .map(k => k.term)
      .sort()
      .join('|');
    return `${theme.category}:${topKeywords}`;
  }

  private calculateThemeRelationship(themeA: DetectedTheme, themeB: DetectedTheme): ThemeRelationship {
    // Calculate keyword overlap
    const keywordsA = new Set(themeA.keywords.map(k => k.term));
    const keywordsB = new Set(themeB.keywords.map(k => k.term));
    const intersection = new Set([...keywordsA].filter(k => keywordsB.has(k)));
    const union = new Set([...keywordsA, ...keywordsB]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Determine relationship type
    let relationshipType: 'similar' | 'opposite' | 'causal' | 'temporal' | 'hierarchical' = 'similar';
    if (jaccardSimilarity > 0.5) {
      relationshipType = 'similar';
    } else if (themeA.category === themeB.category) {
      relationshipType = 'hierarchical';
    }

    return {
      themeId: themeB.id,
      relationshipType,
      strength: jaccardSimilarity,
      description: `Themes share ${intersection.size} common keywords`,
      evidence: []
    };
  }

  private calculateQualityMetrics(
    themes: DetectedTheme[], 
    clusters: DocumentCluster[], 
    topicModels: TopicModel[]
  ) {
    const overallCoherence = themes.length > 0 
      ? themes.reduce((sum, t) => sum + t.coherence, 0) / themes.length 
      : 0;
    
    const coverage = 0.8; // Simplified
    const redundancy = 0.2; // Simplified

    return {
      overallCoherence,
      coverage,
      redundancy
    };
  }

  private updateMetrics(result: ThemeDetectionResult): void {
    this.metrics.documentsProcessed += result.documentsAnalyzed;
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime + result.processingTime) / 2;
    this.metrics.averageThemeConfidence = result.overallCoherence;
  }

  private getDocumentsFromResult(result: ThemeDetectionResult): ProcessedDocument[] {
    // This would need to be implemented based on how you store document references
    return [];
  }

  private calculateRecencyScore(timestamp: Date): number {
    const now = new Date();
    const daysDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysDiff / 365); // Decay over a year
  }

  private createEmptyTemporalSummary(): TemporalSummary {
    return {
      totalTimespan: { start: new Date(), end: new Date(), intensity: 0 },
      mostActiveThemes: [],
      emergingThemes: [],
      decliningThemes: [],
      stableThemes: [],
      overallTrend: 'stable',
      seasonalPatterns: [],
      activityCycles: []
    };
  }

  private calculateOverallTimespan(themes: DetectedTheme[]): DateRange {
    if (themes.length === 0) {
      const now = new Date();
      return { start: now, end: now, intensity: 0 };
    }

    const start = new Date(Math.min(...themes.map(t => t.firstOccurrence.getTime())));
    const end = new Date(Math.max(...themes.map(t => t.lastOccurrence.getTime())));
    
    return { start, end, intensity: 1.0 };
  }

  private analyzeThemeTrends(themes: DetectedTheme[]) {
    // Simplified trend analysis
    return {
      active: themes.filter(t => t.frequency > 5).map(t => t.id),
      emerging: themes.filter(t => t.temporalPattern.trend > 0.5).map(t => t.id),
      declining: themes.filter(t => t.temporalPattern.trend < -0.5).map(t => t.id),
      stable: themes.filter(t => Math.abs(t.temporalPattern.trend) <= 0.5).map(t => t.id)
    };
  }

  private determineOverallTrend(themes: DetectedTheme[]): 'diversifying' | 'consolidating' | 'stable' {
    if (themes.length === 0) return 'stable';
    
    const avgTrend = themes.reduce((sum, t) => sum + t.temporalPattern.trend, 0) / themes.length;
    
    if (avgTrend > 0.3) return 'diversifying';
    if (avgTrend < -0.3) return 'consolidating';
    return 'stable';
  }
} 