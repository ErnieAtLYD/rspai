// src/services/AnalysisManager.ts

import { App, TFile, Notice } from "obsidian";
import { BaseService } from "./BaseService";
import { CacheService } from "./CacheService";
import { PatternRecognitionService, PatternData, TrendData, InsightData } from "./PatternRecognitionService";
import { AIService } from "./AIService";
import { FileOperationsService } from "./FileOperationsService";
import { ErrorHandlingService } from "./ErrorHandlingService";

export interface AnalysisRequest {
    type: 'pattern' | 'trend' | 'insight' | 'comprehensive';
    timeRange: string;
    files?: TFile[];
    options?: AnalysisOptions;
}

export interface AnalysisOptions {
    useCache?: boolean;
    depth?: 'shallow' | 'medium' | 'deep';
    includePredictions?: boolean;
    generateSummary?: boolean;
}

export interface AnalysisResult {
    id: string;
    timestamp: number;
    type: string;
    timeRange: string;
    patterns: PatternData[];
    trends: TrendData[];
    insights: InsightData[];
    summary?: string;
    confidence: number;
    metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
    fileCount: number;
    processingTime: number;
    options: AnalysisOptions;
    [key: string]: string | number | boolean | AnalysisOptions | undefined;
}

export interface CacheStats {
    size: number;
    maxSize: number;
    hitRatio: number;
    memoryUsage: number;
}

export interface AnalysisManagerConfig {
    aiService: AIService;
    fileOperationsService: FileOperationsService;
    cacheService: CacheService;
    patternRecognitionService: PatternRecognitionService;
    errorHandler: ErrorHandlingService;
    defaultOptions: AnalysisOptions;
}

/**
 * Analysis Manager - Central orchestrator for AI-powered analysis
 * Coordinates pattern recognition, trend analysis, and insight generation
 */
export class AnalysisManager extends BaseService {
    private config: AnalysisManagerConfig;
    private activeAnalyses: Map<string, Promise<AnalysisResult>> = new Map();
    private analysisHistory: AnalysisResult[] = [];
    private historyLoaded = false;

    constructor(app: App, config: AnalysisManagerConfig) {
        super(app);
        this.config = config;
    }

    private get errorHandler(): ErrorHandlingService {
        return this.config.errorHandler;
    }

    protected async onInitialize(): Promise<void> {
        // Check that required services exist (but don't check if they're ready yet)
        const requiredServices = [
            this.config.aiService,
            this.config.fileOperationsService,
            this.config.cacheService,
            this.config.patternRecognitionService,
            this.config.errorHandler
        ];

        for (const service of requiredServices) {
            if (!service) {
                throw new Error("AnalysisManager requires all services to be provided");
            }
        }

        // Don't load analysis history during initialization - defer until all services are ready
        // This will be loaded lazily on first use
        
        // Use console logging during initialization instead of error handler
        console.log("AnalysisManager initialized");
    }

    protected async onDispose(): Promise<void> {
        // Cancel active analyses
        if (this.activeAnalyses.size > 0) {
            console.log(`AnalysisManager: Cancelling ${this.activeAnalyses.size} active analyses`);
        }
        this.activeAnalyses.clear();

        // Save analysis history (only if it was loaded)
        if (this.historyLoaded) {
            await this.saveAnalysisHistory();
        }
        
        this.analysisHistory = [];
        this.historyLoaded = false;
        console.log("AnalysisManager disposed");
    }

    /**
     * Perform comprehensive analysis
     */
    async analyzeJournalEntries(
        daysBack = 7,
        options: AnalysisOptions = {}
    ): Promise<AnalysisResult> {
        this.ensureReady();

        const analysisOptions = { ...this.config.defaultOptions, ...options };
        const timeRange = `${daysBack}d`;
        const analysisId = this.generateAnalysisId('comprehensive', timeRange);

        // Check if analysis is already running
        if (this.activeAnalyses.has(analysisId)) {
            const existingAnalysis = this.activeAnalyses.get(analysisId);
            if (existingAnalysis) {
                return await existingAnalysis;
            }
        }

        // Start new analysis
        const analysisPromise = this.performComprehensiveAnalysis(
            daysBack,
            timeRange,
            analysisOptions
        );

        this.activeAnalyses.set(analysisId, analysisPromise);

        try {
            const result = await analysisPromise;
            await this.ensureHistoryLoaded();
            this.analysisHistory.push(result);
            return result;
        } finally {
            this.activeAnalyses.delete(analysisId);
        }
    }

