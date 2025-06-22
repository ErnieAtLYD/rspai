/**
 * Extensible AI Factory - Advanced Model Factory with Plugin Support
 * Integrates with the plugin registry to provide dynamic model creation and management
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

import { Logger } from './logger';
import {
  AIModelAdapter,
  AIModelConfig,
  AIModelFactory,
  AICapability,
  AIModelType,
  PrivacyLevel,
  AIError,
  AIErrorType
} from './ai-interfaces';
import {
  PluginRegistry,
  PluginInstance,
  PluginConstructor,
  PluginMetadata
} from './plugin-registry';

// ========================================
// ENHANCED INTERFACES
// ========================================

/**
 * Model selection criteria for advanced model selection
 */
export interface ModelSelectionCriteria {
  capabilities?: AICapability[];
  type?: AIModelType;
  privacyLevel?: PrivacyLevel;
  maxLatency?: number;
  minQuality?: number;
  maxCost?: number;
  preferLocal?: boolean;
  excludeExperimental?: boolean;
  requiredKeywords?: string[];
  excludedProviders?: string[];
}

/**
 * Model recommendation with scoring
 */
export interface ModelRecommendation {
  pluginId: string;
  metadata: PluginMetadata;
  score: number;
  reasoning: string[];
  estimatedLatency?: number;
  estimatedCost?: number;
  qualityScore?: number;
  compatibilityScore: number;
}

/**
 * Factory configuration options
 */
export interface ExtensibleFactoryConfig {
  enableAutoDiscovery?: boolean;
  enableFallbackChain?: boolean;
  enableHealthMonitoring?: boolean;
  enableUsageTracking?: boolean;
  enableCaching?: boolean;
  maxCacheSize?: number;
  cacheTTL?: number;
  healthCheckInterval?: number;
  defaultTimeout?: number;
  maxRetries?: number;
}

/**
 * Model instance cache entry
 */
interface ModelCacheEntry {
  instance: PluginInstance;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  config: AIModelConfig;
  configHash: string;
}

/**
 * Factory statistics
 */
export interface FactoryStatistics {
  totalModelsCreated: number;
  activeModels: number;
  cachedModels: number;
  totalRequests: number;
  cacheHitRate: number;
  averageCreationTime: number;
  healthyModels: number;
  unhealthyModels: number;
  lastUpdated: Date;
}

// ========================================
// EXTENSIBLE AI FACTORY IMPLEMENTATION
// ========================================

/**
 * Advanced AI model factory with plugin support and intelligent model selection
 */
