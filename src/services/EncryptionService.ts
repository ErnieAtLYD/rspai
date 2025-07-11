import { App } from "obsidian";
import { BaseService } from "./BaseService";

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
    private readonly defaultConfig: EncryptionConfig = {
        iterations: 100000,
        keyLength: 256
    };

    constructor(app: App, config: EncryptionConfig = {}) {
        super(app);
        this.config = { ...this.defaultConfig, ...config };
    }

    async initialize(): Promise<void> {
        if (!this.isWebCryptoAvailable()) {
            throw new Error("Web Crypto API not available. Cannot initialize encryption service.");
        }
    }

    async dispose(): Promise<void> {
        // Clear any cached keys or sensitive data
        this.config = { ...this.defaultConfig };
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
                salt: salt,
                iterations: this.config.iterations!,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: this.config.keyLength!
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data using AES-256-GCM
     */
    async encrypt(data: string, password: string): Promise<EncryptedData> {
        if (!this.isWebCryptoAvailable()) {
            throw new Error("Web Crypto API not available");
        }

        if (!data || !password) {
            throw new Error("Data and password are required for encryption");
        }

        try {
            const salt = this.generateSalt();
            const iv = this.generateIV();
            const key = await this.deriveKey(password, salt);

            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);

            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                dataBuffer
            );

            return {
                iv: this.arrayBufferToBase64(iv),
                salt: this.arrayBufferToBase64(salt),
                encryptedData: this.arrayBufferToBase64(encryptedBuffer)
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt data using AES-256-GCM
     */
    async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
        if (!this.isWebCryptoAvailable()) {
            throw new Error("Web Crypto API not available");
        }

        if (!encryptedData || !password) {
            throw new Error("Encrypted data and password are required for decryption");
        }

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
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Validate if data appears to be encrypted
     */
    isEncrypted(data: any): data is EncryptedData {
        return (
            typeof data === 'object' &&
            data !== null &&
            typeof data.iv === 'string' &&
            typeof data.salt === 'string' &&
            typeof data.encryptedData === 'string'
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
        try {
            const testData = "test-encryption-" + Date.now();
            const encrypted = await this.encrypt(testData, password);
            const decrypted = await this.decrypt(encrypted, password);
            return decrypted === testData;
        } catch (error) {
            return false;
        }
    }
}