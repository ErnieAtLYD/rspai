/**
 * Performance tests for Pattern Detection Engine
 * Tests core functionality, validation, and performance characteristics
 */

import { PatternDetectionValidator } from '../../src/pattern-detection-validator';
import { PrivacyFilter } from '../../src/privacy-filter';
import { Logger, LogLevel } from '../../src/logger';
import {
  PatternDefinition,
  PatternType,
  PatternClassification,
  AnalysisScope
} from '../../src/pattern-detection-interfaces';

/**
 * Simple test framework for performance testing
 */
class TestRunner {
  private passed = 0;
  private failed = 0;
  private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🚀 Starting Pattern Detection Performance Tests\n');
    
    for (const test of this.tests) {
      try {
        const startTime = Date.now();
        await test.fn();
        const duration = Date.now() - startTime;
        console.log(`✅ ${test.name} (${duration}ms)`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed\n`);
    return this.failed === 0;
  }
}

/**
 * Simple assertion functions
 */
function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected: number) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toHaveLength: (expected: number) => {
      if (!actual || actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual?.length || 'undefined'}`);
      }
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeInstanceOf: (expected: any) => {
      if (!(actual instanceof expected)) {
        throw new Error(`Expected instance of ${expected.name}, got ${typeof actual}`);
      }
    }
  };
}

/**
 * Create a sample pattern for testing
 */
function createSamplePattern(id: string, type: PatternType): PatternDefinition {
  return {
    id,
    type,
    name: `Sample ${type} Pattern`,
    description: `A sample pattern of type ${type} for testing`,
    classification: 'medium' as PatternClassification,
    confidence: 0.75,
    supportingEvidence: ['evidence1', 'evidence2', 'evidence3'],
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
      relatedPatterns: ['pattern1', 'pattern2'],
      strength: 0.6
    },
    metadata: {
      detectedAt: new Date(),
      sourceFiles: ['file1.md', 'file2.md'],
      analysisScope: 'whole-life' as AnalysisScope,
      modelUsed: 'test-model'
    }
  };
}

/**
 * Main test execution
 */
