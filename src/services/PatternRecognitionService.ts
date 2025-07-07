// src/services/PatternRecognitionService.ts

import { App, TFile } from "obsidian";
import { BaseService } from "./BaseService";
import { CacheService } from "./CacheService";
import { AIService } from "./AIService";

export interface PatternData {
    type: string;
    confidence: number;
    timeRange: string;
    metadata: Record<string, any>;
    description: string;
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
    analysisDepth: 'shallow' | 'medium' | 'deep';
    patternThreshold: number;
    enableTrendAnalysis: boolean;
    enableSemanticAnalysis: boolean;
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

    constructor(app: App, config: PatternRecognitionConfig) {
        super(app);
        this.config = config;
    }

    protected async onInitialize(): Promise<void> {
        if (!this.config.aiService || !this.config.cacheService) {
            throw new Error("PatternRecognitionService requires AIService and CacheService");
        }
        
        console.log("Pattern recognition service initialized");
    }

    protected async onDispose(): Promise<void> {
        this.patterns.clear();
        this.trends.clear();
        this.insights.clear();
        console.log("Pattern recognition service disposed");
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

        // Mood pattern analysis
        const moodPatterns = await this.analyzeMoodPatterns(content);
        patterns.push(...moodPatterns);

        // Activity pattern analysis
        const activityPatterns = await this.analyzeActivityPatterns(content);
        patterns.push(...activityPatterns);

        // Sleep pattern analysis
        const sleepPatterns = await this.analyzeSleepPatterns(content);
        patterns.push(...sleepPatterns);

        // Productivity pattern analysis
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
                console.warn(`Failed to read file ${file.path}:`, error);
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

            const response = await this.config.aiService.generateResponse(prompt);
            
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
            console.error("Failed to generate AI insights:", error);
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
}