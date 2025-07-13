import { App, Notice } from "obsidian";
import { BaseService } from "./BaseService";

export enum ErrorType {
    CRITICAL = "critical",
    USER = "user", 
    API = "api",
    FILESYSTEM = "filesystem",
    VALIDATION = "validation",
    NETWORK = "network"
}

export enum ErrorCode {
    PLUGIN_INIT_FAILED = "PLUGIN_INIT_FAILED",
    SERVICE_REGISTRATION_FAILED = "SERVICE_REGISTRATION_FAILED",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    API_KEY_INVALID = "API_KEY_INVALID",
    API_KEY_MISSING = "API_KEY_MISSING",
    API_RATE_LIMITED = "API_RATE_LIMITED",
    API_NETWORK_ERROR = "API_NETWORK_ERROR",
    API_RESPONSE_ERROR = "API_RESPONSE_ERROR",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    FOLDER_NOT_FOUND = "FOLDER_NOT_FOUND",
    PERMISSION_DENIED = "PERMISSION_DENIED",
    DISK_SPACE_FULL = "DISK_SPACE_FULL",
    INVALID_CONFIG = "INVALID_CONFIG",
    ENCRYPTION_FAILED = "ENCRYPTION_FAILED",
    DECRYPTION_FAILED = "DECRYPTION_FAILED",
    ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
    NO_CONTENT_FOUND = "NO_CONTENT_FOUND",
    SUCCESS = "SUCCESS",
    INFO = "INFO"
}

export interface ErrorContext {
    operation: string;
    component: string;
    metadata?: Record<string, unknown>;
    stack?: string;
    timestamp: number;
}

export interface ErrorHandlerOptions {
    showNotice?: boolean;
    logToConsole?: boolean;
    throwAfterHandling?: boolean;
    retryable?: boolean;
    maxRetries?: number;
    retryDelay?: number;
}

export class RetrospectError extends Error {
    public readonly type: ErrorType;
    public readonly code: ErrorCode;
    public readonly context: ErrorContext;
    public readonly userMessage: string;
    public readonly recoverable: boolean;
    public readonly retryable: boolean;

    constructor(
        type: ErrorType,
        code: ErrorCode,
        message: string,
        userMessage: string,
        context: ErrorContext,
        recoverable = true,
        retryable = false
    ) {
        super(message);
        this.type = type;
        this.code = code;
        this.userMessage = userMessage;
        this.context = context;
        this.recoverable = recoverable;
        this.retryable = retryable;
        this.name = 'RetrospectError';
    }

    static fromError(error: Error, type: ErrorType, code: ErrorCode, context: ErrorContext, userMessage?: string): RetrospectError {
        const message = error.message || 'Unknown error occurred';
        const finalUserMessage = userMessage || this.getDefaultUserMessage(type, code);
        const retryable = this.isRetryableError(type, code);
        
        return new RetrospectError(
            type,
            code,
            message,
            finalUserMessage,
            { ...context, stack: error.stack },
            true,
            retryable
        );
    }

    private static getDefaultUserMessage(type: ErrorType, code: ErrorCode): string {
        switch (code) {
            case ErrorCode.API_KEY_MISSING:
                return "Please configure your OpenAI API key in settings";
            case ErrorCode.API_KEY_INVALID:
                return "Invalid API key. Please check your OpenAI API key";
            case ErrorCode.API_RATE_LIMITED:
                return "API rate limit exceeded. Please try again later";
            case ErrorCode.API_NETWORK_ERROR:
                return "Network error. Please check your internet connection";
            case ErrorCode.FILE_NOT_FOUND:
                return "Required file not found. Please check your configuration";
            case ErrorCode.FOLDER_NOT_FOUND:
                return "Folder not found. Please verify the path in settings";
            case ErrorCode.PERMISSION_DENIED:
                return "Permission denied. Please check file permissions";
            case ErrorCode.INVALID_CONFIG:
                return "Invalid configuration. Please check your settings";
            case ErrorCode.ENCRYPTION_FAILED:
                return "Encryption failed. Please try again";
            case ErrorCode.DECRYPTION_FAILED:
                return "Decryption failed. Please check your master password";
            default:
                return "An unexpected error occurred";
        }
    }

    private static isRetryableError(type: ErrorType, code: ErrorCode): boolean {
        const retryableCodes = [
            ErrorCode.API_NETWORK_ERROR,
            ErrorCode.API_RATE_LIMITED,
            ErrorCode.DISK_SPACE_FULL
        ];
        return retryableCodes.includes(code);
    }
}

export interface ErrorHandlingConfig {
    maxRetries: number;
    baseRetryDelay: number;
    enableLogging: boolean;
    enableNotifications: boolean;
}

export class ErrorHandlingService extends BaseService {
    private errorHistory: Map<string, RetrospectError[]> = new Map();
    private config: ErrorHandlingConfig;
    
    constructor(app: App, config: ErrorHandlingConfig) {
        super(app);
        this.config = {
            maxRetries: config.maxRetries ?? 3,
            baseRetryDelay: config.baseRetryDelay ?? 1000,
            enableLogging: config.enableLogging ?? true,
            enableNotifications: config.enableNotifications ?? true
        };
    }
    
    protected async onInitialize(): Promise<void> {
        // Error handling service is ready immediately
    }

    protected async onDispose(): Promise<void> {
        this.errorHistory.clear();
    }

