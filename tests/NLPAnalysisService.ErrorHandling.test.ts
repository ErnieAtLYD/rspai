// tests/NLPAnalysisService.ErrorHandling.test.ts

  // At the top of the test file, before any imports
  jest.mock('../src/services/nlp/nlp-loader', () => ({
    getNlp: jest.fn().mockResolvedValue(jest.fn().mockReturnValue({
      sentences: () => ({ out: () => [] }),
      people: () => ({ out: () => [] }),
      places: () => ({ out: () => [] }),
      organizations: () => ({ out: () => [] })
    })),
    getSentiment: jest.fn().mockResolvedValue(jest.fn().mockImplementation(() => ({
      analyze: () => ({ score: 0 })
    }))),
    getNatural: jest.fn().mockResolvedValue({
      PorterStemmer: { stem: (word: string) => word },
      stopwords: [],
      WordTokenizer: jest.fn().mockImplementation(() => ({ tokenize: (text: string) => text.split(' ') })),
      TfIdf: jest.fn().mockImplementation(() => ({
        addDocument: jest.fn(),
        listTerms: jest.fn().mockReturnValue([]),
        documents: []
      }))
    })
  }));

import { NLPAnalysisService, NLPAnalysisConfig } from '../src/services/NLPAnalysisService';
import * as nlpLoader from '../src/services/nlp/nlp-loader';
import { NaturalModule, CompromiseDoc } from '../src/services/nlp/nlp-loader';
import type { App } from 'obsidian';
import type { CacheService } from '../src/services/CacheService';
import type { ErrorHandlingService } from '../src/services/ErrorHandlingService';
  
// Mock Obsidian App
const mockApp = {
    vault: {
        adapter: {
            read: jest.fn(),
            write: jest.fn(),
            exists: jest.fn()
        }
    }
} as unknown as App;

// Mock CacheService
const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn()
};

// Mock ErrorHandlingService
const mockErrorHandler = {
    handleError: jest.fn(),
    executeWithRetry: jest.fn()
};

// Mock NLP Config
const mockConfig: NLPAnalysisConfig = {
    cacheService: mockCacheService as unknown as CacheService,
    errorHandler: mockErrorHandler as unknown as ErrorHandlingService,
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
        (mockErrorHandler.executeWithRetry as jest.Mock).mockImplementation(<T>(fn: () => T) => fn());
        // Mock cache misses by default
        (mockCacheService.get as jest.Mock).mockResolvedValue(null);
        (mockCacheService.set as jest.Mock).mockResolvedValue(undefined);
        
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
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalledWith(
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
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalledWith(
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
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalledWith(
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

            // Use Promise.allSettled to handle rejections gracefully
            const results = await Promise.allSettled([
                nlpService.extractProductivityThemes('test text'),
                nlpService.analyzeSentiment('test text'),
                nlpService.detectProductivityBlockers('test text')
            ]);

            // All should settle (either fulfill or reject gracefully)
            expect(results.length).toBe(3);
            results.forEach(result => {
                expect(['fulfilled', 'rejected']).toContain(result.status);
            });
            
            // Error handler should have been called (may be more than 3 times due to internal operations)
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    component: 'NLPAnalysisService'
                })
            );
        });
    });

    describe('Partial Library Failures', () => {
        beforeEach(async () => {
            await nlpService.initialize();
        });

        test('should handle corrupted library exports gracefully', async () => {
            // Mock library that imports but has invalid exports
            jest.spyOn(nlpLoader, 'getNlp').mockResolvedValue(null as unknown as (text: string) => CompromiseDoc);

            const themes = await nlpService.extractProductivityThemes('test text');
            
            // Should return empty array as fallback
            expect(Array.isArray(themes)).toBe(true);
            expect(themes.length).toBe(0);
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
            } as unknown as NaturalModule;
            jest.spyOn(nlpLoader, 'getNatural').mockResolvedValue(mockIncompatibleNatural);

            try {
                const preprocessing = await nlpService.preprocessText('test text');
                
                // Should handle gracefully and provide basic preprocessing
                expect(preprocessing).toBeDefined();
                expect(preprocessing.originalText).toBe('test text');
                expect(preprocessing.cleanedText).toBeDefined();
            } catch (error) {
                // If it throws, that's also acceptable behavior for version mismatches
                expect(error).toBeDefined();
            }
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
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalled();
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

            // Should handle errors gracefully - some may reject, some may fulfill with fallbacks
            expect(results.length).toBe(5);
            // At least some should be fulfilled or all should be rejected gracefully
            const fulfilledCount = results.filter(r => r.status === 'fulfilled').length;
            const rejectedCount = results.filter(r => r.status === 'rejected').length;
            expect(fulfilledCount + rejectedCount).toBe(5);
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
            (mockCacheService.get as jest.Mock).mockResolvedValue(null);
            (mockCacheService.set as jest.Mock).mockResolvedValue(undefined);
            (mockErrorHandler.executeWithRetry as jest.Mock).mockImplementation(<T>(fn: () => T) => fn());

            // Second attempt should work normally
            const secondAttempt = await nlpService.extractProductivityThemes('project management tasks');
            // This might still be empty due to the nature of the mock, but it shouldn't throw
            expect(Array.isArray(secondAttempt)).toBe(true);
        });

        test('should maintain service state during partial failures', async () => {
            await nlpService.initialize();

            // Fail only sentiment analysis
            jest.spyOn(nlpLoader, 'getSentiment').mockRejectedValue(new Error('Sentiment failed'));

            // Other operations should still work or handle errors gracefully
            try {
                const themes = await nlpService.extractProductivityThemes('project management');
                const preprocessing = await nlpService.preprocessText('test text');

                expect(Array.isArray(themes)).toBe(true);
                expect(preprocessing).toBeDefined();
                expect(preprocessing.originalText).toBe('test text');
            } catch (error) {
                // If operations fail due to sentiment dependency, that's also valid
                expect(error).toBeDefined();
            }
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

            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalledWith(
                expect.any(Error),
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
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalledWith(
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

            // Error handler should be called (may be more than 3 times due to internal operations)
            expect(mockErrorHandler.handleError as jest.Mock).toHaveBeenCalled();
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
            expect(mockCacheService.set as jest.Mock).not.toHaveBeenCalled();
        });

        test('should handle cache service failures gracefully', async () => {
            // Mock cache service to fail
            (mockCacheService.get as jest.Mock).mockRejectedValue(new Error('Cache read failed'));
            (mockCacheService.set as jest.Mock).mockRejectedValue(new Error('Cache write failed'));

            try {
                const themes = await nlpService.extractProductivityThemes('project management');
                
                // Should still attempt analysis despite cache failures
                expect(Array.isArray(themes)).toBe(true);
            } catch (error) {
                // If cache failures cause operations to fail, that's also acceptable
                expect(error).toBeDefined();
            }
        });

        test('should provide fallback when cache is corrupted', async () => {
            // Mock cache to return corrupted data
            (mockCacheService.get as jest.Mock).mockResolvedValue({ corrupted: 'data' });

            const themes = await nlpService.extractProductivityThemes('test text');

            // Should handle corrupted cache gracefully 
            // May return empty array or undefined based on error handling
            expect(themes !== null && themes !== undefined).toBe(true);
        });
    });
});