/**
 * Summary Generation Interfaces
 * Defines the data structures and interfaces for transforming detected patterns
 * and themes into readable, actionable insights for users.
 */

import { DetectedTheme, ThemeDetectionResult, ThemeCategory } from './theme-detection-interfaces';
import { DetectedPattern, AIModelAdapter } from './ai-interfaces';

/**
 * Configuration options for summary generation
 */
export interface SummaryOptions {
  // Content control
  maxInsights: number;
  includeEvidence: boolean;
  includeRecommendations: boolean;
  includeMetadata: boolean;
  
  // Format and style
  format: 'concise' | 'detailed' | 'executive' | 'technical';
  style: 'formal' | 'casual' | 'academic' | 'personal';
  tone: 'neutral' | 'encouraging' | 'analytical' | 'reflective';
  
  // Scope and filtering
  dateRange: DateRange;
  scope: 'whole-life' | 'work-only' | 'personal-only' | 'custom';
  categories: ThemeCategory[];
  excludeCategories: ThemeCategory[];
  
  // Prioritization
  priorityWeighting: PriorityWeighting;
  minConfidenceThreshold: number;
  minImportanceThreshold: number;
  
  // Output customization
  language: string;
  includeCharts: boolean;
  includeTimeline: boolean;
  includeTrends: boolean;
  
  // Advanced options
  enablePersonalization: boolean;
  contextualDepth: 'shallow' | 'medium' | 'deep';
  crossReferencing: boolean;
}

/**
 * Date range for summary scope
 */
export interface DateRange {
  start: Date;
  end: Date;
  label?: string; // e.g., "Last Month", "Q1 2024"
}

/**
 * Weighting configuration for insight prioritization
 */
export interface PriorityWeighting {
  recency: number;        // Weight for recent insights
  frequency: number;      // Weight for frequently occurring patterns
  confidence: number;     // Weight for high-confidence insights
  impact: number;         // Weight for high-impact insights
  novelty: number;        // Weight for new or emerging patterns
  actionability: number;  // Weight for actionable insights
}

/**
 * Generated summary result
 */
export interface GeneratedSummary {
  // Basic metadata
  id: string;
  title: string;
  subtitle?: string;
  dateRange: DateRange;
  scope: string;
  
  // Content sections
  executiveSummary: string;
  insights: Insight[];
  recommendations: Recommendation[];
  trends: TrendAnalysis[];
  
  // Supporting content
  keyMetrics: SummaryMetric[];
  timeline?: TimelineEvent[];
  charts?: ChartData[];
  
  // Output formats
  markdownContent: string;
  htmlContent?: string;
  plainTextContent: string;
  
  // Generation metadata
  generatedAt: Date;
  generatedBy: string; // Model/system identifier
  processingTime: number;
  tokensUsed?: number;
  confidence: number;
  
  // Source tracking
  sourceThemes: string[]; // Theme IDs
  sourcePatterns: string[]; // Pattern IDs
  documentsAnalyzed: number;
  
  // Quality metrics
  coherenceScore: number;
  completenessScore: number;
  actionabilityScore: number;
  
  // User interaction
  userFeedback?: UserFeedback;
  customizations?: SummaryCustomization[];
}

/**
 * Individual insight within a summary
 */
export interface Insight {
  id: string;
  title: string;
  description: string;
  category: InsightCategory;
  type: InsightType;
  
  // Scoring and ranking
  importance: number; // 0-1 scale
  confidence: number; // 0-1 scale
  actionability: number; // 0-1 scale
  novelty: number; // 0-1 scale
  
  // Supporting information
  evidence: InsightEvidence[];
  relatedInsights: string[]; // Other insight IDs
  keywords: string[];
  
  // Temporal context
  timeframe: DateRange;
  trend: 'increasing' | 'decreasing' | 'stable' | 'emerging' | 'declining';
  
  // Recommendations
  suggestedActions: string[];
  nextSteps: string[];
  
  // Source tracking
  sourceThemes: string[];
  sourcePatterns: string[];
  derivationMethod: 'theme-analysis' | 'pattern-detection' | 'ai-inference' | 'hybrid';
}