    /**
     * Perform pattern analysis only
     */
    async analyzePatterns(
        daysBack = 7,
        options: AnalysisOptions = {}
    ): Promise<PatternData[]> {
        this.ensureReady();

        const files = await this.getAnalysisFiles(daysBack);
        const timeRange = `${daysBack}d`;
        
        if (options.useCache !== false) {
            const cacheKey = this.config.cacheService.generateAnalysisKey('patterns', {
                daysBack,
                fileCount: files.length,
                options
            });
            
            const cached = await this.config.cacheService.get<PatternData[]>(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const analysisResult = await this.config.patternRecognitionService.analyzeFiles(files, timeRange);
        
        if (options.useCache !== false) {
            const cacheKey = this.config.cacheService.generateAnalysisKey('patterns', {
                daysBack,
                fileCount: files.length,
                options
            });
            await this.config.cacheService.set(cacheKey, analysisResult.patterns, { ttl: 6 * 60 * 60 * 1000 });
        }

        return analysisResult.patterns;
    }

    /**
     * Perform trend analysis only
     */
    async analyzeTrends(
        daysBack = 14,
        options: AnalysisOptions = {}
    ): Promise<TrendData[]> {
        this.ensureReady();

        const files = await this.getAnalysisFiles(daysBack);
        const timeRange = `${daysBack}d`;
        
        if (options.useCache !== false) {
            const cacheKey = this.config.cacheService.generateAnalysisKey('trends', {
                daysBack,
                fileCount: files.length,
                options
            });
            
            const cached = await this.config.cacheService.get<TrendData[]>(cacheKey);
            if (cached) {
                return cached;
            }
        }
        
        const analysisResult = await this.config.patternRecognitionService.analyzeFiles(files, timeRange);
        
        if (options.useCache !== false) {
            const cacheKey = this.config.cacheService.generateAnalysisKey('trends', {
                daysBack,
                fileCount: files.length,
                options
            });
            await this.config.cacheService.set(cacheKey, analysisResult.trends, { ttl: 6 * 60 * 60 * 1000 });
        }
        
        return analysisResult.trends;
    }

    /**
     * Generate insights based on patterns and trends
     */
    async generateInsights(
        patterns: PatternData[],
        trends: TrendData[],
        additionalContext?: string
    ): Promise<InsightData[]> {
        this.ensureReady();

        const cacheKey = this.config.cacheService.generateAnalysisKey('insights', {
            patternCount: patterns.length,
            trendCount: trends.length,
            hasContext: !!additionalContext
        });

        const cached = await this.config.cacheService.get<InsightData[]>(cacheKey);
        if (cached) {
            return cached;
        }

        const content = additionalContext || '';
        const insights = await this.config.patternRecognitionService.generateInsights(patterns, trends, content);
        
        await this.config.cacheService.set(cacheKey, insights, { ttl: 4 * 60 * 60 * 1000 });
        
        return insights;
    }

    /**
     * Get analysis summary for time period
     */
    async getAnalysisSummary(daysBack = 7): Promise<string> {
        this.ensureReady();

        const result = await this.analyzeJournalEntries(daysBack, { generateSummary: true });
        return result.summary || 'No summary available';
    }

    /**
     * Get analysis history
     */
    async getAnalysisHistory(): Promise<AnalysisResult[]> {
        await this.ensureHistoryLoaded();
        return [...this.analysisHistory];
    }

    /**
     * Clear analysis cache
     */
    async clearAnalysisCache(): Promise<void> {
        this.ensureReady();
        
        const keys = this.config.cacheService.getKeys();
        const analysisKeys = keys.filter(key => key.startsWith('analysis:') || key.startsWith('pattern:'));
        
        for (const key of analysisKeys) {
            await this.config.cacheService.delete(key);
        }
        
        new Notice(`RETROSPECT-AI: Cleared ${analysisKeys.length} analysis cache entries`);
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): CacheStats {
        return this.config.cacheService.getStats();
    }

    private async performComprehensiveAnalysis(
        daysBack: number,
        timeRange: string,
        options: AnalysisOptions
    ): Promise<AnalysisResult> {
        const startTime = Date.now();
        const analysisId = this.generateAnalysisId('comprehensive', timeRange);

        try {
            // Get files for analysis
            const files = await this.getAnalysisFiles(daysBack);
            
            if (files.length === 0) {
                throw new Error('No files found for analysis');
            }

            // Perform pattern recognition
            const analysisResult = await this.config.patternRecognitionService.analyzeFiles(files, timeRange);
            
            // Generate summary if requested
            let summary: string | undefined;
            if (options.generateSummary) {
                summary = await this.generateAnalysisSummary(analysisResult, files);
            }

            // Calculate overall confidence
            const confidence = this.calculateOverallConfidence(analysisResult);

            const result: AnalysisResult = {
                id: analysisId,
                timestamp: Date.now(),
                type: 'comprehensive',
                timeRange,
                patterns: analysisResult.patterns,
                trends: analysisResult.trends,
                insights: analysisResult.insights,
                summary,
                confidence,
                metadata: {
                    fileCount: files.length,
                    processingTime: Date.now() - startTime,
                    options
                }
            };

            return result;
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: 'perform_comprehensive_analysis',
                    component: 'AnalysisManager',
                    metadata: { daysBack, timeRange, analysisId },
                    timestamp: Date.now()
                }
            );
            throw error;
        }
    }

