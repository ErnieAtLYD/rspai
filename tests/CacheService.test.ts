// tests/CacheService.test.ts

import { CacheService } from '../src/services/CacheService';

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

// Mock ErrorHandlingService
const mockErrorHandler = {
    handleError: jest.fn(),
    executeWithRetry: jest.fn()
} as any;

describe('CacheService', () => {
    let cacheService: CacheService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock executeWithRetry to just execute the function
        mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
        mockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));
    });

    describe('Plugin ID Sanitization', () => {
        test('should sanitize valid plugin ID correctly', () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, 'retrospect-ai');
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/retrospect-ai/cache.json');
        });

        test('should remove path traversal sequences', () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, '../../../malicious');
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/malicious/cache.json');
        });

        test('should replace path separators with hyphens', () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, 'folder/subfolder\\malicious');
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/folder-subfolder-malicious/cache.json');
        });

        test('should remove special characters', () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, 'plugin@#$%name!');
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/pluginname/cache.json');
        });

        test('should convert to lowercase', () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, 'MyPlugin-NAME');
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/myplugin-name/cache.json');
        });

        test('should prepend "plugin-" if it starts with non-alphanumeric', () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, '-my-plugin');
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/plugin-my-plugin/cache.json');
        });

        test('should limit length to 50 characters', () => {
            const longName = 'a'.repeat(100);
            cacheService = new CacheService(mockApp, mockErrorHandler, {}, longName);
            expect(cacheService['cacheFilePath']).toBe('.obsidian/plugins/' + 'a'.repeat(50) + '/cache.json');
        });

        test('should throw error for empty plugin ID', () => {
            expect(() => {
                new CacheService(mockApp, mockErrorHandler, {}, '');
            }).toThrow('Plugin ID must be a non-empty string');
        });

        test('should throw error for plugin ID with only invalid characters', () => {
            expect(() => {
                new CacheService(mockApp, mockErrorHandler, {}, '!@#$%^&*()');
            }).toThrow('Plugin ID contains only invalid characters');
        });

        test('should throw error for non-string plugin ID', () => {
            expect(() => {
                new CacheService(mockApp, mockErrorHandler, {}, null as any);
            }).toThrow('Plugin ID must be a non-empty string');
        });
    });

    describe('Cache Operations', () => {
        beforeEach(async () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, { persistToDisk: false }, 'test-plugin');
            await cacheService.initialize();
        });

        test('should store and retrieve values', async () => {
            const testKey = 'test-key';
            const testValue = { data: 'test-data' };

            await cacheService.set(testKey, testValue);
            const result = await cacheService.get(testKey);

            expect(result).toEqual(testValue);
        });

        test('should return null for non-existent key', async () => {
            const result = await cacheService.get('non-existent-key');
            expect(result).toBeNull();
        });

        test('should delete values', async () => {
            const testKey = 'test-key';
            const testValue = { data: 'test-data' };

            await cacheService.set(testKey, testValue);
            const deleted = await cacheService.delete(testKey);
            const result = await cacheService.get(testKey);

            expect(deleted).toBe(true);
            expect(result).toBeNull();
        });

        test('should clear all values', async () => {
            await cacheService.set('key1', 'value1');
            await cacheService.set('key2', 'value2');
            
            await cacheService.clear();
            
            const result1 = await cacheService.get('key1');
            const result2 = await cacheService.get('key2');
            
            expect(result1).toBeNull();
            expect(result2).toBeNull();
        });

        test('should check if key exists', async () => {
            const testKey = 'test-key';
            const testValue = { data: 'test-data' };

            expect(await cacheService.has(testKey)).toBe(false);
            
            await cacheService.set(testKey, testValue);
            expect(await cacheService.has(testKey)).toBe(true);
        });
    });

    describe('Hit Ratio Tracking', () => {
        beforeEach(async () => {
            cacheService = new CacheService(mockApp, mockErrorHandler, { persistToDisk: false }, 'test-plugin');
            await cacheService.initialize();
        });

        test('should start with 0 hit ratio when no accesses', () => {
            const stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0);
        });

        test('should track misses for non-existent keys', async () => {
            await cacheService.get('missing-key');
            const stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0);
        });

        test('should track hits for existing keys', async () => {
            await cacheService.set('test-key', 'test-value');
            await cacheService.get('test-key');
            
            const stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(1);
        });

        test('should calculate hit ratio correctly with mixed hits and misses', async () => {
            await cacheService.set('key1', 'value1');
            
            // 1 hit
            await cacheService.get('key1');
            // 2 misses
            await cacheService.get('missing1');
            await cacheService.get('missing2');
            // 1 more hit
            await cacheService.get('key1');
            
            const stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0.5); // 2 hits / 4 total accesses
        });

        test('should track misses for expired entries', async () => {
            await cacheService.set('expire-key', 'value', { ttl: -1 }); // Already expired
            await cacheService.get('expire-key');
            
            const stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0);
        });

        test('should reset hit ratio statistics', async () => {
            await cacheService.set('test-key', 'test-value');
            await cacheService.get('test-key');
            await cacheService.get('missing-key');
            
            let stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0.5);
            
            cacheService.resetStats();
            
            stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0);
        });

        test('should continue tracking after reset', async () => {
            await cacheService.set('test-key', 'test-value');
            await cacheService.get('test-key');
            
            cacheService.resetStats();
            
            await cacheService.get('test-key'); // Hit
            await cacheService.get('missing'); // Miss
            
            const stats = cacheService.getStats();
            expect(stats.hitRatio).toBe(0.5);
        });
    });
});