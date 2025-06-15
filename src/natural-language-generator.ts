/**
 * Natural Language Generation Module
 * Transforms structured insights into coherent, natural language summary text.
 * Provides sentence and paragraph generation with variation in structure and style.
 */

import {
  Insight,
  InsightCategory,
  InsightType,
  Recommendation,
  TrendAnalysis,
  SummaryOptions,
  SummaryContext,
  InsightEvidence,
  ActionStep
} from './summary-generation-interfaces';
import { AIModelAdapter, CompletionOptions } from './ai-interfaces';

/**
 * Configuration for natural language generation
 */
export interface NLGConfig {
  // Style and tone settings
  style: 'formal' | 'casual' | 'academic' | 'personal';
  tone: 'neutral' | 'encouraging' | 'analytical' | 'reflective';
  voice: 'active' | 'passive' | 'mixed';
  
  // Content generation settings
  enableVariation: boolean;
  variationLevel: 'low' | 'medium' | 'high';
  sentenceComplexity: 'simple' | 'moderate' | 'complex';
  paragraphLength: 'short' | 'medium' | 'long';
  
  // AI integration settings
  useAIForGeneration: boolean;
  aiModel?: AIModelAdapter;
  fallbackToTemplates: boolean;
  
  // Quality settings
  enableCoherenceChecking: boolean;
  enableFactualConsistency: boolean;
  enableStyleConsistency: boolean;
  
  // Language settings
  language: string;
  locale: string;
  
  // Advanced options
  enablePersonalization: boolean;
  contextAwareness: boolean;
  crossReferencing: boolean;
  enableTransitions: boolean;
}

/**
 * Text generation context
 */
export interface TextGenerationContext {
  previousText: string;
  currentSection: string;
  nextSection?: string;
  insights: Insight[];
  recommendations: Recommendation[];
  summaryContext: SummaryContext;
  options: SummaryOptions;
  metadata: Record<string, unknown>;
}

/**
 * Generated text result
 */
export interface GeneratedTextResult {
  text: string;
  confidence: number;
  coherenceScore: number;
  styleConsistency: number;
  generationMethod: 'ai' | 'template' | 'hybrid';
  tokensUsed?: number;
  processingTime: number;
  warnings: string[];
}

/**
 * Sentence template for structured generation
 */
export interface SentenceTemplate {
  id: string;
  pattern: string;
  variables: string[];
  category: InsightCategory;
  type: InsightType;
  style: string[];
  examples: string[];
}

/**
 * Paragraph structure definition
 */
export interface ParagraphStructure {
  id: string;
  name: string;
  description: string;
  sentences: Array<{
    type: 'topic' | 'evidence' | 'analysis' | 'conclusion' | 'transition';
    template: string;
    required: boolean;
    position: 'start' | 'middle' | 'end' | 'any';
  }>;
  minSentences: number;
  maxSentences: number;
  coherenceRules: string[];
}

/**
 * Text variation options
 */
export interface TextVariation {
  synonyms: Record<string, string[]>;
  phraseAlternatives: Record<string, string[]>;
  sentenceStarters: string[];
  transitions: Record<string, string[]>;
  connectors: string[];
}

/**
 * Main Natural Language Generator class
 */
export class NaturalLanguageGenerator {
  private config: NLGConfig;
  private sentenceTemplates: Map<string, SentenceTemplate[]>;
  private paragraphStructures: Map<string, ParagraphStructure>;
  private textVariations: TextVariation;
  private aiModel?: AIModelAdapter;

  constructor(config: Partial<NLGConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.sentenceTemplates = new Map();
    this.paragraphStructures = new Map();
    this.textVariations = this.initializeTextVariations();
    
    if (config.aiModel) {
      this.aiModel = config.aiModel;
    }
    
    this.initializeTemplates();
    this.initializeParagraphStructures();
  }

