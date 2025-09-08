import { App } from "obsidian";
import { BaseService } from "./BaseService";
import { ErrorHandlingService, ErrorContext } from "./ErrorHandlingService";

export interface EncryptionConfig {
    iterations?: number;
    keyLength?: number;
}

export interface EncryptedData {
    iv: string;
    salt: string;
    encryptedData: string;
}

/**
 * Service for encrypting and decrypting sensitive data
 * Uses Web Crypto API for AES-256-GCM encryption with PBKDF2 key derivation
 */
export class EncryptionService extends BaseService {
    private config: EncryptionConfig;
    private errorHandler: ErrorHandlingService;
    private readonly defaultConfig: EncryptionConfig = {
        iterations: 100000,
        keyLength: 256
    };

    constructor(app: App, config: EncryptionConfig = {}, errorHandler: ErrorHandlingService) {
        super(app);
        this.config = { ...this.defaultConfig, ...config };
        this.errorHandler = errorHandler;
    }

    protected async onInitialize(): Promise<void> {
        if (!this.isWebCryptoAvailable()) {
            const cryptoError = new Error("Web Crypto API not available. Cannot initialize encryption service.");
            throw cryptoError;
        }

        this.logger.lifecycle('initialized');
    }

    protected async onDispose(): Promise<void> {
        // Clear any cached keys or sensitive data
        this.config = { ...this.defaultConfig };

        this.logger.lifecycle('disposed');
    }

    /**
     * Check if Web Crypto API is available
     */
    private isWebCryptoAvailable(): boolean {
        return typeof crypto !== 'undefined' && 
               typeof crypto.subtle !== 'undefined' && 
               typeof crypto.getRandomValues !== 'undefined';
    }

