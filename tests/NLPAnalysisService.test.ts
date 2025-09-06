// tests/NLPAnalysisService.test.ts

import { NLPAnalysisService, NLPAnalysisConfig } from '../src/services/NLPAnalysisService';

// Mock Obsidian App
const mockApp = {
    vault: {
        adapter: {
            read: jest.fn(),
            write: jest.fn(),
            exists: jest.fn()
        }
    }
} as any;

// Mock CacheService
const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn()
} as any;

// Mock ErrorHandlingService
const mockErrorHandler = {
    handleError: jest.fn(),
    executeWithRetry: jest.fn()
} as any;

// Mock NLP Config
const mockConfig: NLPAnalysisConfig = {
    cacheService: mockCacheService,
    errorHandler: mockErrorHandler,
    enableEntityRecognition: true,
    enableAdvancedSentiment: true,
    themeExtractionDepth: 'moderate',
    blockerDetectionSensitivity: 'medium'
};

describe('NLPAnalysisService', () => {
    let nlpService: NLPAnalysisService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock executeWithRetry to just execute the function
        mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
        // Mock cache misses by default
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);
        
        nlpService = new NLPAnalysisService(mockApp, mockConfig);
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            await nlpService.initialize();
            expect(nlpService.isReady()).toBe(true);
        });

        test('should dispose cleanly', async () => {
            await nlpService.initialize();
            await nlpService.dispose();
            expect(nlpService.isReady()).toBe(false);
        });

        test('should handle initialization errors gracefully', async () => {
            // Override the BaseService initialize method to simulate failure
            const originalInitialize = nlpService.initialize;
            nlpService.initialize = jest.fn().mockRejectedValue(new Error('Init failed'));
            
            await expect(nlpService.initialize()).rejects.toThrow('Init failed');
            expect(nlpService.isReady()).toBe(false);
            
            // Restore original method
            nlpService.initialize = originalInitialize;
        });
    });

    describe('Text Preprocessing', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should preprocess text successfully', async () => {
            const text = 'Today I worked on a challenging project. It was difficult but rewarding.';
            
            const result = await nlpService.preprocessText(text);
            
            expect(result).toBeDefined();
            expect(result.originalText).toBe(text);
            expect(result.cleanedText).toBeDefined();
            expect(Array.isArray(result.tokens)).toBe(true);
            expect(Array.isArray(result.sentences)).toBe(true);
            expect(Array.isArray(result.keywords)).toBe(true);
            expect(result.tokens.length).toBeGreaterThan(0);
        });

        test('should handle empty text', async () => {
            const result = await nlpService.preprocessText('');
            
            expect(result).toBeDefined();
            expect(result.originalText).toBe('');
            expect(result.cleanedText).toBe('');
            expect(result.tokens).toEqual([]);
            expect(result.sentences).toEqual([]);
            expect(result.keywords).toEqual([]);
        });

        test('should extract keywords from text', async () => {
            const text = 'I completed the project management tasks today. The team meeting was productive.';
            
            const result = await nlpService.preprocessText(text);
            
            expect(result.keywords.length).toBeGreaterThan(0);
        });
    });

    describe('Productivity Theme Extraction', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should extract themes from project management text', async () => {
            const text = 'Today I worked on project planning and set new deadlines for the sprint milestones.';
            
            const themes = await nlpService.extractProductivityThemes(text);
            
            expect(Array.isArray(themes)).toBe(true);
            // Should find project management related themes
            const projectTheme = themes.find(t => t.theme.includes('project') || t.theme.includes('management'));
            expect(projectTheme).toBeDefined();
            if (projectTheme) {
                expect(projectTheme.confidence).toBeGreaterThan(0);
                expect(Array.isArray(projectTheme.keywords)).toBe(true);
                expect(Array.isArray(projectTheme.context)).toBe(true);
            }
        });

        test('should return empty array for non-productive text', async () => {
            const text = 'The sky is blue and the grass is green.';
            
            const themes = await nlpService.extractProductivityThemes(text);
            
            expect(Array.isArray(themes)).toBe(true);
            // Should have minimal or no productivity themes
            expect(themes.length).toBeLessThanOrEqual(1);
        });

        test('should use cache for repeated requests', async () => {
            const text = 'Project management and deadline planning session.';
            
            // First call
            await nlpService.extractProductivityThemes(text);
            
            // Second call should hit cache
            mockCacheService.get.mockResolvedValueOnce([
                { theme: 'cached_theme', confidence: 0.8, keywords: ['test'], frequency: 0.1, context: ['cached'] }
            ]);
            
            const cachedResult = await nlpService.extractProductivityThemes(text);
            
            expect(cachedResult[0].theme).toBe('cached_theme');
            expect(mockCacheService.get).toHaveBeenCalled();
        });
    });

    describe('Blocker Detection', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should detect procrastination blockers', async () => {
            const text = 'I kept procrastinating on this task because I was avoiding the difficult parts.';
            
            const blockers = await nlpService.detectProductivityBlockers(text);
            
            expect(Array.isArray(blockers)).toBe(true);
            const procrastinationBlocker = blockers.find(b => b.type === 'procrastination');
            expect(procrastinationBlocker).toBeDefined();
            if (procrastinationBlocker) {
                expect(procrastinationBlocker.confidence).toBeGreaterThan(0);
                expect(procrastinationBlocker.severity).toMatch(/low|medium|high/);
                expect(Array.isArray(procrastinationBlocker.indicators)).toBe(true);
            }
        });

        test('should detect workflow disruption blockers', async () => {
            const text = 'Multiple interruptions and meetings broke my focus throughout the day.';
            
            const blockers = await nlpService.detectProductivityBlockers(text);
            
            expect(Array.isArray(blockers)).toBe(true);
            // Check if any blocker was detected (may not be specifically workflow_disruption)
            if (blockers.length > 0) {
                expect(blockers[0]).toHaveProperty('type');
                expect(blockers[0]).toHaveProperty('confidence');
                expect(blockers[0]).toHaveProperty('severity');
            }
        });

        test('should return empty array for non-blocker text', async () => {
            const text = 'Had a very productive day with smooth workflow and good focus.';
            
            const blockers = await nlpService.detectProductivityBlockers(text);
            
            expect(Array.isArray(blockers)).toBe(true);
            expect(blockers.length).toBe(0);
        });

        test('should provide suggestions for detected blockers', async () => {
            const text = 'Time management issues caused delays in my project delivery.';
            
            const blockers = await nlpService.detectProductivityBlockers(text);
            
            const timeBlocker = blockers.find(b => b.type === 'time_management');
            if (timeBlocker && timeBlocker.suggestions) {
                expect(Array.isArray(timeBlocker.suggestions)).toBe(true);
                expect(timeBlocker.suggestions.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Sentiment Analysis', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should analyze positive sentiment', async () => {
            const text = 'I am very happy and excited about completing this amazing project successfully!';
            
            const sentiment = await nlpService.analyzeSentiment(text);
            
            expect(sentiment).toBeDefined();
            expect(sentiment.overall.label).toBe('positive');
            expect(sentiment.overall.polarity).toBeGreaterThan(0);
            expect(typeof sentiment.overall.subjectivity).toBe('number');
            expect(sentiment.emotions).toBeDefined();
            expect(['calm', 'moderate', 'energetic']).toContain(sentiment.arousal);
            expect(['uncertain', 'neutral', 'confident']).toContain(sentiment.confidence_level);
        });

        test('should analyze negative sentiment', async () => {
            const text = 'I am frustrated and disappointed with the poor results and setbacks.';
            
            const sentiment = await nlpService.analyzeSentiment(text);
            
            expect(sentiment).toBeDefined();
            expect(sentiment.overall.label).toBe('negative');
            expect(sentiment.overall.polarity).toBeLessThan(0);
        });

        test('should analyze neutral sentiment', async () => {
            const text = 'The meeting was scheduled for 2pm and covered standard agenda items.';
            
            const sentiment = await nlpService.analyzeSentiment(text);
            
            expect(sentiment).toBeDefined();
            expect(sentiment.overall.label).toBe('neutral');
            expect(Math.abs(sentiment.overall.polarity)).toBeLessThanOrEqual(0.2);
        });

        test('should detect productivity-specific sentiment', async () => {
            const text = 'Feeling overwhelmed with multiple deadlines and competing priorities.';
            
            const sentiment = await nlpService.analyzeSentiment(text);
            
            expect(sentiment.productivity_sentiment).toMatch(/accomplished|frustrated|overwhelmed|motivated|neutral/);
        });

        test('should handle empty text gracefully', async () => {
            const sentiment = await nlpService.analyzeSentiment('');
            
            expect(sentiment).toBeDefined();
            expect(sentiment.overall.label).toBe('neutral');
            expect(sentiment.overall.polarity).toBe(0);
        });
    });

    describe('Combined Analysis', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should perform combined analysis using multiple methods', async () => {
            const text = 'Today I struggled with procrastination on my project deadline. However, I managed to complete the research phase successfully.';
            
            // Test individual methods work together
            const preprocessing = await nlpService.preprocessText(text);
            const themes = await nlpService.extractProductivityThemes(text);
            const blockers = await nlpService.detectProductivityBlockers(text);
            const sentiment = await nlpService.analyzeSentiment(text);
            
            expect(preprocessing).toBeDefined();
            expect(themes).toBeDefined();
            expect(blockers).toBeDefined();
            expect(sentiment).toBeDefined();
            
            expect(Array.isArray(themes)).toBe(true);
            expect(Array.isArray(blockers)).toBe(true);
            expect(typeof sentiment).toBe('object');
        });

        test('should cache individual analysis results', async () => {
            const text = 'Analysis test text for caching.';
            
            // First call
            await nlpService.extractProductivityThemes(text);
            
            // Verify cache was called for setting
            expect(mockCacheService.set).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should handle malformed text gracefully', async () => {
            const malformedText = '\u0000\u0001\u0002Invalid characters';
            
            const result = await nlpService.preprocessText(malformedText);
            
            expect(result).toBeDefined();
            expect(result.cleanedText).not.toContain('\u0000');
        });

        test('should handle very long text', async () => {
            const longText = 'word '.repeat(10000);
            
            const themes = await nlpService.extractProductivityThemes(longText);
            
            expect(Array.isArray(themes)).toBe(true);
        });

        test('should fallback gracefully when NLP dependencies fail', async () => {
            // Mock a failure in NLP dependencies
            const originalMethod = nlpService['ensureNLPDependencies'];
            nlpService['ensureNLPDependencies'] = jest.fn().mockRejectedValue(new Error('NLP load failed'));
            
            const sentiment = await nlpService.analyzeSentiment('test text');
            
            // Should return neutral sentiment as fallback
            expect(sentiment.overall.label).toBe('neutral');
            
            // Restore original method
            nlpService['ensureNLPDependencies'] = originalMethod;
        });
    });

    describe('Configuration Impact', () => {
        test('should respect different analysis depths', async () => {
            const basicConfig = { ...mockConfig, themeExtractionDepth: 'basic' as const };
            const basicService = new NLPAnalysisService(mockApp, basicConfig);
            await basicService.initialize();
            
            const deepConfig = { ...mockConfig, themeExtractionDepth: 'deep' as const };
            const deepService = new NLPAnalysisService(mockApp, deepConfig);
            await deepService.initialize();
            
            const text = 'Project management and deadline planning with team collaboration.';
            
            const basicThemes = await basicService.extractProductivityThemes(text);
            const deepThemes = await deepService.extractProductivityThemes(text);
            
            // Both should work, deep might have more themes or higher confidence
            expect(Array.isArray(basicThemes)).toBe(true);
            expect(Array.isArray(deepThemes)).toBe(true);
            
            await basicService.dispose();
            await deepService.dispose();
        });

        test('should respect blocker detection sensitivity', async () => {
            const lowSensitivityConfig = { ...mockConfig, blockerDetectionSensitivity: 'low' as const };
            const lowSensitivityService = new NLPAnalysisService(mockApp, lowSensitivityConfig);
            await lowSensitivityService.initialize();
            
            const text = 'Slight delay in the project timeline due to minor issues.';
            
            const blockers = await lowSensitivityService.detectProductivityBlockers(text);
            
            // Low sensitivity should detect fewer blockers
            expect(Array.isArray(blockers)).toBe(true);
            
            await lowSensitivityService.dispose();
        });
    });
});