/**
 * AI Service Orchestrator Usage Examples
 * 
 * This file demonstrates how to use the AIServiceOrchestrator for various
 * RetrospectAI scenarios including setup, configuration, and analysis workflows.
 */

import { Logger } from '../src/logger';
import { AIServiceOrchestrator, OrchestratorConfig, RequestContext, RetrospectAnalysisOptions } from '../src/ai-service-orchestrator';
import { AIModelConfig } from '../src/ai-interfaces';

// Example 1: Basic Setup with Multiple Adapters
async function basicOrchestratorSetup() {
  console.log('=== Basic Orchestrator Setup ===');
  
  const logger = new Logger('orchestrator-example', true);
  
  // Configure orchestrator for balanced performance and privacy
  const config: OrchestratorConfig = {
    primaryAdapter: 'openai-gpt4',
    fallbackAdapters: ['ollama-llama2', 'mock-adapter'],
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffMultiplier: 2,
    requestTimeout: 30000,
    privacyLevel: 'hybrid',
    preferLocalModels: false,
    minimumConfidence: 0.7,
    requireConsensus: false
  };
  
  const orchestrator = new AIServiceOrchestrator(logger, config);
  
  // Configure multiple adapters
  const adapterConfigs = new Map<string, AIModelConfig>([
    ['openai-gpt4', {
      name: 'openai-gpt4',
      type: 'cloud',
      endpoint: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.7
    }],
    ['ollama-llama2', {
      name: 'ollama-llama2',
      type: 'local',
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      maxTokens: 1500,
      temperature: 0.6
    }],
    ['mock-adapter', {
      name: 'mock-adapter',
      type: 'local',
      model: 'mock-model'
    }]
  ]);
  
  try {
    await orchestrator.initialize(adapterConfigs);
    console.log('✅ Orchestrator initialized successfully');
    
    // Check adapter status
    const status = await orchestrator.getAdapterStatus();
    console.log('📊 Adapter Status:');
    for (const [name, info] of status) {
      console.log(`  ${name}: ${info.healthy ? '✅' : '❌'} (${info.capabilities.length} capabilities)`);
    }
    
    return orchestrator;
  } catch (error) {
    console.error('❌ Failed to initialize orchestrator:', error);
    throw error;
  }
}

// Example 2: Privacy-Focused Configuration
async function privacyFocusedSetup() {
  console.log('\n=== Privacy-Focused Setup ===');
  
  const logger = new Logger('privacy-orchestrator', true);
  
  // Configure for maximum privacy with local models preferred
  const config: OrchestratorConfig = {
    primaryAdapter: 'ollama-llama2',
    fallbackAdapters: ['ollama-mistral'],
    privacyLevel: 'local',
    preferLocalModels: true,
    maxRetries: 2,
    retryDelay: 500,
    minimumConfidence: 0.6
  };
  
  const orchestrator = new AIServiceOrchestrator(logger, config);
  
  const adapterConfigs = new Map<string, AIModelConfig>([
    ['ollama-llama2', {
      name: 'ollama-llama2',
      type: 'local',
      endpoint: 'http://localhost:11434',
      model: 'llama2',
      maxTokens: 1500
    }],
    ['ollama-mistral', {
      name: 'ollama-mistral',
      type: 'local',
      endpoint: 'http://localhost:11434',
      model: 'mistral',
      maxTokens: 1500
    }]
  ]);
  
  await orchestrator.initialize(adapterConfigs);
  console.log('✅ Privacy-focused orchestrator ready');
  
  return orchestrator;
}

