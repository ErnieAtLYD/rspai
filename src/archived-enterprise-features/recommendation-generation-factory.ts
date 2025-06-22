// Recommendation Generation Factory
// Creates specialized recommendation generators for different use cases and domains

import { 
  RecommendationGenerator,
  RecommendationGenerationConfig,
  type RecommendationGeneratorFactory
} from './recommendation-generation-interfaces';

import { CoreRecommendationGenerator } from './recommendation-generation-engine';
import { AIModelAdapter } from './ai-interfaces';

export class RecommendationFactory implements RecommendationGeneratorFactory {
  
  createForPersonalDevelopment(aiModel?: AIModelAdapter): RecommendationGenerator {
    const config: RecommendationGenerationConfig = {
      strategy: 'balanced',
      enableAIGeneration: !!aiModel,
      fallbackToTemplates: true,
      maxRecommendations: 8,
      minConfidenceThreshold: 0.4,
      includeRiskAssessment: true,
      includeActionSteps: true,
      includeAlternatives: true,
      excludeTypes: [],
      prioritizeUrgency: false, // Focus on long-term growth
      balanceByCategory: true,
      
      userPreferences: {
        preferredDirectness: 'recommendation',
        preferredTimeframes: ['medium-term', 'long-term'],
        preferredTypes: ['habit', 'learning', 'reflection', 'goal'],
        riskTolerance: 'medium',
        detailLevel: 'comprehensive',
        includePersonalTouch: true
      },
      
      contextualFactors: {
        currentLifePhase: 'mid-career',
        availableTime: 'moderate',
        currentStressLevel: 'medium',
        majorLifeEvents: [],
        seasonalFactors: [],
        workContext: 'hybrid'
      },
      
      enableDuplicateDetection: true,
      enableFeasibilityCheck: true,
      enableImpactAssessment: true,
      aiModel,
      temperature: 0.7,
      maxTokens: 600
    };
    
    const generator = new CoreRecommendationGenerator(config);
    this.addPersonalDevelopmentTemplates(generator);
    return generator;
  }

  createForProductivity(aiModel?: AIModelAdapter): RecommendationGenerator {
    const config: RecommendationGenerationConfig = {
      strategy: 'aggressive',
      enableAIGeneration: !!aiModel,
      fallbackToTemplates: true,
      maxRecommendations: 10,
      minConfidenceThreshold: 0.3,
      includeRiskAssessment: false, // Focus on action
      includeActionSteps: true,
      includeAlternatives: true,
      excludeTypes: ['reflection'], // Less introspective
      prioritizeUrgency: true,
      balanceByCategory: false, // Allow productivity focus
      
      userPreferences: {
        preferredDirectness: 'strong-recommendation',
        preferredTimeframes: ['immediate', 'short-term'],
        preferredTypes: ['action', 'optimization', 'productivity', 'habit'],
        riskTolerance: 'high',
        detailLevel: 'standard',
        includePersonalTouch: false
      },
      
      contextualFactors: {
        currentLifePhase: 'early-career',
        availableTime: 'limited',
        currentStressLevel: 'high',
        majorLifeEvents: [],
        seasonalFactors: [],
        workContext: 'office'
      },
      
      enableDuplicateDetection: true,
      enableFeasibilityCheck: true,
      enableImpactAssessment: true,
      aiModel,
      temperature: 0.5, // More focused
      maxTokens: 400
    };
    
    const generator = new CoreRecommendationGenerator(config);
    this.addProductivityTemplates(generator);
    return generator;
  }