export class ExtensibleAIFactory implements AIModelFactory {
  private pluginRegistry: PluginRegistry;
  private logger: Logger;
  private config: ExtensibleFactoryConfig;
  private modelCache: Map<string, ModelCacheEntry> = new Map();
  private statistics: FactoryStatistics;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    logger: Logger,
    pluginRegistry?: PluginRegistry,
    config: Partial<ExtensibleFactoryConfig> = {}
  ) {
    this.logger = logger;
    this.pluginRegistry = pluginRegistry || new PluginRegistry(logger);
    this.config = {
      enableAutoDiscovery: true,
      enableFallbackChain: true,
      enableHealthMonitoring: true,
      enableUsageTracking: true,
      enableCaching: true,
      maxCacheSize: 50,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      healthCheckInterval: 5 * 60 * 1000, // 5 minutes
      defaultTimeout: 30000,
      maxRetries: 3,
      ...config
    };

    this.statistics = {
      totalModelsCreated: 0,
      activeModels: 0,
      cachedModels: 0,
      totalRequests: 0,
      cacheHitRate: 0,
      averageCreationTime: 0,
      healthyModels: 0,
      unhealthyModels: 0,
      lastUpdated: new Date()
    };

    this.initializeFactory();
  }

  /**
   * Initialize the factory
   */
  private async initializeFactory(): Promise<void> {
    try {
      // Auto-discover plugins if enabled
      if (this.config.enableAutoDiscovery) {
        await this.pluginRegistry.discoverPlugins();
      }

      // Start health monitoring if enabled
      if (this.config.enableHealthMonitoring) {
        this.startHealthMonitoring();
      }

      this.logger.info('ExtensibleAIFactory initialized');
    } catch (error) {
      this.logger.error('Failed to initialize ExtensibleAIFactory', error);
    }
  }

  /**
   * Create a model adapter instance
   */
  async createModel(config: AIModelConfig): Promise<AIModelAdapter> {
    const startTime = Date.now();
    this.statistics.totalRequests++;

    try {
      this.logger.debug('Creating model adapter', { name: config.name, type: config.type });

      // Validate configuration
      const validation = await this.validateConfig(config);
      if (!validation.valid) {
        throw new AIError(
          AIErrorType.INVALID_CONFIG,
          `Invalid configuration: ${validation.errors.join(', ')}`
        );
      }

      // Check cache first if enabled
      if (this.config.enableCaching) {
        const cached = this.getCachedModel(config);
        if (cached) {
          this.statistics.cacheHitRate = this.calculateCacheHitRate();
          this.updateStatistics();
          return cached.instance.adapter;
        }
      }

      // Determine best plugin for the configuration
      const pluginId = await this.selectBestPlugin(config);
      if (!pluginId) {
        throw new AIError(
          AIErrorType.INVALID_CONFIG,
          `No suitable plugin found for configuration: ${config.name}`
        );
      }

      // Create plugin instance
      const instance = await this.pluginRegistry.createInstance(pluginId, config);

      // Cache the instance if enabled
      if (this.config.enableCaching) {
        this.cacheModel(config, instance);
      }

      // Update statistics
      this.statistics.totalModelsCreated++;
      this.statistics.averageCreationTime = this.updateAverageCreationTime(Date.now() - startTime);
      this.updateStatistics();

      this.logger.info(`Created model adapter: ${config.name} using plugin: ${pluginId}`);
      return instance.adapter;

    } catch (error) {
      this.logger.error('Failed to create model adapter', error);
      throw error instanceof AIError ? error : new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        `Failed to create model adapter: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  }

  /**
   * Create model with intelligent selection based on criteria
   */
  async createModelWithCriteria(
    criteria: ModelSelectionCriteria,
    baseConfig?: Partial<AIModelConfig>
  ): Promise<AIModelAdapter> {
    const recommendations = await this.recommendModels(criteria);
    
    if (recommendations.length === 0) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        'No models match the specified criteria'
      );
    }

    // Use the top recommendation
    const topRecommendation = recommendations[0];
    
    // Create configuration for the recommended model
    const config: AIModelConfig = {
      name: `auto-selected-${topRecommendation.pluginId}`,
      type: topRecommendation.metadata.supportedTypes[0] || 'local',
      timeout: this.config.defaultTimeout,
      retryAttempts: this.config.maxRetries,
      ...baseConfig
    };

    this.logger.info(`Auto-selected model: ${topRecommendation.pluginId} (score: ${topRecommendation.score})`);
    return await this.createModel(config);
  }

  /**
   * Get available model types
   */
  async getAvailableModels(): Promise<string[]> {
    const plugins = this.pluginRegistry.getRegisteredPlugins();
    return Array.from(plugins.keys());
  }

  /**
   * Recommend models based on criteria
   */
  async recommendModels(criteria: ModelSelectionCriteria): Promise<ModelRecommendation[]> {
    const plugins = this.pluginRegistry.getRegisteredPlugins();
    const recommendations: ModelRecommendation[] = [];

    for (const [id, plugin] of plugins) {
      const score = await this.scorePlugin(plugin, criteria);
      if (score > 0) {
        const reasoning = this.generateRecommendationReasoning(plugin, criteria, score);
        recommendations.push({
          pluginId: id,
          metadata: plugin.metadata,
          score,
          reasoning,
          compatibilityScore: score
        });
      }
    }

    // Sort by score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations;
  }

  /**
   * Validate model configuration
   */
  async validateConfig(config: AIModelConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Model name is required');
    }

    if (!config.type) {
      errors.push('Model type is required');
    }

    // Numeric validations
    if (config.maxTokens !== undefined && (config.maxTokens <= 0 || config.maxTokens > 100000)) {
      errors.push('maxTokens must be between 1 and 100000');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }

    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push('timeout must be positive');
    }

    if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
      errors.push('retryAttempts must be non-negative');
    }

    if (config.retryDelay !== undefined && config.retryDelay < 0) {
      errors.push('retryDelay must be non-negative');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Register a new plugin
   */
  async registerPlugin(plugin: PluginConstructor): Promise<void> {
    await this.pluginRegistry.registerPlugin(plugin);
    this.logger.info(`Registered plugin: ${plugin.metadata.id}`);
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<boolean> {
    // Remove from cache
    this.removeCachedModelsForPlugin(pluginId);
    
    const result = await this.pluginRegistry.unregisterPlugin(pluginId);
    if (result) {
      this.logger.info(`Unregistered plugin: ${pluginId}`);
    }
    return result;
  }

  /**
   * Get factory statistics
   */
  getStatistics(): FactoryStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * Get plugin registry
   */
  getPluginRegistry(): PluginRegistry {
    return this.pluginRegistry;
  }

  /**
   * Clear model cache
   */
  clearCache(): void {
    this.modelCache.clear();
    this.statistics.cachedModels = 0;
    this.logger.info('Model cache cleared');
  }

  /**
   * Dispose factory and cleanup resources
   */
  async dispose(): Promise<void> {
    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Deactivate all cached models
    for (const entry of this.modelCache.values()) {
      try {
        await entry.instance.adapter.dispose();
      } catch (error) {
        this.logger.warn('Error disposing cached model', error);
      }
    }

    this.clearCache();
    this.logger.info('ExtensibleAIFactory disposed');
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Select the best plugin for a given configuration
   */
  private async selectBestPlugin(config: AIModelConfig): Promise<string | null> {
    const plugins = this.pluginRegistry.getRegisteredPlugins();

    // Try to find exact match first
    for (const [id, plugin] of plugins) {
      if (this.isExactMatch(plugin, config)) {
        return id;
      }
    }

    // Fall back to best compatible plugin
    const criteria: ModelSelectionCriteria = {
      type: config.type,
      preferLocal: config.type === 'local'
    };

    const recommendations = await this.recommendModels(criteria);
    return recommendations.length > 0 ? recommendations[0].pluginId : null;
  }

  /**
   * Check if plugin is an exact match for configuration
   */
  private isExactMatch(plugin: PluginConstructor, config: AIModelConfig): boolean {
    const metadata = plugin.metadata;
    
    // Check type compatibility
    if (!metadata.supportedTypes.includes(config.type)) {
      return false;
    }

    // Check if plugin name matches config requirements
    if (config.model && !metadata.id.toLowerCase().includes(config.model.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Score a plugin based on selection criteria
   */
  private async scorePlugin(plugin: PluginConstructor, criteria: ModelSelectionCriteria): Promise<number> {
    let score = 0;
    const metadata = plugin.metadata;

    // Type compatibility (required)
    if (criteria.type && !metadata.supportedTypes.includes(criteria.type)) {
      return 0;
    }

    // Privacy level compatibility
    if (criteria.privacyLevel && !metadata.privacyLevels.includes(criteria.privacyLevel)) {
      return 0;
    }

    // Capabilities matching
    if (criteria.capabilities) {
      const matchedCapabilities = criteria.capabilities.filter(cap => 
        metadata.capabilities.includes(cap)
      );
      score += (matchedCapabilities.length / criteria.capabilities.length) * 40;
    }

    // Keyword matching
    if (criteria.requiredKeywords) {
      const matchedKeywords = criteria.requiredKeywords.filter(keyword =>
        metadata.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))
      );
      score += (matchedKeywords.length / criteria.requiredKeywords.length) * 20;
    }

    // Excluded providers
    if (criteria.excludedProviders?.includes(metadata.id)) {
      return 0;
    }

    // Experimental filter
    if (criteria.excludeExperimental && metadata.experimental) {
      return 0;
    }

    // Local preference
    if (criteria.preferLocal && metadata.supportedTypes.includes('local')) {
      score += 15;
    }

    // Deprecated penalty
    if (metadata.deprecated) {
      score -= 30;
    }

    // Base score for valid plugins
    score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendation reasoning
   */
  private generateRecommendationReasoning(
    plugin: PluginConstructor,
    criteria: ModelSelectionCriteria,
    score: number
  ): string[] {
    const reasoning: string[] = [];
    const metadata = plugin.metadata;

    if (criteria.capabilities) {
      const matchedCaps = criteria.capabilities.filter(cap => metadata.capabilities.includes(cap));
      if (matchedCaps.length > 0) {
        reasoning.push(`Supports ${matchedCaps.length}/${criteria.capabilities.length} required capabilities`);
      }
    }

    if (criteria.type && metadata.supportedTypes.includes(criteria.type)) {
      reasoning.push(`Compatible with ${criteria.type} deployment`);
    }

    if (criteria.privacyLevel && metadata.privacyLevels.includes(criteria.privacyLevel)) {
      reasoning.push(`Meets ${criteria.privacyLevel} privacy requirements`);
    }

    if (criteria.preferLocal && metadata.supportedTypes.includes('local')) {
      reasoning.push('Supports local deployment as preferred');
    }

    if (metadata.deprecated) {
      reasoning.push('⚠️ Plugin is deprecated');
    }

    if (metadata.experimental) {
      reasoning.push('⚠️ Plugin is experimental');
    }

    reasoning.push(`Overall compatibility score: ${score.toFixed(1)}/100`);

    return reasoning;
  }

  /**
   * Get cached model if available and valid
   */
  private getCachedModel(config: AIModelConfig): ModelCacheEntry | null {
    const configHash = this.generateConfigHash(config);
    const cached = this.modelCache.get(configHash);

    if (!cached) {
      return null;
    }

    // Check TTL
    const now = Date.now();
    if (now - cached.createdAt.getTime() > (this.config.cacheTTL || 30 * 60 * 1000)) {
      this.modelCache.delete(configHash);
      return null;
    }

    // Update usage
    cached.lastUsed = new Date();
    cached.usageCount++;

    return cached;
  }

  /**
   * Cache a model instance
   */
  private cacheModel(config: AIModelConfig, instance: PluginInstance): void {
    // Check cache size limit
    if (this.modelCache.size >= (this.config.maxCacheSize || 50)) {
      this.evictOldestCacheEntry();
    }

    const configHash = this.generateConfigHash(config);
    const entry: ModelCacheEntry = {
      instance,
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 1,
      config,
      configHash
    };

    this.modelCache.set(configHash, entry);
    this.statistics.cachedModels = this.modelCache.size;
  }

  /**
   * Remove cached models for a specific plugin
   */
  private removeCachedModelsForPlugin(pluginId: string): void {
    for (const [hash, entry] of this.modelCache.entries()) {
      if (entry.instance.metadata.id === pluginId) {
        this.modelCache.delete(hash);
      }
    }
    this.statistics.cachedModels = this.modelCache.size;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldestCacheEntry(): void {
    let oldestHash = '';
    let oldestTime = Date.now();

    for (const [hash, entry] of this.modelCache.entries()) {
      if (entry.lastUsed.getTime() < oldestTime) {
        oldestTime = entry.lastUsed.getTime();
        oldestHash = hash;
      }
    }

    if (oldestHash) {
      this.modelCache.delete(oldestHash);
    }
  }

  /**
   * Generate configuration hash for caching
   */
  private generateConfigHash(config: AIModelConfig): string {
    const hashData = {
      name: config.name,
      type: config.type,
      endpoint: config.endpoint,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature
    };
    
    const str = JSON.stringify(hashData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    if (this.statistics.totalRequests === 0) return 0;
    const cacheHits = this.statistics.totalRequests - this.statistics.totalModelsCreated;
    return (cacheHits / this.statistics.totalRequests) * 100;
  }

  /**
   * Update average creation time
   */
  private updateAverageCreationTime(newTime: number): number {
    const currentAvg = this.statistics.averageCreationTime;
    const count = this.statistics.totalModelsCreated;
    return ((currentAvg * (count - 1)) + newTime) / count;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    const instances = this.pluginRegistry.getActiveInstances();
    this.statistics.activeModels = instances.size;
    this.statistics.cachedModels = this.modelCache.size;
    this.statistics.lastUpdated = new Date();
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval || 5 * 60 * 1000);
  }

  /**
   * Perform health check on all active models
   */
  private async performHealthCheck(): Promise<void> {
    const instances = this.pluginRegistry.getActiveInstances();
    let healthy = 0;
    let unhealthy = 0;

    for (const instance of instances.values()) {
      try {
        const isAvailable = await instance.adapter.isAvailable();
        if (isAvailable) {
          healthy++;
        } else {
          unhealthy++;
        }
      } catch (error) {
        unhealthy++;
        this.logger.warn(`Health check failed for ${instance.metadata.id}`, error);
      }
    }

    this.statistics.healthyModels = healthy;
    this.statistics.unhealthyModels = unhealthy;

    if (unhealthy > 0) {
      this.logger.warn(`Health check completed: ${healthy} healthy, ${unhealthy} unhealthy models`);
    } else {
      this.logger.debug(`Health check completed: ${healthy} healthy models`);
    }
  }
} 