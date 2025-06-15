/**
 * Core NLP Processing Interfaces for Pattern Detection Engine
 * Builds on the existing markdown parsing infrastructure to provide
 * advanced text processing capabilities for theme detection, sentiment analysis,
 * and pattern recognition.
 */

import { ParsedMarkdown } from './markdown-interfaces';

/**
 * Configuration for NLP processing pipeline
 */
export interface NLPConfig {
  // Text preprocessing options
  enableTokenization: boolean;
  enableStemming: boolean;
  enableLemmatization: boolean;
  enableStopwordRemoval: boolean;
  enableNormalization: boolean;
  
  // Language settings
  language: 'en' | 'es' | 'fr' | 'de' | 'auto';
  customStopwords: string[];
  
  // Feature extraction
  enableNGrams: boolean;
  nGramRange: [number, number]; // [min, max] e.g., [1, 3] for unigrams to trigrams
  enableTfIdf: boolean;
  maxFeatures: number;
  
  // Performance settings
  batchSize: number;
  enableCaching: boolean;
  cacheSize: number;
  
  // Output options
  preserveOriginalText: boolean;
  includePositions: boolean;
  includeConfidenceScores: boolean;
}

/**
 * Processed text document ready for pattern detection
 */
export interface ProcessedDocument {
  id: string;
  originalPath: string;
  originalContent: string;
  
  // Processed text components
  tokens: Token[];
  sentences: Sentence[];
  paragraphs: ProcessedParagraph[];
  
  // Feature vectors
  features: FeatureVector;
  
  // Metadata
  metadata: DocumentProcessingMetadata;
  
  // Temporal information
  createdAt: Date;
  lastModified: Date;
  processedAt: Date;
}

/**
 * Individual token with linguistic information
 */
export interface Token {
  text: string;
  normalizedText: string;
  stemmed?: string;
  lemmatized?: string;
  position: TokenPosition;
  partOfSpeech?: string;
  isStopword: boolean;
  isAlphanumeric: boolean;
  frequency: number;
}

/**
 * Position information for tokens
 */
export interface TokenPosition {
  sentenceIndex: number;
  paragraphIndex: number;
  startChar: number;
  endChar: number;
  lineNumber: number;
}

/**
 * Sentence-level processing
 */
export interface Sentence {
  text: string;
  tokens: Token[];
  position: SentencePosition;
  wordCount: number;
  characterCount: number;
  complexity: number; // 1-10 scale
}

/**
 * Position information for sentences
 */
export interface SentencePosition {
  paragraphIndex: number;
  sentenceIndex: number;
  startChar: number;
  endChar: number;
  startLine: number;
  endLine: number;
}

/**
 * Paragraph-level processing
 */
export interface ProcessedParagraph {
  text: string;
  sentences: Sentence[];
  tokens: Token[];
  position: ParagraphPosition;
  wordCount: number;
  topicKeywords: string[];
  coherenceScore: number; // 0-1 scale
}

/**
 * Position information for paragraphs
 */
export interface ParagraphPosition {
  paragraphIndex: number;
  startChar: number;
  endChar: number;
  startLine: number;
  endLine: number;
}

/**
 * Feature vector for machine learning and similarity calculations
 */
export interface FeatureVector {
  // Term frequency features
  termFrequency: Map<string, number>;
  tfIdf: Map<string, number>;
  
  // N-gram features
  unigrams: Map<string, number>;
  bigrams: Map<string, number>;
  trigrams: Map<string, number>;
  
  // Document-level features
  documentLength: number;
  averageSentenceLength: number;
  vocabularySize: number;
  uniqueWordRatio: number;
  
  // Semantic features (for future enhancement)
  embeddings?: number[];
  semanticClusters?: string[];
}

/**
 * Metadata about document processing
 */
export interface DocumentProcessingMetadata {
  processingTime: number; // milliseconds
  tokenCount: number;
  sentenceCount: number;
  paragraphCount: number;
  uniqueTokenCount: number;
  stopwordCount: number;
  
  // Quality metrics
  processingQuality: ProcessingQuality;
  
  // Configuration used
  configUsed: NLPConfig;
  
  // Warnings and issues
  warnings: string[];
  errors: string[];
}

/**
 * Quality assessment of processing
 */
export interface ProcessingQuality {
  overallScore: number; // 0-1 scale
  tokenizationQuality: number;
  sentenceSegmentationQuality: number;
  languageDetectionConfidence: number;
  textCleanlinessScore: number;
}

