import {
  PatternDefinition,
  NoteAnalysisRecord,
  PatternDetectionOptions,
  PatternCorrelation,
  VaultPatternResult,
  AnalysisScope,
  PatternType,
  PatternClassification
} from './pattern-detection-interfaces';

/**
 * Validation error details
 */
interface ValidationError {
  code: string;
  message: string;
  field: string;
  value: any;
  expected: string;
}

/**
 * Validation warning details
 */
interface ValidationWarning {
  code: string;
  message: string;
  field: string;
  value: any;
  suggestion: string;
}

/**
 * Validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: {
    validatedAt: Date;
    duration: number;
    itemsValidated: number;
  };
}

/**
 * Pattern Detection Validator
 * Validates pattern detection data structures and configurations
 */
export class PatternDetectionValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  /**
   * Validate a PatternDefinition object
   */
  validatePatternDefinition(pattern: PatternDefinition): ValidationResult {
    this.resetValidation();
    const startTime = Date.now();

    // Validate required fields
    this.validateRequired(pattern.id, 'id', 'string');
    this.validateRequired(pattern.type, 'type', 'PatternType');
    this.validateRequired(pattern.name, 'name', 'string');
    this.validateRequired(pattern.description, 'description', 'string');
    this.validateRequired(pattern.classification, 'classification', 'PatternClassification');
    this.validateRequired(pattern.confidence, 'confidence', 'number');

    // Validate field formats and ranges
    if (pattern.id) {
      this.validatePatternId(pattern.id);
    }

    if (pattern.type) {
      this.validatePatternType(pattern.type);
    }

    if (pattern.classification) {
      this.validatePatternClassification(pattern.classification);
    }

    if (typeof pattern.confidence === 'number') {
      this.validateConfidenceScore(pattern.confidence, 'confidence');
    }

    // Validate supporting evidence
    if (pattern.supportingEvidence) {
      this.validateSupportingEvidence(pattern.supportingEvidence);
    }

    // Validate frequency metrics
    if (pattern.frequency) {
      this.validateFrequencyMetrics(pattern.frequency);
    }

    // Validate temporal information
    if (pattern.temporal) {
      this.validateTemporalInfo(pattern.temporal);
    }

    // Validate correlations
    if (pattern.correlations) {
      this.validatePatternCorrelations(pattern.correlations);
    }

    // Validate metadata
    if (pattern.metadata) {
      this.validatePatternMetadata(pattern.metadata);
    }

    return this.buildValidationResult(startTime, 1);
  }

  /**
   * Validate a NoteAnalysisRecord object
   */
  validateNoteAnalysisRecord(record: NoteAnalysisRecord): ValidationResult {
    this.resetValidation();
    const startTime = Date.now();

    // Validate required fields
    this.validateRequired(record.filePath, 'filePath', 'string');
    this.validateRequired(record.fileInfo, 'fileInfo', 'object');
    this.validateRequired(record.analysis, 'analysis', 'object');
    this.validateRequired(record.content, 'content', 'object');

    // Validate file path format
    if (record.filePath) {
      this.validateFilePath(record.filePath);
    }

    // Validate file info
    if (record.fileInfo) {
      this.validateFileInfo(record.fileInfo);
    }

    // Validate analysis results
    if (record.analysis) {
      this.validateAnalysisResults(record.analysis);
    }

    // Validate content analysis
    if (record.content) {
      this.validateContentAnalysis(record.content);
    }

    return this.buildValidationResult(startTime, 1);
  }

  /**
   * Validate PatternDetectionOptions
   */
  validatePatternDetectionOptions(options: PatternDetectionOptions): ValidationResult {
    this.resetValidation();
    const startTime = Date.now();

    // Validate required fields
    this.validateRequired(options.scope, 'scope', 'AnalysisScope');
    this.validateRequired(options.patternTypes, 'patternTypes', 'array');
    this.validateRequired(options.minConfidence, 'minConfidence', 'number');
    this.validateRequired(options.incremental, 'incremental', 'boolean');
    this.validateRequired(options.performance, 'performance', 'object');
    this.validateRequired(options.caching, 'caching', 'object');

    // Validate scope
    if (options.scope) {
      this.validateAnalysisScope(options.scope);
    }

    // Validate custom scope if provided
    if (options.customScope) {
      this.validateCustomScope(options.customScope);
    }

    // Validate pattern types
    if (options.patternTypes) {
      this.validatePatternTypes(options.patternTypes);
    }

    // Validate confidence threshold
    if (typeof options.minConfidence === 'number') {
      this.validateConfidenceScore(options.minConfidence, 'minConfidence');
    }

    // Validate performance settings
    if (options.performance) {
      this.validatePerformanceSettings(options.performance);
    }

    // Validate caching settings
    if (options.caching) {
      this.validateCachingSettings(options.caching);
    }

    return this.buildValidationResult(startTime, 1);
  }

  /**
   * Validate PatternCorrelation
   */
  validatePatternCorrelation(correlation: PatternCorrelation): ValidationResult {
    this.resetValidation();
    const startTime = Date.now();

    // Validate required fields
    this.validateRequired(correlation.primaryPattern, 'primaryPattern', 'string');
    this.validateRequired(correlation.relatedPattern, 'relatedPattern', 'string');
    this.validateRequired(correlation.strength, 'strength', 'number');
    this.validateRequired(correlation.type, 'type', 'string');
    this.validateRequired(correlation.evidence, 'evidence', 'object');
    this.validateRequired(correlation.significance, 'significance', 'object');

    // Validate pattern IDs
    if (correlation.primaryPattern) {
      this.validatePatternId(correlation.primaryPattern, 'primaryPattern');
    }

    if (correlation.relatedPattern) {
      this.validatePatternId(correlation.relatedPattern, 'relatedPattern');
    }

    // Validate strength
    if (typeof correlation.strength === 'number') {
      this.validateConfidenceScore(correlation.strength, 'strength');
    }

    // Validate correlation type
    if (correlation.type) {
      this.validateCorrelationType(correlation.type);
    }

    // Validate evidence
    if (correlation.evidence) {
      this.validateCorrelationEvidence(correlation.evidence);
    }

    // Validate significance
    if (correlation.significance) {
      this.validateStatisticalSignificance(correlation.significance);
    }

    return this.buildValidationResult(startTime, 1);
  }

  /**
   * Validate VaultPatternResult
   */
  validateVaultPatternResult(result: VaultPatternResult): ValidationResult {
    this.resetValidation();
    const startTime = Date.now();

    // Validate required fields
    this.validateRequired(result.patterns, 'patterns', 'array');
    this.validateRequired(result.correlations, 'correlations', 'array');
    this.validateRequired(result.summary, 'summary', 'object');
    this.validateRequired(result.performance, 'performance', 'object');
    this.validateRequired(result.insights, 'insights', 'object');

    // Validate patterns array
    if (result.patterns) {
      result.patterns.forEach((pattern, index) => {
        const patternValidation = this.validatePatternDefinition(pattern);
        if (!patternValidation.isValid) {
          this.addError('INVALID_PATTERN', `Pattern at index ${index} is invalid`, `patterns[${index}]`, pattern, 'Valid PatternDefinition');
        }
      });
    }

    // Validate correlations array
    if (result.correlations) {
      result.correlations.forEach((correlation, index) => {
        const correlationValidation = this.validatePatternCorrelation(correlation);
        if (!correlationValidation.isValid) {
          this.addError('INVALID_CORRELATION', `Correlation at index ${index} is invalid`, `correlations[${index}]`, correlation, 'Valid PatternCorrelation');
        }
      });
    }

    // Validate summary
    if (result.summary) {
      this.validateResultSummary(result.summary);
    }

    // Validate performance metrics
    if (result.performance) {
      this.validateResultPerformance(result.performance);
    }

    // Validate insights
    if (result.insights) {
      this.validateResultInsights(result.insights);
    }

    return this.buildValidationResult(startTime, 1);
  }

  // Private validation helper methods

  private resetValidation(): void {
    this.errors = [];
    this.warnings = [];
  }

  private validateRequired(value: any, field: string, expectedType: string): void {
    if (value === undefined || value === null) {
      this.addError('REQUIRED_FIELD', `Field '${field}' is required`, field, value, expectedType);
    }
  }

  private validatePatternId(id: string, field = 'id'): void {
    if (typeof id !== 'string' || id.trim().length === 0) {
      this.addError('INVALID_PATTERN_ID', 'Pattern ID must be a non-empty string', field, id, 'Non-empty string');
    }

    if (id.length > 100) {
      this.addWarning('LONG_PATTERN_ID', 'Pattern ID is unusually long', field, id, 'Shorter ID (< 100 characters)');
    }
  }

  private validatePatternType(type: PatternType): void {
    const validTypes: PatternType[] = [
      'productivity-theme', 'productivity-blocker', 'sentiment-pattern', 'sentiment-change',
      'procrastination-language', 'distraction-language', 'task-switching', 'positive-momentum',
      'work-pattern', 'habit-pattern', 'mood-pattern', 'health-pattern', 'personal-activity'
    ];

    if (!validTypes.includes(type)) {
      this.addError('INVALID_PATTERN_TYPE', `Invalid pattern type: ${type}`, 'type', type, validTypes.join(', '));
    }
  }

  private validatePatternClassification(classification: PatternClassification): void {
    const validClassifications: PatternClassification[] = ['high', 'medium', 'low'];

    if (!validClassifications.includes(classification)) {
      this.addError('INVALID_CLASSIFICATION', `Invalid classification: ${classification}`, 'classification', classification, validClassifications.join(', '));
    }
  }

  private validateConfidenceScore(score: number, field: string): void {
    if (typeof score !== 'number' || isNaN(score)) {
      this.addError('INVALID_CONFIDENCE', `${field} must be a valid number`, field, score, 'Number between 0 and 1');
      return;
    }

    if (score < 0 || score > 1) {
      this.addError('CONFIDENCE_OUT_OF_RANGE', `${field} must be between 0 and 1`, field, score, 'Number between 0 and 1');
    }

    if (score < 0.1) {
      this.addWarning('LOW_CONFIDENCE', `${field} is very low (${score})`, field, score, 'Higher confidence score');
    }
  }

  private validateSupportingEvidence(evidence: string[]): void {
    if (!Array.isArray(evidence)) {
      this.addError('INVALID_EVIDENCE', 'Supporting evidence must be an array', 'supportingEvidence', evidence, 'Array of strings');
      return;
    }

    if (evidence.length === 0) {
      this.addWarning('NO_EVIDENCE', 'No supporting evidence provided', 'supportingEvidence', evidence, 'At least one evidence item');
    }

    evidence.forEach((item, index) => {
      if (typeof item !== 'string' || item.trim().length === 0) {
        this.addError('INVALID_EVIDENCE_ITEM', `Evidence item at index ${index} must be a non-empty string`, `supportingEvidence[${index}]`, item, 'Non-empty string');
      }
    });
  }

  private validateFrequencyMetrics(frequency: PatternDefinition['frequency']): void {
    if (typeof frequency.count !== 'number' || frequency.count < 0) {
      this.addError('INVALID_FREQUENCY_COUNT', 'Frequency count must be a non-negative number', 'frequency.count', frequency.count, 'Non-negative number');
    }

    if (typeof frequency.rate !== 'number' || frequency.rate < 0) {
      this.addError('INVALID_FREQUENCY_RATE', 'Frequency rate must be a non-negative number', 'frequency.rate', frequency.rate, 'Non-negative number');
    }

    const validTrends = ['increasing', 'decreasing', 'stable'];
    if (!validTrends.includes(frequency.trend)) {
      this.addError('INVALID_TREND', `Invalid trend: ${frequency.trend}`, 'frequency.trend', frequency.trend, validTrends.join(', '));
    }
  }

  private validateTemporalInfo(temporal: PatternDefinition['temporal']): void {
    if (!(temporal.firstSeen instanceof Date)) {
      this.addError('INVALID_FIRST_SEEN', 'firstSeen must be a Date object', 'temporal.firstSeen', temporal.firstSeen, 'Date object');
    }

    if (!(temporal.lastSeen instanceof Date)) {
      this.addError('INVALID_LAST_SEEN', 'lastSeen must be a Date object', 'temporal.lastSeen', temporal.lastSeen, 'Date object');
    }

    if (temporal.firstSeen instanceof Date && temporal.lastSeen instanceof Date) {
      if (temporal.firstSeen > temporal.lastSeen) {
        this.addError('INVALID_TEMPORAL_ORDER', 'firstSeen cannot be after lastSeen', 'temporal', temporal, 'firstSeen <= lastSeen');
      }
    }

    if (!Array.isArray(temporal.peakPeriods)) {
      this.addError('INVALID_PEAK_PERIODS', 'peakPeriods must be an array', 'temporal.peakPeriods', temporal.peakPeriods, 'Array of strings');
    }
  }

  private validatePatternCorrelations(correlations: PatternDefinition['correlations']): void {
    if (!Array.isArray(correlations.relatedPatterns)) {
      this.addError('INVALID_RELATED_PATTERNS', 'relatedPatterns must be an array', 'correlations.relatedPatterns', correlations.relatedPatterns, 'Array of strings');
    }

    if (typeof correlations.strength !== 'number' || correlations.strength < 0 || correlations.strength > 1) {
      this.addError('INVALID_CORRELATION_STRENGTH', 'Correlation strength must be between 0 and 1', 'correlations.strength', correlations.strength, 'Number between 0 and 1');
    }
  }

  private validatePatternMetadata(metadata: PatternDefinition['metadata']): void {
    if (!(metadata.detectedAt instanceof Date)) {
      this.addError('INVALID_DETECTED_AT', 'detectedAt must be a Date object', 'metadata.detectedAt', metadata.detectedAt, 'Date object');
    }

    if (!Array.isArray(metadata.sourceFiles)) {
      this.addError('INVALID_SOURCE_FILES', 'sourceFiles must be an array', 'metadata.sourceFiles', metadata.sourceFiles, 'Array of strings');
    }

    this.validateAnalysisScope(metadata.analysisScope, 'metadata.analysisScope');
  }

  private validateAnalysisScope(scope: AnalysisScope, field = 'scope'): void {
    const validScopes: AnalysisScope[] = ['whole-life', 'work-only', 'personal-only', 'custom'];

    if (!validScopes.includes(scope)) {
      this.addError('INVALID_ANALYSIS_SCOPE', `Invalid analysis scope: ${scope}`, field, scope, validScopes.join(', '));
    }
  }

  private validateFilePath(filePath: string): void {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      this.addError('INVALID_FILE_PATH', 'File path must be a non-empty string', 'filePath', filePath, 'Non-empty string');
    }

    if (!filePath.endsWith('.md')) {
      this.addWarning('NON_MARKDOWN_FILE', 'File path does not end with .md', 'filePath', filePath, 'Markdown file (.md)');
    }
  }

  private validateFileInfo(fileInfo: NoteAnalysisRecord['fileInfo']): void {
    this.validateRequired(fileInfo.name, 'fileInfo.name', 'string');
    this.validateRequired(fileInfo.size, 'fileInfo.size', 'number');
    this.validateRequired(fileInfo.createdAt, 'fileInfo.createdAt', 'Date');
    this.validateRequired(fileInfo.modifiedAt, 'fileInfo.modifiedAt', 'Date');
    this.validateRequired(fileInfo.isDailyNote, 'fileInfo.isDailyNote', 'boolean');

    if (typeof fileInfo.size === 'number' && fileInfo.size < 0) {
      this.addError('INVALID_FILE_SIZE', 'File size cannot be negative', 'fileInfo.size', fileInfo.size, 'Non-negative number');
    }
  }

  private validateAnalysisResults(analysis: NoteAnalysisRecord['analysis']): void {
    if (!Array.isArray(analysis.patternsFound)) {
      this.addError('INVALID_PATTERNS_FOUND', 'patternsFound must be an array', 'analysis.patternsFound', analysis.patternsFound, 'Array of PatternDefinition');
    }

    if (!Array.isArray(analysis.patternsExcluded)) {
      this.addError('INVALID_PATTERNS_EXCLUDED', 'patternsExcluded must be an array', 'analysis.patternsExcluded', analysis.patternsExcluded, 'Array of strings');
    }
  }

  private validateContentAnalysis(content: NoteAnalysisRecord['content']): void {
    if (typeof content.wordCount !== 'number' || content.wordCount < 0) {
      this.addError('INVALID_WORD_COUNT', 'Word count must be a non-negative number', 'content.wordCount', content.wordCount, 'Non-negative number');
    }

    if (typeof content.sentimentScore !== 'number' || content.sentimentScore < -1 || content.sentimentScore > 1) {
      this.addError('INVALID_SENTIMENT_SCORE', 'Sentiment score must be between -1 and 1', 'content.sentimentScore', content.sentimentScore, 'Number between -1 and 1');
    }
  }

  private validateCustomScope(customScope: PatternDetectionOptions['customScope']): void {
    if (!customScope) return;

    ['includeFolders', 'excludeFolders', 'includePatterns', 'excludePatterns'].forEach(field => {
      const value = (customScope as any)[field];
      if (value && !Array.isArray(value)) {
        this.addError('INVALID_CUSTOM_SCOPE_ARRAY', `${field} must be an array`, `customScope.${field}`, value, 'Array of strings');
      }
    });
  }

  private validatePatternTypes(patternTypes: PatternType[]): void {
    if (!Array.isArray(patternTypes)) {
      this.addError('INVALID_PATTERN_TYPES', 'patternTypes must be an array', 'patternTypes', patternTypes, 'Array of PatternType');
      return;
    }

    if (patternTypes.length === 0) {
      this.addError('EMPTY_PATTERN_TYPES', 'At least one pattern type must be specified', 'patternTypes', patternTypes, 'Non-empty array');
    }

    patternTypes.forEach((type, index) => {
      this.validatePatternType(type);
    });
  }

  private validatePerformanceSettings(performance: PatternDetectionOptions['performance']): void {
    if (typeof performance.maxProcessingTime !== 'number' || performance.maxProcessingTime <= 0) {
      this.addError('INVALID_MAX_PROCESSING_TIME', 'maxProcessingTime must be a positive number', 'performance.maxProcessingTime', performance.maxProcessingTime, 'Positive number');
    }

    if (performance.maxFiles !== undefined && (typeof performance.maxFiles !== 'number' || performance.maxFiles <= 0)) {
      this.addError('INVALID_MAX_FILES', 'maxFiles must be a positive number', 'performance.maxFiles', performance.maxFiles, 'Positive number');
    }

    if (typeof performance.batchSize !== 'number' || performance.batchSize <= 0) {
      this.addError('INVALID_BATCH_SIZE', 'batchSize must be a positive number', 'performance.batchSize', performance.batchSize, 'Positive number');
    }
  }

  private validateCachingSettings(caching: PatternDetectionOptions['caching']): void {
    if (typeof caching.enabled !== 'boolean') {
      this.addError('INVALID_CACHING_ENABLED', 'caching.enabled must be a boolean', 'caching.enabled', caching.enabled, 'Boolean');
    }

    if (typeof caching.ttl !== 'number' || caching.ttl < 0) {
      this.addError('INVALID_CACHE_TTL', 'Cache TTL must be a non-negative number', 'caching.ttl', caching.ttl, 'Non-negative number');
    }
  }

  private validateCorrelationType(type: string): void {
    const validTypes = ['causal', 'temporal', 'thematic', 'contextual'];
    if (!validTypes.includes(type)) {
      this.addError('INVALID_CORRELATION_TYPE', `Invalid correlation type: ${type}`, 'type', type, validTypes.join(', '));
    }
  }

  private validateCorrelationEvidence(evidence: PatternCorrelation['evidence']): void {
    if (typeof evidence.coOccurrences !== 'number' || evidence.coOccurrences < 0) {
      this.addError('INVALID_CO_OCCURRENCES', 'coOccurrences must be a non-negative number', 'evidence.coOccurrences', evidence.coOccurrences, 'Non-negative number');
    }

    if (typeof evidence.temporalProximity !== 'number' || evidence.temporalProximity < 0 || evidence.temporalProximity > 1) {
      this.addError('INVALID_TEMPORAL_PROXIMITY', 'temporalProximity must be between 0 and 1', 'evidence.temporalProximity', evidence.temporalProximity, 'Number between 0 and 1');
    }

    if (typeof evidence.contextualSimilarity !== 'number' || evidence.contextualSimilarity < 0 || evidence.contextualSimilarity > 1) {
      this.addError('INVALID_CONTEXTUAL_SIMILARITY', 'contextualSimilarity must be between 0 and 1', 'evidence.contextualSimilarity', evidence.contextualSimilarity, 'Number between 0 and 1');
    }
  }

  private validateStatisticalSignificance(significance: PatternCorrelation['significance']): void {
    if (typeof significance.pValue !== 'number' || significance.pValue < 0 || significance.pValue > 1) {
      this.addError('INVALID_P_VALUE', 'pValue must be between 0 and 1', 'significance.pValue', significance.pValue, 'Number between 0 and 1');
    }

    if (!Array.isArray(significance.confidenceInterval) || significance.confidenceInterval.length !== 2) {
      this.addError('INVALID_CONFIDENCE_INTERVAL', 'confidenceInterval must be an array of two numbers', 'significance.confidenceInterval', significance.confidenceInterval, '[number, number]');
    }

    if (typeof significance.sampleSize !== 'number' || significance.sampleSize <= 0) {
      this.addError('INVALID_SAMPLE_SIZE', 'sampleSize must be a positive number', 'significance.sampleSize', significance.sampleSize, 'Positive number');
    }
  }

  private validateResultSummary(summary: VaultPatternResult['summary']): void {
    const numericFields = ['filesAnalyzed', 'filesExcluded', 'patternsFound', 'processingTime'];
    numericFields.forEach(field => {
      const value = (summary as any)[field];
      if (typeof value !== 'number' || value < 0) {
        this.addError('INVALID_SUMMARY_FIELD', `${field} must be a non-negative number`, `summary.${field}`, value, 'Non-negative number');
      }
    });

    if (typeof summary.cacheHitRate !== 'number' || summary.cacheHitRate < 0 || summary.cacheHitRate > 1) {
      this.addError('INVALID_CACHE_HIT_RATE', 'cacheHitRate must be between 0 and 1', 'summary.cacheHitRate', summary.cacheHitRate, 'Number between 0 and 1');
    }
  }

  private validateResultPerformance(performance: VaultPatternResult['performance']): void {
    const numericFields = ['throughput', 'memoryUsage', 'aiCallsCount', 'avgAiResponseTime'];
    numericFields.forEach(field => {
      const value = (performance as any)[field];
      if (typeof value !== 'number' || value < 0) {
        this.addError('INVALID_PERFORMANCE_FIELD', `${field} must be a non-negative number`, `performance.${field}`, value, 'Non-negative number');
      }
    });
  }

  private validateResultInsights(insights: VaultPatternResult['insights']): void {
    const arrayFields = ['topPatterns', 'emergingPatterns', 'decliningPatterns', 'recommendations'];
    arrayFields.forEach(field => {
      const value = (insights as any)[field];
      if (!Array.isArray(value)) {
        this.addError('INVALID_INSIGHTS_FIELD', `${field} must be an array`, `insights.${field}`, value, 'Array');
      }
    });
  }

  private addError(code: string, message: string, field: string, value: any, expected: string): void {
    this.errors.push({
      code,
      message,
      field,
      value,
      expected
    });
  }

  private addWarning(code: string, message: string, field: string, value: any, suggestion: string): void {
    this.warnings.push({
      code,
      message,
      field,
      value,
      suggestion
    });
  }

  private buildValidationResult(startTime: number, itemsValidated: number): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
      metadata: {
        validatedAt: new Date(),
        duration: Date.now() - startTime,
        itemsValidated
      }
    };
  }
} 