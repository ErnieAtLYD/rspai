// src/services/PatternRecognitionService.ts

import { App, TFile } from "obsidian";
import { BaseService } from "./BaseService";
import { CacheService } from "./CacheService";
import { AIService } from "./AIService";
import { ErrorHandlingService } from "./ErrorHandlingService";
import { NLPAnalysisService, ProductivityTheme, BlockerPattern, SentimentAnalysis } from "./NLPAnalysisService";

export interface PatternData {
    type: string;
    confidence: number;
    timeRange: string;
    metadata: Record<string, any>;
    description: string;
    // Enhanced NLP data
    themes?: ProductivityTheme[];
    blockers?: BlockerPattern[];
    sentiment?: SentimentAnalysis;
    nlpKeywords?: string[];
}

export interface TrendData {
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    timePoints: Array<{ date: string; value: number }>;
}

export interface InsightData {
    category: string;
    insight: string;
    confidence: number;
    supportingData: any[];
    timestamp: number;
}

export interface PatternRecognitionConfig {
    aiService: AIService;
    cacheService: CacheService;
    errorHandler: ErrorHandlingService;
    nlpService?: NLPAnalysisService;
    analysisDepth: 'shallow' | 'medium' | 'deep';
    patternThreshold: number;
    enableTrendAnalysis: boolean;
    enableSemanticAnalysis: boolean;
    enableAdvancedNLP: boolean;
}

/**
 * Pattern recognition service for analyzing journal entries
 * Identifies trends, patterns, and insights in user data
 */
export class PatternRecognitionService extends BaseService {
    private config: PatternRecognitionConfig;
    private patterns: Map<string, PatternData[]> = new Map();
    private trends: Map<string, TrendData[]> = new Map();
    private insights: Map<string, InsightData[]> = new Map();
    private nlpService?: NLPAnalysisService;

    constructor(app: App, config: PatternRecognitionConfig) {
        super(app);
        this.config = config;
    }

    private get errorHandler(): ErrorHandlingService {
        return this.config.errorHandler;
    }

    protected async onInitialize(): Promise<void> {
        if (!this.config.aiService || !this.config.cacheService || !this.config.errorHandler) {
            throw new Error("PatternRecognitionService requires AIService, CacheService, and ErrorHandlingService");
        }
        // Initialize NLP service if available and enabled
        if (this.config.enableAdvancedNLP && this.config.nlpService) {
            this.nlpService = this.config.nlpService;
            if (!this.nlpService.isReady()) {
                await this.nlpService.initialize();
            }
        }
        
        // Use console logging during initialization instead of error handler
        console.log("PatternRecognitionService initialized");
    }

    protected async onDispose(): Promise<void> {
        this.patterns.clear();
        this.trends.clear();
        this.insights.clear();
        
        // Use console logging during disposal instead of error handler
        console.log("PatternRecognitionService disposed");
    }

    /**
     * Analyze files for patterns and trends
     */
    async analyzeFiles(files: TFile[], dateRange: string): Promise<{
        patterns: PatternData[];
        trends: TrendData[];
        insights: InsightData[];
    }> {
        this.ensureReady();
        
        const contentHash = await this.generateContentHash(files);
        const cacheKey = this.config.cacheService.generatePatternKey(dateRange, contentHash);
        
        // Check cache first
        const cachedResult = await this.config.cacheService.get<{
            patterns: PatternData[];
            trends: TrendData[];
            insights: InsightData[];
        }>(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }

        // Perform analysis
        const analysisResult = await this.performAnalysis(files, dateRange);
        
        // Cache result for 12 hours
        await this.config.cacheService.set(cacheKey, analysisResult, { ttl: 12 * 60 * 60 * 1000 });
        
        return analysisResult;
    }

