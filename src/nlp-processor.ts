// src/nlp-processor.ts

/**
 * Core NLP Processor Implementation
 * Provides text preprocessing, tokenization, feature extraction, and analysis
 * capabilities for the pattern detection engine.
 */

import {
  NLPProcessor,
  NLPConfig,
  ProcessedDocument,
  Token,
  Sentence,
  ProcessedParagraph,
  FeatureVector,
  DocumentProcessingMetadata,
  BatchProcessingResult,
  AggregateStatistics,
  ProcessingError,
  SimilarityResult,
  KeywordExtractionResult,
  ExtractedKeyword,
  TextStatistics
} from './nlp-interfaces';
import { ParsedMarkdown } from './markdown-interfaces';

/**
 * Default NLP configuration
 */
const DEFAULT_CONFIG: NLPConfig = {
  // Text preprocessing options
  enableTokenization: true,
  enableStemming: false, // Start simple, can enhance later
  enableLemmatization: false,
  enableStopwordRemoval: true,
  enableNormalization: true,
  
  // Language settings
  language: 'en',
  customStopwords: [],
  
  // Feature extraction
  enableNGrams: true,
  nGramRange: [1, 2], // unigrams and bigrams
  enableTfIdf: true,
  maxFeatures: 1000,
  
  // Performance settings
  batchSize: 10,
  enableCaching: true,
  cacheSize: 100,
  
  // Output options
  preserveOriginalText: true,
  includePositions: true,
  includeConfidenceScores: false
};

/**
 * Default English stopwords list
 */
const DEFAULT_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'i', 'you', 'we', 'they', 'this',
  'but', 'have', 'had', 'what', 'said', 'each', 'which', 'their',
  'time', 'if', 'up', 'out', 'many', 'then', 'them', 'these', 'so',
  'some', 'her', 'would', 'make', 'like', 'into', 'him', 'two',
  'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been',
  'call', 'who', 'oil', 'sit', 'now', 'find', 'down', 'day', 'did',
  'get', 'come', 'made', 'may', 'part'
]);

/**
 * Simple Porter Stemmer implementation
 * Based on the Porter Stemming Algorithm
 */
class SimpleStemmer {
  private static readonly STEP2_RULES = new Map([
    ['ational', 'ate'],
    ['tional', 'tion'],
    ['enci', 'ence'],
    ['anci', 'ance'],
    ['izer', 'ize'],
    ['abli', 'able'],
    ['alli', 'al'],
    ['entli', 'ent'],
    ['eli', 'e'],
    ['ousli', 'ous'],
    ['ization', 'ize'],
    ['ation', 'ate'],
    ['ator', 'ate'],
    ['alism', 'al'],
    ['iveness', 'ive'],
    ['fulness', 'ful'],
    ['ousness', 'ous'],
    ['aliti', 'al'],
    ['iviti', 'ive'],
    ['biliti', 'ble']
  ]);

  static stem(word: string): string {
    if (word.length <= 2) return word;
    
    let result = word.toLowerCase();
    
    // Step 1a
    if (result.endsWith('sses')) {
      result = result.slice(0, -2);
    } else if (result.endsWith('ies')) {
      result = result.slice(0, -2);
    } else if (result.endsWith('ss')) {
      // Keep as is
    } else if (result.endsWith('s')) {
      result = result.slice(0, -1);
    }
    
    // Step 1b - simplified
    if (result.endsWith('eed')) {
      if (this.measure(result.slice(0, -3)) > 0) {
        result = result.slice(0, -1);
      }
    } else if (result.endsWith('ed') && this.containsVowel(result.slice(0, -2))) {
      result = result.slice(0, -2);
    } else if (result.endsWith('ing') && this.containsVowel(result.slice(0, -3))) {
      result = result.slice(0, -3);
    }
    
    // Step 2 - simplified
    for (const [suffix, replacement] of this.STEP2_RULES) {
      if (result.endsWith(suffix) && this.measure(result.slice(0, -suffix.length)) > 0) {
        result = result.slice(0, -suffix.length) + replacement;
        break;
      }
    }
    
    return result;
  }
  
  private static measure(word: string): number {
    // Simplified measure function
    const vowels = 'aeiou';
    let m = 0;
    let prevWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (!isVowel && prevWasVowel) {
        m++;
      }
      prevWasVowel = isVowel;
    }
    
    return m;
  }
  
  private static containsVowel(word: string): boolean {
    return /[aeiou]/.test(word);
  }
}

