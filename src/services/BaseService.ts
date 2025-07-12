// src/services/BaseService.ts

import { App, Notice } from "obsidian";
import { IService } from "./ServiceManager";

/**
 * Base service class providing common functionality
 * All services should extend this class
 */
export abstract class BaseService implements IService {
    protected isInitialized = false;
    protected isDisposed = false;

    constructor(protected app: App) {}

    /**
     * Initialize the service
     * Override this method to add custom initialization logic
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            await this.onInitialize();
            this.isInitialized = true;
        } catch (error) {
            // Use simple error handling to avoid circular dependency with ErrorHandlingService
            const errorMessage = `Failed to initialize ${this.constructor.name}`;
            console.error(errorMessage, error);
            
            // Show notice if we have access to the app and Notice is available
            if (this.app && typeof Notice !== 'undefined') {
                try {
                    new Notice(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
                } catch (noticeError) {
                    // Fallback to console if Notice fails
                    console.error('Failed to show notice:', noticeError);
                }
            }
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
            await this.onDispose();
            this.isDisposed = true;
        } catch (error) {
            // Use simple error handling to avoid circular dependency with ErrorHandlingService
            const errorMessage = `Failed to dispose ${this.constructor.name}`;
            console.error(errorMessage, error);
            
            // Show notice if we have access to the app and Notice is available
            if (this.app && typeof Notice !== 'undefined') {
                try {
                    new Notice(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
                } catch (noticeError) {
                    // Fallback to console if Notice fails
                    console.error('Failed to show notice:', noticeError);
                }
            }
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
     * Ensure service is not disposed
     * Throws error if service is disposed
     */
    protected ensureNotDisposed(): void {
        if (this.isDisposed) {
            throw new Error(`${this.constructor.name} has been disposed and cannot be used.`);
        }
    }
}