    /**
     * Generate a random salt
     */
    private generateSalt(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(16));
    }

    /**
     * Generate a random IV for AES-GCM
     */
    private generateIV(): Uint8Array {
        return crypto.getRandomValues(new Uint8Array(12));
    }

    /**
     * Derive encryption key from password using PBKDF2
     */
    private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        // Derive AES key
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt.buffer as ArrayBuffer,
                iterations: this.config.iterations || 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: this.config.keyLength || 256
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data using AES-256-GCM
     */
    async encrypt(data: string, password: string): Promise<EncryptedData> {
        this.ensureReady();

        const context: ErrorContext = {
            operation: 'encrypt',
            component: 'EncryptionService',
            timestamp: Date.now(),
            metadata: { dataLength: data?.length || 0 }
        };

        if (!this.isWebCryptoAvailable()) {
            const cryptoError = new Error("Web Crypto API not available");
            await this.errorHandler.handleError(cryptoError, context, { 
                showNotice: true, 
                throwAfterHandling: true 
            });
            throw cryptoError;
        }

        if (!data || !password) {
            const validationError = new Error("Data and password are required for encryption");
            await this.errorHandler.handleError(validationError, context, { 
                showNotice: true, 
                throwAfterHandling: true 
            });
            throw validationError;
        }

        return await this.errorHandler.executeWithRetry(
            async () => {
                const salt = this.generateSalt();
                const iv = this.generateIV();
                const key = await this.deriveKey(password, salt);

                const encoder = new TextEncoder();
                const dataBuffer = encoder.encode(data);

                const encryptedBuffer = await crypto.subtle.encrypt(
                    {
                        name: 'AES-GCM',
                        iv: iv.buffer as ArrayBuffer
                    },
                    key,
                    dataBuffer
                );

                return {
                    iv: this.arrayBufferToBase64(iv.buffer as ArrayBuffer),
                    salt: this.arrayBufferToBase64(salt.buffer as ArrayBuffer),
                    encryptedData: this.arrayBufferToBase64(encryptedBuffer)
                };
            },
            context,
            { maxRetries: 2, retryDelay: 500 }
        );
    }

    /**
     * Decrypt data using AES-256-GCM
     */
    async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
        this.ensureReady();

        const context: ErrorContext = {
            operation: 'decrypt',
            component: 'EncryptionService',
            timestamp: Date.now(),
            metadata: { hasEncryptedData: !!encryptedData }
        };

        if (!this.isWebCryptoAvailable()) {
            const cryptoError = new Error("Web Crypto API not available");
            await this.errorHandler.handleError(cryptoError, context, { 
                showNotice: true, 
                throwAfterHandling: true 
            });
            throw cryptoError;
        }

        if (!encryptedData || !password) {
            const validationError = new Error("Encrypted data and password are required for decryption");
            await this.errorHandler.handleError(validationError, context, { 
                showNotice: true, 
                throwAfterHandling: true 
            });
            throw validationError;
        }

        return await this.errorHandler.executeWithRetry(
            async () => {
                try {
                    const salt = this.base64ToArrayBuffer(encryptedData.salt);
                    const iv = this.base64ToArrayBuffer(encryptedData.iv);
                    const encrypted = this.base64ToArrayBuffer(encryptedData.encryptedData);

                    const key = await this.deriveKey(password, new Uint8Array(salt));

                    const decryptedBuffer = await crypto.subtle.decrypt(
                        {
                            name: 'AES-GCM',
                            iv: new Uint8Array(iv)
                        },
                        key,
                        encrypted
                    );

                    const decoder = new TextDecoder();
                    return decoder.decode(decryptedBuffer);
                } catch (error) {
                    // Handle specific decryption failures
                    if (error instanceof Error && error.name === 'OperationError') {
                        throw new Error("Decryption failed - incorrect password or corrupted data");
                    }
                    throw error;
                }
            },
            context,
            { maxRetries: 1 } // Don't retry decryption as password is likely wrong
        );
    }

    /**
     * Validate if data appears to be encrypted
     */
    isEncrypted(data: unknown): data is EncryptedData {
        return (
            typeof data === 'object' &&
            data !== null &&
            typeof (data as Record<string, unknown>).iv === 'string' &&
            typeof (data as Record<string, unknown>).salt === 'string' &&
            typeof (data as Record<string, unknown>).encryptedData === 'string'
        );
    }

    /**
     * Validate password strength
     */
    validatePassword(password: string): { valid: boolean; message: string } {
        if (!password) {
            return { valid: false, message: "Password cannot be empty" };
        }

        if (password.length < 8) {
            return { valid: false, message: "Password must be at least 8 characters long" };
        }

        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: "Password must contain at least one uppercase letter" };
        }

        if (!/[a-z]/.test(password)) {
            return { valid: false, message: "Password must contain at least one lowercase letter" };
        }

        if (!/[0-9]/.test(password)) {
            return { valid: false, message: "Password must contain at least one number" };
        }

        return { valid: true, message: "Password is valid" };
    }

    /**
     * Convert ArrayBuffer to Base64 string
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        // Use Array.from to handle null bytes and special characters properly
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Update service configuration
     */
    updateConfig(newConfig: Partial<EncryptionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Test encryption/decryption functionality
     */
    async testEncryption(password: string): Promise<boolean> {
        this.ensureReady();

        const context: ErrorContext = {
            operation: 'testEncryption',
            component: 'EncryptionService',
            timestamp: Date.now()
        };

        return await this.errorHandler.executeWithRetry(
            async () => {
                try {
                    const testData = "test-encryption-" + Date.now();
                    const encrypted = await this.encrypt(testData, password);
                    const decrypted = await this.decrypt(encrypted, password);
                    const success = decrypted === testData;

                    if (!success) {
                        throw new Error("Encryption test failed - decrypted data does not match original");
                    }

                    return success;
                } catch (error) {
                    await this.errorHandler.handleError(
                        error instanceof Error ? error : new Error(String(error)),
                        context,
                        { showNotice: false, logToConsole: true }
                    );
                    return false;
                }
            },
            context,
            { maxRetries: 2, retryDelay: 500 }
        );
    }
}