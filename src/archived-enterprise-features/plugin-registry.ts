/**
 * Plugin Registry - Advanced Extensibility Framework for AI Model Adapters
 * Provides dynamic plugin registration, dependency injection, and lifecycle management
 * 
 * @version 2.0.0
 * @author RetrospectAI Plugin Team
 */

import { Logger } from './logger';
import { 
  AIModelAdapter, 
  AIModelConfig, 
  AICapability, 
  AIModelType, 
  PrivacyLevel,
  AIError,
  AIErrorType
} from './ai-interfaces';

// ========================================
// PLUGIN INTERFACES
// ========================================

/**
 * Plugin metadata for registration and discovery
 */
export interface PluginMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly homepage?: string;
  readonly repository?: string;
  readonly license?: string;
  readonly keywords: string[];
  readonly capabilities: AICapability[];
  readonly supportedTypes: AIModelType[];
  readonly privacyLevels: PrivacyLevel[];
  readonly dependencies?: string[];
  readonly optionalDependencies?: string[];
  readonly minimumVersion?: string;
  readonly maximumVersion?: string;
  readonly experimental?: boolean;
  readonly deprecated?: boolean;
  readonly replacedBy?: string;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema {
  readonly properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
    default?: unknown;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    pattern?: string;
    items?: PluginConfigSchema['properties'][string];
    properties?: Record<string, PluginConfigSchema['properties'][string]>;
  }>;
  readonly required?: string[];
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  /**
   * Called when plugin is registered
   */
  onRegister?(registry: PluginRegistry): Promise<void> | void;

  /**
   * Called before plugin is activated
   */
  onActivate?(registry: PluginRegistry): Promise<void> | void;

  /**
   * Called when plugin is deactivated
   */
  onDeactivate?(registry: PluginRegistry): Promise<void> | void;

  /**
   * Called when plugin is unregistered
   */
  onUnregister?(registry: PluginRegistry): Promise<void> | void;

  /**
   * Called when dependencies are resolved
   */
  onDependenciesResolved?(dependencies: Map<string, PluginInstance>): Promise<void> | void;

  /**
   * Called when plugin configuration is updated
   */
  onConfigUpdate?(config: Record<string, unknown>): Promise<void> | void;
}

/**
 * Plugin constructor interface
 */
export interface PluginConstructor {
  new (logger: Logger, config: AIModelConfig, dependencies?: Map<string, PluginInstance>): AIModelAdapter & PluginLifecycle;
  readonly metadata: PluginMetadata;
  readonly configSchema?: PluginConfigSchema;
}

/**
 * Plugin instance wrapper
 */
export interface PluginInstance {
  readonly metadata: PluginMetadata;
  readonly adapter: AIModelAdapter & PluginLifecycle;
  readonly config: AIModelConfig;
  readonly dependencies: Map<string, PluginInstance>;
  readonly state: PluginState;
  readonly registeredAt: Date;
  readonly activatedAt?: Date;
  readonly lastUsed?: Date;
  readonly usageCount: number;
  readonly errorCount: number;
}

/**
 * Plugin state enumeration
 */
export enum PluginState {
  REGISTERED = 'registered',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  INACTIVE = 'inactive',
  ERROR = 'error',
  DEPRECATED = 'deprecated'
}

/**
 * Plugin discovery interface
 */
export interface PluginDiscovery {
  /**
   * Discover plugins from various sources
   */
  discoverPlugins(): Promise<PluginConstructor[]>;

  /**
   * Load plugin from path or module
   */
  loadPlugin(source: string): Promise<PluginConstructor>;

  /**
   * Validate plugin structure
   */
  validatePlugin(plugin: PluginConstructor): Promise<boolean>;
}

/**
 * Dependency resolver interface
 */
export interface DependencyResolver {
  /**
   * Resolve plugin dependencies
   */
  resolveDependencies(pluginId: string, registry: PluginRegistry): Promise<Map<string, PluginInstance>>;

  /**
   * Check for circular dependencies
   */
  checkCircularDependencies(pluginId: string, registry: PluginRegistry): boolean;

  /**
   * Get dependency graph
   */
  getDependencyGraph(registry: PluginRegistry): Map<string, string[]>;
}

// ========================================
// PLUGIN REGISTRY IMPLEMENTATION
// ========================================