/**
 * Categories for insights
 */
export type InsightCategory = 
  | 'productivity'
  | 'wellbeing'
  | 'relationships'
  | 'learning'
  | 'goals'
  | 'habits'
  | 'challenges'
  | 'opportunities'
  | 'patterns'
  | 'trends'
  | 'achievements'
  | 'concerns';

/**
 * Types of insights
 */
export type InsightType =
  | 'observation'     // What happened
  | 'correlation'     // What's connected
  | 'causation'       // What caused what
  | 'prediction'      // What might happen
  | 'recommendation'  // What to do
  | 'warning'         // What to watch out for
  | 'opportunity'     // What to pursue
  | 'achievement'     // What was accomplished
  | 'pattern'         // Recurring behavior
  | 'anomaly';        // Unusual occurrence

/**
 * Evidence supporting an insight
 */
export interface InsightEvidence {
  type: 'theme' | 'pattern' | 'document' | 'statistic' | 'trend';
  sourceId: string;
  excerpt: string;
  context: string;
  relevanceScore: number;
  timestamp: Date;
  documentPath?: string;
  position?: EvidencePosition;
}

/**
 * Position information for evidence
 */
export interface EvidencePosition {
  paragraphIndex: number;
  sentenceIndex: number;
  startChar: number;
  endChar: number;
  lineNumber: number;
}

/**
 * Actionable recommendation
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  // Implementation details
  actionSteps: ActionStep[];
  estimatedEffort: 'minimal' | 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  
  // Context and rationale
  rationale: string;
  expectedOutcome: string;
  successMetrics: string[];
  
  // Supporting information
  relatedInsights: string[];
  prerequisites: string[];
  potentialObstacles: string[];
  
  // Confidence and impact
  confidence: number;
  expectedImpact: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Categories for recommendations
 */
export type RecommendationCategory =
  | 'habit-formation'
  | 'goal-setting'
  | 'productivity'
  | 'health-wellness'
  | 'relationships'
  | 'learning'
  | 'time-management'
  | 'stress-management'
  | 'career-development'
  | 'personal-growth'
  | 'system-optimization'
  | 'problem-solving';

/**
 * Individual action step within a recommendation
 */
export interface ActionStep {
  id: string;
  description: string;
  order: number;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'hard';
  resources?: string[];
  dependencies?: string[]; // Other step IDs
}

/**
 * Trend analysis for summary
 */
export interface TrendAnalysis {
  id: string;
  title: string;
  description: string;
  category: ThemeCategory;
  
  // Trend characteristics
  direction: 'increasing' | 'decreasing' | 'stable' | 'cyclical' | 'volatile';
  strength: number; // 0-1 scale
  confidence: number; // 0-1 scale
  
  // Temporal information
  timeframe: DateRange;
  dataPoints: TrendDataPoint[];
  
  // Analysis
  significance: 'low' | 'medium' | 'high';
  implications: string[];
  projections: string[];
  
  // Supporting data
  relatedThemes: string[];
  contributingFactors: string[];
}

/**
 * Data point for trend analysis
 */
export interface TrendDataPoint {
  date: Date;
  value: number;
  label?: string;
  confidence?: number;
}

/**
 * Key metrics for summary
 */
export interface SummaryMetric {
  id: string;
  name: string;
  value: number | string;
  unit?: string;
  category: 'productivity' | 'wellbeing' | 'activity' | 'progress' | 'quality';
  
  // Context
  description: string;
  timeframe: DateRange;
  
  // Comparison
  previousValue?: number | string;
  change?: number;
  changeDirection?: 'up' | 'down' | 'stable';
  
  // Visualization
  displayFormat: 'number' | 'percentage' | 'duration' | 'count' | 'rating';
  color?: string;
  icon?: string;
}

/**
 * Timeline event for summary
 */
export interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  category: ThemeCategory;
  importance: 'low' | 'medium' | 'high';
  type: 'milestone' | 'event' | 'pattern-start' | 'pattern-end' | 'insight';
  relatedInsights?: string[];
  relatedThemes?: string[];
}

/**
 * Chart data for visualization
 */
