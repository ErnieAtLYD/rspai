// src/services/BaseService.ts

import { App } from "obsidian";
import { IService } from "./ServiceManager";
import { Logger, createLogger } from "./Logger";

/**
 * Error callback type for BaseService
 */
export type ServiceErrorCallback = (serviceName: string, error: Error, operation: string) => void;

/**
 * Base service class providing common functionality
 * All services should extend this class
 */
export abstract class BaseService implements IService {
    protected isInitialized = false;
    protected isDisposed = false;
    protected logger: Logger;
    private errorCallback?: ServiceErrorCallback;

    constructor(protected app: App, errorCallback?: ServiceErrorCallback) {
        this.errorCallback = errorCallback;
        this.logger = createLogger(this.constructor.name);
    }

    /**
     * Initialize the service
     * Override this method to add custom initialization logic
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            this.logger.lifecycle('initialize started');
            await this.onInitialize();
            this.isInitialized = true;
            this.logger.lifecycle('initialized');
        } catch (error) {
            const serviceError = error instanceof Error ? error : new Error(String(error));
            await this.logger.error('Initialization failed', serviceError);
            this.handleServiceError(serviceError, 'initialize');
            throw error;
        }
    }

    /**
     * Dispose the service
     * Override this method to add custom cleanup logic
     */
    async dispose(): Promise<void> {
        if (this.isDisposed) {
            return;
        }

        try {
            this.logger.lifecycle('dispose started');
            await this.onDispose();
            this.isDisposed = true;
            this.logger.lifecycle('disposed');
        } catch (error) {
            const serviceError = error instanceof Error ? error : new Error(String(error));
            await this.logger.error('Disposal failed', serviceError);
            this.handleServiceError(serviceError, 'dispose');
            throw error;
        }
    }

    /**
     * Check if service is ready to use
     */
    isReady(): boolean {
        return this.isInitialized && !this.isDisposed;
    }

    /**
     * Override this method to add custom initialization logic
     */
    protected async onInitialize(): Promise<void> {
        // Default implementation does nothing
    }

    /**
     * Override this method to add custom cleanup logic
     */
    protected async onDispose(): Promise<void> {
        // Default implementation does nothing
    }

    /**
     * Ensure service is ready before use
     * Throws error if service is not ready
     */
    protected ensureReady(): void {
        if (!this.isReady()) {
            throw new Error(`${this.constructor.name} is not ready. Call initialize() first.`);
        }
    }

    /**
     * Handle service errors using callback or fallback to console
     */
    private handleServiceError(error: Error, operation: string): void {
        const serviceName = this.constructor.name;
        
        if (this.errorCallback) {
            try {
                this.errorCallback(serviceName, error, operation);
            } catch (callbackError) {
                // Fallback to console if callback fails - report original error only
                console.error(`Failed to ${operation} ${serviceName}:`, error);
            }
        } else {
            // Fallback to console logging only
            console.error(`Failed to ${operation} ${serviceName}:`, error);
        }
    }

    /**
     * Ensure service is not disposed
     * Throws error if service is disposed
     */
    protected ensureNotDisposed(): void {
        if (this.isDisposed) {
            throw new Error(`${this.constructor.name} has been disposed and cannot be used.`);
        }
    }
}