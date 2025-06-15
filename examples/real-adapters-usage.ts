/**
 * Real AI Adapters Usage Examples
 * 
 * This file demonstrates how to use the OpenAI and Ollama adapters
 * for actual AI processing in the RetrospectAI plugin.
 */

import { Logger } from '../src/logger';
import { OpenAIAdapter } from '../src/openai-adapter';
import { OllamaAdapter } from '../src/ollama-adapter';
import { DefaultAIModelFactory } from '../src/ai-model-factory';
import {
  AIModelConfig
} from '../src/ai-interfaces';

/**
 * Example 1: OpenAI Adapter Usage
 */
async function openAIAdapterExample() {
  console.log('=== OpenAI Adapter Usage ===');
  
  const logger = new Logger('OpenAIExample', true);
  
  // Configuration for OpenAI
  const config: AIModelConfig = {
    name: 'openai-gpt4',
    type: 'cloud',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
  };

  try {
    const adapter = new OpenAIAdapter(logger, config);
    
    // Initialize the adapter
    await adapter.initialize();
    console.log('✅ OpenAI adapter initialized successfully');
    
    // Check capabilities
    console.log('📋 Capabilities:', adapter.capabilities);
    
    // Test basic completion
    const prompt = 'Analyze this personal reflection: "Today I completed my morning workout routine and felt energized throughout the day. I also made progress on my reading goal by finishing two chapters."';
    const completion = await adapter.generateCompletion(prompt);
    console.log('💬 Completion:', completion);
    
    // Test pattern extraction
    const sampleContent = `
    Daily Reflection - March 15, 2024
    
    Morning Routine:
    - Woke up at 6:00 AM (goal: 6:00 AM) ✅
    - 30-minute workout completed
    - Meditation: 10 minutes
    - Healthy breakfast: oatmeal with berries
    
    Work Progress:
    - Completed project proposal draft
    - Team meeting went well, good feedback
    - Struggled with time management in afternoon
    
    Personal Goals:
    - Reading: Finished 2 chapters of "Atomic Habits"
    - Learning: Practiced Spanish for 20 minutes
    - Health: Drank 8 glasses of water
    
    Challenges:
    - Got distracted by social media during work
    - Skipped evening walk due to rain
    
    Tomorrow's Focus:
    - Finish project proposal
    - Start new book chapter
    - Plan weekend activities
    `;
    
    const patterns = await adapter.extractPatterns(sampleContent);
    console.log('🔍 Extracted Patterns:', patterns.length);
    patterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern.title} (${pattern.type}) - Confidence: ${pattern.confidence}`);
    });
    
    // Test content analysis
    const analysis = await adapter.analyzeContent(sampleContent, 'daily-reflection');
    console.log('📊 Analysis Result:');
    console.log(`  Success: ${analysis.success}`);
    console.log(`  Patterns: ${analysis.patterns.length}`);
    console.log(`  Processing Time: ${analysis.processingTime}ms`);
    console.log(`  Summary: ${analysis.summary.substring(0, 100)}...`);
    
    // Test sentiment analysis
    const sentiment = await adapter.analyzeSentiment(sampleContent);
    console.log('😊 Sentiment:', sentiment);
    
    // Test classification
    const categories = ['daily-reflection', 'goal-tracking', 'habit-analysis', 'work-notes'];
    const classification = await adapter.classifyContent(sampleContent, categories);
    console.log('🏷️ Classification:', classification);
    
    // Clean up
    await adapter.dispose();
    console.log('✅ OpenAI adapter disposed');
    
  } catch (error) {
    console.error('❌ OpenAI adapter error:', error);
  }
}

/**
 * Example 2: Ollama Adapter Usage
 */
async function ollamaAdapterExample() {
  console.log('\n=== Ollama Adapter Usage ===');
  
  const logger = new Logger('OllamaExample', true);
  
  // Configuration for Ollama
  const config: AIModelConfig = {
    name: 'ollama-llama2',
    type: 'local',
    model: 'llama2',
    maxTokens: 1500,
    temperature: 0.8,
    endpoint: 'http://localhost:11434'
  };

  try {
    const adapter = new OllamaAdapter(logger, config);
    
    // Initialize the adapter
    await adapter.initialize();
    console.log('✅ Ollama adapter initialized successfully');
    
    // Check capabilities
    console.log('📋 Capabilities:', adapter.capabilities);
    
    // Test basic completion
    const prompt = 'Summarize the key insights from this personal development content in 2-3 sentences.';
    const completion = await adapter.generateCompletion(prompt);
    console.log('💬 Completion:', completion);
    
    // Test with personal content
    const personalContent = `
    Weekly Review - Week of March 11-17, 2024
    
    Achievements:
    - Maintained consistent morning routine (6/7 days)
    - Completed all work deadlines on time
    - Read 3 chapters of personal development book
    - Exercised 4 times this week
    
    Challenges:
    - Struggled with evening routine consistency
    - Procrastinated on personal project
    - Ate out more than planned (3 times)
    
    Insights:
    - Morning routine directly impacts daily productivity
    - Need better meal planning to avoid eating out
    - Personal projects need dedicated time blocks
    
    Next Week Goals:
    - Establish consistent evening routine
    - Dedicate 2 hours to personal project
    - Meal prep on Sunday
    `;
    
    // Test pattern extraction
    const patterns = await adapter.extractPatterns(personalContent);
    console.log('🔍 Extracted Patterns:', patterns.length);
    patterns.forEach((pattern, index) => {
      console.log(`  ${index + 1}. ${pattern.title} (${pattern.type}) - Confidence: ${pattern.confidence}`);
    });
    
    // Test content analysis
    const analysis = await adapter.analyzeContent(personalContent, 'weekly-review');
    console.log('📊 Analysis Result:');
    console.log(`  Success: ${analysis.success}`);
    console.log(`  Patterns: ${analysis.patterns.length}`);
    console.log(`  Processing Time: ${analysis.processingTime}ms`);
    console.log(`  Insights: ${analysis.insights.length}`);
    console.log(`  Recommendations: ${analysis.recommendations.length}`);
    
    // Clean up
    await adapter.dispose();
    console.log('✅ Ollama adapter disposed');
    
  } catch (error) {
    console.error('❌ Ollama adapter error:', error);
    console.log('💡 Make sure Ollama is running locally on port 11434');
  }
}

/**
 * Example 3: Using AI Model Factory
 */
async function factoryUsageExample() {
  console.log('\n=== AI Model Factory Usage ===');
  
  const logger = new Logger('FactoryExample', true);
  const factory = new DefaultAIModelFactory(logger);
  
  try {
    // List available adapters
    const adapters = await factory.getAvailableModels();
    console.log('🏭 Available Adapters:', adapters);
    
    // Create OpenAI adapter via factory
    const openAIConfig: AIModelConfig = {
      name: 'factory-openai',
      type: 'cloud',
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
    };
    
    const openAIAdapter = await factory.createModel(openAIConfig);
    console.log('✅ Created OpenAI adapter via factory');
    console.log('📋 Capabilities:', openAIAdapter.capabilities);
    
    // Create Ollama adapter via factory
    const ollamaConfig: AIModelConfig = {
      name: 'factory-ollama',
      type: 'local',
      model: 'ollama',
      maxTokens: 1000,
      temperature: 0.7,
      endpoint: 'http://localhost:11434'
    };
    
    const ollamaAdapter = await factory.createModel(ollamaConfig);
    console.log('✅ Created Ollama adapter via factory');
    console.log('📋 Capabilities:', ollamaAdapter.capabilities);
    
    // Test both adapters with the same content
    const testContent = 'Today I made significant progress on my goals and feel motivated to continue.';
    
    console.log('\n🔄 Testing both adapters with same content:');
    
    // OpenAI analysis
    try {
      const openAIResult = await openAIAdapter.generateCompletion(`Analyze this reflection: "${testContent}"`);
      console.log('🌐 OpenAI Result:', openAIResult.substring(0, 100) + '...');
    } catch (error) {
      console.log('❌ OpenAI failed:', error instanceof Error ? error.message : String(error));
    }
    
    // Ollama analysis
    try {
      const ollamaResult = await ollamaAdapter.generateCompletion(`Analyze this reflection: "${testContent}"`);
      console.log('🏠 Ollama Result:', ollamaResult.substring(0, 100) + '...');
    } catch (error) {
      console.log('❌ Ollama failed:', error instanceof Error ? error.message : String(error));
    }
    
    // Clean up
    await openAIAdapter.dispose();
    await ollamaAdapter.dispose();
    console.log('✅ All adapters disposed');
    
  } catch (error) {
    console.error('❌ Factory usage error:', error);
  }
}

/**
 * Example 4: Error Handling and Fallback
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const logger = new Logger('ErrorExample', true);
  
  // Test with invalid API key
  const invalidConfig: AIModelConfig = {
    name: 'invalid-openai',
    type: 'cloud',
    model: 'gpt-3.5-turbo',
    maxTokens: 1000,
    temperature: 0.7,
    apiKey: 'invalid-key'
  };
  
  try {
    const adapter = new OpenAIAdapter(logger, invalidConfig);
    await adapter.initialize();
  } catch (error) {
    console.log('❌ Expected error with invalid API key:', error instanceof Error ? error.message : String(error));
  }
  
  // Test with unavailable Ollama model
  const unavailableModelConfig: AIModelConfig = {
    name: 'unavailable-model',
    type: 'local',
    model: 'nonexistent-model',
    maxTokens: 1000,
    temperature: 0.7,
    endpoint: 'http://localhost:11434'
  };
  
  try {
    const adapter = new OllamaAdapter(logger, unavailableModelConfig);
    await adapter.initialize();
  } catch (error) {
    console.log('❌ Expected error with unavailable model:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Example 5: Performance Comparison
 */
async function performanceComparisonExample() {
  console.log('\n=== Performance Comparison ===');
  
  const logger = new Logger('PerfExample', true);
  const testContent = `
  Personal Development Log - March 2024
  
  This month I focused on building better habits and achieving my goals.
  I successfully maintained a morning routine, read 5 books, and exercised regularly.
  However, I struggled with time management and procrastination on some projects.
  
  Key insights:
  - Consistency in small habits leads to big results
  - Environment design is crucial for success
  - Regular reflection helps maintain motivation
  
  Areas for improvement:
  - Better planning and prioritization
  - Reducing digital distractions
  - Building stronger evening routines
  `;
  
  // Test OpenAI performance
  try {
    const openAIConfig: AIModelConfig = {
      name: 'perf-openai',
      type: 'cloud',
      model: 'gpt-3.5-turbo',
      maxTokens: 500,
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
    };
    
    const openAIAdapter = new OpenAIAdapter(logger, openAIConfig);
    await openAIAdapter.initialize();
    
    const startTime = Date.now();
    const openAIAnalysis = await openAIAdapter.analyzeContent(testContent);
    const openAITime = Date.now() - startTime;
    
    console.log(`🌐 OpenAI Performance: ${openAITime}ms`);
    console.log(`   Patterns: ${openAIAnalysis.patterns.length}`);
    console.log(`   Success: ${openAIAnalysis.success}`);
    
    await openAIAdapter.dispose();
  } catch (error) {
    console.log('❌ OpenAI performance test failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Test Ollama performance
  try {
    const ollamaConfig: AIModelConfig = {
      name: 'perf-ollama',
      type: 'local',
      model: 'llama2',
      maxTokens: 500,
      temperature: 0.7,
      endpoint: 'http://localhost:11434'
    };
    
    const ollamaAdapter = new OllamaAdapter(logger, ollamaConfig);
    await ollamaAdapter.initialize();
    
    const startTime = Date.now();
    const ollamaAnalysis = await ollamaAdapter.analyzeContent(testContent);
    const ollamaTime = Date.now() - startTime;
    
    console.log(`🏠 Ollama Performance: ${ollamaTime}ms`);
    console.log(`   Patterns: ${ollamaAnalysis.patterns.length}`);
    console.log(`   Success: ${ollamaAnalysis.success}`);
    
    await ollamaAdapter.dispose();
  } catch (error) {
    console.log('❌ Ollama performance test failed:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Starting Real AI Adapters Examples\n');
  
  await openAIAdapterExample();
  await ollamaAdapterExample();
  await factoryUsageExample();
  await errorHandlingExample();
  await performanceComparisonExample();
  
  console.log('\n✅ All examples completed!');
  console.log('\n📝 Notes:');
  console.log('- Set OPENAI_API_KEY environment variable for OpenAI examples');
  console.log('- Ensure Ollama is running locally for Ollama examples');
  console.log('- Some examples may fail if services are not available');
}

// Export for use in other files
export {
  openAIAdapterExample,
  ollamaAdapterExample,
  factoryUsageExample,
  errorHandlingExample,
  performanceComparisonExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
} 