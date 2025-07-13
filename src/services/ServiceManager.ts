// src/services/ServiceManager.ts

import { App } from "obsidian";
import { ErrorHandlingService, RetrospectError, ErrorCode, ErrorType } from "./ErrorHandlingService";

/**
 * Base interface for all services
 * Provides common lifecycle methods
 */
export interface IService {
    /**
     * Initialize the service
     * Called after all dependencies are injected
     */
    initialize?(): Promise<void> | void;

    /**
     * Cleanup the service
     * Called when the plugin is unloaded
     */
    dispose?(): Promise<void> | void;

    /**
     * Check if service is ready to use
     */
    isReady?(): boolean;
}

/**
 * Service constructor type
 * Defines how services are created
 */
export type ServiceConstructor<T extends IService> = new (...args: any[]) => T;

/**
 * Service factory function type
 * Alternative to constructor for more complex creation logic
 */
export type ServiceFactory<T extends IService> = (serviceManager: ServiceManager) => T;

/**
 * Service registration options
 */
export interface ServiceRegistration<T extends IService> {
    /**
     * Service constructor or factory function
     */
    implementation: ServiceConstructor<T> | ServiceFactory<T>;
    
    /**
     * Dependencies required by this service
     * Array of service keys that should be injected
     */
    dependencies?: string[];
    
    /**
     * Whether this service should be a singleton
     * Default: true
     */
    singleton?: boolean;
    
    /**
     * Whether to initialize this service immediately when registered
     * Default: false
     */
    eager?: boolean;
}

/**
 * Lightweight service manager for dependency injection
 * 
 * Features:
 * - Constructor injection
 * - Singleton management
 * - Dependency resolution
 * - Lifecycle management
 * - Type safety
 */
export class ServiceManager {
    private services = new Map<string, ServiceRegistration<any>>();
    private instances = new Map<string, any>();
    private initializing = new Set<string>();
    private errorHandler?: ErrorHandlingService;

    constructor(private app: App) {}

    /**
     * Set the error handler for service operations
     * This should be called after the ErrorHandlingService is registered
     */
    setErrorHandler(errorHandler: ErrorHandlingService): void {
        this.errorHandler = errorHandler;
    }

    /**
     * Register a service with the manager
     * 
     * @param key - Unique identifier for the service
     * @param registration - Service registration configuration
     * 
     * @example
     * ```typescript
     * serviceManager.register('aiService', {
     *   implementation: AIService,
     *   dependencies: ['settingsService'],
     *   singleton: true
     * });
     * ```
     */
    register<T extends IService>(
        key: string, 
        registration: ServiceRegistration<T>
    ): void {
        if (this.services.has(key)) {
            throw new RetrospectError(
                ErrorType.CRITICAL,
                ErrorCode.SERVICE_REGISTRATION_FAILED,
                `Service '${key}' is already registered`,
                `Service '${key}' is already registered`,
                { operation: 'register_service', component: 'ServiceManager', metadata: { serviceKey: key }, timestamp: Date.now() }
            );
        }

        // Set defaults
        const config: ServiceRegistration<T> = {
            singleton: true,
            eager: false,
            dependencies: [],
            ...registration
        };

        this.services.set(key, config);

        // Initialize eagerly if requested
        if (config.eager) {
            this.resolve<T>(key);
        }
    }

    /**
     * Resolve a service by key
     * Creates the service if it doesn't exist (for singletons)
     * 
     * @param key - Service key to resolve
     * @returns The service instance
     * 
     * @example
     * ```typescript
     * const aiService = serviceManager.resolve<AIService>('aiService');
     * ```
     */
    resolve<T extends IService>(key: string): T {
        // Check for circular dependencies
        if (this.initializing.has(key)) {
            throw new RetrospectError(
                ErrorType.CRITICAL,
                ErrorCode.SERVICE_REGISTRATION_FAILED,
                `Circular dependency detected for service '${key}'`,
                `Circular dependency detected for service '${key}'`,
                { operation: 'resolve_service', component: 'ServiceManager', metadata: { serviceKey: key }, timestamp: Date.now() }
            );
        }

        // Return existing instance if singleton
        if (this.instances.has(key)) {
            return this.instances.get(key) as T;
        }

        const registration = this.services.get(key);
        if (!registration) {
            throw new RetrospectError(
                ErrorType.CRITICAL,
                ErrorCode.SERVICE_UNAVAILABLE,
                `Service '${key}' is not registered`,
                `Service '${key}' is not registered`,
                { operation: 'resolve_service', component: 'ServiceManager', metadata: { serviceKey: key }, timestamp: Date.now() }
            );
        }

        // Mark as initializing to detect circular dependencies
        this.initializing.add(key);

        try {
            // Resolve dependencies first
            const dependencies = this.resolveDependencies(registration.dependencies || []);
            
            // Create the service instance
            const instance = this.createInstance<T>(registration, dependencies);
            
            // Store instance if singleton
            if (registration.singleton) {
                this.instances.set(key, instance);
            }

            // Don't initialize during construction - wait for initializeAll()
            
            return instance;
        } finally {
            // Remove from initializing set
            this.initializing.delete(key);
        }
    }