  /**
   * Set AI model for enhanced generation
   */
  setAIModel(model: AIModelAdapter): void {
    this.aiModel = model;
    this.config.aiModel = model;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NLGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Generate executive summary text
   */
  async generateExecutiveSummary(
    insights: Insight[],
    context: SummaryContext,
    options: SummaryOptions
  ): Promise<GeneratedTextResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Select top insights for executive summary
      const topInsights = insights
        .filter(insight => insight.importance > 0.7)
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 3);

      if (topInsights.length === 0) {
        warnings.push('No high-importance insights found for executive summary');
        return this.generateFallbackExecutiveSummary(context, warnings, startTime);
      }

      // Generate summary using AI or templates
      let text: string;
      let generationMethod: 'ai' | 'template' | 'hybrid' = 'template';
      let tokensUsed: number | undefined;

      if (this.config.useAIForGeneration && this.aiModel) {
        try {
          const aiResult = await this.generateExecutiveSummaryWithAI(
            topInsights, 
            context, 
            options
          );
          text = aiResult.text;
          tokensUsed = aiResult.tokensUsed;
          generationMethod = 'ai';
        } catch (error) {
          warnings.push(`AI generation failed: ${error}. Falling back to templates.`);
          text = this.generateExecutiveSummaryWithTemplates(topInsights, context);
        }
      } else {
        text = this.generateExecutiveSummaryWithTemplates(topInsights, context);
      }

      // Calculate quality metrics
      const coherenceScore = this.calculateCoherenceScore(text);
      const styleConsistency = this.calculateStyleConsistency(text);