/**
 * Advanced plugin registry with dependency injection and lifecycle management
 */
export class PluginRegistry {
  private plugins: Map<string, PluginConstructor> = new Map();
  private instances: Map<string, PluginInstance> = new Map();
  private dependencyResolver: DependencyResolver;
  private discovery: PluginDiscovery;
  private logger: Logger;

  constructor(
    logger: Logger,
    dependencyResolver?: DependencyResolver,
    discovery?: PluginDiscovery
  ) {
    this.logger = logger;
    this.dependencyResolver = dependencyResolver || new DefaultDependencyResolver();
    this.discovery = discovery || new DefaultPluginDiscovery(logger);
  }

  /**
   * Register a plugin constructor
   */
  async registerPlugin(plugin: PluginConstructor): Promise<void> {
    const metadata = plugin.metadata;

    // Validate plugin
    if (!await this.validatePlugin(plugin)) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Plugin validation failed: ${metadata.id}`
      );
    }

    // Check for conflicts
    if (this.plugins.has(metadata.id)) {
      const existing = this.plugins.get(metadata.id)!;
      if (existing.metadata.version === metadata.version) {
        throw new AIError(
          AIErrorType.INVALID_CONFIG,
          `Plugin already registered: ${metadata.id}@${metadata.version}`
        );
      }
      this.logger.warn(`Replacing plugin: ${metadata.id}@${existing.metadata.version} with @${metadata.version}`);
    }

    // Register plugin
    this.plugins.set(metadata.id, plugin);
    this.logger.info(`Registered plugin: ${metadata.id}@${metadata.version}`);

    // Call lifecycle hook
    const tempInstance = new plugin(this.logger, {} as AIModelConfig);
    if (tempInstance.onRegister) {
      await tempInstance.onRegister(this);
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    // Deactivate if active
    if (this.instances.has(pluginId)) {
      await this.deactivatePlugin(pluginId);
    }

    // Call lifecycle hook
    const tempInstance = new plugin(this.logger, {} as AIModelConfig);
    if (tempInstance.onUnregister) {
      await tempInstance.onUnregister(this);
    }

    // Remove from registry
    this.plugins.delete(pluginId);
    this.logger.info(`Unregistered plugin: ${pluginId}`);

    return true;
  }

  /**
   * Create and activate a plugin instance
   */
  async createInstance(pluginId: string, config: AIModelConfig): Promise<PluginInstance> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Plugin not found: ${pluginId}`
      );
    }

    // Check if already active
    if (this.instances.has(pluginId)) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Plugin already active: ${pluginId}`
      );
    }

    try {
      // Resolve dependencies
      const dependencies = await this.dependencyResolver.resolveDependencies(pluginId, this);

      // Create instance
      const adapter = new plugin(this.logger, config, dependencies);

      // Create instance wrapper
      const instance: PluginInstance = {
        metadata: plugin.metadata,
        adapter,
        config,
        dependencies,
        state: PluginState.REGISTERED,
        registeredAt: new Date(),
        usageCount: 0,
        errorCount: 0
      };

      // Update state to activating
      (instance as any).state = PluginState.ACTIVATING;

      // Call lifecycle hooks
      if (adapter.onDependenciesResolved) {
        await adapter.onDependenciesResolved(dependencies);
      }

      if (adapter.onActivate) {
        await adapter.onActivate(this);
      }

      // Initialize adapter
      await adapter.initialize();

      // Update state and timestamps
      (instance as any).state = PluginState.ACTIVE;
      (instance as any).activatedAt = new Date();

      // Store instance
      this.instances.set(pluginId, instance);

      this.logger.info(`Activated plugin instance: ${pluginId}`);
      return instance;

    } catch (error) {
      this.logger.error(`Failed to create plugin instance: ${pluginId}`, error);
      throw new AIError(
        AIErrorType.INITIALIZATION_FAILED,
        `Failed to create plugin instance: ${pluginId}`,
        error
      );
    }
  }

  /**
   * Deactivate a plugin instance
   */
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      return false;
    }

    try {
      // Update state
      (instance as any).state = PluginState.DEACTIVATING;

      // Call lifecycle hook
      if (instance.adapter.onDeactivate) {
        await instance.adapter.onDeactivate(this);
      }

      // Dispose adapter
      await instance.adapter.dispose();

      // Update state
      (instance as any).state = PluginState.INACTIVE;

      // Remove from active instances
      this.instances.delete(pluginId);

      this.logger.info(`Deactivated plugin: ${pluginId}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to deactivate plugin: ${pluginId}`, error);
      (instance as any).state = PluginState.ERROR;
      return false;
    }
  }

  /**
   * Get plugin instance
   */
  getInstance(pluginId: string): PluginInstance | undefined {
    return this.instances.get(pluginId);
  }

  /**
   * Get all active instances
   */
  getActiveInstances(): Map<string, PluginInstance> {
    return new Map(this.instances);
  }

  /**
   * Get registered plugins
   */
  getRegisteredPlugins(): Map<string, PluginConstructor> {
    return new Map(this.plugins);
  }

  /**
   * Find plugins by capability
   */
  findPluginsByCapability(capability: AICapability): PluginConstructor[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.metadata.capabilities.includes(capability)
    );
  }

  /**
   * Find plugins by type
   */
  findPluginsByType(type: AIModelType): PluginConstructor[] {
    return Array.from(this.plugins.values()).filter(
      plugin => plugin.metadata.supportedTypes.includes(type)
    );
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    registered: number;
    active: number;
    inactive: number;
    error: number;
    totalUsage: number;
    totalErrors: number;
  } {
    const registered = this.plugins.size;
    const instances = Array.from(this.instances.values());
    
    return {
      registered,
      active: instances.filter(i => i.state === PluginState.ACTIVE).length,
      inactive: instances.filter(i => i.state === PluginState.INACTIVE).length,
      error: instances.filter(i => i.state === PluginState.ERROR).length,
      totalUsage: instances.reduce((sum, i) => sum + i.usageCount, 0),
      totalErrors: instances.reduce((sum, i) => sum + i.errorCount, 0)
    };
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(pluginId: string, config: Partial<AIModelConfig>): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new AIError(
        AIErrorType.INVALID_CONFIG,
        `Plugin instance not found: ${pluginId}`
      );
    }

    // Update adapter config
    await instance.adapter.updateConfig(config);

    // Update instance config
    Object.assign(instance.config, config);

    // Call lifecycle hook
    if (instance.adapter.onConfigUpdate) {
      await instance.adapter.onConfigUpdate(config);
    }

    this.logger.info(`Updated plugin configuration: ${pluginId}`);
  }

  /**
   * Discover and register plugins automatically
   */
  async discoverPlugins(): Promise<number> {
    const plugins = await this.discovery.discoverPlugins();
    let registered = 0;

    for (const plugin of plugins) {
      try {
        await this.registerPlugin(plugin);
        registered++;
      } catch (error) {
        this.logger.warn(`Failed to register discovered plugin: ${plugin.metadata.id}`, error);
      }
    }

    this.logger.info(`Discovered and registered ${registered} plugins`);
    return registered;
  }

  /**
   * Validate plugin structure and metadata
   */
  private async validatePlugin(plugin: PluginConstructor): Promise<boolean> {
    try {
      // Check metadata
      if (!plugin.metadata || !plugin.metadata.id || !plugin.metadata.version) {
        return false;
      }

      // Check constructor
      if (typeof plugin !== 'function') {
        return false;
      }

      // Try creating a test instance
      const testInstance = new plugin(this.logger, {} as AIModelConfig);
      if (!testInstance || typeof testInstance.initialize !== 'function') {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Plugin validation failed: ${plugin.metadata?.id}`, error);
      return false;
    }
  }
}

