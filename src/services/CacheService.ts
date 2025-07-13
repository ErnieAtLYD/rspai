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

    constructor(app: App, errorHandler: ErrorHandlingService, config: Partial<CacheConfig> = {}, pluginId: 'retrospect-ai') {
        super(app);
        this.errorHandler = errorHandler;
        this.config = {
            defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
            maxSize: 1000,
            persistToDisk: true,
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            ...config
        };
        // Sanitize plugin ID to prevent path traversal attacks
        const sanitizedPluginId = this.sanitizePluginId(pluginId);
        this.cacheFilePath = `.obsidian/plugins/${sanitizedPluginId}/cache.json`;
    }

    protected async onInitialize(): Promise<void> {
        if (this.config.persistToDisk) {
            await this.loadFromDisk();
        }
        
        this.startCleanupTimer();
        await this.errorHandler.handleError(
            new Error(`Cache service initialized with ${this.cache.size} entries`),
            {
                operation: 'initialize',
                component: 'CacheService',
                metadata: { cacheSize: this.cache.size },
                timestamp: Date.now()
            },
            { logToConsole: true, showNotice: false }
        );
    }

    protected async onDispose(): Promise<void> {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        if (this.config.persistToDisk) {
            await this.errorHandler.executeWithRetry(
                () => this.saveToDisk(),
                {
                    operation: 'dispose_save_to_disk',
                    component: 'CacheService',
                    timestamp: Date.now()
                }
            );
        }

        this.cache.clear();
        await this.errorHandler.handleError(
            new Error("Cache service disposed"),
            {
                operation: 'dispose',
                component: 'CacheService',
                timestamp: Date.now()
            },
            { logToConsole: true, showNotice: false }
        );
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
        await this.errorHandler.executeWithRetry(
            async () => {
                const data = await this.app.vault.adapter.read(this.cacheFilePath);
                const cacheData = JSON.parse(data);
                
                // Restore cache entries
                for (const entry of cacheData.entries || []) {
                    // Skip expired entries
                    if (Date.now() <= entry.timestamp + entry.ttl) {
                        this.cache.set(entry.key, entry);
                    }
                }
            },
            {
                operation: 'load_from_disk',
                component: 'CacheService',
                metadata: { cacheFilePath: this.cacheFilePath },
                timestamp: Date.now()
            },
            { showNotice: false }
        ).catch(async (error) => {
            // Cache file doesn't exist or is corrupted, start fresh
            await this.errorHandler.handleError(
                error,
                {
                    operation: 'load_from_disk_fallback',
                    component: 'CacheService',
                    metadata: { cacheFilePath: this.cacheFilePath },
                    timestamp: Date.now()
                },
                { logToConsole: true, showNotice: false }
            );
        });
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

    /**
     * Sanitize plugin ID to prevent path traversal attacks
     * @param pluginId - The plugin ID to sanitize
     * @returns A sanitized plugin ID safe for file path construction
     */
    private sanitizePluginId(pluginId: string): string {
        if (!pluginId || typeof pluginId !== 'string') {
            throw new Error('Plugin ID must be a non-empty string');
        }

        // Remove any path traversal sequences and normalize path separators
        let sanitized = pluginId
            .replace(/\.\./g, '')  // Remove ".." sequences
            .replace(/[\/\\]/g, '-')  // Replace path separators with hyphens
            .replace(/[^a-zA-Z0-9_-]/g, '')  // Remove any non-alphanumeric characters except underscore and hyphen
            .toLowerCase();  // Convert to lowercase for consistency

        // Ensure the sanitized ID is not empty and starts with an alphanumeric character
        if (!sanitized || sanitized.length === 0) {
            throw new Error('Plugin ID contains only invalid characters');
        }

        // Ensure it starts with an alphanumeric character
        if (!/^[a-zA-Z0-9]/.test(sanitized)) {
            sanitized = 'plugin-' + sanitized;
        }

        // Limit length to prevent excessively long directory names
        if (sanitized.length > 50) {
            sanitized = sanitized.substring(0, 50);
        }

        return sanitized;
    }
}