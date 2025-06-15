/**
 * MockAIAdapter Usage Examples
 * 
 * This file demonstrates how to use the MockAIAdapter for testing
 * the AI abstraction layer without external dependencies.
 */

import { Logger } from '../src/logger';
import { MockAIAdapter, MockAdapterFactory, MockResponse } from '../src/mock-ai-adapter';
import { DefaultAIModelFactory } from '../src/ai-model-factory';
import {
  AIModelConfig,
  AICapability,
  DetectedPattern,
  AIError,
  AIErrorType
} from '../src/ai-interfaces';

/**
 * Example 1: Basic MockAIAdapter Usage
 */
async function basicUsageExample() {
  console.log('=== Basic MockAIAdapter Usage ===');
  
  const logger = new Logger('MockExample', true);
  const config: AIModelConfig = {
    name: 'test-mock',
    type: 'local',
    model: 'mock',
    maxTokens: 1000,
    temperature: 0.7
  };

  // Create and initialize the mock adapter
  const adapter = new MockAIAdapter(logger, config);
  await adapter.initialize();

  console.log('Adapter initialized:', adapter.name);
  console.log('Capabilities:', adapter.capabilities);
  console.log('Health status:', await adapter.getHealth());

  // Test basic completion
  const completion = await adapter.generateCompletion('What is artificial intelligence?');
  console.log('Completion result:', completion);

  // Test pattern extraction
  const patterns = await adapter.extractPatterns('I have been exercising daily for the past month. It has become a habit.');
  console.log('Extracted patterns:', patterns.length);
  patterns.forEach(pattern => {
    console.log(`- ${pattern.title}: ${pattern.description} (confidence: ${pattern.confidence})`);
  });

  // Test summary generation
  const summary = await adapter.generateSummary(patterns);
  console.log('Generated summary:', summary);

  await adapter.dispose();
}

/**
 * Example 2: Configurable Responses
 */
async function configurableResponsesExample() {
  console.log('\n=== Configurable Responses Example ===');
  
  const logger = new Logger('MockExample', true);
  const config: AIModelConfig = {
    name: 'scripted-mock',
    type: 'local',
    model: 'mock'
  };

  const adapter = new MockAIAdapter(logger, config, {
    simulateLatency: false, // Disable latency for faster testing
    trackRequests: true
  });
  
  await adapter.initialize();

  // Set predefined completion responses
  const completionResponses: MockResponse[] = [
    { content: 'First scripted response', tokensUsed: 25 },
    { content: 'Second scripted response', tokensUsed: 30 },
    { content: 'Third scripted response', tokensUsed: 35 }
  ];
  
  adapter.setCompletionResponses(completionResponses);

  // Test cycling through responses
  for (let i = 0; i < 5; i++) {
    const result = await adapter.generateCompletion(`Test prompt ${i + 1}`);
    console.log(`Response ${i + 1}:`, result);
  }

  // Check request history
  const history = adapter.getRequestHistory();
  console.log(`\nRequest history (${history.length} requests):`);
  history.forEach((request, index) => {
    console.log(`${index + 1}. ${request.method} - Duration: ${request.duration}ms`);
  });

  await adapter.dispose();
}

/**
 * Example 3: Error Simulation
 */
async function errorSimulationExample() {
  console.log('\n=== Error Simulation Example ===');
  
  const logger = new Logger('MockExample', true);
  const config: AIModelConfig = {
    name: 'error-mock',
    type: 'local',
    model: 'mock'
  };

  // Create adapter with 50% error rate
  const adapter = new MockAIAdapter(logger, config, {
    errorRate: 0.5,
    errorTypes: [AIErrorType.REQUEST_FAILED, AIErrorType.TIMEOUT],
    simulateLatency: false
  });
  
  await adapter.initialize();

  // Test multiple requests to see error simulation
  console.log('Testing error simulation (50% error rate):');
  for (let i = 0; i < 10; i++) {
    try {
      const result = await adapter.generateCompletion(`Test prompt ${i + 1}`);
      console.log(`✓ Request ${i + 1}: Success - ${result.substring(0, 50)}...`);
    } catch (error) {
      if (error instanceof AIError) {
        console.log(`✗ Request ${i + 1}: Error - ${error.type}: ${error.message}`);
      }
    }
  }

  // Test specific error simulation
  console.log('\nTesting specific error simulation:');
  const customError = new AIError(
    AIErrorType.RATE_LIMITED,
    'Rate limit exceeded for testing',
    undefined,
    true
  );
  
  adapter.simulateError(customError);
  
  try {
    await adapter.generateCompletion('This should fail');
  } catch (error) {
    if (error instanceof AIError) {
      console.log(`Expected error caught: ${error.type} - ${error.message}`);
    }
  }

  await adapter.dispose();
}

/**
 * Example 4: Performance Testing with Latency
 */
async function performanceTestingExample() {
  console.log('\n=== Performance Testing Example ===');
  
  const logger = new Logger('MockExample', true);
  const config: AIModelConfig = {
    name: 'slow-mock',
    type: 'local',
    model: 'mock'
  };

  // Create slow adapter for performance testing
  const adapter = MockAdapterFactory.createSlowAdapter(logger, config);
  await adapter.initialize();

  console.log('Testing with high latency simulation...');
  
  const startTime = Date.now();
  await adapter.generateCompletion('Test slow response');
  const duration = Date.now() - startTime;
  
  console.log(`Request completed in ${duration}ms (expected >2000ms)`);

  await adapter.dispose();
}

/**
 * Example 5: Limited Capabilities Testing
 */