/**
 * Batch processing result
 */
export interface BatchProcessingResult {
  processedDocuments: ProcessedDocument[];
  totalProcessingTime: number;
  successCount: number;
  errorCount: number;
  warnings: string[];
  errors: ProcessingError[];
  
  // Aggregate statistics
  aggregateStats: AggregateStatistics;
}

/**
 * Aggregate statistics across processed documents
 */
export interface AggregateStatistics {
  totalTokens: number;
  totalSentences: number;
  totalParagraphs: number;
  averageDocumentLength: number;
  vocabularySize: number;
  mostFrequentTerms: Array<{ term: string; frequency: number }>;
  languageDistribution: Map<string, number>;
}

/**
 * Processing error information
 */
export interface ProcessingError {
  documentId: string;
  documentPath: string;
  errorType: 'tokenization' | 'parsing' | 'feature_extraction' | 'memory' | 'timeout';
  message: string;
  stack?: string;
  timestamp: Date;
}

/**
 * Text similarity calculation result
 */
export interface SimilarityResult {
  documentA: string;
  documentB: string;
  similarity: number; // 0-1 scale
  similarityType: 'cosine' | 'jaccard' | 'euclidean' | 'semantic';
  sharedTerms: string[];
  uniqueTermsA: string[];
  uniqueTermsB: string[];
}

/**
 * Keyword extraction result
 */
export interface KeywordExtractionResult {
  keywords: ExtractedKeyword[];
  extractionMethod: 'tf-idf' | 'rake' | 'textrank' | 'yake' | 'ai-enhanced';
  confidence: number;
  processingTime: number;
}

/**
 * Individual extracted keyword
 */
export interface ExtractedKeyword {
  term: string;
  score: number;
  frequency: number;
  positions: TokenPosition[];
  context: string[];
  category?: 'topic' | 'entity' | 'concept' | 'action';
}

/**
 * Text statistics for analysis
 */
export interface TextStatistics {
  // Basic counts
  characterCount: number;
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  
  // Vocabulary analysis
  uniqueWords: number;
  vocabularyRichness: number; // unique words / total words
  averageWordLength: number;
  averageSentenceLength: number;
  
  // Complexity metrics
  readabilityScore: number; // Flesch reading ease
  complexityScore: number; // 1-10 scale
  
  // Content distribution
  stopwordPercentage: number;
  punctuationDensity: number;
  numberDensity: number;
}

/**
 * Main NLP processor interface
 */
export interface NLPProcessor {
  // Configuration
  configure(config: Partial<NLPConfig>): void;
  getConfig(): NLPConfig;
  
  // Single document processing
  processDocument(content: string | ParsedMarkdown, documentId?: string): Promise<ProcessedDocument>;
  
  // Batch processing
  processBatch(documents: Array<{ content: string | ParsedMarkdown; id: string }>): Promise<BatchProcessingResult>;
  
  // Feature extraction
  extractFeatures(document: ProcessedDocument): FeatureVector;
  extractKeywords(document: ProcessedDocument, maxKeywords?: number): KeywordExtractionResult;
  
  // Similarity and comparison
  calculateSimilarity(docA: ProcessedDocument, docB: ProcessedDocument, method?: 'cosine' | 'jaccard'): SimilarityResult;
  
  // Statistics and analysis
  getTextStatistics(document: ProcessedDocument): TextStatistics;
  
  // Utility methods
  tokenize(text: string): Token[];
  normalize(text: string): string;
  removeStopwords(tokens: Token[]): Token[];
  
  // Cache management
  clearCache(): void;
  getCacheStats(): { size: number; hitRate: number; memoryUsage: number };
}

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  alternativeLanguages: Array<{ language: string; confidence: number }>;
}

/**
 * Text normalization options
 */
export interface NormalizationOptions {
  lowercase: boolean;
  removeAccents: boolean;
  removePunctuation: boolean;
  removeNumbers: boolean;
  removeExtraWhitespace: boolean;
  expandContractions: boolean;
  removeUrls: boolean;
  removeEmails: boolean;
  removeHashtags: boolean;
  removeMentions: boolean;
}

/**
 * Stopword list configuration
 */
export interface StopwordConfig {
  language: string;
  includeDefault: boolean;
  customStopwords: string[];
  excludeStopwords: string[];
  caseSensitive: boolean;
} 