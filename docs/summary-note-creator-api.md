# SummaryNoteCreator API Documentation

## Overview

The `SummaryNoteCreator` class is responsible for generating AI-enhanced summary notes from analyzed Obsidian files. It integrates with the Pattern Detection Engine, AI services, privacy filters, and natural language generation to create comprehensive, actionable summaries.

## Table of Contents

- [Class Overview](#class-overview)
- [Interfaces](#interfaces)
- [Constructor](#constructor)
- [Public Methods](#public-methods)
- [Private Methods](#private-methods)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Integration Points](#integration-points)

## Class Overview

```typescript
export class SummaryNoteCreator {
    constructor(
        private app: App, 
        private logger: Logger,
        private aiService?: AIService,
        private privacyFilter?: PrivacyFilter,
        private patternDetectionEngine?: PatternDetectionEngine
    )
}
```

### Key Features

- **AI-Enhanced Content**: Generates executive summaries, key insights, and pattern analysis using AI services
- **Privacy Protection**: Automatically detects and respects privacy settings (#private, #noai tags)
- **Pattern Detection Integration**: Leverages the Pattern Detection Engine for advanced pattern analysis
- **Multiple Writing Styles**: Supports business, personal, and academic writing styles
- **Vault-Wide Analysis**: Can generate comprehensive vault pattern summaries
- **Flexible Configuration**: Highly configurable through SummaryNoteOptions interface

## Interfaces

### SummaryNoteOptions

Main configuration interface for summary note creation:

```typescript
export interface SummaryNoteOptions {
    // Basic Options
    folderPath: string;                    // Folder where summary notes are created
    filenameTemplate: string;              // Template for generating filenames
    createBacklinks: boolean;              // Whether to create backlinks to original files
    overwriteExisting: boolean;            // Whether to overwrite existing summary notes
    
    // AI Enhancement Options
    enableAIInsights: boolean;             // Enable AI-powered insights and analysis
    writingStyle: 'business' | 'personal' | 'academic';  // Writing style for AI content
    includeRecommendations: boolean;       // Include AI-generated recommendations
    includePatternAnalysis: boolean;       // Include pattern analysis in summaries
    includeTrendAnalysis: boolean;         // Include temporal trend analysis
    
    // Privacy Options
    respectPrivacySettings: boolean;       // Respect #private/#noai tags
    
    // Pattern Detection Options
    enablePatternDetection: boolean;       // Enable pattern detection features
    patternDetectionScope: AnalysisScope;  // Scope for pattern analysis
    includeVaultPatterns: boolean;         // Include vault-wide pattern context
    includePatternCorrelations: boolean;   // Include pattern correlations
    includeTemporalAnalysis: boolean;      // Include temporal pattern analysis
    patternConfidenceThreshold: number;    // Minimum confidence for pattern inclusion
}
```

### Default Configuration

```typescript
export const DEFAULT_SUMMARY_OPTIONS: SummaryNoteOptions = {
    folderPath: "Summaries",
    filenameTemplate: "Summary - {{date}} - {{originalName}}",
    createBacklinks: true,
    overwriteExisting: false,
    enableAIInsights: true,
    writingStyle: 'personal',
    includeRecommendations: true,
    includePatternAnalysis: true,
    includeTrendAnalysis: true,
    respectPrivacySettings: true,
    enablePatternDetection: true,
    patternDetectionScope: 'whole-life',
    includeVaultPatterns: false,
    includePatternCorrelations: false,
    includeTemporalAnalysis: true,
    patternConfidenceThreshold: 0.6,
};
```

## Constructor

```typescript
constructor(
    private app: App, 
    private logger: Logger,
    private aiService?: AIService,
    private privacyFilter?: PrivacyFilter,
    private patternDetectionEngine?: PatternDetectionEngine
)
```

### Parameters

- **app**: Obsidian App instance for vault operations
- **logger**: Logger instance for debugging and error tracking
- **aiService** (optional): AI service for generating enhanced content
- **privacyFilter** (optional): Privacy filter for respecting privacy settings
- **patternDetectionEngine** (optional): Pattern detection engine for advanced analysis

### Notes

- Optional dependencies enable graceful degradation when services are unavailable
- NLG generator is initialized with 'personal' style by default but can be changed per summary

## Public Methods

### createSummaryNote()

Creates a summary note for a specific file with AI-enhanced content and pattern analysis.

```typescript
async createSummaryNote(
    originalFile: TFile,
    analysisResult: ProcessingResult,
    options: Partial<SummaryNoteOptions> = {}
): Promise<string>
```

#### Parameters

- **originalFile**: The original Obsidian file to summarize
- **analysisResult**: Processing result from MarkdownProcessingService
- **options**: Partial configuration options (merged with defaults)

#### Returns

- **Promise<string>**: Path to the created summary note

#### Features

- **Privacy Protection**: Automatically detects privacy tags and disables AI when needed
- **Folder Management**: Creates necessary folders automatically
- **Conflict Handling**: Handles existing files based on overwrite settings
- **Enhanced Content**: Generates AI-powered insights, patterns, and recommendations
- **Error Recovery**: Robust error handling with fallback strategies

#### Example

```typescript
const summaryCreator = new SummaryNoteCreator(app, logger, aiService, privacyFilter, patternEngine);

const summaryPath = await summaryCreator.createSummaryNote(
    file,
    analysisResult,
    {
        folderPath: "My Summaries",
        enableAIInsights: true,
        writingStyle: 'business',
        includePatternAnalysis: true,
        patternDetectionScope: 'work-only'
    }
);
```

### createVaultPatternSummary()

Creates a comprehensive vault-wide pattern summary analyzing patterns across all files.

```typescript
async createVaultPatternSummary(
    options: Partial<SummaryNoteOptions> = {}
): Promise<string>
```

#### Parameters

- **options**: Partial configuration options for vault-wide analysis

#### Returns

- **Promise<string>**: Path to the created vault pattern summary

#### Features

- **Comprehensive Analysis**: Analyzes patterns across entire vault
- **Pattern Correlations**: Identifies relationships between different patterns
- **Temporal Trends**: Shows how patterns change over time
- **Actionable Insights**: Provides vault-level recommendations
- **Performance Optimized**: Uses efficient batch processing for large vaults

#### Requirements

- Pattern Detection Engine must be available
- Sufficient vault content for meaningful analysis

#### Example

```typescript
const vaultSummaryPath = await summaryCreator.createVaultPatternSummary({
    patternDetectionScope: 'whole-life',
    includePatternCorrelations: true,
    includeTemporalAnalysis: true,
    patternConfidenceThreshold: 0.7
});
```

## Private Methods

### Privacy and Security

#### shouldEnableAIForFile()

```typescript
private async shouldEnableAIForFile(
    originalFile: TFile,
    options: SummaryNoteOptions
): Promise<boolean>
```

Determines whether AI services should be enabled for a specific file based on privacy settings.

**Privacy Checks:**
- File-level privacy tags (#private, #noai)
- Folder-based exclusions
- Content-level privacy markers
- User privacy preferences

### Content Generation

#### generateEnhancedSummaryContent()

```typescript
private async generateEnhancedSummaryContent(
    originalFile: TFile,
    analysisResult: ProcessingResult,
    options: SummaryNoteOptions
): Promise<string>
```

Generates the complete enhanced summary content including all sections.

**Generated Sections:**
- Executive Summary
- Key Insights
- Content Analysis
- Pattern Analysis
- Recommendations
- Connection Opportunities
- Frontmatter and metadata

#### generateAdvancedPatternAnalysis()

```typescript
private async generateAdvancedPatternAnalysis(
    originalFile: TFile,
    options: SummaryNoteOptions
): Promise<{
    patterns: PatternDefinition[];
    correlations: PatternCorrelation[];
    summary: string;
    insights: string[];
}>
```

Performs advanced pattern analysis using the Pattern Detection Engine.

### AI Integration

#### generateExecutiveSummary()

```typescript
private async generateExecutiveSummary(
    originalFile: TFile,
    analysisResult: ProcessingResult
): Promise<string | null>
```

Generates AI-powered executive summary of the file content.

#### generateKeyInsights()

```typescript
private async generateKeyInsights(
    originalFile: TFile,
    analysisResult: ProcessingResult
): Promise<Array<{ title: string; description: string; evidence?: string[] }>>
```

Extracts key insights using AI analysis with supporting evidence.

#### generatePatternDrivenRecommendations()

```typescript
private async generatePatternDrivenRecommendations(
    originalFile: TFile,
    options: SummaryNoteOptions
): Promise<Array<{
    title: string;
    description: string;
    confidence: number;
    patternBasis: string[];
    actionSteps: Array<{ description: string }>;
}>>
```

Generates actionable recommendations based on detected patterns.

### Utility Methods

#### generateFilename()

```typescript
private generateFilename(originalFile: TFile, template: string): string
```

Generates filename from template with variable substitution.

**Supported Variables:**
- `{{date}}`: Current date (YYYY-MM-DD)
- `{{originalName}}`: Original file name without extension
- `{{timestamp}}`: Full timestamp

#### ensureFolderExists()

```typescript
private async ensureFolderExists(folderPath: string): Promise<void>
```

Ensures the target folder exists, creating it if necessary with robust error handling.

#### fileExists()

```typescript
private async fileExists(path: string): Promise<boolean>
```

Checks if a file exists at the specified path.

## Usage Examples

### Basic Summary Creation

```typescript
import { SummaryNoteCreator, DEFAULT_SUMMARY_OPTIONS } from './summary-note-creator';

// Initialize with required dependencies
const summaryCreator = new SummaryNoteCreator(
    app,
    logger,
    aiService,
    privacyFilter,
    patternDetectionEngine
);

// Create basic summary
const summaryPath = await summaryCreator.createSummaryNote(
    file,
    analysisResult
);
```

### Advanced Configuration

```typescript
// Custom configuration for business context
const businessOptions = {
    ...DEFAULT_SUMMARY_OPTIONS,
    folderPath: "Business Summaries",
    writingStyle: 'business' as const,
    enablePatternDetection: true,
    patternDetectionScope: 'work-only' as const,
    includePatternCorrelations: true,
    patternConfidenceThreshold: 0.8,
    filenameTemplate: "Business Summary - {{date}} - {{originalName}}"
};

const summaryPath = await summaryCreator.createSummaryNote(
    file,
    analysisResult,
    businessOptions
);
```

### Privacy-Aware Summary

```typescript
// Configuration that respects privacy
const privacyAwareOptions = {
    respectPrivacySettings: true,
    enableAIInsights: true, // Will be disabled automatically for private content
    writingStyle: 'personal' as const,
    includeRecommendations: false // Disable for sensitive content
};

const summaryPath = await summaryCreator.createSummaryNote(
    file,
    analysisResult,
    privacyAwareOptions
);
```

### Vault-Wide Pattern Analysis

```typescript
// Comprehensive vault analysis
const vaultAnalysisOptions = {
    patternDetectionScope: 'whole-life' as const,
    includeVaultPatterns: true,
    includePatternCorrelations: true,
    includeTemporalAnalysis: true,
    patternConfidenceThreshold: 0.6,
    folderPath: "Vault Analysis"
};

const vaultSummaryPath = await summaryCreator.createVaultPatternSummary(
    vaultAnalysisOptions
);
```

## Error Handling

### Common Error Scenarios

1. **Missing Dependencies**: Graceful degradation when optional services unavailable
2. **Privacy Violations**: Automatic AI disabling for private content
3. **File System Errors**: Robust folder creation and file handling
4. **AI Service Failures**: Fallback to basic summary content
5. **Pattern Detection Errors**: Continue with structural analysis only

### Error Recovery Strategies

```typescript
try {
    const summaryPath = await summaryCreator.createSummaryNote(file, result, options);
    console.log(`Summary created: ${summaryPath}`);
} catch (error) {
    if (error.message.includes('already exists')) {
        // Handle existing file conflict
        const overwriteOptions = { ...options, overwriteExisting: true };
        const summaryPath = await summaryCreator.createSummaryNote(file, result, overwriteOptions);
    } else if (error.message.includes('Privacy')) {
        // Handle privacy-related errors
        const basicOptions = { ...options, enableAIInsights: false };
        const summaryPath = await summaryCreator.createSummaryNote(file, result, basicOptions);
    } else {
        console.error('Summary creation failed:', error);
        throw error;
    }
}
```

## Integration Points

### With Pattern Detection Engine

- **File-Level Analysis**: Analyzes individual files for patterns
- **Vault-Wide Context**: Provides broader pattern context
- **Correlation Analysis**: Identifies pattern relationships
- **Temporal Analysis**: Tracks pattern changes over time

### With AI Services

- **Content Analysis**: Uses AI for deep content understanding
- **Pattern Recognition**: AI-powered pattern detection and classification
- **Natural Language Generation**: Multiple writing styles for different contexts
- **Recommendation Generation**: AI-driven actionable insights

### With Privacy Filter

- **Automatic Detection**: Detects privacy tags and folder exclusions
- **Content Scanning**: Scans content for privacy markers
- **Graceful Degradation**: Disables AI while maintaining basic functionality
- **Audit Logging**: Tracks privacy-related decisions

### With Obsidian API

- **File Operations**: Create, modify, and manage summary files
- **Folder Management**: Automatic folder creation and organization
- **Vault Integration**: Seamless integration with Obsidian's file system
- **Backlink Creation**: Automatic backlinking to original files

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Optional dependencies loaded only when needed
2. **Caching**: Pattern results cached to avoid recomputation
3. **Batch Processing**: Efficient processing for vault-wide analysis
4. **Memory Management**: Proper cleanup and resource management
5. **Error Boundaries**: Isolated error handling prevents cascading failures

### Performance Monitoring

The class includes built-in performance monitoring:
- Processing time tracking
- Memory usage monitoring
- AI service call optimization
- Cache hit rate tracking

## Best Practices

### Configuration

1. **Use Defaults**: Start with `DEFAULT_SUMMARY_OPTIONS` and override as needed
2. **Privacy First**: Always enable `respectPrivacySettings` for user data
3. **Performance Tuning**: Adjust `patternConfidenceThreshold` based on content quality needs
4. **Scope Selection**: Choose appropriate `patternDetectionScope` for context

### Error Handling

1. **Graceful Degradation**: Design for optional dependency failures
2. **User Feedback**: Provide clear error messages and recovery suggestions
3. **Logging**: Use comprehensive logging for debugging and monitoring
4. **Fallback Strategies**: Always have fallback options for critical functionality

### Security

1. **Privacy Compliance**: Respect all privacy settings and tags
2. **Data Protection**: Avoid exposing sensitive information in summaries
3. **Access Control**: Ensure proper file system permissions
4. **Audit Trails**: Maintain logs of privacy-related decisions

This API documentation provides a comprehensive guide to using the SummaryNoteCreator class effectively while maintaining security, privacy, and performance best practices. 