async function limitedCapabilitiesExample() {
  console.log('\n=== Limited Capabilities Example ===');
  
  const logger = new Logger('MockExample', true);
  const config: AIModelConfig = {
    name: 'limited-mock',
    type: 'local',
    model: 'mock'
  };

  // Create adapter with limited capabilities
  const limitedCapabilities: AICapability[] = ['text-completion', 'summarization'];
  const adapter = MockAdapterFactory.createLimitedAdapter(logger, config, limitedCapabilities);
  await adapter.initialize();

  console.log('Available capabilities:', adapter.capabilities);

  // Test enabled capability
  try {
    const result = await adapter.generateCompletion('Test completion');
    console.log('✓ Text completion works:', result.substring(0, 50) + '...');
  } catch (error) {
    console.log('✗ Text completion failed:', error);
  }

  // Test disabled capability
  try {
    await adapter.extractPatterns('Test content for pattern extraction');
    console.log('✓ Pattern extraction works (unexpected)');
  } catch (error) {
    if (error instanceof AIError) {
      console.log('✓ Pattern extraction correctly blocked:', error.message);
    }
  }

  await adapter.dispose();
}

/**
 * Example 6: Factory Integration
 */
async function factoryIntegrationExample() {
  console.log('\n=== Factory Integration Example ===');
  
  const logger = new Logger('MockExample', true);
  
  // Create adapter through factory
  const factory = new DefaultAIModelFactory(logger);
  const adapter = await factory.createModel({
    name: 'factory-mock',
    type: 'local',
    model: 'mock'
  });

  console.log('Adapter created through factory:', adapter.name);
  console.log('Adapter type:', adapter.constructor.name);

  // Verify it's a MockAIAdapter
  if (adapter instanceof MockAIAdapter) {
    console.log('✓ Successfully created MockAIAdapter through factory');
    
    // Test functionality
    const result = await adapter.generateCompletion('Factory test');
    console.log('Factory adapter result:', result.substring(0, 50) + '...');
  } else {
    console.log('✗ Unexpected adapter type');
  }

  await adapter.dispose();
}

/**
 * Example 7: Complex Testing Scenario
 */
async function complexTestingScenario() {
  console.log('\n=== Complex Testing Scenario ===');
  
  const logger = new Logger('MockExample', true);
  const config: AIModelConfig = {
    name: 'complex-mock',
    type: 'local',
    model: 'mock'
  };

  // Create scripted adapter with predefined responses
  const mockPatterns: DetectedPattern[] = [
    {
      id: 'habit-1',
      type: 'habit',
      title: 'Morning Exercise',
      description: 'Daily morning workout routine',
      confidence: 0.9,
      evidence: ['Exercised at 7 AM', 'Consistent for 30 days'],
      metadata: {
        sourceFiles: ['journal-march.md'],
        keywords: ['exercise', 'morning', 'routine'],
        sentiment: 'positive',
        importance: 'high',
        category: 'health'
      }
    },
    {
      id: 'goal-1',
      type: 'goal',
      title: 'Learn TypeScript',
      description: 'Goal to master TypeScript programming',
      confidence: 0.8,
      evidence: ['Started TypeScript course', 'Built sample projects'],
      metadata: {
        sourceFiles: ['learning-log.md'],
        keywords: ['typescript', 'programming', 'learning'],
        sentiment: 'positive',
        importance: 'medium',
        category: 'education'
      }
    }
  ];

  const adapter = MockAdapterFactory.createScriptedAdapter(logger, config, {
    completions: [
      { content: 'Based on your journal entries, I can see clear patterns of personal growth and habit formation.' },
      { content: 'Your consistency in morning exercise shows strong commitment to health goals.' }
    ],
    patterns: [mockPatterns],
    summaries: [
      { content: 'Summary: You have established strong morning exercise habits and are making progress on learning goals.' }
    ]
  });

  await adapter.initialize();

  console.log('Running complex analysis workflow...');

  // Step 1: Analyze content
  const analysisResult = await adapter.analyzeContent('March journal entries with exercise and learning notes');
  console.log('Analysis success:', analysisResult.success);
  console.log('Patterns found:', analysisResult.patterns.length);
  console.log('Insights:', analysisResult.insights.length);

  // Step 2: Extract specific patterns
  const extractedPatterns = await adapter.extractPatterns('Daily exercise logs and learning progress notes');
  console.log('\nExtracted patterns:');
  extractedPatterns.forEach(pattern => {
    console.log(`- ${pattern.title} (${pattern.type}): ${pattern.description}`);
    console.log(`  Confidence: ${pattern.confidence}, Evidence: ${pattern.evidence.length} items`);
  });

  // Step 3: Generate summary
  const summary = await adapter.generateSummary(extractedPatterns);
  console.log('\nGenerated summary:', summary);

  // Step 4: Additional analysis
  const sentiment = await adapter.analyzeSentiment('I feel great about my progress this month!');
  console.log('\nSentiment analysis:', sentiment);

  const classification = await adapter.classifyContent('Exercise routine and learning goals', ['health', 'education', 'work']);
  console.log('Content classification:', classification);

  // Check request history
  const history = adapter.getRequestHistory();
  console.log(`\nCompleted ${history.length} AI operations in workflow`);

  await adapter.dispose();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await basicUsageExample();
    await configurableResponsesExample();
    await errorSimulationExample();
    await performanceTestingExample();
    await limitedCapabilitiesExample();
    await factoryIntegrationExample();
    await complexTestingScenario();
    
    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other files
export {
  basicUsageExample,
  configurableResponsesExample,
  errorSimulationExample,
  performanceTestingExample,
  limitedCapabilitiesExample,
  factoryIntegrationExample,
  complexTestingScenario,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
} 