// ========================================
// DEFAULT IMPLEMENTATIONS
// ========================================

/**
 * Default dependency resolver implementation
 */
export class DefaultDependencyResolver implements DependencyResolver {
  async resolveDependencies(pluginId: string, registry: PluginRegistry): Promise<Map<string, PluginInstance>> {
    const plugin = registry.getRegisteredPlugins().get(pluginId);
    if (!plugin) {
      throw new AIError(AIErrorType.INVALID_CONFIG, `Plugin not found: ${pluginId}`);
    }

    const dependencies = new Map<string, PluginInstance>();
    const metadata = plugin.metadata;

    // Check for circular dependencies
    if (this.checkCircularDependencies(pluginId, registry)) {
      throw new AIError(AIErrorType.INVALID_CONFIG, `Circular dependency detected for: ${pluginId}`);
    }

    // Resolve required dependencies
    if (metadata.dependencies) {
      for (const depId of metadata.dependencies) {
        const depInstance = registry.getInstance(depId);
        if (!depInstance) {
          throw new AIError(
            AIErrorType.INVALID_CONFIG,
            `Required dependency not found: ${depId} for plugin ${pluginId}`
          );
        }
        dependencies.set(depId, depInstance);
      }
    }

    // Resolve optional dependencies
    if (metadata.optionalDependencies) {
      for (const depId of metadata.optionalDependencies) {
        const depInstance = registry.getInstance(depId);
        if (depInstance) {
          dependencies.set(depId, depInstance);
        }
      }
    }

    return dependencies;
  }

