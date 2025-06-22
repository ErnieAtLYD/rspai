/**
 * Analysis scope options for pattern detection
 */
export type AnalysisScope = 'whole-life' | 'work-only' | 'personal-only' | 'custom';

/**
 * Pattern types that can be detected
 */
export type PatternType = 
  | 'productivity-theme'
  | 'productivity-blocker'
  | 'sentiment-pattern'
  | 'sentiment-change'
  | 'procrastination-language'
  | 'distraction-language'
  | 'task-switching'
  | 'positive-momentum'
  | 'work-pattern'
  | 'habit-pattern'
  | 'mood-pattern'
  | 'health-pattern'
  | 'personal-activity';

/**
 * Pattern classification levels
 */
export type PatternClassification = 'high' | 'medium' | 'low';

/**
 * Core pattern definition structure
 */
export interface PatternDefinition {
  /** Unique identifier for the pattern */
  id: string;
  
  /** Type of pattern detected */
  type: PatternType;
  
  /** Human-readable pattern name */
  name: string;
  
  /** Detailed description of the pattern */
  description: string;
  
  /** Theme classification level */
  classification: PatternClassification;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Supporting evidence from the text */
  supportingEvidence: string[];
  
  /** Frequency metrics */
  frequency: {
    /** Number of occurrences found */
    count: number;
    /** Time period analyzed */
    period: string;
    /** Frequency per day/week/month */
    rate: number;
    /** Trend direction */
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  
  /** Temporal information */
  temporal: {
    /** First occurrence timestamp */
    firstSeen: Date;
    /** Last occurrence timestamp */
    lastSeen: Date;
    /** Peak activity periods */
    peakPeriods: string[];
  };
  
  /** Related patterns */
  correlations: {
    /** IDs of correlated patterns */
    relatedPatterns: string[];
    /** Correlation strength (0-1) */
    strength: number;
  };
  
  /** Metadata */
  metadata: {
    /** When pattern was detected */
    detectedAt: Date;
    /** Files where pattern was found */
    sourceFiles: string[];
    /** Analysis scope used */
    analysisScope: AnalysisScope;
    /** AI model used for detection */
    modelUsed?: string;
  };
}

/**
 * Per-note analysis record
 */
export interface NoteAnalysisRecord {
  /** File path */
  filePath: string;
  
  /** File metadata */
  fileInfo: {
    /** File name */
    name: string;
    /** File size in bytes */
    size: number;
    /** Creation timestamp */
    createdAt: Date;
    /** Last modified timestamp */
    modifiedAt: Date;
    /** Whether it's a daily note */
    isDailyNote: boolean;
  };
  
  /** Analysis results */
  analysis: {
    /** Patterns found in this note */
    patternsFound: PatternDefinition[];
    /** Patterns explicitly excluded */
    patternsExcluded: string[];
    /** Privacy exclusions applied */
    privacyExclusions: {
      /** Whether file was excluded */
      fileExcluded: boolean;
      /** Sections that were redacted */
      sectionsRedacted: string[];
      /** Privacy tags found */
      privacyTags: string[];
    };
    /** Processing metadata */
    processingInfo: {
      /** Analysis timestamp */
      analyzedAt: Date;
      /** Processing time in ms */
      processingTime: number;
      /** Content hash for caching */
      contentHash: string;
      /** Analysis scope used */
      scope: AnalysisScope;
      /** Whether result was cached */
      fromCache: boolean;
    };
  };
  
  /** Content analysis */
  content: {
    /** Word count */
    wordCount: number;
    /** Sentiment score (-1 to 1) */
    sentimentScore: number;
    /** Key themes identified */
    themes: string[];
    /** Emotional indicators */
    emotions: string[];
    /** Activity mentions */
    activities: string[];
  };
}

/**
 * Pattern detection options
 */
export interface PatternDetectionOptions {
  /** Analysis scope */
  scope: AnalysisScope;
  
  /** Custom scope configuration */
  customScope?: {
    /** Include specific folders */
    includeFolders: string[];
    /** Exclude specific folders */
    excludeFolders: string[];
    /** Include files matching patterns */
    includePatterns: string[];
    /** Exclude files matching patterns */
    excludePatterns: string[];
  };
  
  /** Pattern types to detect */
  patternTypes: PatternType[];
  
  /** Minimum confidence threshold */
  minConfidence: number;
  
  /** Enable incremental processing */
  incremental: boolean;
  
  /** Performance settings */
  performance: {
    /** Maximum processing time in ms */
    maxProcessingTime: number;
    /** Maximum files to process */
    maxFiles?: number;
    /** Enable parallel processing */
    enableParallel: boolean;
    /** Batch size for processing */
    batchSize: number;
  };
  
  /** Caching options */
  caching: {
    /** Enable result caching */
    enabled: boolean;
    /** Cache TTL in ms */
    ttl: number;
    /** Force cache refresh */
    forceRefresh: boolean;
  };
}

/**
 * Pattern correlation information
 */
export interface PatternCorrelation {
  /** Primary pattern ID */
  primaryPattern: string;
  