// Example 3: Daily Reflection Analysis
async function dailyReflectionAnalysis(orchestrator: AIServiceOrchestrator) {
  console.log('\n=== Daily Reflection Analysis ===');
  
  const dailyContent = `
Today was a productive day. I completed my morning workout routine and felt energized throughout the day.
Had a great meeting with the team where we discussed the new project roadmap. I'm excited about the challenges ahead.
Spent some time reading about mindfulness practices and tried a 10-minute meditation session.
Need to work on better time management - got distracted by social media a few times.
Overall feeling grateful for the progress I'm making on my personal goals.
  `;
  
  const analysisOptions: RetrospectAnalysisOptions = {
    extractPatterns: true,
    generateSummary: true,
    identifyGoals: true,
    trackHabits: true,
    analyzeMood: true,
    suggestActions: true,
    privacyLevel: 'local',
    analysisDepth: 'comprehensive'
  };
  
  const context: RequestContext = {
    contentType: 'daily-reflection',
    privacyLevel: 'local',
    urgency: 'low',
    complexity: 'medium',
    requiredCapabilities: ['pattern-extraction', 'sentiment-analysis', 'summarization']
  };
  
  try {
    const result = await orchestrator.analyzePersonalContent(dailyContent, analysisOptions, context);
    
    console.log('📝 Analysis Results:');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`⏱️ Processing Time: ${result.processingTime}ms`);
    console.log(`🤖 Model Used: ${result.modelUsed}`);
    
    console.log('\n📋 Summary:');
    console.log(result.summary);
    
    console.log('\n🔍 Patterns Found:');
    result.patterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern.title} (${pattern.type})`);
      console.log(`     Confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
      console.log(`     ${pattern.description}`);
    });
    
    console.log('\n💡 Insights:');
    result.insights.forEach((insight, index) => {
      console.log(`  ${index + 1}. ${insight}`);
    });
    
    console.log('\n🎯 Recommendations:');
    result.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    console.log('\n🔧 Orchestrator Metadata:');
    const meta = result.orchestratorMetadata;
    console.log(`  Adapters Used: ${meta.adaptersUsed.join(', ')}`);
    console.log(`  Fallbacks Triggered: ${meta.fallbacksTriggered}`);
    console.log(`  Retries Attempted: ${meta.retriesAttempted}`);
    console.log(`  Routing Decision: ${meta.routingDecision}`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Example 4: Goal Review with Consensus
async function goalReviewWithConsensus(orchestrator: AIServiceOrchestrator) {
  console.log('\n=== Goal Review with Consensus ===');
  
  const goalContent = `
Q1 Goals Review:
1. Fitness: Aimed to work out 4x per week - achieved 3.2x average. Good progress but room for improvement.
2. Learning: Wanted to complete 2 online courses - completed 1.5 courses. TypeScript course done, React course 50% complete.
3. Reading: Goal was 12 books - read 8 books so far. Behind schedule but quality reads.
4. Side Project: Launch MVP - 80% complete, delayed due to scope creep.
5. Networking: Attend 6 events - attended 4 events, made valuable connections.

Overall feeling positive about progress despite not hitting all targets perfectly.
  `;
  
  // Configure for consensus analysis (example configuration)
  // const consensusOrchestrator = new AIServiceOrchestrator(
  //   new Logger('consensus-orchestrator', true),
  //   {
  //     requireConsensus: true,
  //     consensusThreshold: 0.7,
  //     minimumConfidence: 0.8
  //   }
  // );
  
  // Note: In a real scenario, you would initialize consensusOrchestrator with adapters
  // For this example, we'll use the main orchestrator
  
  const context: RequestContext = {
    contentType: 'goal-review',
    privacyLevel: 'hybrid',
    urgency: 'medium',
    complexity: 'complex',
    requiredCapabilities: ['sentiment-analysis', 'classification', 'summarization']
  };
  
  try {
    // Analyze sentiment with consensus
    const sentiment = await orchestrator.analyzeSentiment(goalContent, context);
    console.log(`😊 Sentiment Analysis (Consensus): ${sentiment.sentiment} (${(sentiment.confidence * 100).toFixed(1)}%)`);
    
    // Extract patterns
    const patterns = await orchestrator.extractPatterns(goalContent, context);
    console.log(`\n🔍 Extracted ${patterns.length} patterns:`);
    patterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern.title} - ${pattern.type}`);
    });
    
  } catch (error) {
    console.error('❌ Consensus analysis failed:', error);
  }
}

// Example 5: Habit Tracking Analysis
async function habitTrackingAnalysis(orchestrator: AIServiceOrchestrator) {
  console.log('\n=== Habit Tracking Analysis ===');
  
  const habitData = `
Weekly Habit Tracking:
- Morning meditation: 5/7 days ✅
- Exercise: 4/7 days (missed Wed, Sat, Sun)
- Reading before bed: 6/7 days ✅
- Journaling: 3/7 days (need improvement)
- Healthy breakfast: 7/7 days ✅
- Screen time limit: 2/7 days (major issue)
- Water intake (8 glasses): 4/7 days

Observations: Weekends are challenging for maintaining routines.
Stress at work affected journaling consistency.
  `;
  
  const context: RequestContext = {
    contentType: 'habit-tracking',
    privacyLevel: 'local',
    urgency: 'low',
    complexity: 'simple',
    requiredCapabilities: ['pattern-extraction', 'classification']
  };
  
  try {
    const result = await orchestrator.analyzePersonalContent(
      habitData,
      {
        extractPatterns: true,
        trackHabits: true,
        suggestActions: true,
        analysisDepth: 'standard'
      },
      context
    );
    
    console.log('📊 Habit Analysis Results:');
    console.log(`Success Rate Patterns: ${result.patterns.length} identified`);
    
    result.patterns.forEach(pattern => {
      if (pattern.type === 'habit') {
        console.log(`  📈 ${pattern.title}: ${pattern.description}`);
      }
    });
    
    console.log('\n🎯 Habit Improvement Suggestions:');
    result.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
  } catch (error) {
    console.error('❌ Habit analysis failed:', error);
  }
}

// Example 6: Performance Monitoring
async function performanceMonitoring(orchestrator: AIServiceOrchestrator) {
  console.log('\n=== Performance Monitoring ===');
  
  const metrics = orchestrator.getMetrics();
  
  console.log('📊 Orchestrator Performance Metrics:');
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
  console.log(`  Average Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`);
  console.log(`  Fallbacks Used: ${metrics.fallbackUsageCount}`);
  console.log(`  Retries: ${metrics.retryCount}`);
  console.log(`  Last Activity: ${metrics.lastActivity.toISOString()}`);
  
  console.log('\n🤖 Adapter Usage Statistics:');
  for (const [adapter, count] of metrics.adapterUsageStats) {
    console.log(`  ${adapter}: ${count} requests`);
  }
}

// Example 7: Error Handling and Fallbacks
async function errorHandlingDemo(orchestrator: AIServiceOrchestrator) {
  console.log('\n=== Error Handling Demo ===');
  
  // Simulate a request that might fail
  const problematicContent = ""; // Empty content to potentially trigger errors
  
  const context: RequestContext = {
    contentType: 'general',
    privacyLevel: 'cloud',
    urgency: 'high',
    preferredAdapter: 'non-existent-adapter' // This will trigger fallback
  };
  
  try {
    const result = await orchestrator.analyzePersonalContent(
      problematicContent,
      { analysisDepth: 'quick' },
      context
    );
    
    console.log('🔄 Fallback Analysis Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Fallbacks Triggered: ${result.orchestratorMetadata.fallbacksTriggered}`);
    console.log(`  Routing Decision: ${result.orchestratorMetadata.routingDecision}`);
    
    if (result.error) {
      console.log(`  Error Handled: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Even fallback failed:', error);
  }
}

// Main execution function
async function runOrchestratorExamples() {
  try {
    console.log('🚀 Starting AI Service Orchestrator Examples\n');
    
    // Basic setup
    const orchestrator = await basicOrchestratorSetup();
    
    // Privacy-focused setup
    const privacyOrchestrator = await privacyFocusedSetup();
    
    // Analysis examples
    await dailyReflectionAnalysis(orchestrator);
    await goalReviewWithConsensus(orchestrator);
    await habitTrackingAnalysis(privacyOrchestrator);
    
    // Monitoring and error handling
    await performanceMonitoring(orchestrator);
    await errorHandlingDemo(orchestrator);
    
    // Cleanup
    await orchestrator.dispose();
    await privacyOrchestrator.dispose();
    
    console.log('\n✅ All orchestrator examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export for use in other files
export {
  basicOrchestratorSetup,
  privacyFocusedSetup,
  dailyReflectionAnalysis,
  goalReviewWithConsensus,
  habitTrackingAnalysis,
  performanceMonitoring,
  errorHandlingDemo,
  runOrchestratorExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runOrchestratorExamples().catch(console.error);
} 