  checkCircularDependencies(pluginId: string, registry: PluginRegistry): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (id: string): boolean => {
      if (recursionStack.has(id)) {
        return true;
      }
      if (visited.has(id)) {
        return false;
      }

      visited.add(id);
      recursionStack.add(id);

      const plugin = registry.getRegisteredPlugins().get(id);
      if (plugin?.metadata.dependencies) {
        for (const depId of plugin.metadata.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(id);
      return false;
    };

    return hasCycle(pluginId);
  }

  getDependencyGraph(registry: PluginRegistry): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const [id, plugin] of registry.getRegisteredPlugins()) {
      const deps = [
        ...(plugin.metadata.dependencies || []),
        ...(plugin.metadata.optionalDependencies || [])
      ];
      graph.set(id, deps);
    }

    return graph;
  }
}

/**
 * Default plugin discovery implementation
 */
export class DefaultPluginDiscovery implements PluginDiscovery {
  constructor(private logger: Logger) {}

  async discoverPlugins(): Promise<PluginConstructor[]> {
    // In a real implementation, this would scan directories, npm packages, etc.
    // For now, return empty array as this is just the framework
    this.logger.debug('Plugin discovery not implemented - returning empty array');
    return [];
  }

  async loadPlugin(source: string): Promise<PluginConstructor> {
    // In a real implementation, this would dynamically import/require the plugin
    throw new AIError(AIErrorType.INVALID_CONFIG, `Plugin loading not implemented: ${source}`);
  }

  async validatePlugin(plugin: PluginConstructor): Promise<boolean> {
    return plugin.metadata && typeof plugin === 'function';
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Create a plugin metadata object
 */
export function createPluginMetadata(
  id: string,
  name: string,
  version: string,
  options: Partial<Omit<PluginMetadata, 'id' | 'name' | 'version'>>
): PluginMetadata {
  return {
    id,
    name,
    version,
    description: options.description || '',
    keywords: options.keywords || [],
    capabilities: options.capabilities || [],
    supportedTypes: options.supportedTypes || [],
    privacyLevels: options.privacyLevels || [],
    ...options
  };
}

/**
 * Create a plugin configuration schema
 */
export function createConfigSchema(properties: PluginConfigSchema['properties']): PluginConfigSchema {
  return { properties };
}

/**
 * Validate plugin configuration against schema
 */
export function validatePluginConfig(
  config: Record<string, unknown>,
  schema: PluginConfigSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required properties
  if (schema.required) {
    for (const prop of schema.required) {
      if (!(prop in config)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
  }

  // Validate property types and constraints
  for (const [prop, value] of Object.entries(config)) {
    const propSchema = schema.properties[prop];
    if (!propSchema) {
      continue; // Allow extra properties
    }

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== propSchema.type) {
      errors.push(`Property ${prop} must be of type ${propSchema.type}, got ${actualType}`);
      continue;
    }

    // Additional validations based on type
    if (propSchema.type === 'string' && typeof value === 'string') {
      if (propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) {
        errors.push(`Property ${prop} does not match pattern: ${propSchema.pattern}`);
      }
      if (propSchema.enum && !propSchema.enum.includes(value)) {
        errors.push(`Property ${prop} must be one of: ${propSchema.enum.join(', ')}`);
      }
    }

    if (propSchema.type === 'number' && typeof value === 'number') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        errors.push(`Property ${prop} must be >= ${propSchema.minimum}`);
      }
      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        errors.push(`Property ${prop} must be <= ${propSchema.maximum}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
} 