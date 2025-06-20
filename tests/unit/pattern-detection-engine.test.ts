/**
 * Unit tests for Pattern Detection Engine
 */

import { PatternDetectionEngine } from '../../src/pattern-detection-engine';
import { PatternDetectionValidator } from '../../src/pattern-detection-validator';
import { Logger, LogLevel } from '../../src/logger';
import { AIServiceOrchestrator } from '../../src/ai-service-orchestrator';
import { PrivacyFilter } from '../../src/privacy-filter';
import { MarkdownProcessingService } from '../../src/markdown-processing-service';
import { PerformanceOptimizer } from '../../src/performance-optimizer';
import { VaultScanner } from '../../src/vault-scanner';
import {
  PatternDetectionOptions,
  PatternDefinition,
  PatternDetectionConfig,
  AnalysisScope,
  PatternType,
  PatternClassification
} from '../../src/pattern-detection-interfaces';
import { testUtils } from '../setup';

// Mock dependencies
jest.mock('../../src/ai-service-orchestrator');
jest.mock('../../src/privacy-filter');
jest.mock('../../src/markdown-processing-service');
jest.mock('../../src/performance-optimizer');
jest.mock('../../src/vault-scanner');

describe('PatternDetectionEngine', () => {
  let engine: PatternDetectionEngine;
  let mockApp: any;
  let mockLogger: Logger;
  let mockAIOrchestrator: jest.Mocked<AIServiceOrchestrator>;
  let mockPrivacyFilter: jest.Mocked<PrivacyFilter>;
  let mockMarkdownProcessor: jest.Mocked<MarkdownProcessingService>;
  let mockPerformanceOptimizer: jest.Mocked<PerformanceOptimizer>;
  let mockVaultScanner: jest.Mocked<VaultScanner>;
  let validator: PatternDetectionValidator;

  const defaultConfig: PatternDetectionConfig = {
    defaultScope: 'whole-life' as AnalysisScope,
    defaultPatternTypes: ['productivity-theme', 'sentiment-pattern'] as PatternType[],
    performance: {
      maxProcessingTime: 10000,
      batchSize: 10,
      maxConcurrentAiCalls: 3,
      memoryLimit: 100
    },
    caching: {
      defaultTtl: 3600000,
      maxCacheSize: 100,
      cleanupInterval: 60000
    },
    confidence: {
      minConfidence: 0.6,
      highConfidence: 0.8,
      lowConfidence: 0.4
    },
    privacy: {
      enabled: true,
      customPrivacyTags: [],
      excludedFolders: ['Private', 'Confidential']
    }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock app
    mockApp = testUtils.createMockApp();

    // Create logger
    mockLogger = new Logger('PatternDetectionEngine', false, LogLevel.ERROR);

    // Create mocked dependencies
    mockAIOrchestrator = new AIServiceOrchestrator(
      mockApp,
      mockLogger,
      {}
    ) as jest.Mocked<AIServiceOrchestrator>;

    mockPrivacyFilter = new PrivacyFilter(
      mockApp,
      mockLogger,
      {}
    ) as jest.Mocked<PrivacyFilter>;

    mockMarkdownProcessor = new MarkdownProcessingService(
      mockApp,
      mockLogger,
      {} as any
    ) as jest.Mocked<MarkdownProcessingService>;

    mockPerformanceOptimizer = new PerformanceOptimizer(
      mockLogger
    ) as jest.Mocked<PerformanceOptimizer>;

    mockVaultScanner = new VaultScanner(
      mockApp,
      mockLogger,
      mockPrivacyFilter
    ) as jest.Mocked<VaultScanner>;

    validator = new PatternDetectionValidator();

    // Create engine instance
    engine = new PatternDetectionEngine(
      mockApp,
      mockLogger,
      mockAIOrchestrator,
      mockPrivacyFilter,
      mockMarkdownProcessor,
      mockPerformanceOptimizer,
      mockVaultScanner,
      defaultConfig,
      validator
    );
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with all dependencies', () => {
      expect(engine).toBeInstanceOf(PatternDetectionEngine);
    });

    test('should use default configuration when none provided', () => {
      const engineWithDefaults = new PatternDetectionEngine(
        mockApp,
        mockLogger,
        mockAIOrchestrator,
        mockPrivacyFilter,
        mockMarkdownProcessor,
        mockPerformanceOptimizer,
        mockVaultScanner,
        {} as any,
        validator
      );
      expect(engineWithDefaults).toBeInstanceOf(PatternDetectionEngine);
    });
  });

  describe('detectPatternsInVault', () => {
    const mockOptions: PatternDetectionOptions = {
      scope: 'whole-life' as AnalysisScope,
      patternTypes: ['productivity-themes', 'sentiment-patterns'] as PatternType[],
      minConfidence: 0.7,
      incremental: false,
      performance: {
        maxProcessingTime: 10000,
        enableParallelProcessing: true,
        batchSize: 10
      },
      caching: {
        enableCaching: true,
        cacheTTL: 3600000
      }
    };

    test('should detect patterns in vault successfully', async () => {
      // Mock file data
      const mockFiles = [
        testUtils.createMockFile('notes/daily-1.md', 'I completed my tasks today and felt productive.'),
        testUtils.createMockFile('notes/daily-2.md', 'Struggled with focus today, got distracted often.')
      ];

      // Mock dependencies
      mockVaultScanner.scanVaultWithPrivacy.mockResolvedValue({
        files: mockFiles.map(file => ({
          path: file.path,
          content: '',
          privacy: { isExcluded: false, isFiltered: false }
        })),
        results: {
          totalFiles: 2,
          excludedFiles: 0,
          filteredFiles: 0,
          processingTime: 100
        }
      });

      mockAIOrchestrator.analyzePersonalContent.mockResolvedValue({
        patterns: [{
          type: 'productivity-themes',
          description: 'Task completion pattern',
          confidence: 0.85,
          evidence: ['completed my tasks']
        }],
        summary: 'Productivity analysis complete',
        processingTime: 500,
        orchestratorMetadata: {
          adaptersUsed: ['mock'],
          fallbacksTriggered: 0,
          cacheHit: false
        }
      });

      // Execute test
      const result = await engine.detectPatternsInVault(mockOptions);

      // Verify results
      expect(result).toBeDefined();
      expect(result.patterns).toBeInstanceOf(Array);
      expect(result.performance.processingTime).toBeGreaterThan(0);
      expect(result.performance.filesAnalyzed).toBe(2);
      expect(mockVaultScanner.scanVaultWithPrivacy).toHaveBeenCalledTimes(1);
    });

    test('should handle empty vault gracefully', async () => {
      // Mock empty vault
      mockVaultScanner.scanVaultWithPrivacy.mockResolvedValue({
        files: [],
        results: {
          totalFiles: 0,
          excludedFiles: 0,
          filteredFiles: 0,
          processingTime: 50
        }
      });

      const result = await engine.detectPatternsInVault(mockOptions);

      expect(result.patterns).toHaveLength(0);
      expect(result.performance.filesAnalyzed).toBe(0);
    });

    test('should respect processing time limits', async () => {
      const quickOptions = {
        ...mockOptions,
        performance: {
          ...mockOptions.performance,
          maxProcessingTime: 100 // Very short time limit
        }
      };

      // Mock many files to trigger time limit
      const manyFiles = Array.from({ length: 100 }, (_, i) =>
        testUtils.createMockFile(`notes/file-${i}.md`, `Content ${i}`)
      );

      mockVaultScanner.scanVaultWithPrivacy.mockResolvedValue({
        files: manyFiles.map(file => ({
          path: file.path,
          content: '',
          privacy: { isExcluded: false, isFiltered: false }
        })),
        results: {
          totalFiles: 100,
          excludedFiles: 0,
          filteredFiles: 0,
          processingTime: 200
        }
      });

      // Mock slow AI processing
      mockAIOrchestrator.analyzePersonalContent.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          patterns: [],
          summary: '',
          processingTime: 1000,
          orchestratorMetadata: {
            adaptersUsed: ['mock'],
            fallbacksTriggered: 0,
            cacheHit: false
          }
        }), 200))
      );

      const result = await engine.detectPatternsInVault(quickOptions);

      // Should complete within time limit (with some buffer)
      expect(result.performance.processingTime).toBeLessThan(5000);
    });
  });

  describe('analyzeFilePatterns', () => {
    const mockFile = testUtils.createMockFile(
      'notes/test.md',
      'I felt really productive today. Completed all my tasks and felt energized.'
    );

    const mockOptions: PatternDetectionOptions = {
      scope: 'whole-life' as AnalysisScope,
      patternTypes: ['productivity-themes', 'sentiment-patterns'] as PatternType[],
      minConfidence: 0.7,
      incremental: false,
      performance: {
        maxProcessingTime: 10000,
        enableParallelProcessing: true,
        batchSize: 10
      },
      caching: {
        enableCaching: true,
        cacheTTL: 3600000
      }
    };

    test('should analyze single file successfully', async () => {
      // Mock privacy check
      mockPrivacyFilter.checkFilePrivacy.mockResolvedValue({
        excluded: false,
        filtered: false,
        actions: []
      });

      // Mock markdown processing
      mockMarkdownProcessor.processFile.mockResolvedValue({
        success: true,
        filePath: mockFile.path,
        parsedContent: {
          elements: [],
          sections: [],
          metadata: {}
        },
        metadata: {
          title: 'Test',
          tags: [],
          created: new Date(),
          modified: new Date()
        },
        sections: [],
        errors: [],
        warnings: [],
        processingTime: 100,
        skipped: false
      });

      // Mock AI analysis
      mockAIOrchestrator.analyzePersonalContent.mockResolvedValue({
        patterns: [{
          type: 'productivity-themes',
          description: 'High productivity pattern',
          confidence: 0.9,
          evidence: ['productive today', 'completed all my tasks']
        }],
        summary: 'Analysis complete',
        processingTime: 300,
        orchestratorMetadata: {
          adaptersUsed: ['mock'],
          fallbacksTriggered: 0,
          cacheHit: false
        }
      });

      const result = await engine.analyzeFilePatterns(mockFile, mockOptions);

      expect(result).toBeDefined();
      expect(result.filePath).toBe(mockFile.path);
      expect(result.analysis.patternsFound).toBeGreaterThan(0);
      expect(result.analysis.processingTime).toBeGreaterThan(0);
    });

    test('should handle privacy exclusions', async () => {
      // Mock privacy exclusion
      mockPrivacyFilter.checkFilePrivacy.mockResolvedValue({
        excluded: true,
        filtered: false,
        actions: [{
          type: 'FILE_EXCLUDED',
          reason: 'privacy_tags',
          details: 'File contains #private tag'
        }]
      });

      const result = await engine.analyzeFilePatterns(mockFile, mockOptions);

      expect(result.privacy.isExcluded).toBe(true);
      expect(result.analysis.patternsFound).toBe(0);
      expect(mockAIOrchestrator.analyzePersonalContent).not.toHaveBeenCalled();
    });

    test('should handle processing errors gracefully', async () => {
      // Mock processing error
      mockPrivacyFilter.checkFilePrivacy.mockRejectedValue(
        new Error('Privacy check failed')
      );

      const result = await engine.analyzeFilePatterns(mockFile, mockOptions);

      expect(result.analysis.errors).toContain('Privacy check failed');
      expect(result.analysis.patternsFound).toBe(0);
    });
  });

  describe('Caching System', () => {
    test('should cache and retrieve file analysis results', async () => {
      const mockFile = testUtils.createMockFile('notes/cached.md', 'Test content');
      const mockOptions: PatternDetectionOptions = {
        scope: 'whole-life' as AnalysisScope,
        patternTypes: ['productivity-themes'] as PatternType[],
        minConfidence: 0.7,
        incremental: false,
        performance: {
          maxProcessingTime: 10000,
          enableParallelProcessing: true,
          batchSize: 10
        },
        caching: {
          enableCaching: true,
          cacheTTL: 3600000
        }
      };

      // Mock dependencies for first call
      mockPrivacyFilter.checkFilePrivacy.mockResolvedValue({
        excluded: false,
        filtered: false,
        actions: []
      });

      mockMarkdownProcessor.processFile.mockResolvedValue({
        success: true,
        filePath: mockFile.path,
        parsedContent: { elements: [], sections: [], metadata: {} },
        metadata: { title: 'Test', tags: [], created: new Date(), modified: new Date() },
        sections: [],
        errors: [],
        warnings: [],
        processingTime: 100,
        skipped: false
      });

      mockAIOrchestrator.analyzePersonalContent.mockResolvedValue({
        patterns: [{
          type: 'productivity-themes',
          description: 'Test pattern',
          confidence: 0.8,
          evidence: ['test']
        }],
        summary: 'Test analysis',
        processingTime: 200,
        orchestratorMetadata: {
          adaptersUsed: ['mock'],
          fallbacksTriggered: 0,
          cacheHit: false
        }
      });

      // First call - should process and cache
      const result1 = await engine.analyzeFilePatterns(mockFile, mockOptions);
      expect(mockAIOrchestrator.analyzePersonalContent).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await engine.analyzeFilePatterns(mockFile, mockOptions);
      expect(mockAIOrchestrator.analyzePersonalContent).toHaveBeenCalledTimes(1); // Still only 1 call

      expect(result1.filePath).toBe(result2.filePath);
    });
  });

  describe('Pattern Validation', () => {
    test('should validate valid pattern definitions', () => {
      const validPattern: PatternDefinition = {
        id: 'test-pattern-1',
        type: 'productivity-theme' as PatternType,
        name: 'High Productivity',
        description: 'Pattern indicating high productivity levels',
        classification: 'high' as PatternClassification,
        confidence: 0.85,
        supportingEvidence: ['completed tasks efficiently', 'felt energized'],
        frequency: {
          count: 5,
          period: '1 week',
          rate: 0.7,
          trend: 'increasing'
        },
        temporal: {
          firstSeen: new Date('2024-01-01'),
          lastSeen: new Date('2024-01-07'),
          peakPeriods: ['morning', 'afternoon']
        },
        correlations: {
          relatedPatterns: [],
          strength: 0.0
        },
        metadata: {
          detectedAt: new Date(),
          sourceFiles: ['notes/daily-1.md'],
          analysisScope: 'whole-life' as AnalysisScope,
          modelUsed: 'test-model'
        }
      };

             const result = validator.validatePatternDefinition(validPattern);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid pattern definitions', () => {
      const invalidPattern = {
        id: '', // Invalid: empty ID
        type: 'invalid-type', // Invalid: not a valid PatternType
        confidence: 1.5, // Invalid: confidence > 1.0
        // Missing required fields
      } as any;

      const result = validator.validatePatternDefinition(invalidPattern);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate confidence scores within range', () => {
      const patterns = [
        { confidence: -0.1 }, // Invalid: below 0
        { confidence: 0.0 },   // Valid: minimum
        { confidence: 0.5 },   // Valid: middle
        { confidence: 1.0 },   // Valid: maximum
        { confidence: 1.1 }    // Invalid: above 1
      ];

      patterns.forEach((pattern, index) => {
        const testPattern = {
          id: `test-${index}`,
          type: 'productivity-theme',
          name: 'Test',
          description: 'Test pattern',
          classification: 'medium',
          supportingEvidence: ['test'],
          frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
          temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
          correlations: { relatedPatterns: [], strength: 0 },
          metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' },
          ...pattern
        } as any;

                 const result = validator.validatePatternDefinition(testPattern);
        
        if (pattern.confidence < 0 || pattern.confidence > 1) {
          expect(result.isValid).toBe(false);
          expect(result.errors.some(e => e.field === 'confidence')).toBe(true);
        } else {
          expect(result.isValid).toBe(true);
        }
      });
    });

    test('should validate required fields are present', () => {
      const basePattern = {
        id: 'test-1',
        type: 'productivity-theme',
        name: 'Test Pattern',
        description: 'Test description',
        classification: 'medium',
        confidence: 0.8,
        supportingEvidence: ['evidence'],
        frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
        temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
        correlations: { relatedPatterns: [], strength: 0 },
        metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
      };

      const requiredFields = ['id', 'type', 'name', 'description', 'classification', 'confidence'];

      requiredFields.forEach(field => {
        const patternWithoutField = { ...basePattern };
        delete (patternWithoutField as any)[field];

                 const result = validator.validatePatternDefinition(patternWithoutField as any);
         expect(result.isValid).toBe(false);
         expect(result.errors.some(e => e.field === field)).toBe(true);
       });
     });

     test('should validate pattern types are valid', () => {
       const validTypes: PatternType[] = [
         'productivity-theme',
         'productivity-blocker',
         'sentiment-pattern',
         'sentiment-change',
         'procrastination-language',
         'distraction-language',
         'task-switching',
         'positive-momentum',
         'work-pattern',
         'habit-pattern',
         'mood-pattern',
         'health-pattern',
         'personal-activity'
       ];

       validTypes.forEach(type => {
         const pattern = {
           id: 'test',
           type,
           name: 'Test',
           description: 'Test',
           classification: 'medium',
           confidence: 0.8,
           supportingEvidence: ['test'],
           frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
           temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
           correlations: { relatedPatterns: [], strength: 0 },
           metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
         } as PatternDefinition;

         const result = validator.validatePatternDefinition(pattern);
         expect(result.isValid).toBe(true);
       });

       // Test invalid type
       const invalidPattern = {
         id: 'test',
         type: 'invalid-pattern-type',
         name: 'Test',
         description: 'Test',
         classification: 'medium',
         confidence: 0.8,
         supportingEvidence: ['test'],
         frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
         temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
         correlations: { relatedPatterns: [], strength: 0 },
         metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
       } as any;

       const result = validator.validatePatternDefinition(invalidPattern);
      expect(result.isValid).toBe(false);
    });

    test('should validate frequency data structure', () => {
      const validFrequency = {
        count: 5,
        period: '1 week',
        rate: 0.7,
        trend: 'increasing' as const
      };

      const pattern = {
        id: 'test',
        type: 'productivity-theme',
        name: 'Test',
        description: 'Test',
        classification: 'medium',
        confidence: 0.8,
        supportingEvidence: ['test'],
        frequency: validFrequency,
        temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
        correlations: { relatedPatterns: [], strength: 0 },
        metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
      } as PatternDefinition;

      const result = validator.validatePatternDefinition(pattern);
      expect(result.isValid).toBe(true);

      // Test invalid frequency
      const invalidPattern = {
        ...pattern,
        frequency: {
          count: -1, // Invalid: negative count
          period: '',  // Invalid: empty period
          rate: 2.0,  // Invalid: rate > 1.0
          trend: 'invalid' // Invalid: not a valid trend
        }
      } as any;

      const invalidResult = validator.validatePatternDefinition(invalidPattern);
      expect(invalidResult.isValid).toBe(false);
    });

    test('should validate temporal data structure', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const validTemporal = {
        firstSeen: yesterday,
        lastSeen: now,
        peakPeriods: ['morning', 'evening']
      };

      const pattern = {
        id: 'test',
        type: 'productivity-theme',
        name: 'Test',
        description: 'Test',
        classification: 'medium',
        confidence: 0.8,
        supportingEvidence: ['test'],
        frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
        temporal: validTemporal,
        correlations: { relatedPatterns: [], strength: 0 },
        metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
      } as PatternDefinition;

      const result = validator.validatePatternDefinition(pattern);
      expect(result.isValid).toBe(true);

      // Test invalid temporal (lastSeen before firstSeen)
      const invalidPattern = {
        ...pattern,
        temporal: {
          firstSeen: now,
          lastSeen: yesterday, // Invalid: before firstSeen
          peakPeriods: []
        }
      };

      const invalidResult = validator.validatePatternDefinition(invalidPattern);
      expect(invalidResult.isValid).toBe(false);
    });

    test('should validate metadata structure', () => {
      const validMetadata = {
        detectedAt: new Date(),
        sourceFiles: ['file1.md', 'file2.md'],
        analysisScope: 'whole-life' as AnalysisScope,
        modelUsed: 'gpt-4'
      };

      const pattern = {
        id: 'test',
        type: 'productivity-theme',
        name: 'Test',
        description: 'Test',
        classification: 'medium',
        confidence: 0.8,
        supportingEvidence: ['test'],
        frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
        temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
        correlations: { relatedPatterns: [], strength: 0 },
        metadata: validMetadata
      } as PatternDefinition;

      const result = validator.validatePatternDefinition(pattern);
      expect(result.isValid).toBe(true);

      // Test invalid metadata
      const invalidPattern = {
        ...pattern,
        metadata: {
          detectedAt: 'invalid-date', // Invalid: not a Date
          sourceFiles: 'not-an-array', // Invalid: not an array
          analysisScope: 'invalid-scope' // Invalid: not a valid scope
        }
      } as any;

      const invalidResult = validator.validatePatternDefinition(invalidPattern);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Pattern Classification Validation', () => {
    test('should validate classification levels', () => {
      const validClassifications: PatternClassification[] = ['high', 'medium', 'low'];

      validClassifications.forEach(classification => {
        const pattern = {
          id: 'test',
          type: 'productivity-theme',
          name: 'Test',
          description: 'Test',
          classification,
          confidence: 0.8,
          supportingEvidence: ['test'],
          frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
          temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
          correlations: { relatedPatterns: [], strength: 0 },
          metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
        } as PatternDefinition;

        const result = validator.validatePatternDefinition(pattern);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Analysis Scope Validation', () => {
    test('should validate analysis scopes', () => {
      const validScopes: AnalysisScope[] = ['whole-life', 'work-only', 'personal-only', 'custom'];

      validScopes.forEach(scope => {
        const pattern = {
          id: 'test',
          type: 'productivity-theme',
          name: 'Test',
          description: 'Test',
          classification: 'medium',
          confidence: 0.8,
          supportingEvidence: ['test'],
          frequency: { count: 1, period: '1 day', rate: 1, trend: 'stable' },
          temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
          correlations: { relatedPatterns: [], strength: 0 },
          metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: scope }
        } as PatternDefinition;

        const result = validator.validatePatternDefinition(pattern);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(() => validator.validatePatternDefinition(null as any)).not.toThrow();
      expect(() => validator.validatePatternDefinition(undefined as any)).not.toThrow();
      
      const nullResult = validator.validatePatternDefinition(null as any);
      expect(nullResult.isValid).toBe(false);
      
      const undefinedResult = validator.validatePatternDefinition(undefined as any);
      expect(undefinedResult.isValid).toBe(false);
    });

    test('should handle empty arrays and objects', () => {
      const patternWithEmptyArrays = {
        id: 'test',
        type: 'productivity-theme',
        name: 'Test',
        description: 'Test',
        classification: 'medium',
        confidence: 0.8,
        supportingEvidence: [], // Empty but valid
        frequency: { count: 0, period: '1 day', rate: 0, trend: 'stable' },
        temporal: { firstSeen: new Date(), lastSeen: new Date(), peakPeriods: [] },
        correlations: { relatedPatterns: [], strength: 0 },
        metadata: { detectedAt: new Date(), sourceFiles: [], analysisScope: 'whole-life' }
      } as PatternDefinition;

      const result = validator.validatePatternDefinition(patternWithEmptyArrays);
      expect(result.isValid).toBe(true);
    });

    test('should provide meaningful error messages', () => {
      const invalidPattern = {
        id: '',
        type: 'invalid-type',
        confidence: 1.5
      } as any;

      const result = validator.validatePatternDefinition(invalidPattern);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that error messages are meaningful
      result.errors.forEach(error => {
        expect(error.message).toBeTruthy();
        expect(error.field).toBeTruthy();
        expect(error.code).toBeTruthy();
      });
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large pattern definitions efficiently', () => {
      const largePattern = {
        id: 'large-pattern',
        type: 'productivity-theme',
        name: 'Large Pattern',
        description: 'A pattern with lots of data',
        classification: 'high',
        confidence: 0.9,
        supportingEvidence: Array.from({ length: 1000 }, (_, i) => `evidence-${i}`),
        frequency: { count: 1000, period: '1 year', rate: 0.8, trend: 'increasing' },
        temporal: { 
          firstSeen: new Date('2023-01-01'), 
          lastSeen: new Date('2024-01-01'), 
          peakPeriods: Array.from({ length: 100 }, (_, i) => `period-${i}`)
        },
        correlations: { 
          relatedPatterns: Array.from({ length: 50 }, (_, i) => `pattern-${i}`), 
          strength: 0.7 
        },
        metadata: { 
          detectedAt: new Date(), 
          sourceFiles: Array.from({ length: 500 }, (_, i) => `file-${i}.md`), 
          analysisScope: 'whole-life' 
        }
      } as PatternDefinition;

      const startTime = Date.now();
      const result = validator.validatePatternDefinition(largePattern);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
}); 