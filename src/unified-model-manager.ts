import { Logger } from './logger';
import { AIModelAdapter } from './ai-interfaces';
import { OllamaAdapter } from './ollama-adapter';
import { LlamaCppAdapter } from './llamacpp-adapter';

/**
 * Unified model information interface
 */
export interface UnifiedModelInfo {
  id: string;
  name: string;
  provider: 'ollama' | 'llamacpp';
  size?: number;
  sizeFormatted?: string;
  status: 'available' | 'downloading' | 'not-installed' | 'error';
  version?: string;
  description?: string;
  capabilities: string[];
  lastModified?: Date;
  downloadProgress?: {
    completed: number;
    total: number;
    percentage: number;
    status: string;
  };
  metadata?: {
    family?: string;
    format?: string;
    quantization?: string;
    parameters?: string;
    contextLength?: number;
  };
}

/**
 * Model download progress callback
 */
export type ModelDownloadProgress = (progress: {
  modelId: string;
  completed: number;
  total: number;
  percentage: number;
  status: string;
  speed?: string;
  eta?: string;
}) => void;

/**
 * Model management operation result
 */
export interface ModelOperationResult {
  success: boolean;
  message: string;
  modelId?: string;
  error?: string;
}

/**
 * Model search and filter options
 */
export interface ModelSearchOptions {
  provider?: 'ollama' | 'llamacpp' | 'all';
  status?: 'available' | 'downloading' | 'not-installed' | 'error' | 'all';
  capabilities?: string[];
  nameFilter?: string;
  sizeRange?: { min?: number; max?: number };
  sortBy?: 'name' | 'size' | 'lastModified' | 'provider';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Recommended models for different use cases
 */
export interface ModelRecommendation {
  useCase: string;
  description: string;
  models: {
    modelId: string;
    provider: 'ollama' | 'llamacpp';
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

/**
 * Unified Model Manager
 * 
 * Provides a consistent interface for managing AI models across different providers.
 * Abstracts the complexity of different model management APIs and provides unified
 * operations for downloading, organizing, and maintaining models.
 */
export class UnifiedModelManager {
  private logger: Logger;
  private adapters: Map<string, AIModelAdapter> = new Map();
  private modelCache: Map<string, UnifiedModelInfo[]> = new Map();
  private downloadCallbacks: Map<string, ModelDownloadProgress> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register an AI adapter for model management
   */
  registerAdapter(adapter: AIModelAdapter): void {
    const providerId = this.getProviderId(adapter);
    this.adapters.set(providerId, adapter);
    this.logger.info(`Registered adapter: ${providerId}`);
  }

  /**
   * Unregister an AI adapter
   */
  unregisterAdapter(adapter: AIModelAdapter): void {
    const providerId = this.getProviderId(adapter);
    this.adapters.delete(providerId);
    this.logger.info(`Unregistered adapter: ${providerId}`);
  }

  /**
   * Get all available models across all registered adapters
   */
  async getAllModels(options: ModelSearchOptions = {}): Promise<UnifiedModelInfo[]> {
    await this.refreshModelCache();
    
    let allModels: UnifiedModelInfo[] = [];
    
    // Collect models from all adapters
    for (const [providerId, models] of this.modelCache) {
      if (options.provider && options.provider !== 'all' && providerId !== options.provider) {
        continue;
      }
      allModels = allModels.concat(models);
    }

    // Apply filters
    return this.filterModels(allModels, options);
  }

  /**
   * Get models for a specific provider
   */
  async getModelsForProvider(provider: 'ollama' | 'llamacpp'): Promise<UnifiedModelInfo[]> {
    await this.refreshModelCache();
    return this.modelCache.get(provider) || [];
  }

  /**
   * Download a model
   */
  async downloadModel(
    modelId: string, 
    provider: 'ollama' | 'llamacpp',
    onProgress?: ModelDownloadProgress
  ): Promise<ModelOperationResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      return {
        success: false,
        message: `No adapter registered for provider: ${provider}`,
        error: 'ADAPTER_NOT_FOUND'
      };
    }

    try {
      this.logger.info(`Starting download for model: ${modelId} (${provider})`);
      
      if (onProgress) {
        this.downloadCallbacks.set(modelId, onProgress);
      }

      if (adapter instanceof OllamaAdapter) {
        await adapter.downloadModel(modelId, (progress) => {
          const unifiedProgress = {
            modelId,
            completed: progress.completed,
            total: progress.total,
            percentage: progress.total > 0 ? (progress.completed / progress.total) * 100 : 0,
            status: progress.status,
            speed: this.formatSpeed(progress.completed, progress.total),
            eta: this.calculateETA(progress.completed, progress.total)
          };
          onProgress?.(unifiedProgress);
        });
      } else if (adapter instanceof LlamaCppAdapter) {
        // LlamaCpp models are typically downloaded manually or via external tools
        // We'll implement a placeholder that guides users
        throw new Error('LlamaCpp models must be downloaded manually. Please refer to the documentation.');
      }

      // Invalidate cache to refresh model list
      this.invalidateCache();
      
      this.logger.info(`Successfully downloaded model: ${modelId}`);
      return {
        success: true,
        message: `Model ${modelId} downloaded successfully`,
        modelId
      };

    } catch (error) {
      this.logger.error(`Failed to download model ${modelId}:`, error);
      return {
        success: false,
        message: `Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.downloadCallbacks.delete(modelId);
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelId: string, provider: 'ollama' | 'llamacpp'): Promise<ModelOperationResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      return {
        success: false,
        message: `No adapter registered for provider: ${provider}`,
        error: 'ADAPTER_NOT_FOUND'
      };
    }

    try {
      this.logger.info(`Deleting model: ${modelId} (${provider})`);

      if (adapter instanceof OllamaAdapter) {
        await adapter.deleteModel(modelId);
      } else if (adapter instanceof LlamaCppAdapter) {
        // LlamaCpp models are typically files that need manual deletion
        throw new Error('LlamaCpp models must be deleted manually from the file system.');
      }

      // Invalidate cache to refresh model list
      this.invalidateCache();
      
      this.logger.info(`Successfully deleted model: ${modelId}`);
      return {
        success: true,
        message: `Model ${modelId} deleted successfully`,
        modelId
      };

    } catch (error) {
      this.logger.error(`Failed to delete model ${modelId}:`, error);
      return {
        success: false,
        message: `Failed to delete model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update a model to the latest version
   */
  async updateModel(modelId: string, provider: 'ollama' | 'llamacpp'): Promise<ModelOperationResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      return {
        success: false,
        message: `No adapter registered for provider: ${provider}`,
        error: 'ADAPTER_NOT_FOUND'
      };
    }

    try {
      this.logger.info(`Updating model: ${modelId} (${provider})`);

      if (adapter instanceof OllamaAdapter) {
        await adapter.updateModel(modelId);
      } else if (adapter instanceof LlamaCppAdapter) {
        throw new Error('LlamaCpp models must be updated manually by downloading new versions.');
      }

      // Invalidate cache to refresh model list
      this.invalidateCache();
      
      this.logger.info(`Successfully updated model: ${modelId}`);
      return {
        success: true,
        message: `Model ${modelId} updated successfully`,
        modelId
      };

    } catch (error) {
      this.logger.error(`Failed to update model ${modelId}:`, error);
      return {
        success: false,
        message: `Failed to update model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get detailed information about a specific model
   */
  async getModelInfo(modelId: string, provider: 'ollama' | 'llamacpp'): Promise<UnifiedModelInfo | null> {
    const models = await this.getModelsForProvider(provider);
    return models.find(model => model.id === modelId) || null;
  }

  /**
   * Check if a model is available (installed and ready to use)
   */
  async isModelAvailable(modelId: string, provider: 'ollama' | 'llamacpp'): Promise<boolean> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      return false;
    }

    try {
      if (adapter instanceof OllamaAdapter) {
        return await adapter.isModelAvailable(modelId);
      } else if (adapter instanceof LlamaCppAdapter) {
        // For LlamaCpp, we check if the model file exists and is loadable
        const models = await this.getModelsForProvider(provider);
        const model = models.find(m => m.id === modelId);
        return model?.status === 'available';
      }
      return false;
    } catch (error) {
      this.logger.error(`Error checking model availability for ${modelId}:`, error);
      return false;
    }
  }

  /**
   * Get model recommendations for different use cases
   */
  getModelRecommendations(): ModelRecommendation[] {
    return [
      {
        useCase: 'Personal Reflection Analysis',
        description: 'Best models for analyzing personal notes and extracting insights',
        models: [
          {
            modelId: 'llama3.2:3b',
            provider: 'ollama',
            reason: 'Excellent balance of performance and privacy for personal content',
            priority: 'high'
          },
          {
            modelId: 'mistral:7b',
            provider: 'ollama',
            reason: 'Strong reasoning capabilities for pattern detection',
            priority: 'medium'
          },
          {
            modelId: 'llama-2-7b-chat.Q4_0.gguf',
            provider: 'llamacpp',
            reason: 'Lightweight option for resource-constrained environments',
            priority: 'medium'
          }
        ]
      },
      {
        useCase: 'Quick Summarization',
        description: 'Fast models for generating summaries of notes',
        models: [
          {
            modelId: 'phi3:mini',
            provider: 'ollama',
            reason: 'Very fast inference with good summarization quality',
            priority: 'high'
          },
          {
            modelId: 'gemma:2b',
            provider: 'ollama',
            reason: 'Compact model with efficient summarization',
            priority: 'medium'
          }
        ]
      },
      {
        useCase: 'Deep Analysis',
        description: 'Powerful models for comprehensive analysis and insights',
        models: [
          {
            modelId: 'llama3.1:8b',
            provider: 'ollama',
            reason: 'Advanced reasoning and comprehensive analysis capabilities',
            priority: 'high'
          },
          {
            modelId: 'mistral:7b-instruct',
            provider: 'ollama',
            reason: 'Excellent instruction following for detailed analysis',
            priority: 'medium'
          }
        ]
      },
      {
        useCase: 'Privacy-First Processing',
        description: 'Models optimized for local processing with maximum privacy',
        models: [
          {
            modelId: 'llama-2-7b-chat.Q4_0.gguf',
            provider: 'llamacpp',
            reason: 'Fully local processing with no external dependencies',
            priority: 'high'
          },
          {
            modelId: 'mistral-7b-instruct-v0.1.Q4_0.gguf',
            provider: 'llamacpp',
            reason: 'Strong local performance with privacy guarantees',
            priority: 'medium'
          }
        ]
      }
    ];
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalModels: number;
    totalSize: number;
    totalSizeFormatted: string;
    byProvider: Record<string, { count: number; size: number; sizeFormatted: string }>;
  }> {
    const allModels = await this.getAllModels();
    
    let totalSize = 0;
    const byProvider: Record<string, { count: number; size: number; sizeFormatted: string }> = {};

    for (const model of allModels) {
      const size = model.size || 0;
      totalSize += size;

      if (!byProvider[model.provider]) {
        byProvider[model.provider] = { count: 0, size: 0, sizeFormatted: '' };
      }
      
      byProvider[model.provider].count++;
      byProvider[model.provider].size += size;
    }

    // Format sizes
    for (const provider in byProvider) {
      byProvider[provider].sizeFormatted = this.formatBytes(byProvider[provider].size);
    }

    return {
      totalModels: allModels.length,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      byProvider
    };
  }

  /**
   * Refresh the model cache
   */
  private async refreshModelCache(force = false): Promise<void> {
    const now = Date.now();
    if (!force && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return; // Cache is still valid
    }

    this.logger.debug('Refreshing model cache...');

    for (const [providerId, adapter] of this.adapters) {
      try {
        const models = await this.getModelsFromAdapter(adapter, providerId as 'ollama' | 'llamacpp');
        this.modelCache.set(providerId, models);
      } catch (error) {
        this.logger.error(`Failed to refresh models for ${providerId}:`, error);
        // Keep existing cache if refresh fails
      }
    }

    this.lastCacheUpdate = now;
  }

  /**
   * Get models from a specific adapter and convert to unified format
   */
  private async getModelsFromAdapter(adapter: AIModelAdapter, provider: 'ollama' | 'llamacpp'): Promise<UnifiedModelInfo[]> {
    const models: UnifiedModelInfo[] = [];

    if (adapter instanceof OllamaAdapter) {
      const ollamaModels = await adapter.getAvailableModels();
      for (const model of ollamaModels) {
                 models.push({
           id: model.name,
           name: model.name,
           provider: 'ollama',
           size: model.size,
           sizeFormatted: this.formatBytes(model.size || 0),
           status: model.isAvailable ? 'available' : 'not-installed',
           version: model.name.includes(':') ? model.name.split(':')[1] : undefined,
           capabilities: adapter.capabilities,
           lastModified: new Date(model.lastModified),
           metadata: {
             family: model.details?.family,
             format: model.details?.format,
             quantization: model.details?.quantization_level,
             parameters: model.details?.parameter_size
           }
         });
      }
    } else if (adapter instanceof LlamaCppAdapter) {
      // For LlamaCpp, we need to scan for available model files
      // This is a simplified implementation - in practice, you'd scan directories
      const llamaCppModels = await this.getLlamaCppModels();
      for (const model of llamaCppModels) {
        models.push({
          id: model.id,
          name: model.name,
          provider: 'llamacpp',
          size: model.size,
          sizeFormatted: this.formatBytes(model.size || 0),
          status: 'available',
          capabilities: adapter.capabilities,
          metadata: model.metadata
        });
      }
    }

    return models;
  }

  /**
   * Get LlamaCpp models (placeholder implementation)
   */
  private async getLlamaCppModels(): Promise<Array<{
    id: string;
    name: string;
    size?: number;
    metadata?: any;
  }>> {
    // This is a placeholder - in a real implementation, you would:
    // 1. Scan common model directories
    // 2. Parse model file names and metadata
    // 3. Check file sizes and availability
    return [
      {
        id: 'llama-2-7b-chat.Q4_0.gguf',
        name: 'Llama 2 7B Chat (Q4_0)',
        size: 3800000000, // ~3.8GB
        metadata: {
          family: 'llama',
          quantization: 'Q4_0',
          parameters: '7B'
        }
      }
    ];
  }

  /**
   * Filter models based on search options
   */
  private filterModels(models: UnifiedModelInfo[], options: ModelSearchOptions): UnifiedModelInfo[] {
    let filtered = [...models];

    // Filter by status
    if (options.status && options.status !== 'all') {
      filtered = filtered.filter(model => model.status === options.status);
    }

    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      filtered = filtered.filter(model => 
        options.capabilities!.some(cap => model.capabilities.includes(cap))
      );
    }

    // Filter by name
    if (options.nameFilter) {
      const nameFilter = options.nameFilter.toLowerCase();
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(nameFilter) ||
        model.id.toLowerCase().includes(nameFilter)
      );
    }

    // Filter by size range
    if (options.sizeRange) {
      filtered = filtered.filter(model => {
        const size = model.size || 0;
        const min = options.sizeRange!.min || 0;
        const max = options.sizeRange!.max || Infinity;
        return size >= min && size <= max;
      });
    }

    // Sort results
    if (options.sortBy) {
      filtered.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (options.sortBy) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'size':
            aVal = a.size || 0;
            bVal = b.size || 0;
            break;
          case 'lastModified':
            aVal = a.lastModified?.getTime() || 0;
            bVal = b.lastModified?.getTime() || 0;
            break;
          case 'provider':
            aVal = a.provider;
            bVal = b.provider;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return options.sortOrder === 'desc' ? 1 : -1;
        if (aVal > bVal) return options.sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    return filtered;
  }

  /**
   * Get provider ID from adapter
   */
  private getProviderId(adapter: AIModelAdapter): string {
    if (adapter instanceof OllamaAdapter) return 'ollama';
    if (adapter instanceof LlamaCppAdapter) return 'llamacpp';
    return adapter.name.toLowerCase();
  }

  /**
   * Invalidate the model cache
   */
  private invalidateCache(): void {
    this.lastCacheUpdate = 0;
    this.modelCache.clear();
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format download speed
   */
  private formatSpeed(completed: number, total: number): string {
    // This is a simplified implementation
    // In practice, you'd track time and calculate actual speed
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    return `${percentage.toFixed(1)}%`;
  }

  /**
   * Calculate estimated time of arrival
   */
  private calculateETA(completed: number, total: number): string {
    // This is a simplified implementation
    // In practice, you'd track download speed and calculate ETA
    const remaining = total - completed;
    if (remaining <= 0) return '0s';
    
    // Placeholder calculation
    const estimatedSeconds = Math.ceil(remaining / 1000000); // Assume 1MB/s
    if (estimatedSeconds < 60) return `${estimatedSeconds}s`;
    if (estimatedSeconds < 3600) return `${Math.ceil(estimatedSeconds / 60)}m`;
    return `${Math.ceil(estimatedSeconds / 3600)}h`;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.adapters.clear();
    this.modelCache.clear();
    this.downloadCallbacks.clear();
    this.logger.info('UnifiedModelManager disposed');
  }
} 