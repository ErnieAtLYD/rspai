// Recommendation Generation Interfaces
// Comprehensive type definitions for generating actionable recommendations from insights

import { Insight, InsightCategory, InsightType, ActionStep } from './summary-generation-interfaces';
import { AIModelAdapter } from './ai-interfaces';

// Core recommendation types
export type RecommendationType = 
  | 'action'           // Direct action to take
  | 'habit'            // Habit to develop/change
  | 'decision'         // Decision to make
  | 'investigation'    // Something to explore further
  | 'optimization'     // Process/system improvement
  | 'prevention'       // Risk mitigation
  | 'learning'         // Skill/knowledge development
  | 'reflection'       // Self-reflection prompt
  | 'goal'             // Goal setting
  | 'relationship'     // Social/relationship advice
  | 'health'           // Health and wellness
  | 'productivity'     // Productivity improvement
  | 'creative'         // Creative endeavor
  | 'financial'        // Financial advice
  | 'career';          // Career development

export type RecommendationUrgency = 'low' | 'medium' | 'high' | 'urgent';
export type RecommendationDifficulty = 'easy' | 'moderate' | 'challenging' | 'complex';
export type RecommendationTimeframe = 'immediate' | 'short-term' | 'medium-term' | 'long-term';
export type RecommendationDirectness = 'suggestion' | 'recommendation' | 'strong-recommendation' | 'imperative';

// Core recommendation structure
export interface GeneratedRecommendation {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  category: InsightCategory;
  
  // Prioritization and urgency
  urgency: RecommendationUrgency;
  difficulty: RecommendationDifficulty;
  timeframe: RecommendationTimeframe;
  directness: RecommendationDirectness;
  
  // Confidence and quality metrics
  confidence: number;              // 0-1, how confident we are in this recommendation
  relevanceScore: number;          // 0-1, how relevant to user's patterns
  impactPotential: number;         // 0-1, potential positive impact
  feasibilityScore: number;        // 0-1, how feasible this is to implement
  
  // Supporting information
  sourceInsights: string[];        // IDs of insights that led to this recommendation
  evidence: RecommendationEvidence[];
  actionSteps: ActionStep[];
  
  // Risk and considerations
  risks: string[];
  prerequisites: string[];
  alternatives: string[];
  
  // Tracking and measurement
  successMetrics: string[];
  trackingMethods: string[];
  reviewTimeframe: string;
  
  // Metadata
  generatedAt: Date;
  generationMethod: 'ai' | 'template' | 'hybrid';
  tags: string[];
}

export interface RecommendationEvidence {
  insightId: string;
  excerpt: string;
  relevanceScore: number;
  supportType: 'direct' | 'indirect' | 'contextual';
  filePath?: string;
  timestamp?: Date;
}

// Generation configuration
export interface RecommendationGenerationConfig {
  // Generation strategy
  strategy: 'conservative' | 'balanced' | 'aggressive';
  enableAIGeneration: boolean;
  fallbackToTemplates: boolean;
  
  // Content preferences
  maxRecommendations: number;
  minConfidenceThreshold: number;
  includeRiskAssessment: boolean;
  includeActionSteps: boolean;
  includeAlternatives: boolean;
  
  // Filtering and prioritization
  excludeTypes: RecommendationType[];
  prioritizeUrgency: boolean;
  balanceByCategory: boolean;
  
  // Personalization
  userPreferences: UserRecommendationPreferences;
  contextualFactors: ContextualFactors;
  
  // Quality control
  enableDuplicateDetection: boolean;
  enableFeasibilityCheck: boolean;
  enableImpactAssessment: boolean;
  
  // AI model settings
  aiModel?: AIModelAdapter;
  temperature: number;
  maxTokens: number;
}

export interface UserRecommendationPreferences {
  preferredDirectness: RecommendationDirectness;
  preferredTimeframes: RecommendationTimeframe[];
  preferredTypes: RecommendationType[];
  riskTolerance: 'low' | 'medium' | 'high';
  detailLevel: 'minimal' | 'standard' | 'comprehensive';
  includePersonalTouch: boolean;
}

export interface ContextualFactors {
  currentLifePhase: 'student' | 'early-career' | 'mid-career' | 'senior' | 'retired' | 'transition';
  availableTime: 'limited' | 'moderate' | 'flexible';
  currentStressLevel: 'low' | 'medium' | 'high';
  majorLifeEvents: string[];
  seasonalFactors: string[];
  workContext: 'remote' | 'office' | 'hybrid' | 'freelance' | 'unemployed';
}

// Generation strategies and templates
export interface RecommendationTemplate {
  id: string;
  name: string;
  type: RecommendationType;
  category: InsightCategory;
  
  // Template structure
  titleTemplate: string;
  descriptionTemplate: string;
  actionStepsTemplate: string[];
  
  // Conditions for use
  applicableInsightTypes: InsightType[];
  minimumConfidence: number;
  requiredEvidence: number;
  
  // Customization
  variables: string[];
  variations: TemplateVariation[];
  
  // Metadata
  usage: 'frequent' | 'occasional' | 'rare';
  effectiveness: number;  // 0-1 based on user feedback
}