export interface ChartData {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'timeline';
  data: any; // Chart-specific data structure
  config: ChartConfig;
  description: string;
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  width?: number;
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  showAxes?: boolean;
  interactive?: boolean;
  exportable?: boolean;
}

/**
 * User feedback on generated summary
 */
export interface UserFeedback {
  rating: number; // 1-5 scale
  helpful: boolean;
  accurate: boolean;
  actionable: boolean;
  comments?: string;
  suggestedImprovements?: string[];
  timestamp: Date;
}

/**
 * Summary customization applied by user
 */
export interface SummaryCustomization {
  type: 'section-reorder' | 'content-edit' | 'style-change' | 'filter-apply';
  description: string;
  appliedAt: Date;
  parameters: Record<string, any>;
}

/**
 * Template for summary generation
 */
export interface SummaryTemplate {
  id: string;
  name: string;
  description: string;
  category: 'personal' | 'professional' | 'academic' | 'health' | 'general';
  
  // Template structure
  sections: TemplateSection[];
  defaultOptions: Partial<SummaryOptions>;
  
  // Metadata
  version: string;
  author?: string;
  tags: string[];
  isDefault: boolean;
  
  // Customization
  customizable: boolean;
  requiredFields: string[];
  optionalFields: string[];
}

/**
 * Section within a summary template
 */
export interface TemplateSection {
  id: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
  
  // Content specification
  contentType: 'insights' | 'recommendations' | 'trends' | 'metrics' | 'timeline' | 'custom';
  maxItems?: number;
  minItems?: number;
  
  // Filtering and selection
  filters?: SectionFilter[];
  sortBy?: 'importance' | 'confidence' | 'date' | 'category';
  
  // Formatting
  format: 'paragraph' | 'list' | 'table' | 'chart' | 'timeline';
  includeEvidence?: boolean;
  includeMetadata?: boolean;
}

/**
 * Filter for template sections
 */
export interface SectionFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater-than' | 'less-than' | 'in' | 'not-in';
  value: any;
  required: boolean;
}

/**
 * Summary generation context
 */
export interface SummaryContext {
  // Input data
  themes: DetectedTheme[];
  patterns: DetectedPattern[];
  themeDetectionResult: ThemeDetectionResult;
  
  // User context
  userId?: string;
  userPreferences?: UserPreferences;
  previousSummaries?: string[]; // Summary IDs
  
  // Generation context
  purpose: 'daily-review' | 'weekly-summary' | 'monthly-report' | 'project-review' | 'custom';
  audience: 'self' | 'team' | 'manager' | 'public';
  
  // Technical context
  availableModels: string[];
  processingConstraints?: ProcessingConstraints;
}

/**
 * User preferences for summary generation
 */
export interface UserPreferences {
  defaultFormat: 'concise' | 'detailed' | 'executive' | 'technical';
  defaultStyle: 'formal' | 'casual' | 'academic' | 'personal';
  preferredLength: 'short' | 'medium' | 'long';
  
  // Content preferences
  includeEvidence: boolean;
  includeRecommendations: boolean;
  includeCharts: boolean;
  includeTimeline: boolean;
  
  // Category preferences
  priorityCategories: ThemeCategory[];
  excludedCategories: ThemeCategory[];
  
  // Notification preferences
  notifyOnCompletion: boolean;
  emailSummary: boolean;
  
  // Privacy preferences
  shareAnonymizedData: boolean;
  retainSummaries: boolean;
  retentionPeriod: number; // days
}

/**
 * Processing constraints for summary generation
 */
export interface ProcessingConstraints {
  maxProcessingTime: number; // milliseconds
  maxTokens: number;
  maxMemoryUsage: number; // MB
  prioritizeSpeed: boolean;
  enableCaching: boolean;
}

/**
 * Summary generation result with metadata
 */
export interface SummaryGenerationResult {
  summary: GeneratedSummary;
  success: boolean;
  error?: string;
  warnings: string[];
  
  // Performance metrics
  processingTime: number;
  tokensUsed: number;
  memoryUsed: number;
  cacheHits: number;
  
  // Quality metrics
  qualityScore: number;
  completenessScore: number;
  coherenceScore: number;
  
