// src/services/CacheService.ts

import { App } from "obsidian";
import { BaseService } from "./BaseService";

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

    constructor(app: App, config: Partial<CacheConfig> = {}, pluginId: 'retrospect-ai') {
        super(app);
        this.config = {
            defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
            maxSize: 1000,
            persistToDisk: true,
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            ...config
        };
        // Derive the cache file path from plugin ID
        this.cacheFilePath = `.obsidian/plugins/${pluginId}/cache.json`;
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
            await this.saveToDisk();
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
            await this.saveToDisk();
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<boolean> {
        this.ensureReady();
        
        const deleted = this.cache.delete(key);
        
        if (deleted && this.config.persistToDisk) {
            await this.saveToDisk();
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
            await this.saveToDisk();
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
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpired();
        }, this.config.cleanupInterval);
    }

    private cleanupExpired(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.timestamp + entry.ttl) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            this.cache.delete(key);
        }

        if (expiredKeys.length > 0) {
            console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
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
            const data = await this.app.vault.adapter.read(this.cacheFilePath);
            const cacheData = JSON.parse(data);
            
            // Restore cache entries
            for (const entry of cacheData.entries || []) {
                // Skip expired entries
                if (Date.now() <= entry.timestamp + entry.ttl) {
                    this.cache.set(entry.key, entry);
                }
            }
        } catch (error) {
            // Cache file doesn't exist or is corrupted, start fresh
            console.log("No existing cache file found, starting fresh");
        }
    }

    private async saveToDisk(): Promise<void> {
        try {
            const cacheData = {
                entries: Array.from(this.cache.values()),
                timestamp: Date.now()
            };
            
            await this.app.vault.adapter.write(
                this.cacheFilePath,
                JSON.stringify(cacheData, null, 2)
            );
        } catch (error) {
            console.error("Failed to save cache to disk:", error);
        }
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