export interface TemplateVariation {
  condition: string;
  titleVariation?: string;
  descriptionVariation?: string;
  actionStepsVariation?: string[];
  directnessAdjustment?: RecommendationDirectness;
}

// Analysis and extraction interfaces
export interface RecommendationOpportunity {
  insightId: string;
  insight: Insight;
  opportunityType: RecommendationType;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  potentialImpact: string;
  implementationNotes: string;
}

export interface RecommendationCluster {
  id: string;
  theme: string;
  recommendations: GeneratedRecommendation[];
  combinedImpact: number;
  synergies: string[];
  conflicts: string[];
  priorityOrder: string[];  // recommendation IDs in priority order
}

// Generation process interfaces
export interface RecommendationGenerationContext {
  insights: Insight[];
  userPreferences: UserRecommendationPreferences;
  contextualFactors: ContextualFactors;
  existingRecommendations?: GeneratedRecommendation[];
  timeframe: {
    start: Date;
    end: Date;
  };
  scope: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
}

export interface RecommendationGenerationResult {
  recommendations: GeneratedRecommendation[];
  clusters: RecommendationCluster[];
  
  // Analysis metadata
  totalOpportunities: number;
  opportunitiesProcessed: number;
  recommendationsGenerated: number;
  averageConfidence: number;
  
  // Quality metrics
  diversityScore: number;      // How diverse the recommendation types are
  feasibilityScore: number;    // Average feasibility across all recommendations
  impactScore: number;         // Average potential impact
  
  // Generation metadata
  generationTime: number;
  aiTokensUsed?: number;
  templatesUsed: string[];
  warnings: string[];
  
  // User guidance
  priorityRecommendations: string[];  // Top 3-5 recommendation IDs
  quickWins: string[];               // Easy, high-impact recommendations
  longTermGoals: string[];           // Strategic, long-term recommendations
}

// Main generator interface
export interface RecommendationGenerator {
  // Core generation methods
  generateRecommendations(
    insights: Insight[],
    context: RecommendationGenerationContext,
    config?: Partial<RecommendationGenerationConfig>
  ): Promise<RecommendationGenerationResult>;
  
  // Specialized generation methods
  generateQuickWins(insights: Insight[], maxCount?: number): Promise<GeneratedRecommendation[]>;
  generateStrategicRecommendations(insights: Insight[], timeframe: RecommendationTimeframe): Promise<GeneratedRecommendation[]>;
  generateHabitRecommendations(insights: Insight[]): Promise<GeneratedRecommendation[]>;
  
  // Analysis methods
  identifyOpportunities(insights: Insight[]): Promise<RecommendationOpportunity[]>;
  clusterRecommendations(recommendations: GeneratedRecommendation[]): Promise<RecommendationCluster[]>;
  prioritizeRecommendations(recommendations: GeneratedRecommendation[], context: RecommendationGenerationContext): GeneratedRecommendation[];
  
  // Template and AI methods
  generateWithTemplate(opportunity: RecommendationOpportunity, template: RecommendationTemplate): Promise<GeneratedRecommendation>;
  generateWithAI(opportunity: RecommendationOpportunity, context: RecommendationGenerationContext): Promise<GeneratedRecommendation>;
  
  // Quality and validation
  validateRecommendation(recommendation: GeneratedRecommendation): ValidationResult;
  assessFeasibility(recommendation: GeneratedRecommendation, context: RecommendationGenerationContext): number;
  assessImpact(recommendation: GeneratedRecommendation, insights: Insight[]): number;
  
  // Configuration and management
  updateConfig(config: Partial<RecommendationGenerationConfig>): void;
  getConfig(): RecommendationGenerationConfig;
  addTemplate(template: RecommendationTemplate): void;
  removeTemplate(templateId: string): boolean;
  getTemplates(): RecommendationTemplate[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
  confidence: number;
}

export interface ValidationIssue {
  type: 'missing-field' | 'invalid-value' | 'inconsistency' | 'quality-concern';
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// Factory and utility interfaces
export interface RecommendationGeneratorFactory {
  createForPersonalDevelopment(): RecommendationGenerator;
  createForProductivity(): RecommendationGenerator;
  createForWellness(): RecommendationGenerator;
  createForCareer(): RecommendationGenerator;
  createCustom(config: RecommendationGenerationConfig): RecommendationGenerator;
}

export interface RecommendationAnalytics {
  // Usage analytics
  generationCount: number;
  averageGenerationTime: number;
  totalTokensUsed: number;
  
  // Quality analytics
  averageConfidence: number;
  averageFeasibility: number;
  averageImpact: number;
  
  // Type distribution
  typeDistribution: Record<RecommendationType, number>;
  urgencyDistribution: Record<RecommendationUrgency, number>;
  difficultyDistribution: Record<RecommendationDifficulty, number>;
  
  // Template usage
  templateUsage: Record<string, number>;
  aiVsTemplateRatio: number;
  
  // User feedback (if available)
  implementationRate?: number;
  userSatisfactionScore?: number;
  mostEffectiveTypes?: RecommendationType[];
} 