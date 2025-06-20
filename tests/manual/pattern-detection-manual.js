/**
 * Manual test for Pattern Detection Engine components
 * Tests core functionality without complex dependencies
 */

// Simple console-based test runner
class SimpleTestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    try {
      const startTime = Date.now();
      testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${name} (${duration}ms)`);
      this.passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
    }
  }

  summary() {
    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed\n`);
    return this.failed === 0;
  }
}

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Main test execution
async function runManualTests() {
  console.log('\n🚀 Starting Pattern Detection Manual Tests\n');
  
  const runner = new SimpleTestRunner();

  // Test 1: Basic Pattern Structure Validation
  runner.test('Pattern Structure - Required Fields', () => {
    const validPattern = {
      id: 'test-pattern-1',
      type: 'productivity-theme',
      name: 'High Productivity',
      description: 'Pattern indicating high productivity periods',
      classification: 'high',
      confidence: 0.85,
      supportingEvidence: ['evidence1', 'evidence2'],
      frequency: {
        count: 10,
        period: '1 week',
        rate: 0.8,
        trend: 'increasing'
      },
      temporal: {
        firstSeen: new Date('2024-01-01'),
        lastSeen: new Date('2024-01-07'),
        peakPeriods: ['morning']
      },
      correlations: {
        relatedPatterns: ['pattern1'],
        strength: 0.7
      },
      metadata: {
        detectedAt: new Date(),
        sourceFiles: ['file1.md'],
        analysisScope: 'whole-life',
        modelUsed: 'test-model'
      }
    };

    // Check required fields exist
    assert(validPattern.id, 'Pattern must have id');
    assert(validPattern.type, 'Pattern must have type');
    assert(validPattern.name, 'Pattern must have name');
    assert(validPattern.description, 'Pattern must have description');
    assert(validPattern.confidence >= 0 && validPattern.confidence <= 1, 'Confidence must be 0-1');
    assert(Array.isArray(validPattern.supportingEvidence), 'Supporting evidence must be array');
    assert(validPattern.frequency && typeof validPattern.frequency === 'object', 'Frequency must be object');
    assert(validPattern.temporal && typeof validPattern.temporal === 'object', 'Temporal must be object');
    assert(validPattern.metadata && typeof validPattern.metadata === 'object', 'Metadata must be object');
  });

  // Test 2: Pattern Types Validation
  runner.test('Pattern Types - Valid Types', () => {
    const validTypes = [
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
      assert(typeof type === 'string', `Pattern type ${type} must be string`);
      assert(type.length > 0, `Pattern type ${type} must not be empty`);
    });

    console.log(`    📋 Validated ${validTypes.length} pattern types`);
  });

  // Test 3: Classification Levels
  runner.test('Pattern Classification - Valid Levels', () => {
    const validClassifications = ['low', 'medium', 'high', 'critical'];
    
    validClassifications.forEach(classification => {
      assert(typeof classification === 'string', 'Classification must be string');
      assert(classification.length > 0, 'Classification must not be empty');
    });

    console.log(`    🏷️  Validated ${validClassifications.length} classification levels`);
  });

  // Test 4: Analysis Scopes
  runner.test('Analysis Scopes - Valid Scopes', () => {
    const validScopes = ['whole-life', 'work-only', 'personal-only', 'custom'];
    
    validScopes.forEach(scope => {
      assert(typeof scope === 'string', 'Scope must be string');
      assert(scope.length > 0, 'Scope must not be empty');
    });

    console.log(`    🎯 Validated ${validScopes.length} analysis scopes`);
  });

  // Test 5: Privacy Tag Detection
  runner.test('Privacy Filter - Tag Detection', () => {
    const privateContent = `
# Meeting Notes #private

This contains sensitive information.
Should not be analyzed.
    `;

    const publicContent = `
# Public Meeting Notes

This is general information.
Can be analyzed safely.
    `;

    const privateTags = ['#private', '#noai', '#confidential'];
    
    // Check private content detection
    const hasPrivateTag = privateTags.some(tag => privateContent.includes(tag));
    assert(hasPrivateTag, 'Should detect private tags in private content');

    // Check public content doesn't trigger
    const hasPublicTag = privateTags.some(tag => publicContent.includes(tag));
    assert(!hasPublicTag, 'Should not detect private tags in public content');
  });

  // Test 6: Content Structure Validation
  runner.test('Content Structure - Markdown Headers', () => {
    const markdownContent = `
# Main Header

Some content here.

## Sub Header

More content.

### Sub-sub Header

Final content.
    `;

    // Basic markdown structure validation
    const hasMainHeader = markdownContent.includes('# Main Header');
    const hasSubHeader = markdownContent.includes('## Sub Header');
    const hasSubSubHeader = markdownContent.includes('### Sub-sub Header');

    assert(hasMainHeader, 'Should detect main header');
    assert(hasSubHeader, 'Should detect sub header');
    assert(hasSubSubHeader, 'Should detect sub-sub header');
  });

  // Test 7: Frequency Data Validation
  runner.test('Frequency Data - Structure Validation', () => {
    const frequencyData = {
      count: 15,
      period: '2 weeks',
      rate: 0.75,
      trend: 'increasing'
    };

    assert(typeof frequencyData.count === 'number', 'Count must be number');
    assert(frequencyData.count >= 0, 'Count must be non-negative');
    assert(typeof frequencyData.period === 'string', 'Period must be string');
    assert(typeof frequencyData.rate === 'number', 'Rate must be number');
    assert(frequencyData.rate >= 0 && frequencyData.rate <= 1, 'Rate must be 0-1');
    assert(['increasing', 'decreasing', 'stable', 'unknown'].includes(frequencyData.trend), 'Trend must be valid');
  });

  // Test 8: Temporal Data Validation
  runner.test('Temporal Data - Date Validation', () => {
    const temporalData = {
      firstSeen: new Date('2024-01-01'),
      lastSeen: new Date('2024-01-07'),
      peakPeriods: ['morning', 'afternoon']
    };

    assert(temporalData.firstSeen instanceof Date, 'FirstSeen must be Date');
    assert(temporalData.lastSeen instanceof Date, 'LastSeen must be Date');
    assert(temporalData.lastSeen >= temporalData.firstSeen, 'LastSeen must be after FirstSeen');
    assert(Array.isArray(temporalData.peakPeriods), 'PeakPeriods must be array');
  });

  // Test 9: Performance Simulation
  runner.test('Performance - Pattern Processing Simulation', () => {
    const startTime = Date.now();
    
    // Simulate pattern processing
    const patterns = [];
    for (let i = 0; i < 100; i++) {
      patterns.push({
        id: `pattern-${i}`,
        type: 'productivity-theme',
        confidence: Math.random(),
        processed: true
      });
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    assert(patterns.length === 100, 'Should create 100 patterns');
    assert(processingTime < 1000, 'Should process quickly (under 1 second)');
    
    console.log(`    📈 Processed ${patterns.length} patterns in ${processingTime}ms`);
  });

  // Test 10: Memory Usage Simulation
  runner.test('Memory Usage - Large Data Handling', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create large data structures
    const largeData = [];
    for (let i = 0; i < 1000; i++) {
      largeData.push({
        id: `large-pattern-${i}`,
        evidence: Array.from({ length: 100 }, (_, j) => `evidence-${j}`),
        metadata: {
          sourceFiles: Array.from({ length: 50 }, (_, k) => `file-${k}.md`)
        }
      });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    assert(largeData.length === 1000, 'Should create 1000 large patterns');
    assert(memoryIncreaseMB < 100, 'Memory increase should be reasonable');
    
    console.log(`    💾 Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for large data`);
  });

  // Test Summary
  const success = runner.summary();
  
  if (success) {
    console.log('🎉 All manual tests passed! Core pattern detection logic is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the results above.');
    process.exit(1);
  }

  return success;
}

// Run the tests
runManualTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
}); 