    /**
     * Detect behavioral patterns in journal entries
     */
    async detectBehavioralPatterns(content: string, timeRange: string): Promise<PatternData[]> {
        const patterns: PatternData[] = [];

        // Enhanced NLP analysis if available
        if (this.config.enableAdvancedNLP && this.nlpService) {
            const nlpPatterns = await this.performAdvancedNLPAnalysis(content, timeRange);
            patterns.push(...nlpPatterns);
        }

        // Traditional keyword-based analysis (as fallback or supplement)
        const moodPatterns = await this.analyzeMoodPatterns(content);
        patterns.push(...moodPatterns);

        const activityPatterns = await this.analyzeActivityPatterns(content);
        patterns.push(...activityPatterns);

        const sleepPatterns = await this.analyzeSleepPatterns(content);
        patterns.push(...sleepPatterns);

        const productivityPatterns = await this.analyzeProductivityPatterns(content);
        patterns.push(...productivityPatterns);

        return patterns.filter(p => p.confidence >= this.config.patternThreshold);
    }

    /**
     * Analyze trends over time
     */
    async analyzeTrends(files: TFile[]): Promise<TrendData[]> {
        if (!this.config.enableTrendAnalysis) {
            return [];
        }

        const trends: TrendData[] = [];
        
        // Word count trends
        const wordCountTrend = await this.analyzeWordCountTrend(files);
        if (wordCountTrend) trends.push(wordCountTrend);

        // Sentiment trends
        const sentimentTrend = await this.analyzeSentimentTrend(files);
        if (sentimentTrend) trends.push(sentimentTrend);

        // Topic diversity trends
        const topicTrend = await this.analyzeTopicDiversityTrend(files);
        if (topicTrend) trends.push(topicTrend);

        return trends;
    }

    /**
     * Generate insights using AI analysis
     */
    async generateInsights(patterns: PatternData[], trends: TrendData[], content: string): Promise<InsightData[]> {
        const insights: InsightData[] = [];

        if (this.config.enableSemanticAnalysis) {
            // Use AI to generate deep insights
            const aiInsights = await this.generateAIInsights(patterns, trends, content);
            insights.push(...aiInsights);
        }

        // Generate rule-based insights
        const ruleBasedInsights = await this.generateRuleBasedInsights(patterns, trends);
        insights.push(...ruleBasedInsights);

        return insights;
    }

    private async performAnalysis(files: TFile[], dateRange: string): Promise<{
        patterns: PatternData[];
        trends: TrendData[];
        insights: InsightData[];
    }> {
        // Extract content from files
        const content = await this.extractContent(files);
        
        // Detect patterns
        const patterns = await this.detectBehavioralPatterns(content, dateRange);
        
        // Analyze trends
        const trends = await this.analyzeTrends(files);
        
        // Generate insights
        const insights = await this.generateInsights(patterns, trends, content);

        return { patterns, trends, insights };
    }