  createForWellness(aiModel?: AIModelAdapter): RecommendationGenerator {
    const config: RecommendationGenerationConfig = {
      strategy: 'conservative',
      enableAIGeneration: !!aiModel,
      fallbackToTemplates: true,
      maxRecommendations: 6,
      minConfidenceThreshold: 0.5,
      includeRiskAssessment: true,
      includeActionSteps: true,
      includeAlternatives: true,
      excludeTypes: ['decision'], // Avoid pressure
      prioritizeUrgency: false,
      balanceByCategory: true,
      
      userPreferences: {
        preferredDirectness: 'suggestion',
        preferredTimeframes: ['medium-term', 'long-term'],
        preferredTypes: ['health', 'habit', 'reflection', 'prevention'],
        riskTolerance: 'low',
        detailLevel: 'comprehensive',
        includePersonalTouch: true
      },
      
      contextualFactors: {
        currentLifePhase: 'mid-career',
        availableTime: 'flexible',
        currentStressLevel: 'medium',
        majorLifeEvents: [],
        seasonalFactors: [],
        workContext: 'remote'
      },
      
      enableDuplicateDetection: true,
      enableFeasibilityCheck: true,
      enableImpactAssessment: true,
      aiModel,
      temperature: 0.8, // More creative/gentle
      maxTokens: 500
    };
    
    const generator = new CoreRecommendationGenerator(config);
    this.addWellnessTemplates(generator);
    return generator;
  }

  createForCareer(aiModel?: AIModelAdapter): RecommendationGenerator {
    const config: RecommendationGenerationConfig = {
      strategy: 'balanced',
      enableAIGeneration: !!aiModel,
      fallbackToTemplates: true,
      maxRecommendations: 8,
      minConfidenceThreshold: 0.4,
      includeRiskAssessment: true,
      includeActionSteps: true,
      includeAlternatives: true,
      excludeTypes: ['health'], // Focus on professional
      prioritizeUrgency: true,
      balanceByCategory: false,
      
      userPreferences: {
        preferredDirectness: 'recommendation',
        preferredTimeframes: ['short-term', 'medium-term', 'long-term'],
        preferredTypes: ['career', 'learning', 'optimization', 'goal', 'decision'],
        riskTolerance: 'medium',
        detailLevel: 'comprehensive',
        includePersonalTouch: false
      },
      
      contextualFactors: {
        currentLifePhase: 'early-career',
        availableTime: 'moderate',
        currentStressLevel: 'medium',
        majorLifeEvents: [],
        seasonalFactors: [],
        workContext: 'hybrid'
      },
      
      enableDuplicateDetection: true,
      enableFeasibilityCheck: true,
      enableImpactAssessment: true,
      aiModel,
      temperature: 0.6,
      maxTokens: 550
    };
    
    const generator = new CoreRecommendationGenerator(config);
    this.addCareerTemplates(generator);
    return generator;
  }

  createCustom(config: RecommendationGenerationConfig): RecommendationGenerator {
    return new CoreRecommendationGenerator(config);
  }

  // Template addition methods
  private addPersonalDevelopmentTemplates(generator: RecommendationGenerator): void {
    // Habit Development Template
    generator.addTemplate({
      id: 'personal-habit-development',
      name: 'Personal Habit Development',
      type: 'habit',
      category: 'habits',
      titleTemplate: 'Develop a {{habit_type}} habit for {{benefit}}',
      descriptionTemplate: 'Based on your pattern of {{insight_description}}, developing a consistent {{habit_type}} habit could help you {{expected_outcome}}. Start small and build gradually for sustainable change.',
      actionStepsTemplate: [
        'Define the specific habit you want to develop',
        'Start with a minimal viable version (2-5 minutes daily)',
        'Choose a consistent time and trigger',
        'Track your progress daily',
        'Gradually increase intensity after 2 weeks'
      ],
      applicableInsightTypes: ['pattern', 'observation'],
      minimumConfidence: 0.4,
      requiredEvidence: 2,
      variables: ['habit_type', 'benefit', 'insight_description', 'expected_outcome'],
      variations: [
        {
          condition: 'high_stress',
          descriptionVariation: 'Given your current stress levels, developing a {{habit_type}} habit could provide valuable {{benefit}}. Focus on consistency over intensity.',
          directnessAdjustment: 'suggestion'
        }
      ],
      usage: 'frequent',
      effectiveness: 0.8
    });

    // Learning Goal Template
    generator.addTemplate({
      id: 'personal-learning-goal',
      name: 'Personal Learning Goal',
      type: 'learning',
      category: 'learning',
      titleTemplate: 'Learn {{skill_area}} to {{improvement_goal}}',
      descriptionTemplate: 'Your insights suggest an opportunity to develop {{skill_area}} skills. This could help you {{improvement_goal}} and align with your personal growth objectives.',
      actionStepsTemplate: [
        'Research learning resources and methods',
        'Set aside dedicated learning time (15-30 minutes daily)',
        'Find a learning community or accountability partner',
        'Practice regularly with real-world applications',
        'Review and adjust your learning approach monthly'
      ],
      applicableInsightTypes: ['opportunity', 'recommendation'],
      minimumConfidence: 0.5,
      requiredEvidence: 1,
      variables: ['skill_area', 'improvement_goal'],
      variations: [],
      usage: 'frequent',
      effectiveness: 0.75
    });

    // Reflection Practice Template
    generator.addTemplate({
      id: 'personal-reflection-practice',
      name: 'Personal Reflection Practice',
      type: 'reflection',
      category: 'wellbeing',
      titleTemplate: 'Establish a {{reflection_type}} reflection practice',
      descriptionTemplate: 'Regular {{reflection_type}} reflection could help you better understand {{insight_area}} and make more intentional decisions about {{focus_area}}.',
      actionStepsTemplate: [
        'Choose a consistent time for reflection',
        'Start with 5-10 minutes of focused thinking',
        'Use guided questions or prompts',
        'Write down key insights and patterns',
        'Review your reflections weekly to identify trends'
      ],
      applicableInsightTypes: ['pattern', 'observation'],
      minimumConfidence: 0.3,
      requiredEvidence: 1,
      variables: ['reflection_type', 'insight_area', 'focus_area'],
      variations: [],
      usage: 'occasional',
      effectiveness: 0.7
    });
  }