    public async handleError(error: Error | RetrospectError, context: ErrorContext, options: ErrorHandlerOptions = {}): Promise<void> {
        this.ensureReady();
        
        const retrospectError = error instanceof RetrospectError 
            ? error 
            : this.classifyError(error, context);

        const finalOptions = {
            showNotice: this.config.enableNotifications,
            logToConsole: this.config.enableLogging,
            throwAfterHandling: false,
            retryable: retrospectError.retryable,
            maxRetries: this.config.maxRetries,
            retryDelay: this.config.baseRetryDelay,
            ...options
        };

        this.recordError(retrospectError);

        if (finalOptions.logToConsole) {
            this.logError(retrospectError);
        }

        if (finalOptions.showNotice) {
            this.showUserNotification(retrospectError);
        }

        if (finalOptions.throwAfterHandling) {
            throw retrospectError;
        }
    }

    public async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: ErrorContext,
        options: ErrorHandlerOptions = {}
    ): Promise<T> {
        this.ensureReady();
        
        const maxRetries = options.maxRetries || this.config.maxRetries;
        const baseDelay = options.retryDelay || this.config.baseRetryDelay;
        
        let lastError: Error | undefined;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                const retrospectError = error instanceof RetrospectError 
                    ? error 
                    : this.classifyError(lastError, context);
                
                if (!retrospectError.retryable || attempt === maxRetries) {
                    await this.handleError(retrospectError, context, {
                        ...options,
                        throwAfterHandling: true
                    });
                    throw retrospectError;
                }
                
                const delay = this.calculateBackoffDelay(attempt, baseDelay);
                await this.sleep(delay);
            }
        }
        
        throw lastError || new Error('Operation failed after retries');
    }

    private classifyError(error: Error, context: ErrorContext): RetrospectError {
        const message = error.message.toLowerCase();
        
        if (message.includes('api key') && message.includes('invalid')) {
            return RetrospectError.fromError(error, ErrorType.USER, ErrorCode.API_KEY_INVALID, context);
        }
        
        if (message.includes('api key') && (message.includes('missing') || message.includes('not configured'))) {
            return RetrospectError.fromError(error, ErrorType.USER, ErrorCode.API_KEY_MISSING, context);
        }
        
        if (message.includes('rate limit') || message.includes('429')) {
            return RetrospectError.fromError(error, ErrorType.API, ErrorCode.API_RATE_LIMITED, context);
        }
        
        if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
            return RetrospectError.fromError(error, ErrorType.NETWORK, ErrorCode.API_NETWORK_ERROR, context);
        }
        
        if (message.includes('file not found') || message.includes('enoent')) {
            return RetrospectError.fromError(error, ErrorType.FILESYSTEM, ErrorCode.FILE_NOT_FOUND, context);
        }
        
        if (message.includes('folder not found') || message.includes('directory')) {
            return RetrospectError.fromError(error, ErrorType.FILESYSTEM, ErrorCode.FOLDER_NOT_FOUND, context);
        }
        
        if (message.includes('permission') || message.includes('access denied')) {
            return RetrospectError.fromError(error, ErrorType.FILESYSTEM, ErrorCode.PERMISSION_DENIED, context);
        }
        
        if (message.includes('encryption') && message.includes('failed')) {
            return RetrospectError.fromError(error, ErrorType.VALIDATION, ErrorCode.ENCRYPTION_FAILED, context);
        }
        
        if (message.includes('decryption') && message.includes('failed')) {
            return RetrospectError.fromError(error, ErrorType.VALIDATION, ErrorCode.DECRYPTION_FAILED, context);
        }
        
        return RetrospectError.fromError(error, ErrorType.USER, ErrorCode.INVALID_CONFIG, context);
    }

    private recordError(error: RetrospectError): void {
        const key = `${error.context.component}:${error.context.operation}`;
        if (!this.errorHistory.has(key)) {
            this.errorHistory.set(key, []);
        }
        
        const history = this.errorHistory.get(key);
        if (history) {
            history.push(error);
            
            if (history.length > 50) {
                history.shift();
            }
        }
    }

    private logError(error: RetrospectError): void {
        console.error(`[Retrospect AI] ${error.type.toUpperCase()} Error in ${error.context.component}:${error.context.operation}`, {
            code: error.code,
            message: error.message,
            userMessage: error.userMessage,
            context: error.context,
            stack: error.stack
        });
    }

    private showUserNotification(error: RetrospectError): void {
        const severity = error.type === ErrorType.CRITICAL ? '🚨' : 
                        error.type === ErrorType.USER ? '⚠️' : 
                        error.type === ErrorType.API ? '🌐' : 
                        error.type === ErrorType.FILESYSTEM ? '📁' : '❌';
        
        new Notice(`${severity} ${error.userMessage}`, error.type === ErrorType.CRITICAL ? 10000 : 5000);
    }

    private calculateBackoffDelay(attempt: number, baseDelay: number): number {
        const jitter = Math.random() * 0.3 + 0.85;
        return Math.min(baseDelay * Math.pow(2, attempt) * jitter, 30000);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getErrorHistory(component?: string, operation?: string): RetrospectError[] {
        this.ensureNotDisposed();
        
        if (component && operation) {
            return this.errorHistory.get(`${component}:${operation}`) || [];
        }
        
        if (component) {
            const results: RetrospectError[] = [];
            for (const [key, errors] of this.errorHistory.entries()) {
                if (key.startsWith(`${component}:`)) {
                    results.push(...errors);
                }
            }
            return results;
        }
        
        return Array.from(this.errorHistory.values()).flat();
    }

    public clearErrorHistory(component?: string, operation?: string): void {
        this.ensureNotDisposed();
        
        if (component && operation) {
            this.errorHistory.delete(`${component}:${operation}`);
        } else if (component) {
            const keysToDelete = Array.from(this.errorHistory.keys())
                .filter(key => key.startsWith(`${component}:`));
            keysToDelete.forEach(key => this.errorHistory.delete(key));
        } else {
            this.errorHistory.clear();
        }
    }
}