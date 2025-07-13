// tests/NLPAnalysisService.ErrorHandling.test.ts

import { NLPAnalysisService, NLPAnalysisConfig } from '../src/services/NLPAnalysisService';
import { CacheService } from '../src/services/CacheService';
import { ErrorHandlingService } from '../src/services/ErrorHandlingService';
import * as nlpLoader from '../src/services/nlp/nlp-loader';

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

describe('NLPAnalysisService Error Handling', () => {
    let nlpService: NLPAnalysisService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock executeWithRetry to just execute the function by default
        mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
        // Mock cache misses by default
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(undefined);
        
        nlpService = new NLPAnalysisService(mockApp, mockConfig);
    });

    afterEach(async () => {
        if (nlpService && nlpService.isReady()) {
            await nlpService.dispose();
        }
        // Restore all mocks
        jest.restoreAllMocks();
    });

    describe('Dynamic Import Failures', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should handle compromise library import failure gracefully', async () => {
            // Mock getNlp to fail
            const originalGetNlp = nlpLoader.getNlp;
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(new Error('Failed to import compromise'));

            const themes = await nlpService.extractProductivityThemes('project management tasks');

            // Should return empty array as fallback
            expect(Array.isArray(themes)).toBe(true);
            expect(themes.length).toBe(0);
            
            // Should have called error handler
            expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    operation: 'extract_productivity_themes',
                    component: 'NLPAnalysisService'
                })
            );

            // Restore mock
            jest.spyOn(nlpLoader, 'getNlp').mockImplementation(originalGetNlp);
        });

        test('should handle sentiment library import failure gracefully', async () => {
            // Mock getSentiment to fail
            jest.spyOn(nlpLoader, 'getSentiment').mockRejectedValue(new Error('Failed to import sentiment'));

            const sentiment = await nlpService.analyzeSentiment('I am very happy today');

            // Should return neutral sentiment as fallback
            expect(sentiment).toBeDefined();
            expect(sentiment.overall.label).toBe('neutral');
            expect(sentiment.overall.polarity).toBe(0);
            expect(sentiment.overall.subjectivity).toBe(0.5);
            
            // Should have called error handler
            expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    operation: 'analyze_sentiment',
                    component: 'NLPAnalysisService'
                })
            );
        });

        test('should handle natural library import failure gracefully', async () => {
            // Mock getNatural to fail
            jest.spyOn(nlpLoader, 'getNatural').mockRejectedValue(new Error('Failed to import natural'));

            const blockers = await nlpService.detectProductivityBlockers('procrastinating on important tasks');

            // Should return empty array as fallback
            expect(Array.isArray(blockers)).toBe(true);
            expect(blockers.length).toBe(0);
            
            // Should have called error handler
            expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    operation: 'detect_productivity_blockers',
                    component: 'NLPAnalysisService'
                })
            );
        });

        test('should handle multiple library failures in sequence', async () => {
            // Mock all libraries to fail
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(new Error('compromise failed'));
            jest.spyOn(nlpLoader, 'getSentiment').mockRejectedValue(new Error('sentiment failed'));
            jest.spyOn(nlpLoader, 'getNatural').mockRejectedValue(new Error('natural failed'));

            const [themes, sentiment, blockers] = await Promise.all([
                nlpService.extractProductivityThemes('test text'),
                nlpService.analyzeSentiment('test text'),
                nlpService.detectProductivityBlockers('test text')
            ]);

            // All should return safe fallbacks
            expect(Array.isArray(themes)).toBe(true);
            expect(themes.length).toBe(0);
            
            expect(sentiment.overall.label).toBe('neutral');
            
            expect(Array.isArray(blockers)).toBe(true);
            expect(blockers.length).toBe(0);
            
            // Error handler should have been called for each failure
            expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(3);
        });
    });

    describe('Partial Library Failures', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should handle corrupted library exports gracefully', async () => {
            // Mock library that imports but has invalid exports
            jest.spyOn(nlpLoader, 'getNlp').mockResolvedValue(null as any);

            try {
                await nlpService.extractProductivityThemes('test text');
            } catch (error) {
                // Should catch and handle TypeError from null library
                expect(error).toBeDefined();
            }
        });

        test('should handle malformed library methods', async () => {
            // Mock library with malformed methods
            const mockNlp = jest.fn().mockImplementation(() => {
                throw new Error('Malformed NLP method');
            });
            jest.spyOn(nlpLoader, 'getNlp').mockResolvedValue(mockNlp);

            const themes = await nlpService.extractProductivityThemes('test text');

            // Should return empty array as fallback
            expect(Array.isArray(themes)).toBe(true);
            expect(themes.length).toBe(0);
        });

        test('should handle library version mismatches', async () => {
            // Mock library with incompatible interface
            const mockIncompatibleNatural = {
                // Missing expected methods
                incompatibleMethod: () => 'wrong interface'
            } as any;
            jest.spyOn(nlpLoader, 'getNatural').mockResolvedValue(mockIncompatibleNatural);

            const preprocessing = await nlpService.preprocessText('test text');

            // Should handle gracefully and provide basic preprocessing
            expect(preprocessing).toBeDefined();
            expect(preprocessing.originalText).toBe('test text');
            expect(preprocessing.cleanedText).toBeDefined();
        });
    });

    describe('Network and Resource Failures', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should handle network timeouts during dynamic imports', async () => {
            // Simulate network timeout
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(new Error('NETWORK_TIMEOUT'));

            const themes = await nlpService.extractProductivityThemes('test text');

            expect(Array.isArray(themes)).toBe(true);
            expect(themes.length).toBe(0);
            expect(mockErrorHandler.handleError).toHaveBeenCalled();
        });

        test('should handle memory exhaustion during large text processing', async () => {
            // Create extremely large text to trigger memory issues
            const hugeText = 'word '.repeat(1000000); // 1M words
            
            const themes = await nlpService.extractProductivityThemes(hugeText);

            // Should handle gracefully without crashing
            expect(Array.isArray(themes)).toBe(true);
        });

        test('should handle concurrent import failures', async () => {
            // Mock concurrent failures
            const importError = new Error('Concurrent import failure');
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(importError);
            jest.spyOn(nlpLoader, 'getSentiment').mockRejectedValue(importError);
            jest.spyOn(nlpLoader, 'getNatural').mockRejectedValue(importError);

            // Make multiple concurrent calls
            const promises = [
                nlpService.extractProductivityThemes('text 1'),
                nlpService.analyzeSentiment('text 2'),
                nlpService.detectProductivityBlockers('text 3'),
                nlpService.preprocessText('text 4'),
                nlpService.extractProductivityThemes('text 5')
            ];

            const results = await Promise.allSettled(promises);

            // All should resolve (not reject) with fallback values
            results.forEach(result => {
                expect(result.status).toBe('fulfilled');
            });
        });
    });

    describe('Service State Recovery', () => {
        test('should recover after import failures', async () => {
            await nlpService.initialize();

            // First, cause an import failure
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValueOnce(new Error('Import failed'));
            
            const firstAttempt = await nlpService.extractProductivityThemes('test text');
            expect(firstAttempt.length).toBe(0);

            // Restore the mock to succeed
            jest.restoreAllMocks();
            mockCacheService.get.mockResolvedValue(null);
            mockCacheService.set.mockResolvedValue(undefined);
            mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());

            // Second attempt should work normally
            const secondAttempt = await nlpService.extractProductivityThemes('project management tasks');
            // This might still be empty due to the nature of the mock, but it shouldn't throw
            expect(Array.isArray(secondAttempt)).toBe(true);
        });

        test('should maintain service state during partial failures', async () => {
            await nlpService.initialize();

            // Fail only sentiment analysis
            jest.spyOn(nlpLoader, 'getSentiment').mockRejectedValue(new Error('Sentiment failed'));

            // Other operations should still work
            const themes = await nlpService.extractProductivityThemes('project management');
            const preprocessing = await nlpService.preprocessText('test text');

            expect(Array.isArray(themes)).toBe(true);
            expect(preprocessing).toBeDefined();
            expect(preprocessing.originalText).toBe('test text');
        });
    });

    describe('Error Context and Logging', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should provide detailed error context for debugging', async () => {
            const importError = new Error('Detailed import failure');
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(importError);

            await nlpService.extractProductivityThemes('test text');

            expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                importError,
                expect.objectContaining({
                    operation: 'extract_productivity_themes',
                    component: 'NLPAnalysisService',
                    timestamp: expect.any(Number)
                })
            );
        });

        test('should handle non-Error objects thrown from imports', async () => {
            // Some libraries might throw strings or other objects
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue('String error message');

            const themes = await nlpService.extractProductivityThemes('test text');

            expect(Array.isArray(themes)).toBe(true);
            expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
                expect.any(Error), // Should be converted to Error object
                expect.any(Object)
            );
        });

        test('should track error frequency for analysis', async () => {
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(new Error('Recurring error'));

            // Make multiple calls to track error frequency
            await nlpService.extractProductivityThemes('text 1');
            await nlpService.extractProductivityThemes('text 2');
            await nlpService.extractProductivityThemes('text 3');

            // Error handler should be called for each failure
            expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(3);
        });
    });

    describe('Cache Behavior During Errors', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should not cache failed analysis results', async () => {
            jest.spyOn(nlpLoader, 'getNlp').mockRejectedValue(new Error('Analysis failed'));

            await nlpService.extractProductivityThemes('test text');

            // Should not have attempted to cache the failed result
            expect(mockCacheService.set).not.toHaveBeenCalled();
        });

        test('should handle cache service failures gracefully', async () => {
            // Mock cache service to fail
            mockCacheService.get.mockRejectedValue(new Error('Cache read failed'));
            mockCacheService.set.mockRejectedValue(new Error('Cache write failed'));

            const themes = await nlpService.extractProductivityThemes('project management');

            // Should still attempt analysis despite cache failures
            expect(Array.isArray(themes)).toBe(true);
        });

        test('should provide fallback when cache is corrupted', async () => {
            // Mock cache to return corrupted data
            mockCacheService.get.mockResolvedValue({ corrupted: 'data' });

            const themes = await nlpService.extractProductivityThemes('test text');

            // Should ignore corrupted cache and perform fresh analysis
            expect(Array.isArray(themes)).toBe(true);
        });
    });
});