  // Generation metadata
  modelUsed: string;
  templateUsed?: string;
  optionsUsed: SummaryOptions;
  contextUsed: Partial<SummaryContext>;
}

/**
 * Batch summary generation request
 */
export interface BatchSummaryRequest {
  id: string;
  summaries: Array<{
    id: string;
    context: SummaryContext;
    options: SummaryOptions;
    template?: string;
  }>;
  priority: 'low' | 'medium' | 'high';
  deadline?: Date;
  notificationEmail?: string;
}

/**
 * Batch summary generation result
 */
export interface BatchSummaryResult {
  requestId: string;
  results: SummaryGenerationResult[];
  overallSuccess: boolean;
  totalProcessingTime: number;
  completedAt: Date;
  errors: string[];
  warnings: string[];
}

/**
 * Main interface for summary generation engine
 */
export interface SummaryGenerator {
  // Configuration
  configure(options: Partial<SummaryOptions>): void;
  getConfiguration(): SummaryOptions;
  
  // Template management
  loadTemplate(templateId: string): Promise<SummaryTemplate>;
  saveTemplate(template: SummaryTemplate): Promise<void>;
  getAvailableTemplates(): Promise<SummaryTemplate[]>;
  
  // Main generation methods
  generateSummary(
    context: SummaryContext, 
    options: SummaryOptions, 
    template?: SummaryTemplate
  ): Promise<SummaryGenerationResult>;
  
  generateBatchSummaries(request: BatchSummaryRequest): Promise<BatchSummaryResult>;
  
  // Component methods
  prioritizePatterns(patterns: DetectedPattern[], options: SummaryOptions): DetectedPattern[];
  patternsToInsights(patterns: DetectedPattern[], options: SummaryOptions): Promise<Insight[]>;
  generateRecommendations(insights: Insight[], context: SummaryContext): Promise<Recommendation[]>;
  analyzeTrends(themes: DetectedTheme[], timeframe: DateRange): Promise<TrendAnalysis[]>;
  
  // Formatting methods
  formatSummary(insights: Insight[], options: SummaryOptions, template?: SummaryTemplate): string;
  generateTitle(options: SummaryOptions, context: SummaryContext): string;
  generateExecutiveSummary(insights: Insight[], options: SummaryOptions): string;
  
  // Utility methods
  validateContext(context: SummaryContext): { valid: boolean; errors: string[] };
  estimateProcessingTime(context: SummaryContext, options: SummaryOptions): number;
  
  // AI integration
  setAIModel(model: AIModelAdapter): void;
  getAIModel(): AIModelAdapter | null;
  
  // Performance and caching
  clearCache(): void;
  getPerformanceMetrics(): SummaryPerformanceMetrics;
}

/**
 * Performance metrics for summary generation
 */
export interface SummaryPerformanceMetrics {
  totalSummariesGenerated: number;
  averageProcessingTime: number;
  averageTokensUsed: number;
  cacheHitRate: number;
  errorRate: number;
  
  // Quality metrics
  averageQualityScore: number;
  averageCoherenceScore: number;
  averageCompletenessScore: number;
  
  // User satisfaction
  averageUserRating: number;
  feedbackCount: number;
  
  // Performance breakdown
  insightGenerationTime: number;
  recommendationGenerationTime: number;
  formattingTime: number;
  aiProcessingTime: number;
  
  // Resource usage
  memoryUsage: number;
  cpuUsage: number;
  
  lastUpdated: Date;
}

/**
 * Summary generation configuration
 */
export interface SummaryGeneratorConfig {
  // Default options
  defaultSummaryOptions: SummaryOptions;
  defaultTemplate: string;
  
  // AI configuration
  aiModel: string;
  fallbackModel?: string;
  maxRetries: number;
  timeout: number;
  
  // Performance settings
  enableCaching: boolean;
  cacheSize: number;
  maxConcurrentGenerations: number;
  
  // Quality settings
  minQualityThreshold: number;
  enableQualityValidation: boolean;
  
  // Output settings
  outputFormats: ('markdown' | 'html' | 'plain')[];
  enableExport: boolean;
  
  // Logging and monitoring
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
} 