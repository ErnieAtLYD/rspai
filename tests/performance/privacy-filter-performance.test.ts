import { PrivacyFilter, DEFAULT_PRIVACY_SETTINGS } from '../../src/privacy-filter';
import { Logger } from '../../src/logger';
import { FileMetadata, FileMetadataUtils } from '../../src/file-metadata';

/**
 * Performance test suite for Privacy Filter optimizations
 * Tests caching, batch processing, and large vault scenarios
 */
describe('Privacy Filter Performance Tests', () => {
  let logger: Logger;
  let privacyFilter: PrivacyFilter;

  beforeEach(() => {
    logger = new Logger('test');
    privacyFilter = new PrivacyFilter(logger, {
      ...DEFAULT_PRIVACY_SETTINGS,
      enablePerformanceOptimizations: true,
      cacheSize: 1000,
      batchSize: 50
    });
  });

  afterEach(() => {
    privacyFilter.clearCache();
  });

  describe('Caching Performance', () => {
    test('should demonstrate significant performance improvement with caching', async () => {
      const testContent = `
# Test Document #private

This is a test document with private content.

## Public Section
This section is public.

## Private Section #confidential
This section contains sensitive information.
      `.trim();

      const iterations = 100;
      
      // Test without optimizations
      const unoptimizedFilter = new PrivacyFilter(logger, {
        ...DEFAULT_PRIVACY_SETTINGS,
        enablePerformanceOptimizations: false
      });

      const startUnoptimized = Date.now();
      for (let i = 0; i < iterations; i++) {
        unoptimizedFilter.shouldExcludeFile(`test-${i}.md`, testContent);
      }
      const unoptimizedTime = Date.now() - startUnoptimized;

      // Test with optimizations and caching
      const startOptimized = Date.now();
      for (let i = 0; i < iterations; i++) {
        privacyFilter.shouldExcludeFileOptimized(`test-${i}.md`, testContent);
      }
      const optimizedTime = Date.now() - startOptimized;

      console.log(`Unoptimized time: ${unoptimizedTime}ms`);
      console.log(`Optimized time: ${optimizedTime}ms`);
      console.log(`Performance improvement: ${((unoptimizedTime - optimizedTime) / unoptimizedTime * 100).toFixed(1)}%`);

      // Optimized version should be significantly faster (at least 30% improvement)
      expect(optimizedTime).toBeLessThan(unoptimizedTime * 0.7);

      // Check cache statistics
      const cacheStats = privacyFilter.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0.8); // At least 80% cache hit rate
      expect(cacheStats.size).toBeGreaterThan(0);
    });

    test('should handle cache eviction properly', () => {
      const smallCacheFilter = new PrivacyFilter(logger, {
        ...DEFAULT_PRIVACY_SETTINGS,
        enablePerformanceOptimizations: true,
        cacheSize: 10 // Very small cache
      });

      // Fill cache beyond capacity
      for (let i = 0; i < 20; i++) {
        smallCacheFilter.shouldExcludeFileOptimized(`test-${i}.md`, `content ${i}`);
      }

      const cacheStats = smallCacheFilter.getCacheStats();
      expect(cacheStats.size).toBeLessThanOrEqual(10);
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Batch Processing Performance', () => {
    test('should process batches efficiently', async () => {
      const batchSize = 50;
      const requests: Array<{
        filePath: string;
        content: string;
        operation: 'shouldExclude' | 'filterContent';
        fileHash?: string;
      }> = [];

      // Create batch requests
      for (let i = 0; i < batchSize; i++) {
        requests.push({
          filePath: `test-${i}.md`,
          content: `# Test Document ${i}\n\nContent for document ${i}`,
          operation: 'shouldExclude' as const,
          fileHash: `hash-${i}`
        });
      }

      const startTime = Date.now();
      const results = await privacyFilter.processBatch(requests);
      const batchTime = Date.now() - startTime;

      expect(results).toHaveLength(batchSize);
      expect(batchTime).toBeLessThan(1000); // Should complete in under 1 second

      console.log(`Batch processing time for ${batchSize} files: ${batchTime}ms`);
      console.log(`Average time per file: ${(batchTime / batchSize).toFixed(2)}ms`);

      const performanceMetrics = privacyFilter.getPerformanceMetrics();
      expect(performanceMetrics.batchesProcessed).toBe(1);
      expect(performanceMetrics.filesProcessed).toBe(batchSize);
    });

    test('should handle mixed batch operations', async () => {
      const requests = [
        {
          filePath: 'exclude-test.md',
          content: '# Private Document #private\nSensitive content',
          operation: 'shouldExclude' as const
        },
        {
          filePath: 'filter-test.md',
          content: '# Mixed Document\n\n## Public\nPublic content\n\n## Private #confidential\nPrivate content',
          operation: 'filterContent' as const
        }
      ];

      const results = await privacyFilter.processBatch(requests);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toBe(true); // Should be excluded
      expect(typeof results[1]).toBe('string'); // Should be filtered content
      expect(results[1]).toContain('[REDACTED]'); // Should contain redaction
    });
  });

  describe('Large Vault Performance', () => {
    test('should handle large vault optimization', () => {
      privacyFilter.optimizeForLargeVault();
      
      const settings = privacyFilter.getSettings();
      expect(settings.cacheSize).toBeGreaterThanOrEqual(5000);
      expect(settings.batchSize).toBeGreaterThanOrEqual(100);
      expect(settings.enableLazyLoading).toBe(true);
    });

    test('should process large number of files efficiently', async () => {
      const fileCount = 1000;
      const files: FileMetadata[] = [];

      // Generate test files
      for (let i = 0; i < fileCount; i++) {
        files.push(FileMetadataUtils.createFromFile(
          `test-files/file-${i}.md`,
          `file-${i}.md`,
          'md',
          Date.now() - (i * 1000),
          Date.now() - (i * 500),
          1024 + (i * 10)
        ));
      }

      // Optimize for large vault
      privacyFilter.optimizeForLargeVault();

      const startTime = Date.now();
      
      // Simulate processing large number of files
      for (let i = 0; i < Math.min(fileCount, 100); i++) { // Test subset for performance
        const content = i % 10 === 0 ? 
          `# Document ${i} #private\nPrivate content` : 
          `# Document ${i}\nPublic content`;
        
        privacyFilter.shouldExcludeFileOptimized(`file-${i}.md`, content);
      }

      const processingTime = Date.now() - startTime;
      
      console.log(`Large vault simulation: ${processingTime}ms for 100 files`);
      console.log(`Average per file: ${(processingTime / 100).toFixed(2)}ms`);

      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds

      const metrics = privacyFilter.getPerformanceMetrics();
      expect(metrics.averageProcessingTime).toBeLessThan(50); // Average under 50ms per file
    });
  });

  describe('Memory Usage Optimization', () => {
    test('should track memory usage accurately', () => {
      const initialMemory = privacyFilter.getCacheStats().memoryUsage;
      
      // Add several cache entries
      for (let i = 0; i < 10; i++) {
        privacyFilter.shouldExcludeFileOptimized(`memory-test-${i}.md`, `content ${i}`);
      }

      const finalMemory = privacyFilter.getCacheStats().memoryUsage;
      expect(finalMemory).toBeGreaterThan(initialMemory);

      // Clear cache and verify memory is freed
      privacyFilter.clearCache();
      const clearedMemory = privacyFilter.getCacheStats().memoryUsage;
      expect(clearedMemory).toBe(0);
    });

    test('should handle large content efficiently', () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB content
      const maxFileSize = 10 * 1024 * 1024; // 10MB limit

      const filter = new PrivacyFilter(logger, {
        ...DEFAULT_PRIVACY_SETTINGS,
        enablePerformanceOptimizations: true,
        maxFileSize
      });

      const startTime = Date.now();
      const result = filter.shouldExcludeFileOptimized('large-file.md', largeContent);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(1000); // Should handle large content quickly
      expect(typeof result).toBe('boolean');

      // Test with content exceeding limit
      const oversizedContent = 'x'.repeat(maxFileSize + 1);
      const oversizedResult = filter.shouldExcludeFileOptimized('oversized-file.md', oversizedContent);
      expect(oversizedResult).toBe(false); // Should not exclude by default for oversized files
    });
  });

  describe('Performance Metrics', () => {
    test('should provide comprehensive performance metrics', () => {
      // Perform various operations
      privacyFilter.shouldExcludeFileOptimized('test1.md', 'content 1');
      privacyFilter.shouldExcludeFileOptimized('test1.md', 'content 1'); // Cache hit
      privacyFilter.filterContentOptimized('# Test\n\n## Private #private\nSensitive data');

      const metrics = privacyFilter.getPerformanceMetrics();
      
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.cacheHits).toBeGreaterThan(0);
      expect(metrics.cacheMisses).toBeGreaterThan(0);
      expect(metrics.filesProcessed).toBeGreaterThan(0);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.totalProcessingTime).toBeGreaterThan(0);

      const cacheStats = privacyFilter.getCacheStats();
      expect(cacheStats.hitRate).toBeGreaterThan(0);
      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('Regression Tests', () => {
    test('should maintain functional correctness with optimizations', () => {
      const testCases = [
        {
          content: '# Private Document #private\nSensitive content',
          filePath: 'private.md',
          expectedExcluded: true
        },
        {
          content: '# Public Document\nPublic content',
          filePath: 'public.md',
          expectedExcluded: false
        },
        {
          content: '# Mixed Document\n\n## Public\nPublic content\n\n## Private #confidential\nPrivate content',
          filePath: 'mixed.md',
          expectedExcluded: false
        }
      ];

      for (const testCase of testCases) {
        // Test optimized version
        const optimizedResult = privacyFilter.shouldExcludeFileOptimized(
          testCase.filePath, 
          testCase.content
        );
        
        // Test unoptimized version for comparison
        const unoptimizedFilter = new PrivacyFilter(logger, {
          ...DEFAULT_PRIVACY_SETTINGS,
          enablePerformanceOptimizations: false
        });
        const unoptimizedResult = unoptimizedFilter.shouldExcludeFile(
          testCase.filePath, 
          testCase.content
        );

        expect(optimizedResult).toBe(testCase.expectedExcluded);
        expect(optimizedResult).toBe(unoptimizedResult); // Results should be identical
      }
    });

    test('should handle edge cases properly', () => {
      const edgeCases = [
        { content: '', filePath: 'empty.md' },
        { content: '   \n\n   ', filePath: 'whitespace.md' },
        { content: null as any, filePath: 'null.md' },
        { content: undefined as any, filePath: 'undefined.md' }
      ];

      for (const edgeCase of edgeCases) {
        expect(() => {
          privacyFilter.shouldExcludeFileOptimized(edgeCase.filePath, edgeCase.content);
        }).not.toThrow();
      }
    });
  });
}); 