# Pattern Detection Engine API Reference

## Table of Contents
1. [Core Interfaces](#core-interfaces)
2. [PatternDetectionEngine](#patterndetectionengine)
3. [PatternDetectionValidator](#patterndetectionvalidator)
4. [Configuration](#configuration)
5. [Data Models](#data-models)
6. [Type Definitions](#type-definitions)
7. [Usage Examples](#usage-examples)

## Core Interfaces

### PatternDefinition

Represents a detected pattern with all associated metadata.

```typescript
interface PatternDefinition {
  id: string;                          // Unique pattern identifier
  type: PatternType;                   // Pattern type classification
  name: string;                        // Human-readable pattern name
  description: string;                 // Pattern description
  classification: PatternClassification; // High/medium/low/critical
  confidence: number;                  // Confidence score (0-1)
  evidence: string[];                  // Supporting evidence array
  frequency: PatternFrequency;         // Frequency metrics
  temporal: TemporalInfo;             // Temporal information
  correlations: PatternCorrelation[]; // Related patterns
  metadata: PatternMetadata;          // Additional metadata
}
```

### NoteAnalysisRecord

Contains the complete analysis results for a single note/file.

```typescript
interface NoteAnalysisRecord {
  fileId: string;                     // Unique file identifier
  filePath: string;                   // Full file path
  analysisTimestamp: Date;            // When analysis was performed
  patterns: PatternDefinition[];      // Successfully detected patterns
  excludedPatterns: PatternDefinition[]; // Privacy-excluded patterns
  privacyExclusions: PrivacyExclusion[]; // Privacy exclusion details
  contentAnalysis: ContentAnalysis;   // Content analysis metadata
  processingMetadata: ProcessingMetadata; // Processing information
}
```

### VaultPatternResult

Complete vault-wide pattern analysis results.

```typescript
interface VaultPatternResult {
  patterns: PatternDefinition[];      // All detected patterns
  correlations: PatternCorrelation[]; // Cross-pattern correlations
  summary: PatternSummary;           // High-level analysis summary
  insights: PatternInsight[];        // Generated insights
  performance: PerformanceMetrics;   // Performance statistics
  analysisScope: AnalysisScope;      // Scope of analysis performed
  timestamp: Date;                   // Analysis completion time
  metadata: VaultAnalysisMetadata;   // Vault-level metadata
}
```

### PatternDetectionOptions

Configuration options for pattern detection operations.

```typescript
interface PatternDetectionOptions {
  scope: AnalysisScope;              // Analysis scope
  patternTypes?: PatternType[];      // Specific pattern types to detect
  minConfidence?: number;            // Minimum confidence threshold
  performance?: PerformanceConfig;   // Performance configuration
  caching?: CachingConfig;          // Caching configuration
  privacy?: PrivacyConfig;          // Privacy configuration
  customScope?: CustomAnalysisScope; // Custom scope definition
}
```

## PatternDetectionEngine

The main engine class for pattern detection operations.

### Constructor

```typescript
constructor(
  app: App,
  logger: Logger,
  config: PatternDetectionConfig,
  aiOrchestrator: AIServiceOrchestrator,
  privacyFilter: PrivacyFilter,
  markdownService: MarkdownProcessingService,
  performanceOptimizer: PerformanceOptimizer,
  vaultScanner: VaultScanner
)
```

**Parameters:**
- `app`: Obsidian App instance
- `logger`: Logger instance for debugging and monitoring
- `config`: Pattern detection configuration
- `aiOrchestrator`: AI service orchestrator for pattern analysis
- `privacyFilter`: Privacy filter for content exclusion
- `markdownService`: Markdown processing service
- `performanceOptimizer`: Performance optimization utilities
- `vaultScanner`: Vault scanning and indexing service

### Core Methods

#### detectPatternsInVault()

Performs comprehensive pattern analysis across the entire vault.

```typescript
async detectPatternsInVault(
  options: PatternDetectionOptions
): Promise<VaultPatternResult>
```

**Parameters:**
- `options`: Configuration options for the analysis

**Returns:** `Promise<VaultPatternResult>` - Complete vault analysis results

**Example:**
```typescript
const result = await engine.detectPatternsInVault({
  scope: 'work-only',
  patternTypes: ['productivity-theme', 'productivity-blocker'],
  minConfidence: 0.7,
  performance: {
    maxProcessingTime: 10000,
    batchSize: 10
  }
});
```

#### analyzeFilePatterns()

Analyzes patterns in a single file.

```typescript
async analyzeFilePatterns(
  file: TFile,
  options: PatternDetectionOptions
): Promise<NoteAnalysisRecord>
```

**Parameters:**
- `file`: Obsidian TFile object to analyze
- `options`: Configuration options for the analysis

**Returns:** `Promise<NoteAnalysisRecord>` - Analysis results for the file

**Example:**
```typescript
const fileResult = await engine.analyzeFilePatterns(file, {
  scope: 'whole-life',
  patternTypes: ['sentiment-pattern', 'mood-pattern'],
  minConfidence: 0.6
});
```

#### processIncrementalChanges()

Processes only changed files for efficient incremental updates.

```typescript
async processIncrementalChanges(
  changedFiles: TFile[],
  options: PatternDetectionOptions
): Promise<IncrementalPatternResult>
```

**Parameters:**
- `changedFiles`: Array of files that have changed
- `options`: Configuration options for the analysis

**Returns:** `Promise<IncrementalPatternResult>` - Incremental analysis results

**Example:**
```typescript
const incrementalResult = await engine.processIncrementalChanges(
  changedFiles,
  {
    scope: 'whole-life',
    minConfidence: 0.6
  }
);
```

### Configuration Methods

#### updateConfig()

Updates the pattern detection configuration.

```typescript
updateConfig(newConfig: Partial<PatternDetectionConfig>): void
```

**Parameters:**
- `newConfig`: Partial configuration object with updates

**Example:**
```typescript
engine.updateConfig({
  performance: {
    batchSize: 15,
    maxProcessingTime: 8000
  }
});
```

#### getConfig()

Returns the current configuration.

```typescript
getConfig(): PatternDetectionConfig
```

**Returns:** Current pattern detection configuration

### Cache Management

#### clearCache()

Clears all pattern detection caches.

```typescript
clearCache(): void
```

**Example:**
```typescript
engine.clearCache(); // Clear all caches
```

#### getCacheStats()

Returns cache performance statistics.

```typescript
getCacheStats(): CacheStatistics
```

**Returns:** `CacheStatistics` - Cache performance metrics

**Example:**
```typescript
const stats = engine.getCacheStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
console.log(`Total entries: ${stats.totalEntries}`);
```

### Performance Methods

#### getPerformanceStats()

Returns performance statistics for the engine.

```typescript
getPerformanceStats(): PerformanceStatistics
```

**Returns:** `PerformanceStatistics` - Performance metrics

**Example:**
```typescript
const perfStats = engine.getPerformanceStats();
console.log(`Average processing time: ${perfStats.averageProcessingTime}ms`);
console.log(`Files processed: ${perfStats.filesProcessed}`);
```

## PatternDetectionValidator

Validation utilities for pattern detection data structures.

### Constructor

```typescript
constructor()
```

### Validation Methods

#### validatePatternDefinition()

Validates a pattern definition for data integrity.

```typescript
validatePatternDefinition(pattern: PatternDefinition): ValidationResult
```

**Parameters:**
- `pattern`: Pattern definition to validate

**Returns:** `ValidationResult` - Validation results with errors/warnings

**Example:**
```typescript
const validator = new PatternDetectionValidator();
const result = validator.validatePatternDefinition(pattern);

if (!result.isValid) {
  console.log('Validation errors:', result.errors);
}
```

#### validateAnalysisResult()

Validates a complete vault analysis result.

```typescript
validateAnalysisResult(result: VaultPatternResult): ValidationResult
```

**Parameters:**
- `result`: Vault pattern result to validate

**Returns:** `ValidationResult` - Validation results

#### validateConfiguration()

Validates pattern detection configuration.

```typescript
validateConfiguration(config: PatternDetectionConfig): ValidationResult
```

**Parameters:**
- `config`: Configuration to validate

**Returns:** `ValidationResult` - Validation results

## Configuration

### PatternDetectionConfig

Main configuration interface for the pattern detection engine.

```typescript
interface PatternDetectionConfig {
  defaultScope: AnalysisScope;           // Default analysis scope
  defaultPatternTypes: PatternType[];    // Default pattern types to detect
  performance: PerformanceConfig;        // Performance configuration
  caching: CachingConfig;               // Caching configuration
  confidence: ConfidenceConfig;         // Confidence thresholds
  privacy: PrivacyConfig;               // Privacy settings
}
```

### PerformanceConfig

Performance-related configuration options.

```typescript
interface PerformanceConfig {
  maxProcessingTime: number;    // Maximum processing time in ms
  batchSize: number;           // Number of files to process in batch
  maxConcurrentAiCalls: number; // Maximum concurrent AI requests
  memoryLimit: number;         // Memory limit in MB
}
```

### CachingConfig

Caching configuration options.

```typescript
interface CachingConfig {
  defaultTtl: number;          // Default cache TTL in ms
  maxCacheSize: number;        // Maximum cache entries
  cleanupInterval: number;     // Cache cleanup interval in ms
}
```

### ConfidenceConfig

Confidence threshold configuration.

```typescript
interface ConfidenceConfig {
  minConfidence: number;       // Minimum confidence threshold (0-1)
  highConfidence: number;      // High confidence threshold (0-1)
  lowConfidence: number;       // Low confidence threshold (0-1)
}
```

## Data Models

### PatternFrequency

Frequency metrics for detected patterns.

```typescript
interface PatternFrequency {
  count: number;               // Number of occurrences
  period: string;              // Time period (e.g., "1 week")
  rate: number;               // Frequency rate (0-1)
  trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
}
```

### TemporalInfo

Temporal information about pattern occurrences.

```typescript
interface TemporalInfo {
  firstSeen: Date;             // First occurrence
  lastSeen: Date;              // Last occurrence
  peakPeriods: string[];       // Peak occurrence periods
  temporalPattern?: string;    // Temporal pattern description
}
```

### PatternCorrelation

Correlation between patterns.

```typescript
interface PatternCorrelation {
  patternId1: string;          // First pattern ID
  patternId2: string;          // Second pattern ID
  strength: number;            // Correlation strength (0-1)
  type: 'positive' | 'negative' | 'neutral';
  evidence: string[];          // Supporting evidence
  significance: number;        // Statistical significance
}
```

### PatternMetadata

Additional metadata for patterns.

```typescript
interface PatternMetadata {
  detectedAt: Date;            // Detection timestamp
  sourceFiles: string[];       // Source file paths
  analysisScope: AnalysisScope; // Analysis scope used
  modelUsed: string;           // AI model used for detection
  processingTime: number;      // Processing time in ms
  cacheHit: boolean;          // Whether result was cached
}
```

## Type Definitions

### PatternType

Enumeration of supported pattern types.

```typescript
type PatternType = 
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
```

### PatternClassification

Pattern importance classification.

```typescript
type PatternClassification = 'low' | 'medium' | 'high' | 'critical';
```

### AnalysisScope

Analysis scope options.

```typescript
type AnalysisScope = 'whole-life' | 'work-only' | 'personal-only' | 'custom';
```

### CustomAnalysisScope

Custom analysis scope definition.

```typescript
interface CustomAnalysisScope {
  includeFolders?: string[];    // Folders to include
  excludeFolders?: string[];    // Folders to exclude
  includePatterns?: string[];   // File patterns to include
  excludePatterns?: string[];   // File patterns to exclude
  dateRange?: {                // Date range filter
    start: Date;
    end: Date;
  };
}
```

## Usage Examples

### Basic Vault Analysis

```typescript
import { PatternDetectionEngine } from './pattern-detection-engine';

// Initialize engine
const engine = new PatternDetectionEngine(
  app, logger, config, aiOrchestrator, 
  privacyFilter, markdownService, 
  performanceOptimizer, vaultScanner
);

// Perform vault analysis
const result = await engine.detectPatternsInVault({
  scope: 'whole-life',
  patternTypes: ['productivity-theme', 'sentiment-pattern'],
  minConfidence: 0.6
});

// Process results
console.log(`Found ${result.patterns.length} patterns`);
for (const pattern of result.patterns) {
  console.log(`${pattern.name}: ${pattern.confidence.toFixed(2)}`);
}
```

### File-Specific Analysis

```typescript
// Analyze specific file
const file = app.vault.getAbstractFileByPath('Daily Notes/2024-01-15.md');
if (file instanceof TFile) {
  const fileResult = await engine.analyzeFilePatterns(file, {
    scope: 'whole-life',
    patternTypes: ['mood-pattern', 'health-pattern'],
    minConfidence: 0.5
  });
  
  console.log(`File patterns: ${fileResult.patterns.length}`);
  console.log(`Privacy exclusions: ${fileResult.privacyExclusions.length}`);
}
```

### Incremental Processing

```typescript
// Track changed files
const changedFiles = vault.getMarkdownFiles().filter(file => 
  file.stat.mtime > lastProcessingTime
);

// Process only changed files
const incrementalResult = await engine.processIncrementalChanges(
  changedFiles,
  {
    scope: 'work-only',
    minConfidence: 0.7
  }
);

console.log(`Processed ${incrementalResult.changedFiles.length} changed files`);
console.log(`New patterns: ${incrementalResult.newPatterns.length}`);
```

### Custom Scope Analysis

```typescript
// Define custom scope
const customScope: CustomAnalysisScope = {
  includeFolders: ['Projects/', 'Work/'],
  excludeFolders: ['Archive/', 'Templates/'],
  includePatterns: ['*.md'],
  excludePatterns: ['*template*', '*draft*'],
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  }
};

// Analyze with custom scope
const customResult = await engine.detectPatternsInVault({
  scope: 'custom',
  customScope,
  patternTypes: ['work-pattern', 'productivity-theme']
});
```

### Performance Monitoring

```typescript
// Monitor performance
const perfStats = engine.getPerformanceStats();
console.log('Performance Statistics:');
console.log(`- Average processing time: ${perfStats.averageProcessingTime}ms`);
console.log(`- Files processed: ${perfStats.filesProcessed}`);
console.log(`- Cache hit rate: ${perfStats.cacheHitRate}%`);

// Monitor cache
const cacheStats = engine.getCacheStats();
console.log('Cache Statistics:');
console.log(`- Hit rate: ${cacheStats.hitRate}%`);
console.log(`- Total entries: ${cacheStats.totalEntries}`);
console.log(`- Memory usage: ${cacheStats.memoryUsage}MB`);
```

### Error Handling

```typescript
try {
  const result = await engine.detectPatternsInVault(options);
  
  // Check for warnings
  if (result.warnings?.length > 0) {
    console.warn('Analysis warnings:', result.warnings);
  }
  
  // Process results
  processPatternResults(result);
  
} catch (error) {
  if (error instanceof PatternDetectionError) {
    console.error('Pattern detection error:', error.message);
    console.error('Error code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Validation Example

```typescript
import { PatternDetectionValidator } from './pattern-detection-validator';

const validator = new PatternDetectionValidator();

// Validate pattern definition
const validationResult = validator.validatePatternDefinition(pattern);
if (!validationResult.isValid) {
  console.error('Pattern validation failed:');
  validationResult.errors.forEach(error => {
    console.error(`- ${error.field}: ${error.message}`);
  });
}

// Validate configuration
const configValidation = validator.validateConfiguration(config);
if (configValidation.warnings.length > 0) {
  console.warn('Configuration warnings:');
  configValidation.warnings.forEach(warning => {
    console.warn(`- ${warning.message}`);
  });
}
```

---

*API Reference last updated: 2025-06-17*
*Pattern Detection Engine v1.0* 