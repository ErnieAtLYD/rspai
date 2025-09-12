// tests/CacheServiceBatchedWrites.test.ts

import { CacheService, CacheConfig } from '../src/services/CacheService';
import { App } from 'obsidian';
import { ErrorHandlingService } from '../src/services/ErrorHandlingService';

// Mock Obsidian App
const mockApp: Partial<App> = {
    vault: {
        adapter: {
            read: jest.fn(),
            write: jest.fn(),
            exists: jest.fn()
        } as any
    }
};

// Mock ErrorHandlingService
const mockErrorHandler: Partial<ErrorHandlingService> = {
    handleError: jest.fn(),
    executeWithRetry: jest.fn().mockImplementation((fn) => fn())
};

describe('CacheService Batched Writes', () => {
    let cacheService: CacheService;
    let config: CacheConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        config = {
            defaultTtl: 24 * 60 * 60 * 1000,
            maxSize: 1000,
            persistToDisk: true,
            cleanupInterval: 5 * 60 * 1000,
            batchWrites: true,
            batchInterval: 100, // Short interval for testing
            maxBatchSize: 3,
            writeMode: 'batched'
        };
        
        cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, config, 'test-plugin');
    });

    afterEach(async () => {
        if (cacheService && cacheService.isReady()) {
            await cacheService.dispose();
        }
    });

    describe('Batch Write Configuration', () => {
        test('should have correct default batched write config', () => {
            const stats = cacheService.getBatchStats();
            expect(stats.writeMode).toBe('batched');
            expect(stats.batchInterval).toBe(100);
            expect(stats.maxBatchSize).toBe(3);
            expect(stats.isDirty).toBe(false);
            expect(stats.pendingOperations).toBe(0);
        });

        test('should track dirty state and pending operations', async () => {
            await cacheService.initialize();
            
            // Initially clean
            expect(cacheService.getBatchStats().isDirty).toBe(false);
            expect(cacheService.getBatchStats().pendingOperations).toBe(0);
            
            // After set operation
            await cacheService.set('test-key', 'test-value');
            
            const stats = cacheService.getBatchStats();
            expect(stats.isDirty).toBe(true);
            expect(stats.pendingOperations).toBe(1);
            expect(stats.pendingKeys).toBe(1);
        });
    });

    describe('Write Modes', () => {
        test('should support immediate write mode', async () => {
            config.writeMode = 'immediate';
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, config, 'test-plugin');
            await cacheService.initialize();
            
            await cacheService.set('test-key', 'test-value');
            
            // Should have executed write immediately
            expect(mockErrorHandler.executeWithRetry).toHaveBeenCalled();
            
            const stats = cacheService.getBatchStats();
            expect(stats.isDirty).toBe(false); // Should be clean after immediate write
        });

        test('should support lazy write mode', async () => {
            config.writeMode = 'lazy';
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, config, 'test-plugin');
            await cacheService.initialize();
            
            await cacheService.set('test-key', 'test-value');
            
            const stats = cacheService.getBatchStats();
            expect(stats.isDirty).toBe(true);
            expect(stats.batchTimerActive).toBe(true);
        });

        test('should force write when batch size exceeded', async () => {
            await cacheService.initialize();
            
            // Add operations up to batch size
            await cacheService.set('key1', 'value1');
            await cacheService.set('key2', 'value2');
            
            // This should still be batched
            expect(cacheService.getBatchStats().isDirty).toBe(true);
            
            // This should force a write (exceeds maxBatchSize of 3)
            await cacheService.set('key3', 'value3');
            
            // Should have triggered write
            expect(mockErrorHandler.executeWithRetry).toHaveBeenCalled();
        });
    });

    describe('Batch Write Operations', () => {
        test('should flush pending writes on demand', async () => {
            await cacheService.initialize();
            
            await cacheService.set('test-key', 'test-value');
            expect(cacheService.getBatchStats().isDirty).toBe(true);
            
            await cacheService.flushPendingWrites();
            
            expect(cacheService.getBatchStats().isDirty).toBe(false);
            expect(mockErrorHandler.executeWithRetry).toHaveBeenCalled();
        });

        test('should handle multiple operations in batch', async () => {
            await cacheService.initialize();
            
            // Add 2 operations (below batch size of 3)
            await cacheService.set('key1', 'value1');
            await cacheService.set('key2', 'value2');
            
            let stats = cacheService.getBatchStats();
            expect(stats.pendingOperations).toBe(2);
            expect(stats.isDirty).toBe(true);
            
            // Third operation should trigger automatic batch write
            await cacheService.delete('key1');
            
            // After hitting batch size, counters should be reset
            stats = cacheService.getBatchStats();
            expect(stats.pendingOperations).toBe(0);
            expect(stats.isDirty).toBe(false);
            expect(mockErrorHandler.executeWithRetry).toHaveBeenCalled();
        });

        test('should save final state on disposal', async () => {
            await cacheService.initialize();
            
            await cacheService.set('test-key', 'test-value');
            expect(cacheService.getBatchStats().isDirty).toBe(true);
            
            await cacheService.dispose();
            
            // Should have called executeWithRetry for final save
            expect(mockErrorHandler.executeWithRetry).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should not reset counters on write error', async () => {
            await cacheService.initialize();
            
            // Mock executeWithRetry to throw error
            mockErrorHandler.executeWithRetry.mockRejectedValueOnce(new Error('Write failed'));
            
            await cacheService.set('test-key', 'test-value');
            
            try {
                await cacheService.flushPendingWrites();
            } catch (error) {
                // Expected to throw
            }
            
            // Counters should still be set for retry
            const stats = cacheService.getBatchStats();
            expect(stats.isDirty).toBe(true);
            expect(stats.pendingOperations).toBe(1);
        });
    });
});