      return {
        text,
        confidence: Math.min(0.9, topInsights.reduce((sum, i) => sum + i.confidence, 0) / topInsights.length),
        coherenceScore,
        styleConsistency,
        generationMethod,
        tokensUsed,
        processingTime: Date.now() - startTime,
        warnings
      };
    } catch (error) {
      warnings.push(`Executive summary generation failed: ${error}`);
      return this.generateFallbackExecutiveSummary(context, warnings, startTime);
    }
  }

  /**
   * Generate insight descriptions
   */
  async generateInsightDescription(
    insight: Insight,
    context: TextGenerationContext
  ): Promise<GeneratedTextResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      let text: string;
      let generationMethod: 'ai' | 'template' | 'hybrid' = 'template';
      let tokensUsed: number | undefined;

      if (this.config.useAIForGeneration && this.aiModel) {
        try {
          const aiResult = await this.generateInsightWithAI(insight, context);
          text = aiResult.text;
          tokensUsed = aiResult.tokensUsed;
          generationMethod = 'ai';
        } catch (error) {
          warnings.push(`AI generation failed for insight: ${error}`);
          text = this.generateInsightWithTemplates(insight, context);
        }
      } else {
        text = this.generateInsightWithTemplates(insight, context);
      }

      // Add evidence if requested
      if (context.options.includeEvidence && insight.evidence.length > 0) {
        const evidenceText = this.generateEvidenceText(insight.evidence);
        text += ` ${evidenceText}`;
      }

      const coherenceScore = this.calculateCoherenceScore(text);
      const styleConsistency = this.calculateStyleConsistency(text);

      return {
        text,
        confidence: insight.confidence,
        coherenceScore,
        styleConsistency,
        generationMethod,
        tokensUsed,
        processingTime: Date.now() - startTime,
        warnings
      };
    } catch (error) {
      warnings.push(`Insight description generation failed: ${error}`);
      return {
        text: insight.description || 'Unable to generate insight description.',
        confidence: 0.3,
        coherenceScore: 0.5,
        styleConsistency: 0.5,
        generationMethod: 'template',
        processingTime: Date.now() - startTime,
        warnings
      };
    }
  }

  /**
   * Generate recommendation text
   */
  async generateRecommendationText(
    recommendation: Recommendation,
    context: TextGenerationContext
  ): Promise<GeneratedTextResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      let text: string;
      let generationMethod: 'ai' | 'template' | 'hybrid' = 'template';
      let tokensUsed: number | undefined;

      if (this.config.useAIForGeneration && this.aiModel) {
        try {
          const aiResult = await this.generateRecommendationWithAI(recommendation, context);
          text = aiResult.text;
          tokensUsed = aiResult.tokensUsed;
          generationMethod = 'ai';
        } catch (error) {
          warnings.push(`AI generation failed for recommendation: ${error}`);
          text = this.generateRecommendationWithTemplates(recommendation, context);
        }
      } else {
        text = this.generateRecommendationWithTemplates(recommendation, context);
      }

      // Add action steps if available
      if (recommendation.actionSteps.length > 0) {
        const stepsText = this.generateActionStepsText(recommendation.actionSteps);
        text += `\n\n${stepsText}`;
      }

      const coherenceScore = this.calculateCoherenceScore(text);
      const styleConsistency = this.calculateStyleConsistency(text);

      return {
        text,
        confidence: recommendation.confidence,
        coherenceScore,
        styleConsistency,
        generationMethod,
        tokensUsed,
        processingTime: Date.now() - startTime,
        warnings
      };
    } catch (error) {
      warnings.push(`Recommendation generation failed: ${error}`);
      return {
        text: recommendation.description || 'Unable to generate recommendation text.',
        confidence: 0.3,
        coherenceScore: 0.5,
        styleConsistency: 0.5,
        generationMethod: 'template',
        processingTime: Date.now() - startTime,
        warnings
      };
    }
  }

  /**
   * Generate trend analysis text
   */
  async generateTrendAnalysisText(
    trend: TrendAnalysis,
    context: TextGenerationContext
  ): Promise<GeneratedTextResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      let text: string;
      let generationMethod: 'ai' | 'template' | 'hybrid' = 'template';
      let tokensUsed: number | undefined;

      if (this.config.useAIForGeneration && this.aiModel) {
        try {
          const aiResult = await this.generateTrendWithAI(trend, context);
          text = aiResult.text;
          tokensUsed = aiResult.tokensUsed;
          generationMethod = 'ai';
        } catch (error) {
          warnings.push(`AI generation failed for trend: ${error}`);
          text = this.generateTrendWithTemplates(trend, context);
        }
      } else {
        text = this.generateTrendWithTemplates(trend, context);
      }

      const coherenceScore = this.calculateCoherenceScore(text);
      const styleConsistency = this.calculateStyleConsistency(text);

      return {
        text,
        confidence: trend.confidence,
        coherenceScore,
        styleConsistency,
        generationMethod,
        tokensUsed,
        processingTime: Date.now() - startTime,
        warnings
      };
    } catch (error) {
      warnings.push(`Trend analysis generation failed: ${error}`);
      return {
        text: trend.description || 'Unable to generate trend analysis.',
        confidence: 0.3,
        coherenceScore: 0.5,
        styleConsistency: 0.5,
        generationMethod: 'template',
        processingTime: Date.now() - startTime,
        warnings
      };
    }
  }

  /**
   * Generate connecting text between sections
   */
  generateTransitionText(
    fromSection: string,
    toSection: string,
    context: TextGenerationContext
  ): string {
    if (!this.config.enableTransitions) {
      return '';
    }

    const transitions = this.textVariations.transitions;
    const key = `${fromSection}-${toSection}`;
    
    if (transitions[key]) {
      return this.selectRandomVariation(transitions[key]);
    }

    // Generic transitions
    const genericTransitions = [
      'Moving forward,',
      'Additionally,',
      'Furthermore,',
      'Building on this,',
      'In relation to this,',
      'Considering these insights,'
    ];

    return this.selectRandomVariation(genericTransitions);
  }

  /**
   * Generate complete paragraph from insights
   */
  async generateParagraph(
    insights: Insight[],
    structure: ParagraphStructure,
    context: TextGenerationContext
  ): Promise<GeneratedTextResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const sentences: string[] = [];

    try {
      // Generate sentences based on structure
      for (const sentenceSpec of structure.sentences) {
        if (sentenceSpec.required || Math.random() > 0.3) {
          const sentence = await this.generateSentence(
            sentenceSpec,
            insights,
            context
          );
          if (sentence) {
            sentences.push(sentence);
          }
        }
      }

      // Ensure minimum sentences
      while (sentences.length < structure.minSentences && insights.length > 0) {
        const fallbackSentence = this.generateFallbackSentence(insights[0]);
        sentences.push(fallbackSentence);
      }

      // Limit to maximum sentences
      if (sentences.length > structure.maxSentences) {
        sentences.splice(structure.maxSentences);
      }

      const text = sentences.join(' ');
      const coherenceScore = this.calculateCoherenceScore(text);
      const styleConsistency = this.calculateStyleConsistency(text);

      return {
        text,
        confidence: insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length,
        coherenceScore,
        styleConsistency,
        generationMethod: 'template',
        processingTime: Date.now() - startTime,
        warnings
      };
    } catch (error) {
      warnings.push(`Paragraph generation failed: ${error}`);
      return {
        text: insights.map(i => i.description).join(' '),
        confidence: 0.3,
        coherenceScore: 0.5,
        styleConsistency: 0.5,
        generationMethod: 'template',
        processingTime: Date.now() - startTime,
        warnings
      };
    }
  }

  // Private helper methods

  private async generateExecutiveSummaryWithAI(
    insights: Insight[],
    context: SummaryContext,
    options: SummaryOptions
  ): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.aiModel) {
      throw new Error('AI model not available');
    }

    const prompt = this.buildExecutiveSummaryPrompt(insights, context, options);
    const completionOptions: CompletionOptions = {
      maxTokens: 300,
      temperature: 0.7,
      topP: 0.9
    };

    const response = await this.aiModel.generateCompletion(prompt, completionOptions);
    
    return {
      text: this.cleanAIResponse(response),
      tokensUsed: completionOptions.maxTokens
    };
  }

  private generateExecutiveSummaryWithTemplates(
    insights: Insight[],
    context: SummaryContext
  ): string {
    const templates = [
      'Analysis of {timeframe} reveals {count} key insights. {primary_insight} {secondary_insight} These findings suggest {implication}.',
      'During {timeframe}, {count} significant patterns emerged. {primary_insight} Additionally, {secondary_insight} {conclusion}.',
      'Key findings from {timeframe} include {primary_insight} {secondary_insight} These insights indicate {implication}.'
    ];

    const template = this.selectRandomVariation(templates);
    const timeframe = this.formatDateRange(context.purpose);
    const primaryInsight = insights[0]?.description || 'significant patterns were observed';
    const secondaryInsight = insights[1]?.description || '';
    const implication = this.generateImplication(insights);

    return template
      .replace('{timeframe}', timeframe)
      .replace('{count}', insights.length.toString())
      .replace('{primary_insight}', primaryInsight)
      .replace('{secondary_insight}', secondaryInsight)
      .replace('{implication}', implication)
      .replace('{conclusion}', this.generateConclusion(insights));
  }

  private async generateInsightWithAI(
    insight: Insight,
    context: TextGenerationContext
  ): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.aiModel) {
      throw new Error('AI model not available');
    }

    const prompt = this.buildInsightPrompt(insight, context);
    const completionOptions: CompletionOptions = {
      maxTokens: 150,
      temperature: 0.6,
      topP: 0.8
    };

    const response = await this.aiModel.generateCompletion(prompt, completionOptions);
    
    return {
      text: this.cleanAIResponse(response),
      tokensUsed: completionOptions.maxTokens
    };
  }

  private generateInsightWithTemplates(
    insight: Insight,
    context: TextGenerationContext
  ): string {
    const templates = this.sentenceTemplates.get(insight.category) || [];
    
    if (templates.length === 0) {
      return this.generateGenericInsightText(insight);
    }

    const template = this.selectRandomVariation(templates.map(t => t.pattern));
    return this.fillTemplate(template, insight, context);
  }

  private async generateRecommendationWithAI(
    recommendation: Recommendation,
    context: TextGenerationContext
  ): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.aiModel) {
      throw new Error('AI model not available');
    }

    const prompt = this.buildRecommendationPrompt(recommendation, context);
    const completionOptions: CompletionOptions = {
      maxTokens: 200,
      temperature: 0.5,
      topP: 0.8
    };

    const response = await this.aiModel.generateCompletion(prompt, completionOptions);
    
    return {
      text: this.cleanAIResponse(response),
      tokensUsed: completionOptions.maxTokens
    };
  }

  private generateRecommendationWithTemplates(
    recommendation: Recommendation,
    context: TextGenerationContext
  ): string {
    const priorityTemplates = {
      urgent: [
        'Immediate action is required: {description} {rationale}',
        'Critical recommendation: {description} This should be prioritized because {rationale}'
      ],
      high: [
        'Strong recommendation: {description} {rationale}',
        'It is highly recommended to {description} {rationale}'
      ],
      medium: [
        'Consider {description} {rationale}',
        'A beneficial step would be to {description} {rationale}'
      ],
      low: [
        'When possible, {description} {rationale}',
        'As time permits, consider {description} {rationale}'
      ]
    };

    const templates = priorityTemplates[recommendation.priority] || priorityTemplates.medium;
    const template = this.selectRandomVariation(templates);

    return template
      .replace('{description}', recommendation.description)
      .replace('{rationale}', recommendation.rationale);
  }

  private async generateTrendWithAI(
    trend: TrendAnalysis,
    context: TextGenerationContext
  ): Promise<{ text: string; tokensUsed?: number }> {
    if (!this.aiModel) {
      throw new Error('AI model not available');
    }

    const prompt = this.buildTrendPrompt(trend, context);
    const completionOptions: CompletionOptions = {
      maxTokens: 180,
      temperature: 0.6,
      topP: 0.8
    };

    const response = await this.aiModel.generateCompletion(prompt, completionOptions);
    
    return {
      text: this.cleanAIResponse(response),
      tokensUsed: completionOptions.maxTokens
    };
  }

  private generateTrendWithTemplates(
    trend: TrendAnalysis,
    context: TextGenerationContext
  ): string {
    const directionTemplates = {
      increasing: [
        '{title} shows an upward trend over {timeframe}. {description}',
        'There has been a notable increase in {title} during {timeframe}. {description}'
      ],
      decreasing: [
        '{title} has been declining over {timeframe}. {description}',
        'A downward trend in {title} is evident during {timeframe}. {description}'
      ],
      stable: [
        '{title} has remained consistent over {timeframe}. {description}',
        'Stability in {title} is observed during {timeframe}. {description}'
      ],
      cyclical: [
        '{title} shows cyclical patterns over {timeframe}. {description}',
        'Recurring patterns in {title} are evident during {timeframe}. {description}'
      ],
      volatile: [
        '{title} exhibits high variability over {timeframe}. {description}',
        'Significant fluctuations in {title} are observed during {timeframe}. {description}'
      ]
    };

    const templates = directionTemplates[trend.direction] || directionTemplates.stable;
    const template = this.selectRandomVariation(templates);
    const timeframe = this.formatDateRange(trend.timeframe);

    return template
      .replace('{title}', trend.title)
      .replace('{timeframe}', timeframe)
      .replace('{description}', trend.description);
  }

  private generateEvidenceText(evidence: InsightEvidence[]): string {
    if (evidence.length === 0) return '';

    const topEvidence = evidence
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 2);

    if (topEvidence.length === 1) {
      return `This is supported by evidence from ${topEvidence[0].context}.`;
    } else {
      return `This is supported by evidence from ${topEvidence[0].context} and ${topEvidence[1].context}.`;
    }
  }

  private generateActionStepsText(steps: ActionStep[]): string {
    if (steps.length === 0) return '';

    const sortedSteps = steps.sort((a, b) => a.order - b.order);
    
    if (sortedSteps.length === 1) {
      return `Action step: ${sortedSteps[0].description}`;
    }

    const stepTexts = sortedSteps.map((step, index) => 
      `${index + 1}. ${step.description}`
    );

    return `Action steps:\n${stepTexts.join('\n')}`;
  }

  private async generateSentence(
    sentenceSpec: ParagraphStructure['sentences'][0],
    insights: Insight[],
    context: TextGenerationContext
  ): Promise<string | null> {
    // Implementation for generating individual sentences based on specifications
    const templates = [
      'Analysis reveals {insight}.',
      'The data shows {insight}.',
      'Evidence indicates {insight}.',
      'Patterns suggest {insight}.'
    ];

    if (insights.length === 0) return null;

    const template = this.selectRandomVariation(templates);
    const insight = insights[0];
    
    return template.replace('{insight}', insight.description);
  }

  private generateFallbackSentence(insight: Insight): string {
    return `${insight.description}.`;
  }

  private buildExecutiveSummaryPrompt(
    insights: Insight[],
    context: SummaryContext,
    options: SummaryOptions
  ): string {
    const insightTexts = insights.map(i => `- ${i.description}`).join('\n');
    const timeframe = this.formatDateRange(context.purpose);
    
    return `Create a warm, encouraging summary based on these key insights from ${timeframe}:

${insightTexts}

Style: ${options.style || 'personal'}
Tone: ${options.tone || 'encouraging'}
Length: 2-3 sentences
Focus: Personal growth and positive patterns, written in a supportive voice

Summary:`;
  }

  private buildInsightPrompt(insight: Insight, context: TextGenerationContext): string {
    return `Rewrite this insight in a warm, personal way that feels encouraging and supportive:

Original: ${insight.description}
Category: ${insight.category}
Importance: ${insight.importance}
Style: ${context.options.style || 'personal'}

Make it sound like a supportive friend sharing an observation. Rewritten insight:`;
  }

  private buildRecommendationPrompt(
    recommendation: Recommendation,
    context: TextGenerationContext
  ): string {
    return `Rewrite this recommendation in a gentle, encouraging way that feels motivating rather than prescriptive:

Original: ${recommendation.description}
Priority: ${recommendation.priority}
Rationale: ${recommendation.rationale}
Style: ${context.options.style || 'personal'}

Make it sound like friendly advice from someone who believes in you. Rewritten recommendation:`;
  }

  private buildTrendPrompt(trend: TrendAnalysis, context: TextGenerationContext): string {
    const timeframe = this.formatDateRange(trend.timeframe);
    
    return `Describe this trend in a warm, personal way that highlights growth and progress:

Trend: ${trend.title}
Direction: ${trend.direction}
Description: ${trend.description}
Timeframe: ${timeframe}
Confidence: ${trend.confidence}
Style: ${context.options.style || 'personal'}

Focus on the positive aspects and personal development. Trend description:`;
  }

  private cleanAIResponse(response: string): string {
    return response
      .trim()
      .replace(/^(Executive Summary:|Summary:|Rewritten insight:|Rewritten recommendation:|Trend analysis:|Trend description:)\s*/i, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fillTemplate(template: string, insight: Insight, context: TextGenerationContext): string {
    return template
      .replace('{description}', insight.description)
      .replace('{category}', insight.category)
      .replace('{importance}', insight.importance.toString())
      .replace('{confidence}', insight.confidence.toString());
  }

  private generateGenericInsightText(insight: Insight): string {
    const starters = [
      'Looking at your patterns, it seems that',
      'What stands out is that',
      'You might find it interesting that',
      'Your data shows that'
    ];

    const starter = this.selectRandomVariation(starters);
    return `${starter} ${insight.description}.`;
  }

  private generateImplication(insights: Insight[]): string {
    const implications = [
      'opportunities for growth',
      'areas where you could focus',
      'positive trends worth celebrating',
      'patterns that might inspire you'
    ];

    return this.selectRandomVariation(implications);
  }

  private generateConclusion(insights: Insight[]): string {
    const conclusions = [
      'These insights offer some thoughtful direction for your journey ahead.',
      'Understanding these patterns can help guide your next steps.',
      'These findings highlight some meaningful areas to explore.',
      'This analysis reveals some encouraging opportunities for growth.'
    ];

    return this.selectRandomVariation(conclusions);
  }

  private formatDateRange(purpose: string | unknown): string {
    if (typeof purpose === 'string') {
      switch (purpose) {
        case 'daily-review': return 'today';
        case 'weekly-summary': return 'this week';
        case 'monthly-report': return 'this month';
        case 'project-review': return 'the project period';
        default: return 'the analysis period';
      }
    }
    return 'the analysis period';
  }

  private selectRandomVariation(variations: string[]): string {
    if (variations.length === 0) return '';
    
    if (this.config.enableVariation) {
      const index = Math.floor(Math.random() * variations.length);
      return variations[index];
    }
    
    return variations[0];
  }

  private calculateCoherenceScore(text: string): number {
    // Simple coherence scoring based on text characteristics
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return 0;
    if (sentences.length === 1) return 0.8;
    
    // Check for transition words and logical flow
    const transitionWords = ['however', 'therefore', 'additionally', 'furthermore', 'moreover', 'consequently'];
    const hasTransitions = transitionWords.some(word => 
      text.toLowerCase().includes(word)
    );
    
    // Basic scoring
    let score = 0.6;
    if (hasTransitions) score += 0.2;
    if (sentences.length >= 2 && sentences.length <= 5) score += 0.1;
    if (text.length > 50 && text.length < 500) score += 0.1;
    
    return Math.min(1.0, score);
  }

  private calculateStyleConsistency(text: string): number {
    // Simple style consistency check
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return 0;
    
    // Check for consistent sentence structure and length
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    const lengthVariance = sentences.reduce((sum, s) => 
      sum + Math.pow(s.length - avgLength, 2), 0
    ) / sentences.length;
    
    // Lower variance indicates better consistency
    const consistencyScore = Math.max(0, 1 - (lengthVariance / (avgLength * avgLength)));
    
    return Math.min(1.0, consistencyScore);
  }

  private generateFallbackExecutiveSummary(
    context: SummaryContext,
    warnings: string[],
    startTime: number
  ): GeneratedTextResult {
    const timeframe = this.formatDateRange(context.purpose);
    const fallbackText = `Analysis of ${timeframe} has been completed. Key patterns and insights have been identified for review.`;
    
    return {
      text: fallbackText,
      confidence: 0.3,
      coherenceScore: 0.6,
      styleConsistency: 0.7,
      generationMethod: 'template',
      processingTime: Date.now() - startTime,
      warnings
    };
  }

  private mergeWithDefaults(config: Partial<NLGConfig>): NLGConfig {
    return {
      style: 'personal',
      tone: 'encouraging',
      voice: 'active',
      enableVariation: true,
      variationLevel: 'medium',
      sentenceComplexity: 'moderate',
      paragraphLength: 'medium',
      useAIForGeneration: true,
      fallbackToTemplates: true,
      enableCoherenceChecking: true,
      enableFactualConsistency: true,
      enableStyleConsistency: true,
      language: 'en',
      locale: 'en-US',
      enablePersonalization: true,
      contextAwareness: true,
      crossReferencing: false,
      enableTransitions: true,
      ...config
    };
  }

  private initializeTemplates(): void {
    // Initialize sentence templates for different categories
    const productivityTemplates: SentenceTemplate[] = [
      {
        id: 'prod-1',
        pattern: 'Productivity analysis shows {description}',
        variables: ['description'],
        category: 'productivity',
        type: 'observation',
        style: ['formal', 'analytical'],
        examples: ['Productivity analysis shows consistent improvement in task completion rates']
      },
      {
        id: 'prod-2',
        pattern: 'Work patterns indicate {description}',
        variables: ['description'],
        category: 'productivity',
        type: 'pattern',
        style: ['formal', 'analytical'],
        examples: ['Work patterns indicate peak performance during morning hours']
      }
    ];

    const wellbeingTemplates: SentenceTemplate[] = [
      {
        id: 'well-1',
        pattern: 'Wellbeing metrics reveal {description}',
        variables: ['description'],
        category: 'wellbeing',
        type: 'observation',
        style: ['formal', 'personal'],
        examples: ['Wellbeing metrics reveal improved stress management']
      }
    ];

    this.sentenceTemplates.set('productivity', productivityTemplates);
    this.sentenceTemplates.set('wellbeing', wellbeingTemplates);
  }

  private initializeParagraphStructures(): void {
    const basicStructure: ParagraphStructure = {
      id: 'basic',
      name: 'Basic Paragraph',
      description: 'Simple topic-evidence-conclusion structure',
      sentences: [
        {
          type: 'topic',
          template: 'Topic sentence introducing the main point',
          required: true,
          position: 'start'
        },
        {
          type: 'evidence',
          template: 'Supporting evidence or examples',
          required: false,
          position: 'middle'
        },
        {
          type: 'conclusion',
          template: 'Concluding statement or implication',
          required: true,
          position: 'end'
        }
      ],
      minSentences: 2,
      maxSentences: 4,
      coherenceRules: ['topic-before-evidence', 'evidence-before-conclusion']
    };

    this.paragraphStructures.set('basic', basicStructure);
  }

  private initializeTextVariations(): TextVariation {
    return {
      synonyms: {
        'shows': ['reveals', 'suggests', 'indicates', 'highlights'],
        'important': ['meaningful', 'significant', 'valuable', 'noteworthy'],
        'improve': ['grow', 'develop', 'enhance', 'strengthen']
      },
      phraseAlternatives: {
        'analysis shows': ['your patterns reveal', 'what stands out is', 'looking at your data'],
        'it is recommended': ['you might consider', 'it could be helpful to', 'you could try']
      },
      sentenceStarters: [
        'Looking at your patterns',
        'What stands out',
        'Your journey shows',
        'Reflecting on your data',
        'What\'s encouraging is'
      ],
      transitions: {
        'insights-recommendations': ['Based on what you\'ve shared,', 'Given these patterns,', 'To build on this,'],
        'recommendations-trends': ['Looking at your growth over time,', 'Your progress shows,', 'As you\'ve developed,'],
        'trends-conclusion': ['Taking it all together,', 'Overall,', 'What this means for you is']
      },
      connectors: [
        'and what\'s more',
        'additionally',
        'also',
        'on the other hand',
        'as a result',
        'this means',
        'at the same time',
        'similarly'
      ]
    };
  }
}

/**
 * Factory for creating NLG instances with common configurations
 */
export class NLGFactory {
  /**
   * Create NLG for formal business summaries
   */
  static createForBusiness(aiModel?: AIModelAdapter): NaturalLanguageGenerator {
    return new NaturalLanguageGenerator({
      style: 'formal',
      tone: 'analytical',
      voice: 'active',
      enableVariation: true,
      variationLevel: 'low',
      sentenceComplexity: 'moderate',
      useAIForGeneration: !!aiModel,
      aiModel,
      enableTransitions: true,
      contextAwareness: true
    });
  }

  /**
   * Create NLG for personal reflection summaries
   */
  static createForPersonal(aiModel?: AIModelAdapter): NaturalLanguageGenerator {
    return new NaturalLanguageGenerator({
      style: 'personal',
      tone: 'encouraging',
      voice: 'active',
      enableVariation: true,
      variationLevel: 'high',
      sentenceComplexity: 'simple',
      useAIForGeneration: !!aiModel,
      aiModel,
      enablePersonalization: true,
      enableTransitions: true
    });
  }

  /**
   * Create NLG for academic/research summaries
   */
  static createForAcademic(aiModel?: AIModelAdapter): NaturalLanguageGenerator {
    return new NaturalLanguageGenerator({
      style: 'academic',
      tone: 'neutral',
      voice: 'passive',
      enableVariation: false,
      variationLevel: 'low',
      sentenceComplexity: 'complex',
      useAIForGeneration: !!aiModel,
      aiModel,
      enableFactualConsistency: true,
      crossReferencing: true
    });
  }
} 