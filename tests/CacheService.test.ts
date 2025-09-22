// tests/CacheService.test.ts

import { CacheService } from '../src/services/CacheService';
import type { App, DataAdapter } from 'obsidian';
import type { ErrorHandlingService } from '../src/services/ErrorHandlingService';

// Mock Obsidian App
const mockApp: Partial<App> = {
    vault: {
        configDir: '.obsidian',
        adapter: {
            read: jest.fn(),
            write: jest.fn(),
            exists: jest.fn()
        } as jest.Mocked<Pick<DataAdapter, 'read' | 'write' | 'exists'>>
    }
};

// Helper function to create mock app with custom configDir
const createMockApp = (configDir = '.obsidian'): Partial<App> => ({
    vault: {
        configDir,
        adapter: {
            read: jest.fn(),
            write: jest.fn(),
            exists: jest.fn()
        } as jest.Mocked<Pick<DataAdapter, 'read' | 'write' | 'exists'>>
    }
});

// Mock ErrorHandlingService
const mockErrorHandler: Partial<ErrorHandlingService> = {
    handleError: jest.fn(),
    executeWithRetry: jest.fn()
};

describe('CacheService', () => {
    let cacheService: CacheService;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock executeWithRetry to just execute the function
        mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
        mockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));
        // Reset the mockApp configDir to default for each test
        mockApp.vault.configDir = '.obsidian';
    });

    describe('Plugin ID Sanitization', () => {
        test('should sanitize valid plugin ID correctly', () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'retrospect-ai');
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/retrospect-ai/cache.json`);
        });

        test('should remove path traversal sequences', () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, '../../../malicious');
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/plugin----malicious/cache.json`);
        });

        test('should replace path separators with hyphens', () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'folder/subfolder\\malicious');
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/folder-subfolder-malicious/cache.json`);
        });

        test('should remove special characters', () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'plugin@#$%name!');
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/pluginname/cache.json`);
        });

        test('should convert to lowercase', () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'MyPlugin-NAME');
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/myplugin-name/cache.json`);
        });

        test('should prepend "plugin-" if it starts with non-alphanumeric', () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, '-my-plugin');
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/plugin--my-plugin/cache.json`);
        });

        test('should limit length to 50 characters', () => {
            const longName = 'a'.repeat(100);
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, longName);
            expect(cacheService['cacheFilePath']).toBe(`${mockApp.vault.configDir}/plugins/${'a'.repeat(50)}/cache.json`);
        });

        test('should throw error for empty plugin ID', () => {
            expect(() => {
                new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, '');
            }).toThrow('Plugin ID must be a non-empty string');
        });

        test('should throw error for plugin ID with only invalid characters', () => {
            expect(() => {
                new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, '!@#$%^&*()');
            }).toThrow('Plugin ID contains only invalid characters');
        });

        test('should throw error for non-string plugin ID', () => {
            expect(() => {
                new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, {}, null as unknown as string);
            }).toThrow('Plugin ID must be a non-empty string');
        });
    });

    describe('Custom Config Directory Support', () => {
        test('should work with custom config directory name', () => {
            const customMockApp = createMockApp('.my-obsidian');
            mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
            customMockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));

            cacheService = new CacheService(customMockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'test-plugin');
            expect(cacheService['cacheFilePath']).toBe('.my-obsidian/plugins/test-plugin/cache.json');
        });

        test('should work with config directory without leading dot', () => {
            const customMockApp = createMockApp('obsidian-config');
            mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
            customMockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));

            cacheService = new CacheService(customMockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'test-plugin');
            expect(cacheService['cacheFilePath']).toBe('obsidian-config/plugins/test-plugin/cache.json');
        });

        test('should work with nested config directory', () => {
            const customMockApp = createMockApp('config/obsidian');
            mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
            customMockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));

            cacheService = new CacheService(customMockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'test-plugin');
            expect(cacheService['cacheFilePath']).toBe('config/obsidian/plugins/test-plugin/cache.json');
        });

        test('should sanitize plugin ID correctly with custom config dir', () => {
            const customMockApp = createMockApp('.vault-config');
            mockErrorHandler.executeWithRetry.mockImplementation((fn: () => any) => fn());
            customMockApp.vault.adapter.read.mockRejectedValue(new Error('File not found'));

            cacheService = new CacheService(customMockApp as App, mockErrorHandler as ErrorHandlingService, {}, 'My-Plugin@2024!');
            expect(cacheService['cacheFilePath']).toBe('.vault-config/plugins/my-plugin2024/cache.json');
        });
    });

    describe('Cache Operations', () => {
        beforeEach(async () => {
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, { persistToDisk: false }, 'test-plugin');
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
            cacheService = new CacheService(mockApp as App, mockErrorHandler as ErrorHandlingService, { persistToDisk: false }, 'test-plugin');
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