  /** Related pattern ID */
  relatedPattern: string;
  
  /** Correlation strength (0-1) */
  strength: number;
  
  /** Correlation type */
  type: 'causal' | 'temporal' | 'thematic' | 'contextual';
  
  /** Supporting evidence */
  evidence: {
    /** Co-occurrence count */
    coOccurrences: number;
    /** Temporal proximity */
    temporalProximity: number;
    /** Contextual similarity */
    contextualSimilarity: number;
  };
  
  /** Statistical significance */
  significance: {
    /** P-value */
    pValue: number;
    /** Confidence interval */
    confidenceInterval: [number, number];
    /** Sample size */
    sampleSize: number;
  };
}

/**
 * Vault-wide pattern analysis result
 */
export interface VaultPatternResult {
  /** All detected patterns */
  patterns: PatternDefinition[];
  
  /** Pattern correlations */
  correlations: PatternCorrelation[];
  
  /** Analysis summary */
  summary: {
    /** Total files analyzed */
    filesAnalyzed: number;
    /** Files excluded by privacy */
    filesExcluded: number;
    /** Total patterns found */
    patternsFound: number;
    /** Processing time in ms */
    processingTime: number;
    /** Cache hit rate */
    cacheHitRate: number;
    /** Analysis scope used */
    scope: AnalysisScope;
    /** Analysis timestamp */
    analyzedAt: Date;
  };
  
  /** Performance metrics */
  performance: {
    /** Files processed per second */
    throughput: number;
    /** Memory usage in MB */
    memoryUsage: number;
    /** AI calls made */
    aiCallsCount: number;
    /** Average AI response time */
    avgAiResponseTime: number;
  };
  
  /** Insights and recommendations */
  insights: {
    /** Top patterns by frequency */
    topPatterns: PatternDefinition[];
    /** Emerging patterns */
    emergingPatterns: PatternDefinition[];
    /** Declining patterns */
    decliningPatterns: PatternDefinition[];
    /** Actionable recommendations */
    recommendations: string[];
  };
}

/**
 * Incremental pattern analysis result
 */
export interface IncrementalPatternResult extends VaultPatternResult {
  /** Whether this was an incremental update */
  isIncremental: true;
  
  /** Number of changed files processed */
  changedFiles: number;
  
  /** Patterns that were updated */
  updatedPatterns: string[];
  
  /** Patterns that were removed */
  removedPatterns: string[];
  
  /** New patterns discovered */
  newPatterns: string[];
}

/**
 * Pattern detection cache entry
 */
export interface PatternCacheEntry {
  /** Cache key */
  key: string;
  
  /** Cached patterns */
  patterns: PatternDefinition[];
  
  /** Cache metadata */
  metadata: {
    /** When cached */
    cachedAt: Date;
    /** Content hash */
    contentHash: string;
    /** TTL in ms */
    ttl: number;
    /** Access count */
    accessCount: number;
    /** Last accessed */
    lastAccessed: Date;
  };
}

/**
 * Pattern detection configuration
 */
export interface PatternDetectionConfig {
  /** Default analysis scope */
  defaultScope: AnalysisScope;
  
  /** Default pattern types to detect */
  defaultPatternTypes: PatternType[];
  
  /** Performance settings */
  performance: {
    /** Default max processing time */
    maxProcessingTime: number;
    /** Default batch size */
    batchSize: number;
    /** Max concurrent AI calls */
    maxConcurrentAiCalls: number;
    /** Memory limit in MB */
    memoryLimit: number;
  };
  
  /** Caching configuration */
  caching: {
    /** Default cache TTL */
    defaultTtl: number;
    /** Max cache size in MB */
    maxCacheSize: number;
    /** Cache cleanup interval */
    cleanupInterval: number;
  };
  
  /** Confidence thresholds */
  confidence: {
    /** Minimum confidence for pattern inclusion */
    minConfidence: number;
    /** High confidence threshold */
    highConfidence: number;
    /** Low confidence threshold */
    lowConfidence: number;
  };
  
  /** Privacy settings */
  privacy: {
    /** Enable privacy filtering */
    enabled: boolean;
    /** Additional privacy tags */
    customPrivacyTags: string[];
    /** Excluded folders */
    excludedFolders: string[];
  };
}

/**
 * Validation result for pattern detection data
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
  
  /** Validation warnings */
  warnings: ValidationWarning[];
  
  /** Validation metadata */
  metadata: {
    /** Validation timestamp */
    validatedAt: Date;
    /** Validation duration */
    duration: number;
    /** Items validated */
    itemsValidated: number;
  };
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Field that failed validation */
  field: string;
  
  /** Invalid value */
  value: unknown;
  
  /** Expected value or format */
  expected: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  
  /** Warning message */
  message: string;
  
  /** Field with warning */
  field: string;
  
  /** Current value */
  value: unknown;
  
  /** Suggested value */
  suggestion: string;
} 