    /**
     * Check if a service is registered
     * 
     * @param key - Service key to check
     * @returns True if service is registered
     */
    has(key: string): boolean {
        return this.services.has(key);
    }

    /**
     * Get all registered service keys
     * 
     * @returns Array of service keys
     */
    getRegisteredServices(): string[] {
        return Array.from(this.services.keys());
    }

    /**
     * Initialize all registered services
     * Useful for plugin startup
     */
    async initializeAll(): Promise<void> {
        // Initialize ErrorHandlingService first since other services depend on it
        if (this.services.has('errorHandlingService')) {
            try {
                const errorHandlingService = this.resolve('errorHandlingService');
                if (errorHandlingService.initialize) {
                    await errorHandlingService.initialize();
                }
                // Set error handler for service manager once it's initialized
                this.errorHandler = errorHandlingService as ErrorHandlingService;
            } catch (error) {
                console.error('Failed to initialize ErrorHandlingService:', error);
                throw error; // Don't continue if error handling service fails
            }
        }

        // Initialize all other services (excluding ErrorHandlingService which is already done)
        const promises: Promise<void>[] = [];
        
        for (const key of this.services.keys()) {
            if (key === 'errorHandlingService') {
                continue; // Already initialized
            }
            
            try {
                const service = this.resolve(key);
                if (service.initialize) {
                    const result = service.initialize();
                    if (result instanceof Promise) {
                        promises.push(result);
                    }
                }
            } catch (error) {
                if (this.errorHandler) {
                    await this.errorHandler.handleError(
                        error instanceof Error ? error : new Error(String(error)),
                        {
                            operation: 'initialize_service',
                            component: 'ServiceManager',
                            metadata: { serviceKey: key },
                            timestamp: Date.now()
                        }
                    );
                } else {
                    console.error(`Failed to initialize service '${key}':`, error);
                }
            }
        }

        await Promise.all(promises);
    }

    /**
     * Dispose all services
     * Useful for plugin cleanup
     */
    async disposeAll(): Promise<void> {
        const promises: Promise<void>[] = [];

        // Dispose in reverse order of creation
        const keys = Array.from(this.instances.keys()).reverse();
        
        for (const key of keys) {
            try {
                const service = this.instances.get(key);
                if (service && service.dispose) {
                    const result = service.dispose();
                    if (result instanceof Promise) {
                        promises.push(result);
                    }
                }
            } catch (error) {
                if (this.errorHandler) {
                    await this.errorHandler.handleError(
                        error instanceof Error ? error : new Error(String(error)),
                        {
                            operation: 'dispose_service',
                            component: 'ServiceManager',
                            metadata: { serviceKey: key },
                            timestamp: Date.now()
                        }
                    );
                } else {
                    console.error(`Failed to dispose service '${key}':`, error);
                }
            }
        }

        await Promise.all(promises);
        
        // Clear all instances
        this.instances.clear();
        this.initializing.clear();
    }

    /**
     * Resolve dependencies for a service
     * 
     * @param dependencies - Array of dependency keys
     * @returns Array of resolved dependency instances
     */
    private resolveDependencies(dependencies: string[]): any[] {
        return dependencies.map(dep => this.resolve(dep));
    }

    /**
     * Create a service instance
     * 
     * @param registration - Service registration
     * @param dependencies - Resolved dependencies
     * @returns Created service instance
     */
    private createInstance<T extends IService>(
        registration: ServiceRegistration<T>,
        dependencies: any[]
    ): T {
        const { implementation } = registration;

        // Check if it's a factory function
        if (typeof implementation === 'function' && implementation.length === 1) {
            // Factory function - pass the service manager
            return (implementation as ServiceFactory<T>)(this);
        }

        // Constructor - create with dependencies and app
        const Constructor = implementation as ServiceConstructor<T>;
        
        // Common pattern: pass app as first parameter, then dependencies
        return new Constructor(this.app, ...dependencies);
    }

    /**
     * Initialize a service if it has an initialize method
     * 
     * @param service - Service to initialize
     */
    private initializeService(service: IService): void {
        if (service.initialize) {
            try {
                const result = service.initialize();
                if (result instanceof Promise) {
                    result.catch(async (error) => {
                        if (this.errorHandler) {
                            await this.errorHandler.handleError(
                                error instanceof Error ? error : new Error(String(error)),
                                {
                                    operation: 'async_service_initialization',
                                    component: 'ServiceManager',
                                    timestamp: Date.now()
                                }
                            );
                        } else {
                            console.error('Service initialization failed:', error);
                        }
                    });
                }
            } catch (error) {
                if (this.errorHandler) {
                    this.errorHandler.handleError(
                        error instanceof Error ? error : new Error(String(error)),
                        {
                            operation: 'sync_service_initialization',
                            component: 'ServiceManager',
                            timestamp: Date.now()
                        }
                    );
                } else {
                    console.error('Service initialization failed:', error);
                }
            }
        }
    }
}