  private addProductivityTemplates(generator: RecommendationGenerator): void {
    // Process Optimization Template
    generator.addTemplate({
      id: 'productivity-process-optimization',
      name: 'Process Optimization',
      type: 'optimization',
      category: 'productivity',
      titleTemplate: 'Optimize your {{process_name}} process',
      descriptionTemplate: 'Your data shows inefficiencies in {{process_name}}. Streamlining this process could save you {{time_savings}} and improve {{quality_metric}}.',
      actionStepsTemplate: [
        'Document your current process step-by-step',
        'Identify bottlenecks and redundancies',
        'Research automation or tool solutions',
        'Implement one improvement at a time',
        'Measure results and iterate'
      ],
      applicableInsightTypes: ['pattern', 'anomaly'],
      minimumConfidence: 0.4,
      requiredEvidence: 2,
      variables: ['process_name', 'time_savings', 'quality_metric'],
      variations: [],
      usage: 'frequent',
      effectiveness: 0.85
    });

    // Time Management Action Template
    generator.addTemplate({
      id: 'productivity-time-management',
      name: 'Time Management Action',
      type: 'action',
      category: 'productivity',
      titleTemplate: 'Implement {{technique_name}} for better time management',
      descriptionTemplate: 'Based on your time usage patterns, implementing {{technique_name}} could help you {{expected_benefit}} and reduce {{current_problem}}.',
      actionStepsTemplate: [
        'Learn the {{technique_name}} method',
        'Set up necessary tools or systems',
        'Start with a 1-week trial period',
        'Track your productivity metrics',
        'Adjust the approach based on results'
      ],
      applicableInsightTypes: ['pattern', 'observation'],
      minimumConfidence: 0.5,
      requiredEvidence: 2,
      variables: ['technique_name', 'expected_benefit', 'current_problem'],
      variations: [],
      usage: 'frequent',
      effectiveness: 0.8
    });
  }

