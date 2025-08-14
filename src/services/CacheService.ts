// src/services/CacheService.ts

import { App } from "obsidian";
import { BaseService } from "./BaseService";
import { ErrorHandlingService } from "./ErrorHandlingService";

export interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    ttl: number;
    metadata?: Record<string, unknown>;
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
    // Batched write configuration
    batchWrites: boolean;
    batchInterval: number; // ms between batch writes
    maxBatchSize: number; // max operations before forced write
    writeMode: 'immediate' | 'batched' | 'lazy';
}

/**
 * Cache service for storing analysis results and data
 * Supports in-memory caching with optional disk persistence
 */
export class CacheService extends BaseService {
    private cache: Map<string, CacheEntry<unknown>> = new Map();
    private cleanupTimer: NodeJS.Timeout | null = null;
    private config: CacheConfig;
    private cacheFilePath: string;
    private errorHandler: ErrorHandlingService;
    
    // Hit ratio tracking
    private hitCount = 0;
    private missCount = 0;
    
    // Batched write system
    private batchTimer: NodeJS.Timeout | null = null;
    private pendingWrites: Set<string> = new Set(); // Track which keys need writing
    private batchOperationCount = 0;
    private isDirty = false; // Flag to track if cache has unsaved changes

    constructor(app: App, errorHandler: ErrorHandlingService, config: Partial<CacheConfig> = {}, pluginId = 'retrospect-ai') {
        super(app);
        this.errorHandler = errorHandler;
        this.config = {
            defaultTtl: 24 * 60 * 60 * 1000, // 24 hours
            maxSize: 1000,
            persistToDisk: true,
            cleanupInterval: 5 * 60 * 1000, // 5 minutes
            // Batched write defaults
            batchWrites: true,
            batchInterval: 2000, // 2 seconds
            maxBatchSize: 50, // operations
            writeMode: 'batched',
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
        console.log(`Cache service initialized with ${this.cache.size} entries`);
    }

    protected async onDispose(): Promise<void> {
        // Clear timers
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        // Force final write if there are pending changes
        if (this.isDirty && this.config.persistToDisk) {
            try {
                await this.forceBatchWrite();
            } catch (error) {
                console.warn('Failed to save final cache state during disposal:', error);
            }
        }
        
        this.cache.clear();
        this.pendingWrites.clear();
        console.log("Cache service disposed");
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<T | null> {
        this.ensureReady();
        
        const entry = this.cache.get(key);
        if (!entry) {
            this.missCount++;
            return null;
        }

        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl) {
            this.cache.delete(key);
            this.missCount++;
            return null;
        }

        this.hitCount++;
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
        
        // Handle disk persistence based on write mode
        if (this.config.persistToDisk) {
            await this.handleDiskWrite('set', key);
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<boolean> {
        this.ensureReady();
        
        const deleted = this.cache.delete(key);
        
        if (deleted && this.config.persistToDisk) {
            await this.handleDiskWrite('delete', key);
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
            await this.handleDiskWrite('clear');
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
        const totalAccesses = this.hitCount + this.missCount;
        const hitRatio = totalAccesses > 0 ? this.hitCount / totalAccesses : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRatio: hitRatio,
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
     * Reset hit ratio statistics
     */
    resetStats(): void {
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * Generate cache key for analysis results
     */
    generateAnalysisKey(type: string, params: Record<string, unknown>): string {
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

    private hashObject(obj: Record<string, unknown>): string {
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
            .replace(/[/\\]/g, '-')  // Replace path separators with hyphens
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

    /**
     * Batched Write System Methods
     */

    /**
     * Handle disk write based on the configured write mode
     */
    private async handleDiskWrite(operation: 'set' | 'delete' | 'clear', key?: string): Promise<void> {
        this.isDirty = true;
        
        if (key) {
            this.pendingWrites.add(key);
        }
        
        this.batchOperationCount++;

        switch (this.config.writeMode) {
            case 'immediate':
                await this.immediateWrite(operation, key);
                break;
                
            case 'batched':
                await this.scheduleOrForceBatchWrite();
                break;
                
            case 'lazy':
                this.scheduleBatchWrite();
                break;
                
            default:
                // Default to batched mode if config is invalid
                await this.scheduleOrForceBatchWrite();
        }
    }

    /**
     * Immediate write mode - write to disk right away
     */
    private async immediateWrite(operation: string, key?: string): Promise<void> {
        await this.errorHandler.executeWithRetry(
            () => this.saveToDisk(),
            {
                operation: `${operation}_immediate_write`,
                component: 'CacheService',
                metadata: { key, operation },
                timestamp: Date.now()
            }
        );
        this.markWriteComplete();
    }

    /**
     * Schedule a batch write or force it if batch size exceeded
     */
    private async scheduleOrForceBatchWrite(): Promise<void> {
        // Force write if batch size exceeded
        if (this.batchOperationCount >= this.config.maxBatchSize) {
            await this.forceBatchWrite();
            return;
        }
        
        // Otherwise, schedule a batch write
        this.scheduleBatchWrite();
    }

    /**
     * Schedule a batch write (lazy scheduling)
     */
    private scheduleBatchWrite(): void {
        // Clear existing timer if any
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        
        // Schedule new batch write
        this.batchTimer = setTimeout(async () => {
            await this.executeBatchWrite();
        }, this.config.batchInterval);
    }

    /**
     * Force an immediate batch write
     */
    private async forceBatchWrite(): Promise<void> {
        // Clear any pending timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }
        
        await this.executeBatchWrite();
    }

    /**
     * Execute the actual batch write
     */
    private async executeBatchWrite(): Promise<void> {
        if (!this.isDirty) {
            return; // No changes to write
        }
        
        await this.errorHandler.executeWithRetry(
            () => this.saveToDisk(),
            {
                operation: 'batch_write',
                component: 'CacheService',
                metadata: { 
                    operationCount: this.batchOperationCount,
                    pendingKeys: this.pendingWrites.size,
                    mode: this.config.writeMode
                },
                timestamp: Date.now()
            }
        );
        
        this.markWriteComplete();
    }

    /**
     * Mark write operation as complete and reset counters
     */
    private markWriteComplete(): void {
        this.isDirty = false;
        this.batchOperationCount = 0;
        this.pendingWrites.clear();
        this.batchTimer = null;
    }

    /**
     * Force flush all pending writes (useful for testing or explicit saves)
     */
    async flushPendingWrites(): Promise<void> {
        if (this.isDirty) {
            await this.forceBatchWrite();
        }
    }

    /**
     * Get current batch write statistics
     */
    getBatchStats() {
        return {
            isDirty: this.isDirty,
            pendingOperations: this.batchOperationCount,
            pendingKeys: this.pendingWrites.size,
            batchTimerActive: !!this.batchTimer,
            writeMode: this.config.writeMode,
            batchInterval: this.config.batchInterval,
            maxBatchSize: this.config.maxBatchSize
        };
    }
}