    private async extractContent(files: TFile[]): Promise<string> {
        const contents: string[] = [];
        
        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                contents.push(content);
            } catch (error) {
                await this.errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    {
                        operation: 'extract_content_read_file',
                        component: 'PatternRecognitionService',
                        metadata: { filePath: file.path },
                        timestamp: Date.now()
                    },
                    { showNotice: false }
                );
            }
        }
        
        return contents.join('\n\n');
    }

    private async generateContentHash(files: TFile[]): Promise<string> {
        const fileData = files.map(f => ({
            path: f.path,
            mtime: f.stat.mtime,
            size: f.stat.size
        }));
        
        const str = JSON.stringify(fileData);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash;
        }
        return hash.toString(36);
    }

    private async analyzeMoodPatterns(content: string): Promise<PatternData[]> {
        const patterns: PatternData[] = [];
        
        // Simple mood keyword analysis
        const moodKeywords = {
            positive: ['happy', 'excited', 'grateful', 'proud', 'joy', 'good', 'great', 'amazing'],
            negative: ['sad', 'angry', 'frustrated', 'worried', 'stressed', 'bad', 'terrible', 'awful'],
            neutral: ['okay', 'fine', 'normal', 'average', 'alright']
        };

        const wordCount = content.toLowerCase().split(/\s+/).length;
        
        for (const [mood, keywords] of Object.entries(moodKeywords)) {
            const matches = keywords.filter(keyword => 
                content.toLowerCase().includes(keyword)
            ).length;
            
            if (matches > 0) {
                const frequency = matches / wordCount;
                patterns.push({
                    type: `mood_${mood}`,
                    confidence: Math.min(frequency * 100, 1.0),
                    timeRange: 'recent',
                    metadata: { keywords: keywords.filter(k => content.toLowerCase().includes(k)), frequency },
                    description: `Detected ${mood} mood patterns with ${matches} keyword matches`
                });
            }
        }

        return patterns;
    }

    private async analyzeActivityPatterns(content: string): Promise<PatternData[]> {
        const patterns: PatternData[] = [];
        
        // Activity keywords
        const activityKeywords = {
            exercise: ['run', 'gym', 'workout', 'walk', 'bike', 'swim', 'exercise'],
            social: ['friends', 'family', 'dinner', 'party', 'meeting', 'social'],
            work: ['work', 'project', 'meeting', 'deadline', 'task', 'job'],
            creative: ['write', 'draw', 'paint', 'music', 'create', 'art']
        };

        for (const [activity, keywords] of Object.entries(activityKeywords)) {
            const matches = keywords.filter(keyword => 
                content.toLowerCase().includes(keyword)
            ).length;
            
            if (matches > 2) {
                patterns.push({
                    type: `activity_${activity}`,
                    confidence: Math.min(matches / 10, 1.0),
                    timeRange: 'recent',
                    metadata: { keywords: keywords.filter(k => content.toLowerCase().includes(k)) },
                    description: `High ${activity} activity detected`
                });
            }
        }

        return patterns;
    }

    private async analyzeSleepPatterns(content: string): Promise<PatternData[]> {
        const patterns: PatternData[] = [];
        
        const sleepKeywords = ['sleep', 'tired', 'exhausted', 'rest', 'bed', 'wake', 'dream'];
        const matches = sleepKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        ).length;
        
        if (matches > 1) {
            patterns.push({
                type: 'sleep_focus',
                confidence: Math.min(matches / 5, 1.0),
                timeRange: 'recent',
                metadata: { keywords: sleepKeywords.filter(k => content.toLowerCase().includes(k)) },
                description: 'Sleep-related concerns or focus detected'
            });
        }

        return patterns;
    }

    private async analyzeProductivityPatterns(content: string): Promise<PatternData[]> {
        const patterns: PatternData[] = [];
        
        const productivityKeywords = {
            high: ['productive', 'accomplished', 'finished', 'completed', 'achieved'],
            low: ['procrastinate', 'distracted', 'unfocused', 'lazy', 'behind']
        };

        for (const [level, keywords] of Object.entries(productivityKeywords)) {
            const matches = keywords.filter(keyword => 
                content.toLowerCase().includes(keyword)
            ).length;
            
            if (matches > 0) {
                patterns.push({
                    type: `productivity_${level}`,
                    confidence: Math.min(matches / 3, 1.0),
                    timeRange: 'recent',
                    metadata: { keywords: keywords.filter(k => content.toLowerCase().includes(k)) },
                    description: `${level} productivity pattern detected`
                });
            }
        }

        return patterns;
    }

    private async analyzeWordCountTrend(files: TFile[]): Promise<TrendData | null> {
        if (files.length < 3) return null;

        const wordCounts = await Promise.all(
            files.map(async (file) => {
                try {
                    const content = await this.app.vault.read(file);
                    const wordCount = content.split(/\s+/).length;
                    return {
                        date: file.basename,
                        value: wordCount
                    };
                } catch {
                    return null;
                }
            })
        );

        const validCounts = wordCounts.filter(c => c !== null) as Array<{ date: string; value: number }>;
        if (validCounts.length < 3) return null;

        // Simple trend analysis
        const values = validCounts.map(c => c!.value);
        const avgFirst = values.slice(0, Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(values.length / 2);
        const avgLast = values.slice(Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / (values.length - Math.floor(values.length / 2));
        
        const direction = avgLast > avgFirst * 1.1 ? 'increasing' : 
                         avgLast < avgFirst * 0.9 ? 'decreasing' : 'stable';
        
        const strength = Math.abs(avgLast - avgFirst) / avgFirst;

        return {
            metric: 'word_count',
            direction,
            strength,
            timePoints: validCounts
        };
    }

    private async analyzeSentimentTrend(files: TFile[]): Promise<TrendData | null> {
        // Placeholder for sentiment analysis
        return null;
    }

    private async analyzeTopicDiversityTrend(files: TFile[]): Promise<TrendData | null> {
        // Placeholder for topic diversity analysis
        return null;
    }

    private async generateAIInsights(patterns: PatternData[], trends: TrendData[], content: string): Promise<InsightData[]> {
        const insights: InsightData[] = [];

        try {
            const prompt = `Analyze the following patterns and trends from journal entries and provide 2-3 key insights:

Patterns detected:
${patterns.map(p => `- ${p.type}: ${p.description} (confidence: ${p.confidence.toFixed(2)})`).join('\n')}

Trends detected:
${trends.map(t => `- ${t.metric}: ${t.direction} trend (strength: ${t.strength.toFixed(2)})`).join('\n')}

Sample content:
${content.substring(0, 1000)}...

Please provide insights in this format:
1. [Category]: [Insight description]
2. [Category]: [Insight description]
3. [Category]: [Insight description]

Focus on actionable insights about personal growth, habits, and well-being.`;

            const response = await this.errorHandler.executeWithRetry(
                () => this.config.aiService.generateResponse(prompt),
                {
                    operation: 'ai_insights_generation',
                    component: 'PatternRecognitionService',
                    metadata: { patternCount: patterns.length, trendCount: trends.length },
                    timestamp: Date.now()
                }
            );
            
            // Parse AI response into insights
            const lines = response.split('\n').filter((line: string) => line.trim().match(/^\d+\./));
            
            for (const line of lines) {
                const match = line.match(/^\d+\.\s*\[([^\]]+)\]:\s*(.+)$/);
                if (match) {
                    insights.push({
                        category: match[1],
                        insight: match[2],
                        confidence: 0.8,
                        supportingData: [patterns, trends],
                        timestamp: Date.now()
                    });
                }
            }
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: 'generate_ai_insights',
                    component: 'PatternRecognitionService',
                    metadata: { patternCount: patterns.length, trendCount: trends.length },
                    timestamp: Date.now()
                }
            );
        }

        return insights;
    }

    private async generateRuleBasedInsights(patterns: PatternData[], trends: TrendData[]): Promise<InsightData[]> {
        const insights: InsightData[] = [];

        // High mood variation insight
        const moodPatterns = patterns.filter(p => p.type.startsWith('mood_'));
        if (moodPatterns.length > 2) {
            insights.push({
                category: 'Emotional Well-being',
                insight: 'You show varied emotional patterns - consider tracking specific triggers',
                confidence: 0.7,
                supportingData: moodPatterns,
                timestamp: Date.now()
            });
        }

        // Productivity patterns
        const productivityPatterns = patterns.filter(p => p.type.startsWith('productivity_'));
        if (productivityPatterns.some(p => p.type === 'productivity_low')) {
            insights.push({
                category: 'Productivity',
                insight: 'Consider identifying and addressing productivity blockers',
                confidence: 0.6,
                supportingData: productivityPatterns,
                timestamp: Date.now()
            });
        }

        // Writing trends
        const wordCountTrend = trends.find(t => t.metric === 'word_count');
        if (wordCountTrend && wordCountTrend.direction === 'increasing') {
            insights.push({
                category: 'Journaling Habits',
                insight: 'Your journal entries are becoming more detailed over time',
                confidence: 0.8,
                supportingData: [wordCountTrend],
                timestamp: Date.now()
            });
        }

        return insights;
    }

    /**
     * Perform advanced NLP analysis using the NLPAnalysisService
     */
    private async performAdvancedNLPAnalysis(content: string, timeRange: string): Promise<PatternData[]> {
        if (!this.nlpService) {
            return [];
        }

        try {
            const patterns: PatternData[] = [];

            // Extract productivity themes
            const themes = await this.nlpService.extractProductivityThemes(content);
            if (themes.length > 0) {
                patterns.push({
                    type: 'productivity_themes',
                    confidence: Math.max(...themes.map(t => t.confidence)),
                    timeRange,
                    metadata: { themeCount: themes.length },
                    description: `Identified ${themes.length} productivity themes: ${themes.map(t => t.theme).join(', ')}`,
                    themes,
                    nlpKeywords: themes.flatMap(t => t.keywords)
                });
            }

            // Detect productivity blockers
            const blockers = await this.nlpService.detectProductivityBlockers(content);
            if (blockers.length > 0) {
                patterns.push({
                    type: 'productivity_blockers',
                    confidence: Math.max(...blockers.map(b => b.confidence)),
                    timeRange,
                    metadata: { 
                        blockerCount: blockers.length,
                        severityLevels: blockers.map(b => b.severity)
                    },
                    description: `Detected ${blockers.length} productivity blockers: ${blockers.map(b => b.type).join(', ')}`,
                    blockers
                });
            }

            // Advanced sentiment analysis
            const sentiment = await this.nlpService.analyzeSentiment(content);
            patterns.push({
                type: 'advanced_sentiment',
                confidence: 0.8,
                timeRange,
                metadata: {
                    overallPolarity: sentiment.overall.polarity,
                    productivitySentiment: sentiment.productivity_sentiment,
                    arousal: sentiment.arousal,
                    confidenceLevel: sentiment.confidence_level
                },
                description: `Sentiment: ${sentiment.overall.label} (${sentiment.productivity_sentiment} productivity mood)`,
                sentiment
            });

            return patterns;
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: 'advanced_nlp_analysis',
                    component: 'PatternRecognitionService',
                    timestamp: Date.now()
                }
            );
            return [];
        }
    }

    /**
     * Generate enhanced insights using NLP data
     */
    private async generateEnhancedInsights(patterns: PatternData[], trends: TrendData[], content: string): Promise<InsightData[]> {
        const insights: InsightData[] = [];

        // Find patterns with NLP data
        const nlpPatterns = patterns.filter(p => p.themes || p.blockers || p.sentiment);
        
        for (const pattern of nlpPatterns) {
            if (pattern.themes) {
                // Theme-based insights
                const dominantTheme = pattern.themes.sort((a, b) => b.confidence - a.confidence)[0];
                insights.push({
                    category: 'Productivity Themes',
                    insight: `Your dominant productivity focus is on ${dominantTheme.theme} with ${dominantTheme.frequency.toFixed(2)} frequency`,
                    confidence: dominantTheme.confidence,
                    supportingData: [pattern.themes],
                    timestamp: Date.now()
                });
            }

            if (pattern.blockers) {
                // Blocker-based insights
                const highSeverityBlockers = pattern.blockers.filter(b => b.severity === 'high');
                if (highSeverityBlockers.length > 0) {
                    insights.push({
                        category: 'Productivity Blockers',
                        insight: `High-severity blockers detected: ${highSeverityBlockers.map(b => b.type).join(', ')}. ${highSeverityBlockers[0].suggestions?.join(', ') || 'Consider addressing these systematically.'}`,
                        confidence: Math.max(...highSeverityBlockers.map(b => b.confidence)),
                        supportingData: [highSeverityBlockers],
                        timestamp: Date.now()
                    });
                }
            }

            if (pattern.sentiment) {
                // Sentiment-based insights
                const sentiment = pattern.sentiment;
                if (sentiment.productivity_sentiment !== 'neutral') {
                    const emotionalContext = Object.entries(sentiment.emotions)
                        .filter(([_, value]) => value > 0.3)
                        .map(([emotion, _]) => emotion)
                        .join(', ');
                    
                    insights.push({
                        category: 'Emotional Well-being',
                        insight: `Productivity sentiment: ${sentiment.productivity_sentiment}. ${emotionalContext ? `Associated emotions: ${emotionalContext}` : ''}`,
                        confidence: 0.7,
                        supportingData: [sentiment],
                        timestamp: Date.now()
                    });
                }
            }
        }

        return insights;
    }
}