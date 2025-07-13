// src/services/CacheService.ts

import { App } from "obsidian";
import { BaseService } from "./BaseService";
import { ErrorHandlingService, ErrorType, ErrorCode } from "./ErrorHandlingService";

export interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    ttl: number;
    metadata?: Record<string, any>;
}

export interface CacheOptions {
    ttl?: number;
    maxSize?: number;
    persistToDisk?: boolean;
}

export interface CacheConfig {
    defaultTtl: number;
    maxSize: number;
    persistToDisk: boolean;
    cleanupInterval: number;
}

/**
 * Cache service for storing analysis results and data
 * Supports in-memory caching with optional disk persistence
 */
export class CacheService extends BaseService {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private cleanupTimer: NodeJS.Timeout | null = null;
    private config: CacheConfig;
    private cacheFilePath: string;
    private errorHandler: ErrorHandlingService;

    constructor(app: App, errorHandler: ErrorHandlingService, config: Partial<CacheConfig> = {}, pluginId = 'retrospect-ai') {
        super(app);
        this.errorHandler = errorHandler;
        this.config = {
            defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
            maxSize: 1000,
            persistToDisk: true,
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            ...config
        };
        // Derive the cache file path from plugin ID
        // If pluginId contains path separators, use it directly; otherwise construct the path
        if (pluginId.includes('/') || pluginId.includes('\\')) {
            this.cacheFilePath = `${pluginId}/cache.json`;
        } else {
            this.cacheFilePath = `.obsidian/plugins/${pluginId}/cache.json`;
        }
    }

    protected async onInitialize(): Promise<void> {
        if (this.config.persistToDisk) {
            await this.loadFromDisk();
        }
        
        this.startCleanupTimer();
        console.log(`Cache service initialized with ${this.cache.size} entries`);
    }

    protected async onDispose(): Promise<void> {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        if (this.config.persistToDisk) {
            try {
                // During disposal, ErrorHandlingService may already be disposed
                // Use direct approach without error handling service
                await this.saveToDisk();
            } catch (error) {
                // Just log to console during disposal - don't use error handler
                console.warn('CacheService: Failed to save cache during disposal:', error);
            }
        }

        this.cache.clear();
        console.log("Cache service disposed");
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        this.ensureReady();
        
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.value as T;
    }

    /**
     * Set value in cache
     */
    async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
        this.ensureReady();
        
        const ttl = options.ttl || this.config.defaultTtl;
        const entry: CacheEntry<T> = {
            key,
            value,
            timestamp: Date.now(),
            ttl,
            metadata: {}
        };

        // Enforce cache size limit
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        this.cache.set(key, entry);
        