  private addWellnessTemplates(generator: RecommendationGenerator): void {
    // Stress Management Template
    generator.addTemplate({
      id: 'wellness-stress-management',
      name: 'Stress Management',
      type: 'health',
      category: 'wellbeing',
      titleTemplate: 'Develop {{stress_technique}} for stress management',
      descriptionTemplate: 'Your patterns suggest elevated stress levels around {{stress_trigger}}. Developing {{stress_technique}} practices could help you manage stress more effectively.',
      actionStepsTemplate: [
        'Learn about {{stress_technique}} techniques',
        'Practice for 5-10 minutes daily',
        'Use the technique when you notice stress signals',
        'Track your stress levels and technique usage',
        'Gradually expand your stress management toolkit'
      ],
      applicableInsightTypes: ['pattern', 'warning'],
      minimumConfidence: 0.4,
      requiredEvidence: 2,
      variables: ['stress_technique', 'stress_trigger'],
      variations: [
        {
          condition: 'high_stress',
          descriptionVariation: 'Given your current high stress levels, it\'s especially important to develop {{stress_technique}} practices. Start gently and be patient with yourself.',
          directnessAdjustment: 'suggestion'
        }
      ],
      usage: 'frequent',
      effectiveness: 0.75
    });

    // Sleep Improvement Template
    generator.addTemplate({
      id: 'wellness-sleep-improvement',
      name: 'Sleep Improvement',
      type: 'habit',
      category: 'wellbeing',
      titleTemplate: 'Improve your sleep quality through {{sleep_strategy}}',
      descriptionTemplate: 'Your sleep patterns show {{sleep_issue}}. Implementing {{sleep_strategy}} could help improve your sleep quality and overall well-being.',
      actionStepsTemplate: [
        'Establish a consistent bedtime routine',
        'Create a sleep-friendly environment',
        'Limit screen time before bed',
        'Track your sleep patterns',
        'Adjust your approach based on what works'
      ],
      applicableInsightTypes: ['pattern', 'observation'],
      minimumConfidence: 0.5,
      requiredEvidence: 3,
      variables: ['sleep_strategy', 'sleep_issue'],
      variations: [],
      usage: 'frequent',
      effectiveness: 0.8
    });
  }

  private addCareerTemplates(generator: RecommendationGenerator): void {
    // Skill Development Template
    generator.addTemplate({
      id: 'career-skill-development',
      name: 'Career Skill Development',
      type: 'learning',
      category: 'learning',
      titleTemplate: 'Develop {{skill_name}} skills for career advancement',
      descriptionTemplate: 'Your career patterns suggest that developing {{skill_name}} skills could significantly impact your {{career_goal}}. This aligns with current industry trends and your professional trajectory.',
      actionStepsTemplate: [
        'Assess your current skill level',
        'Identify specific learning objectives',
        'Find relevant courses, books, or mentors',
        'Practice skills in real work projects',
        'Seek feedback and iterate'
      ],
      applicableInsightTypes: ['opportunity', 'recommendation'],
      minimumConfidence: 0.5,
      requiredEvidence: 2,
      variables: ['skill_name', 'career_goal'],
      variations: [],
      usage: 'frequent',
      effectiveness: 0.85
    });

    // Network Building Template
    generator.addTemplate({
      id: 'career-network-building',
      name: 'Professional Network Building',
      type: 'action',
      category: 'relationships',
      titleTemplate: 'Build your professional network in {{target_area}}',
      descriptionTemplate: 'Your career insights suggest that expanding your network in {{target_area}} could open new opportunities and provide valuable {{expected_benefit}}.',
      actionStepsTemplate: [
        'Identify key people and organizations in {{target_area}}',
        'Attend relevant industry events or online communities',
        'Engage meaningfully with content and discussions',
        'Offer value before asking for help',
        'Maintain regular contact with new connections'
      ],
      applicableInsightTypes: ['opportunity', 'recommendation'],
      minimumConfidence: 0.4,
      requiredEvidence: 1,
      variables: ['target_area', 'expected_benefit'],
      variations: [],
      usage: 'occasional',
      effectiveness: 0.7
    });

    // Career Goal Setting Template
    generator.addTemplate({
      id: 'career-goal-setting',
      name: 'Career Goal Setting',
      type: 'goal',
      category: 'goals',
      titleTemplate: 'Set and pursue {{goal_type}} career goals',
      descriptionTemplate: 'Based on your career patterns and interests, setting clear {{goal_type}} goals could help you {{expected_outcome}} and provide direction for your professional development.',
      actionStepsTemplate: [
        'Define specific, measurable career objectives',
        'Break down goals into quarterly milestones',
        'Identify required skills and experiences',
        'Create an action plan with deadlines',
        'Review and adjust goals quarterly'
      ],
      applicableInsightTypes: ['opportunity', 'recommendation'],
      minimumConfidence: 0.4,
      requiredEvidence: 1,
      variables: ['goal_type', 'expected_outcome'],
      variations: [],
      usage: 'occasional',
      effectiveness: 0.8
    });
  }
}

// Convenience factory instance
export const recommendationGeneratorFactory = new RecommendationFactory(); 