/**
 * Core NLP Processor implementation
 */
export class CoreNLPProcessor implements NLPProcessor {
  private config: NLPConfig;
  private cache: Map<string, ProcessedDocument>;
  private stopwords: Set<string>;
  private cacheHits = 0;
  private cacheRequests = 0;

  constructor(config?: Partial<NLPConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.stopwords = new Set([...DEFAULT_STOPWORDS, ...this.config.customStopwords]);
  }

  configure(config: Partial<NLPConfig>): void {
    this.config = { ...this.config, ...config };
    // Update stopwords if custom stopwords changed
    this.stopwords = new Set([...DEFAULT_STOPWORDS, ...this.config.customStopwords]);
  }

  getConfig(): NLPConfig {
    return { ...this.config };
  }

  async processDocument(content: string | ParsedMarkdown, documentId?: string): Promise<ProcessedDocument> {
    // const startTime = Date.now();
    const id = documentId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract text content
    const textContent = this.extractTextContent(content);
    
    // Check cache
    const cacheKey = this.generateCacheKey(textContent, this.config);
    this.cacheRequests++;
    
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          id,
          processedAt: new Date()
        };
      }
    }

    try {
      // Process the document
      const processedDoc = await this.processTextContent(textContent, id);
      
      // Cache the result
      if (this.config.enableCaching) {
        this.manageCache(cacheKey, processedDoc);
      }
      
      return processedDoc;
    } catch (error) {
      throw new Error(`Failed to process document ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processBatch(documents: Array<{ content: string | ParsedMarkdown; id: string }>): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const processedDocuments: ProcessedDocument[] = [];
    const errors: ProcessingError[] = [];
    const warnings: string[] = [];
    
    // Process in batches
    for (let i = 0; i < documents.length; i += this.config.batchSize) {
      const batch = documents.slice(i, i + this.config.batchSize);
      
      const batchPromises = batch.map(async (doc) => {
        try {
          return await this.processDocument(doc.content, doc.id);
        } catch (error) {
          errors.push({
            documentId: doc.id,
            documentPath: doc.id,
            errorType: 'parsing',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date()
          });
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      processedDocuments.push(...batchResults.filter(doc => doc !== null) as ProcessedDocument[]);
    }
    
    const totalProcessingTime = Date.now() - startTime;
    
    return {
      processedDocuments,
      totalProcessingTime,
      successCount: processedDocuments.length,
      errorCount: errors.length,
      warnings,
      errors,
      aggregateStats: this.calculateAggregateStats(processedDocuments)
    };
  }

  extractFeatures(document: ProcessedDocument): FeatureVector {
    const termFreq = new Map<string, number>();
    const unigrams = new Map<string, number>();
    const bigrams = new Map<string, number>();
    const trigrams = new Map<string, number>();
    
    // Calculate term frequencies
    for (const token of document.tokens) {
      if (!token.isStopword && token.isAlphanumeric) {
        const term = token.normalizedText;
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
        unigrams.set(term, (unigrams.get(term) || 0) + 1);
      }
    }
    
    // Calculate n-grams if enabled
    if (this.config.enableNGrams) {
      const tokens = document.tokens.filter(t => !t.isStopword && t.isAlphanumeric);
      
      // Bigrams
      for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i].normalizedText} ${tokens[i + 1].normalizedText}`;
        bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
      }
      
      // Trigrams
      for (let i = 0; i < tokens.length - 2; i++) {
        const trigram = `${tokens[i].normalizedText} ${tokens[i + 1].normalizedText} ${tokens[i + 2].normalizedText}`;
        trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1);
      }
    }
    
    // Calculate TF-IDF (simplified - would need document corpus for proper IDF)
    const tfIdf = new Map<string, number>();
    const totalTerms = document.tokens.filter(t => !t.isStopword).length;
    
    for (const [term, freq] of termFreq) {
      const tf = freq / totalTerms;
      // Simplified IDF calculation (would need corpus statistics)
      const idf = Math.log(1 + 1 / freq);
      tfIdf.set(term, tf * idf);
    }
    
    return {
      termFrequency: termFreq,
      tfIdf,
      unigrams,
      bigrams,
      trigrams,
      documentLength: document.tokens.length,
      averageSentenceLength: document.sentences.reduce((sum, s) => sum + s.wordCount, 0) / document.sentences.length,
      vocabularySize: termFreq.size,
      uniqueWordRatio: termFreq.size / totalTerms
    };
  }

  extractKeywords(document: ProcessedDocument, maxKeywords = 10): KeywordExtractionResult {
    const startTime = Date.now();
    
    // Simple TF-IDF based keyword extraction
    const features = document.features || this.extractFeatures(document);
    const keywords: ExtractedKeyword[] = [];
    
    // Sort terms by TF-IDF score
    const sortedTerms = Array.from(features.tfIdf.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords);
    
    for (const [term, score] of sortedTerms) {
      const frequency = features.termFrequency.get(term) || 0;
      const positions = document.tokens
        .filter(t => t.normalizedText === term)
        .map(t => t.position);
      
      keywords.push({
        term,
        score,
        frequency,
        positions,
        context: [], // Would need more sophisticated context extraction
        category: 'topic' // Simple categorization
      });
    }
    
    return {
      keywords,
      extractionMethod: 'tf-idf',
      confidence: 0.7, // Simplified confidence score
      processingTime: Date.now() - startTime
    };
  }

  calculateSimilarity(docA: ProcessedDocument, docB: ProcessedDocument, method: 'cosine' | 'jaccard' = 'cosine'): SimilarityResult {
    const featuresA = docA.features || this.extractFeatures(docA);
    const featuresB = docB.features || this.extractFeatures(docB);
    
    if (method === 'cosine') {
      return this.calculateCosineSimilarity(featuresA, featuresB, docA.id, docB.id);
    } else {
      return this.calculateJaccardSimilarity(featuresA, featuresB, docA.id, docB.id);
    }
  }

  getTextStatistics(document: ProcessedDocument): TextStatistics {
    const tokens = document.tokens;
    const nonStopwordTokens = tokens.filter(t => !t.isStopword);
    const words = tokens.filter(t => t.isAlphanumeric);
    
    const uniqueWords = new Set(words.map(t => t.normalizedText)).size;
    const totalWords = words.length;
    const totalChars = document.originalContent.length;
    
    // Calculate readability (simplified Flesch Reading Ease)
    const avgSentenceLength = document.sentences.reduce((sum, s) => sum + s.wordCount, 0) / document.sentences.length;
    const avgSyllables = 1.5; // Simplified - would need syllable counting
    const readabilityScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllables);
    
    return {
      characterCount: totalChars,
      wordCount: totalWords,
      sentenceCount: document.sentences.length,
      paragraphCount: document.paragraphs.length,
      uniqueWords,
      vocabularyRichness: uniqueWords / totalWords,
      averageWordLength: words.reduce((sum, t) => sum + t.text.length, 0) / totalWords,
      averageSentenceLength: avgSentenceLength,
      readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
      complexityScore: this.calculateComplexityScore(document),
      stopwordPercentage: (tokens.length - nonStopwordTokens.length) / tokens.length * 100,
      punctuationDensity: (totalChars - words.reduce((sum, t) => sum + t.text.length, 0)) / totalChars * 100,
      numberDensity: tokens.filter(t => /\d/.test(t.text)).length / tokens.length * 100
    };
  }

  tokenize(text: string): Token[] {
    // Simple tokenization - split on whitespace and punctuation
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    const tokens: Token[] = [];
    let charPosition = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const normalizedText = this.normalize(word);
      const isStopword = this.stopwords.has(normalizedText);
      const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(word);
      
      tokens.push({
        text: word,
        normalizedText,
        stemmed: this.config.enableStemming ? SimpleStemmer.stem(normalizedText) : undefined,
        position: {
          sentenceIndex: 0, // Would need sentence segmentation
          paragraphIndex: 0, // Would need paragraph segmentation
          startChar: charPosition,
          endChar: charPosition + word.length,
          lineNumber: 1 // Simplified
        },
        isStopword,
        isAlphanumeric,
        frequency: 1 // Would be calculated later
      });
      
      charPosition += word.length + 1; // +1 for space
    }
    
    return tokens;
  }

  normalize(text: string): string {
    if (!this.config.enableNormalization) return text;
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  removeStopwords(tokens: Token[]): Token[] {
    return tokens.filter(token => !token.isStopword);
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheRequests = 0;
  }

  getCacheStats(): { size: number; hitRate: number; memoryUsage: number } {
    return {
      size: this.cache.size,
      hitRate: this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0,
      memoryUsage: this.cache.size * 1024 // Rough estimate
    };
  }

  // Private helper methods

  private extractTextContent(content: string | ParsedMarkdown): string {
    if (typeof content === 'string') {
      return content;
    }
    
    // Extract text from ParsedMarkdown
    let text = '';
    for (const element of content.elements) {
      if (element.type === 'paragraph' && 'text' in element) {
        text += element.text + '\n';
      } else if (element.type === 'heading' && 'text' in element) {
        text += element.text + '\n';
      }
      // Add more element types as needed
    }
    
    return text;
  }

  private async processTextContent(textContent: string, id: string): Promise<ProcessedDocument> {
    const startTime = Date.now();
    
    // Tokenize
    const tokens = this.tokenize(textContent);
    
    // Simple sentence segmentation
    const sentences = this.segmentSentences(textContent, tokens);
    
    // Simple paragraph segmentation
    const paragraphs = this.segmentParagraphs(textContent, sentences);
    
    // Extract features
    const processedDoc: ProcessedDocument = {
      id,
      originalPath: id,
      originalContent: textContent,
      tokens,
      sentences,
      paragraphs,
      features: {} as FeatureVector, // Will be populated below
      metadata: {} as DocumentProcessingMetadata, // Will be populated below
      createdAt: new Date(),
      lastModified: new Date(),
      processedAt: new Date()
    };
    
    // Extract features
    processedDoc.features = this.extractFeatures(processedDoc);
    
    // Generate metadata
    processedDoc.metadata = this.generateMetadata(processedDoc, Date.now() - startTime);
    
    return processedDoc;
  }

  private segmentSentences(text: string, tokens: Token[]): Sentence[] {
    // Simple sentence segmentation based on punctuation
    const sentenceEnders = /[.!?]+/g;
    const sentences: Sentence[] = [];
    
    const sentenceTexts = text.split(sentenceEnders).filter(s => s.trim().length > 0);
    
    for (let i = 0; i < sentenceTexts.length; i++) {
      const sentenceText = sentenceTexts[i].trim();
      if (sentenceText.length === 0) continue;
      
      const sentenceTokens = this.tokenize(sentenceText);
      
      sentences.push({
        text: sentenceText,
        tokens: sentenceTokens,
        position: {
          paragraphIndex: 0, // Simplified
          sentenceIndex: i,
          startChar: 0, // Would need proper calculation
          endChar: sentenceText.length,
          startLine: 1,
          endLine: 1
        },
        wordCount: sentenceTokens.filter(t => t.isAlphanumeric).length,
        characterCount: sentenceText.length,
        complexity: this.calculateSentenceComplexity(sentenceTokens)
      });
    }
    
    return sentences;
  }

  private segmentParagraphs(text: string, sentences: Sentence[]): ProcessedParagraph[] {
    // Simple paragraph segmentation based on double newlines
    const paragraphTexts = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphs: ProcessedParagraph[] = [];
    
    for (let i = 0; i < paragraphTexts.length; i++) {
      const paragraphText = paragraphTexts[i].trim();
      if (paragraphText.length === 0) continue;
      
      const paragraphTokens = this.tokenize(paragraphText);
      const paragraphSentences = this.segmentSentences(paragraphText, paragraphTokens);
      
      paragraphs.push({
        text: paragraphText,
        sentences: paragraphSentences,
        tokens: paragraphTokens,
        position: {
          paragraphIndex: i,
          startChar: 0, // Would need proper calculation
          endChar: paragraphText.length,
          startLine: 1,
          endLine: 1
        },
        wordCount: paragraphTokens.filter(t => t.isAlphanumeric).length,
        topicKeywords: [], // Would need keyword extraction
        coherenceScore: 0.7 // Simplified
      });
    }
    
    return paragraphs;
  }

  private generateMetadata(document: ProcessedDocument, processingTime: number): DocumentProcessingMetadata {
    return {
      processingTime,
      tokenCount: document.tokens.length,
      sentenceCount: document.sentences.length,
      paragraphCount: document.paragraphs.length,
      uniqueTokenCount: new Set(document.tokens.map(t => t.normalizedText)).size,
      stopwordCount: document.tokens.filter(t => t.isStopword).length,
      processingQuality: {
        overallScore: 0.8, // Simplified
        tokenizationQuality: 0.9,
        sentenceSegmentationQuality: 0.7,
        languageDetectionConfidence: 0.9,
        textCleanlinessScore: 0.8
      },
      configUsed: this.config,
      warnings: [],
      errors: []
    };
  }

  private calculateComplexityScore(document: ProcessedDocument): number {
    // Simple complexity calculation based on various factors
    const avgSentenceLength = document.sentences.reduce((sum, s) => sum + s.wordCount, 0) / document.sentences.length;
    const vocabularyRichness = document.features.uniqueWordRatio;
    const sentenceComplexity = document.sentences.reduce((sum, s) => sum + s.complexity, 0) / document.sentences.length;
    
    // Normalize to 1-10 scale
    const complexity = (avgSentenceLength / 20 + vocabularyRichness + sentenceComplexity / 10) / 3 * 10;
    return Math.max(1, Math.min(10, complexity));
  }

  private calculateSentenceComplexity(tokens: Token[]): number {
    // Simple sentence complexity based on length and vocabulary
    const wordCount = tokens.filter(t => t.isAlphanumeric).length;
    const uniqueWords = new Set(tokens.map(t => t.normalizedText)).size;
    
    return Math.min(10, (wordCount / 10 + uniqueWords / wordCount * 5));
  }

  private calculateCosineSimilarity(featuresA: FeatureVector, featuresB: FeatureVector, idA: string, idB: string): SimilarityResult {
    const termsA = new Set(featuresA.termFrequency.keys());
    const termsB = new Set(featuresB.termFrequency.keys());
    const allTerms = new Set([...termsA, ...termsB]);
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (const term of allTerms) {
      const freqA = featuresA.termFrequency.get(term) || 0;
      const freqB = featuresB.termFrequency.get(term) || 0;
      
      dotProduct += freqA * freqB;
      normA += freqA * freqA;
      normB += freqB * freqB;
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    
    return {
      documentA: idA,
      documentB: idB,
      similarity: isNaN(similarity) ? 0 : similarity,
      similarityType: 'cosine',
      sharedTerms: Array.from(new Set([...termsA].filter(t => termsB.has(t)))),
      uniqueTermsA: Array.from(new Set([...termsA].filter(t => !termsB.has(t)))),
      uniqueTermsB: Array.from(new Set([...termsB].filter(t => !termsA.has(t))))
    };
  }

  private calculateJaccardSimilarity(featuresA: FeatureVector, featuresB: FeatureVector, idA: string, idB: string): SimilarityResult {
    const termsA = new Set(featuresA.termFrequency.keys());
    const termsB = new Set(featuresB.termFrequency.keys());
    
    const intersection = new Set([...termsA].filter(t => termsB.has(t)));
    const union = new Set([...termsA, ...termsB]);
    
    const similarity = intersection.size / union.size;
    
    return {
      documentA: idA,
      documentB: idB,
      similarity,
      similarityType: 'jaccard',
      sharedTerms: Array.from(intersection),
      uniqueTermsA: Array.from(new Set([...termsA].filter(t => !termsB.has(t)))),
      uniqueTermsB: Array.from(new Set([...termsB].filter(t => !termsA.has(t))))
    };
  }

  private calculateAggregateStats(documents: ProcessedDocument[]): AggregateStatistics {
    const totalTokens = documents.reduce((sum, doc) => sum + doc.tokens.length, 0);
    const totalSentences = documents.reduce((sum, doc) => sum + doc.sentences.length, 0);
    const totalParagraphs = documents.reduce((sum, doc) => sum + doc.paragraphs.length, 0);
    
    // Calculate most frequent terms across all documents
    const termFrequencies = new Map<string, number>();
    for (const doc of documents) {
      for (const [term, freq] of doc.features.termFrequency) {
        termFrequencies.set(term, (termFrequencies.get(term) || 0) + freq);
      }
    }
    
    const mostFrequentTerms = Array.from(termFrequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term, frequency]) => ({ term, frequency }));
    
    return {
      totalTokens,
      totalSentences,
      totalParagraphs,
      averageDocumentLength: totalTokens / documents.length,
      vocabularySize: termFrequencies.size,
      mostFrequentTerms,
      languageDistribution: new Map([['en', documents.length]]) // Simplified
    };
  }

  private generateCacheKey(content: string, config: NLPConfig): string {
    // Simple cache key generation
    const contentHash = this.simpleHash(content);
    const configHash = this.simpleHash(JSON.stringify(config));
    return `${contentHash}_${configHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private manageCache(key: string, document: ProcessedDocument): void {
    if (this.cache.size >= this.config.cacheSize) {
      // Simple LRU eviction - remove first entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, document);
  }
} 