        if (this.config.persistToDisk) {
            await this.errorHandler.executeWithRetry(
                () => this.saveToDisk(),
                {
                    operation: 'set_save_to_disk',
                    component: 'CacheService',
                    metadata: { key, hasValue: !!value },
                    timestamp: Date.now()
                }
            );
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<boolean> {
        this.ensureReady();
        
        const deleted = this.cache.delete(key);
        
        if (deleted && this.config.persistToDisk) {
            await this.errorHandler.executeWithRetry(
                () => this.saveToDisk(),
                {
                    operation: 'delete_save_to_disk',
                    component: 'CacheService',
                    metadata: { key, deleted },
                    timestamp: Date.now()
                }
            );
        }
        
        return deleted;
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        this.ensureReady();
        
        this.cache.clear();
        
        if (this.config.persistToDisk) {
            await this.errorHandler.executeWithRetry(
                () => this.saveToDisk(),
                {
                    operation: 'clear_save_to_disk',
                    component: 'CacheService',
                    timestamp: Date.now()
                }
            );
        }
    }

    /**
     * Check if key exists in cache
     */
    async has(key: string): Promise<boolean> {
        this.ensureReady();
        
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }

        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRatio: number;
        memoryUsage: number;
    } {
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRatio: 0, // TODO: Implement hit ratio tracking
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Get all cache keys
     */
    getKeys(): string[] {
        this.ensureReady();
        return Array.from(this.cache.keys());
    }

    /**
     * Generate cache key for analysis results
     */
    generateAnalysisKey(type: string, params: Record<string, any>): string {
        const paramsHash = this.hashObject(params);
        return `analysis:${type}:${paramsHash}`;
    }

    /**
     * Generate cache key for pattern recognition
     */
    generatePatternKey(dateRange: string, contentHash: string): string {
        return `pattern:${dateRange}:${contentHash}`;
    }

    private startCleanupTimer(): void {
        // Add jitter to prevent thundering herd - randomize interval by ±20%
        const jitter = Math.random() * 0.4 + 0.8; // 0.8-1.2 multiplier
        const interval = this.config.cleanupInterval * jitter;
        
        this.cleanupTimer = setInterval(async () => {
            await this.cleanupExpired();
        }, interval);
    }

    private async cleanupExpired(): Promise<void> {
        const now = Date.now();
        const expiredKeys: string[] = [];
        const maxEntriesPerCleanup = 100; // Limit entries processed per cleanup cycle
        let processedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (processedCount >= maxEntriesPerCleanup) {
                break;
            }
            
            if (now > entry.timestamp + entry.ttl) {
                expiredKeys.push(key);
            }
            processedCount++;
        }

        for (const key of expiredKeys) {
            this.cache.delete(key);
        }

        if (expiredKeys.length > 0) {
            await this.errorHandler.handleError(
                new Error(`Cleaned up ${expiredKeys.length} expired cache entries (processed ${processedCount}/${this.cache.size} total entries)`),
                {
                    operation: 'cleanup_expired',
                    component: 'CacheService',
                    metadata: { expiredCount: expiredKeys.length, processedCount, totalEntries: this.cache.size },
                    timestamp: Date.now()
                },
                { logToConsole: true, showNotice: false }
            );
        }
    }

    private evictOldest(): void {
        let oldestKey: string | null = null;
        let oldestTimestamp = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTimestamp) {
                oldestTimestamp = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    private async loadFromDisk(): Promise<void> {
        try {
            // Always attempt to load cache, regardless of error handler state
            // If error handler is available and ready, use it for retry logic
            if (this.errorHandler && this.isReady()) {
                await this.errorHandler.executeWithRetry(
                    () => this.loadFromDiskDirect(),
                    {
                        operation: 'load_from_disk',
                        component: 'CacheService',
                        metadata: { cacheFilePath: this.cacheFilePath },
                        timestamp: Date.now()
                    },
                    { showNotice: false }
                );
            } else {
                // Direct load without error handler (during initialization)
                await this.loadFromDiskDirect();
            }
        } catch (error) {
            // Cache file doesn't exist or is corrupted, start fresh
            if (this.errorHandler && this.isReady()) {
                            await this.errorHandler.handleError(
                                error instanceof Error ? error : new Error(String(error)),
                                {
                                    operation: 'load_from_disk_fallback',
                                    component: 'CacheService',
                                    metadata: { cacheFilePath: this.cacheFilePath },
                                    timestamp: Date.now()
                                },
                                { logToConsole: true, showNotice: false }
                            );
                        }
            else if (error instanceof Error && error.message.includes('ENOENT')) {
                                console.log('CacheService: No existing cache found, starting fresh');
                            }
            else {
                                // Other errors (corrupted file, etc.)
                                console.warn('CacheService: Could not load cache from disk, starting fresh:', error);
                            }

        }
    }

    private async loadFromDiskDirect(): Promise<void> {
        const data = await this.app.vault.adapter.read(this.cacheFilePath);
        const cacheData = JSON.parse(data);
        
        // Restore cache entries
        for (const entry of cacheData.entries || []) {
            // Skip expired entries
            if (Date.now() <= entry.timestamp + entry.ttl) {
                this.cache.set(entry.key, entry);
            }
        }
    }

    private async saveToDisk(): Promise<void> {
        const cacheData = {
            entries: Array.from(this.cache.values()),
            timestamp: Date.now()
        };
        
        await this.app.vault.adapter.write(
            this.cacheFilePath,
            JSON.stringify(cacheData, null, 2)
        );
    }

    private hashObject(obj: Record<string, any>): string {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash &= hash;
        }
        return hash.toString(36);
    }

    private estimateMemoryUsage(): number {
        let size = 0;
        for (const entry of this.cache.values()) {
            size += JSON.stringify(entry).length * 2; // Rough estimate
        }
        return size;
    }
}