    private async getAnalysisFiles(daysBack: number): Promise<TFile[]> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        return await this.config.fileOperationsService.findRecentNotes();
    }

    private async generateAnalysisSummary(
        analysisResult: { patterns: PatternData[]; trends: TrendData[]; insights: InsightData[] },
        files: TFile[]
    ): Promise<string> {
        const prompt = `Create a comprehensive analysis summary based on the following data:

FILES ANALYZED: ${files.length} journal entries

PATTERNS DETECTED:
${analysisResult.patterns.map(p => `- ${p.description} (${(p.confidence * 100).toFixed(0)}% confidence)`).join('\n')}

TRENDS IDENTIFIED:
${analysisResult.trends.map(t => `- ${t.metric}: ${t.direction} trend (strength: ${t.strength.toFixed(2)})`).join('\n')}

KEY INSIGHTS:
${analysisResult.insights.map(i => `- ${i.category}: ${i.insight}`).join('\n')}

Please provide a 2-3 paragraph summary that:
1. Highlights the most significant patterns and trends
2. Provides actionable insights for personal growth
3. Maintains a supportive and encouraging tone
4. Focuses on opportunities for improvement and positive reinforcement`;

        try {
            return await this.errorHandler.executeWithRetry(
                () => this.config.aiService.generateResponse(prompt),
                {
                    operation: 'generate_analysis_summary',
                    component: 'AnalysisManager',
                    metadata: { fileCount: files.length, patternCount: analysisResult.patterns.length },
                    timestamp: Date.now()
                }
            );
        } catch (error) {
            await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                {
                    operation: 'generate_analysis_summary_fallback',
                    component: 'AnalysisManager',
                    metadata: { fileCount: files.length },
                    timestamp: Date.now()
                }
            );
            return 'Analysis completed but summary generation failed.';
        }
    }

    private calculateOverallConfidence(analysisResult: { patterns: PatternData[]; trends: TrendData[]; insights: InsightData[] }): number {
        const allConfidences = [
            ...analysisResult.patterns.map(p => p.confidence),
            ...analysisResult.trends.map(t => t.strength),
            ...analysisResult.insights.map(i => i.confidence)
        ];

        if (allConfidences.length === 0) return 0;

        const averageConfidence = allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length;
        return Math.round(averageConfidence * 100) / 100;
    }

    private generateAnalysisId(type: string, timeRange: string): string {
        const timestamp = Date.now();
        return `${type}_${timeRange}_${timestamp}`;
    }

    private async ensureHistoryLoaded(): Promise<void> {
        if (this.historyLoaded) {
            return;
        }
        
        await this.loadAnalysisHistory();
        this.historyLoaded = true;
    }

    private async loadAnalysisHistory(): Promise<void> {
        try {
            // Check if cache service is ready before attempting to load
            if (!this.config.cacheService.isReady()) {
                console.log('AnalysisManager: Cache service not ready, skipping history load');
                return;
            }
            
            const cached = await this.config.cacheService.get<AnalysisResult[]>('analysis_history');
            if (cached) {
                this.analysisHistory = cached;
                console.log(`AnalysisManager: Loaded ${cached.length} entries from analysis history`);
            }
        } catch (error) {
            // Use console logging if error handler is not ready
            if (this.isReady() && this.errorHandler && this.errorHandler.isReady()) {
                await this.errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    {
                        operation: 'load_analysis_history',
                        component: 'AnalysisManager',
                        timestamp: Date.now()
                    },
                    { showNotice: false }
                );
            } else {
                console.warn('AnalysisManager: Failed to load analysis history:', error);
            }
        }
    }

    private async saveAnalysisHistory(): Promise<void> {
        try {
            // Keep only last 50 analyses
            const recentHistory = this.analysisHistory.slice(-50);
            await this.config.cacheService.set('analysis_history', recentHistory, { ttl: 30 * 24 * 60 * 60 * 1000 });
        } catch (error) {
            // Check if we're in a ready state before using error handler
            if (this.isReady() && this.errorHandler && this.errorHandler.isReady()) {
                await this.errorHandler.handleError(
                    error instanceof Error ? error : new Error(String(error)),
                    {
                        operation: 'save_analysis_history',
                        component: 'AnalysisManager',
                        timestamp: Date.now()
                    },
                    { showNotice: false }
                );
            } else {
                // Fallback to console logging during disposal
                console.warn('AnalysisManager: Failed to save analysis history:', error);
            }
        }
    }
}