async function runPerformanceTests() {
  const runner = new TestRunner();
  
  // Initialize components
  const logger = new Logger('PerformanceTest', false, LogLevel.ERROR);
  const validator = new PatternDetectionValidator();
  const privacyFilter = new PrivacyFilter(logger, {});

  // Test 1: Basic Pattern Validation
  runner.test('Pattern Validation - Basic Functionality', () => {
    const pattern = createSamplePattern('test-1', 'productivity-theme');
    const result = validator.validatePatternDefinition(pattern);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metadata).toBeTruthy();
    expect(result.metadata.validatedAt).toBeInstanceOf(Date);
  });

  // Test 2: Invalid Pattern Detection
  runner.test('Pattern Validation - Error Detection', () => {
    const invalidPattern = {
      id: '',
      type: 'invalid-type',
      confidence: 1.5
    } as any;
    
    const result = validator.validatePatternDefinition(invalidPattern);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // Test 3: Performance Test - Multiple Patterns
  runner.test('Pattern Validation - Performance (100 patterns)', () => {
    const patterns: PatternDefinition[] = [];
    
    // Generate test patterns
    for (let i = 0; i < 100; i++) {
      patterns.push(createSamplePattern(`perf-test-${i}`, 'productivity-theme'));
    }
    
    const startTime = Date.now();
    const results = patterns.map(pattern => validator.validatePatternDefinition(pattern));
    const endTime = Date.now();
    
    const processingTime = endTime - startTime;
    const allValid = results.every(r => r.isValid);
    
    expect(allValid).toBe(true);
    expect(processingTime).toBeLessThan(1000); // Should complete in under 1 second
    
    console.log(`    📈 Processed 100 patterns in ${processingTime}ms (${(processingTime/100).toFixed(2)}ms per pattern)`);
  });

  // Test 4: Privacy Filter - Basic Functionality
  runner.test('Privacy Filter - Basic Exclusion', () => {
    const privateContent = `
# Private Notes #private

This content should be excluded from analysis.
Contains sensitive information.
    `;
    
    const shouldExclude = privacyFilter.shouldExcludeFile('test/private.md', privateContent);
    expect(shouldExclude).toBe(true);
  });

  // Test 5: Privacy Filter - Non-private Content
  runner.test('Privacy Filter - Non-private Content', () => {
    const publicContent = `
# Public Notes

This is regular content that can be analyzed.
No privacy markers present.
    `;
    
    const shouldExclude = privacyFilter.shouldExcludeFile('test/public.md', publicContent);
    expect(shouldExclude).toBe(false);
  });

  // Test 6: Privacy Filter - Content Filtering
  runner.test('Privacy Filter - Content Redaction', () => {
    const mixedContent = `
# Mixed Content

This is public content.

## Private Section #private
This section contains sensitive data.
Should be redacted.

## Public Section
This section is fine to analyze.
    `;
    
    const filteredContent = privacyFilter.filterContent(mixedContent);
    expect(filteredContent.length).toBeGreaterThan(0);
    expect(filteredContent.length).toBeLessThan(mixedContent.length);
  });

  // Test 7: Pattern Types Coverage
  runner.test('Pattern Types - All Types Validation', () => {
    const allPatternTypes: PatternType[] = [
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

    const results = allPatternTypes.map(type => {
      const pattern = createSamplePattern(`type-test-${type}`, type);
      return validator.validatePatternDefinition(pattern);
    });

    const allValid = results.every(r => r.isValid);
    expect(allValid).toBe(true);
    
    console.log(`    📋 Validated ${allPatternTypes.length} different pattern types`);
  });

  // Test 8: Analysis Scopes Coverage
  runner.test('Analysis Scopes - All Scopes Validation', () => {
    const allScopes: AnalysisScope[] = ['whole-life', 'work-only', 'personal-only', 'custom'];

    const results = allScopes.map(scope => {
      const pattern = createSamplePattern(`scope-test-${scope}`, 'productivity-theme');
      pattern.metadata.analysisScope = scope;
      return validator.validatePatternDefinition(pattern);
    });

    const allValid = results.every(r => r.isValid);
    expect(allValid).toBe(true);
    
    console.log(`    🎯 Validated ${allScopes.length} different analysis scopes`);
  });

  // Test 9: Large Pattern Validation
  runner.test('Pattern Validation - Large Pattern Data', () => {
    const largePattern = createSamplePattern('large-test', 'productivity-theme');
    
    // Create large arrays to test performance
    largePattern.supportingEvidence = Array.from({ length: 1000 }, (_, i) => `evidence-${i}`);
    largePattern.temporal.peakPeriods = Array.from({ length: 100 }, (_, i) => `period-${i}`);
    largePattern.correlations.relatedPatterns = Array.from({ length: 50 }, (_, i) => `pattern-${i}`);
    largePattern.metadata.sourceFiles = Array.from({ length: 500 }, (_, i) => `file-${i}.md`);

    const startTime = Date.now();
    const result = validator.validatePatternDefinition(largePattern);
    const endTime = Date.now();

    expect(result.isValid).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Should validate large pattern quickly
    
    console.log(`    📊 Validated large pattern (${largePattern.supportingEvidence.length} evidence items) in ${endTime - startTime}ms`);
  });

  // Test 10: Memory and Resource Usage
  runner.test('Resource Usage - Memory Efficiency', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create and validate many patterns
    for (let i = 0; i < 1000; i++) {
      const pattern = createSamplePattern(`memory-test-${i}`, 'productivity-theme');
      const result = validator.validatePatternDefinition(pattern);
      expect(result.isValid).toBe(true);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
    
    console.log(`    💾 Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for 1000 pattern validations`);
    
    // Memory increase should be reasonable (less than 50MB for 1000 patterns)
    expect(memoryIncreaseMB).toBeLessThan(50);
  });

  // Run all tests
  const success = await runner.run();
  
  if (success) {
    console.log('🎉 All performance tests passed! Pattern Detection Engine is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Please review the results above.');
    process.exit(1);
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runPerformanceTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { runPerformanceTests }; 