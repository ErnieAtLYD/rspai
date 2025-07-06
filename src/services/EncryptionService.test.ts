import { App } from 'obsidian';
import { EncryptionService, EncryptionConfig, EncryptedData } from './EncryptionService';

// Mock the crypto module for consistent testing
const mockCrypto = {
    getRandomValues: jest.fn(),
    subtle: {
        importKey: jest.fn(),
        deriveKey: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
    }
};

// Override the global crypto object
Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true
});

describe('EncryptionService', () => {
    let app: App;
    let encryptionService: EncryptionService;

    beforeEach(() => {
        jest.clearAllMocks();
        app = new App();
        encryptionService = new EncryptionService(app);
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with default configuration', () => {
            expect(encryptionService).toBeDefined();
            expect(encryptionService['config']).toEqual({
                iterations: 100000,
                keyLength: 256
            });
        });

        it('should accept custom configuration', () => {
            const customConfig: EncryptionConfig = {
                iterations: 50000,
                keyLength: 128
            };
            const customService = new EncryptionService(app, customConfig);
            expect(customService['config']).toEqual(customConfig);
        });

        it('should merge custom config with defaults', () => {
            const partialConfig: EncryptionConfig = {
                iterations: 75000
            };
            const customService = new EncryptionService(app, partialConfig);
            expect(customService['config']).toEqual({
                iterations: 75000,
                keyLength: 256
            });
        });
    });

    describe('Service Lifecycle', () => {
        it('should initialize successfully when Web Crypto API is available', async () => {
            mockCrypto.getRandomValues.mockImplementation((arr) => arr);
            
            await expect(encryptionService.initialize()).resolves.not.toThrow();
        });

        it('should throw error when Web Crypto API is not available', async () => {
            // Temporarily remove crypto
            const originalCrypto = global.crypto;
            delete (global as any).crypto;

            await expect(encryptionService.initialize()).rejects.toThrow(
                'Web Crypto API not available. Cannot initialize encryption service.'
            );

            // Restore crypto
            global.crypto = originalCrypto;
        });

        it('should dispose properly', async () => {
            const customConfig: EncryptionConfig = {
                iterations: 50000,
                keyLength: 128
            };
            const customService = new EncryptionService(app, customConfig);
            
            await customService.dispose();
            
            expect(customService['config']).toEqual({
                iterations: 100000,
                keyLength: 256
            });
        });
    });

    describe('Web Crypto API Availability Check', () => {
        it('should return true when Web Crypto API is available', () => {
            expect(encryptionService['isWebCryptoAvailable']()).toBe(true);
        });

        it('should return false when crypto is undefined', () => {
            const originalCrypto = global.crypto;
            delete (global as any).crypto;

            expect(encryptionService['isWebCryptoAvailable']()).toBe(false);

            global.crypto = originalCrypto;
        });

        it('should return false when crypto.subtle is undefined', () => {
            const originalSubtle = global.crypto.subtle;
            delete (global.crypto as any).subtle;

            expect(encryptionService['isWebCryptoAvailable']()).toBe(false);

            (global.crypto as any).subtle = originalSubtle;
        });

        it('should return false when crypto.getRandomValues is undefined', () => {
            const originalGetRandomValues = global.crypto.getRandomValues;
            delete (global.crypto as any).getRandomValues;

            expect(encryptionService['isWebCryptoAvailable']()).toBe(false);

            global.crypto.getRandomValues = originalGetRandomValues;
        });
    });

    describe('Random Value Generation', () => {
        it('should generate salt with correct length', () => {
            const mockArray = new Uint8Array(16);
            mockCrypto.getRandomValues.mockImplementation((arr) => {
                arr.set(Array.from({ length: 16 }, (_, i) => i));
                return arr;
            });

            const salt = encryptionService['generateSalt']();
            
            expect(salt).toHaveLength(16);
            expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        });

        it('should generate IV with correct length', () => {
            const mockArray = new Uint8Array(12);
            mockCrypto.getRandomValues.mockImplementation((arr) => {
                arr.set(Array.from({ length: 12 }, (_, i) => i));
                return arr;
            });

            const iv = encryptionService['generateIV']();
            
            expect(iv).toHaveLength(12);
            expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        });
    });

    describe('Key Derivation', () => {
        it('should derive key with correct parameters', async () => {
            const mockKeyMaterial = { type: 'key-material' };
            const mockDerivedKey = { type: 'derived-key' };
            const password = 'TestPassword123';
            const salt = new Uint8Array(16);

            mockCrypto.subtle.importKey.mockResolvedValue(mockKeyMaterial);
            mockCrypto.subtle.deriveKey.mockResolvedValue(mockDerivedKey);

            const result = await encryptionService['deriveKey'](password, salt);

            expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
                'raw',
                expect.any(Uint8Array),
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                mockKeyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['encrypt', 'decrypt']
            );

            expect(result).toBe(mockDerivedKey);
        });
    });

    describe('Encryption', () => {
        it('should encrypt data successfully', async () => {
            const testData = 'sensitive data';
            const password = 'TestPassword123';
            const mockEncryptedBuffer = new ArrayBuffer(16);
            const mockKey = { type: 'key' };

            mockCrypto.getRandomValues.mockImplementation((arr) => {
                arr.fill(1);
                return arr;
            });
            mockCrypto.subtle.importKey.mockResolvedValue({});
            mockCrypto.subtle.deriveKey.mockResolvedValue(mockKey);
            mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedBuffer);

            const result = await encryptionService.encrypt(testData, password);

            expect(result).toHaveProperty('iv');
            expect(result).toHaveProperty('salt');
            expect(result).toHaveProperty('encryptedData');
            expect(typeof result.iv).toBe('string');
            expect(typeof result.salt).toBe('string');
            expect(typeof result.encryptedData).toBe('string');
        });

        it('should throw error when Web Crypto API is not available', async () => {
            const originalCrypto = global.crypto;
            delete (global as any).crypto;

            await expect(encryptionService.encrypt('data', 'password')).rejects.toThrow(
                'Web Crypto API not available'
            );

            global.crypto = originalCrypto;
        });

        it('should throw error when data is empty', async () => {
            await expect(encryptionService.encrypt('', 'password')).rejects.toThrow(
                'Data and password are required for encryption'
            );
        });

        it('should throw error when password is empty', async () => {
            await expect(encryptionService.encrypt('data', '')).rejects.toThrow(
                'Data and password are required for encryption'
            );
        });

        it('should handle encryption errors gracefully', async () => {
            mockCrypto.subtle.importKey.mockRejectedValue(new Error('Crypto error'));

            await expect(encryptionService.encrypt('data', 'password')).rejects.toThrow(
                'Encryption failed: Crypto error'
            );
        });
    });

    describe('Decryption', () => {
        it('should decrypt data successfully', async () => {
            const encryptedData: EncryptedData = {
                iv: 'dGVzdGl2',
                salt: 'dGVzdHNhbHQ=',
                encryptedData: 'dGVzdGVuY3J5cHRlZA=='
            };
            const password = 'TestPassword123';
            const mockDecryptedBuffer = new TextEncoder().encode('decrypted data');
            const mockKey = { type: 'key' };

            mockCrypto.subtle.importKey.mockResolvedValue({});
            mockCrypto.subtle.deriveKey.mockResolvedValue(mockKey);
            mockCrypto.subtle.decrypt.mockResolvedValue(mockDecryptedBuffer);

            const result = await encryptionService.decrypt(encryptedData, password);

            expect(result).toBe('decrypted data');
            expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
                {
                    name: 'AES-GCM',
                    iv: expect.any(Uint8Array)
                },
                mockKey,
                expect.any(ArrayBuffer)
            );
        });

        it('should throw error when Web Crypto API is not available', async () => {
            const originalCrypto = global.crypto;
            delete (global as any).crypto;

            const encryptedData: EncryptedData = {
                iv: 'test',
                salt: 'test',
                encryptedData: 'test'
            };

            await expect(encryptionService.decrypt(encryptedData, 'password')).rejects.toThrow(
                'Web Crypto API not available'
            );

            global.crypto = originalCrypto;
        });

        it('should throw error when encrypted data is null', async () => {
            await expect(encryptionService.decrypt(null as any, 'password')).rejects.toThrow(
                'Encrypted data and password are required for decryption'
            );
        });

        it('should throw error when password is empty', async () => {
            const encryptedData: EncryptedData = {
                iv: 'test',
                salt: 'test',
                encryptedData: 'test'
            };

            await expect(encryptionService.decrypt(encryptedData, '')).rejects.toThrow(
                'Encrypted data and password are required for decryption'
            );
        });

        it('should handle decryption errors gracefully', async () => {
            const encryptedData: EncryptedData = {
                iv: 'dGVzdGl2',
                salt: 'dGVzdHNhbHQ=',
                encryptedData: 'dGVzdGVuY3J5cHRlZA=='
            };

            mockCrypto.subtle.importKey.mockRejectedValue(new Error('Crypto error'));

            await expect(encryptionService.decrypt(encryptedData, 'password')).rejects.toThrow(
                'Decryption failed: Crypto error'
            );
        });
    });

    describe('Data Validation', () => {
        it('should identify valid encrypted data', () => {
            const validEncryptedData: EncryptedData = {
                iv: 'test-iv',
                salt: 'test-salt',
                encryptedData: 'test-encrypted-data'
            };

            expect(encryptionService.isEncrypted(validEncryptedData)).toBe(true);
        });

        it('should reject invalid encrypted data structures', () => {
            const testCases = [
                null,
                undefined,
                'string',
                123,
                {},
                { iv: 'test' },
                { salt: 'test' },
                { encryptedData: 'test' },
                { iv: 'test', salt: 'test' },
                { iv: 'test', encryptedData: 'test' },
                { salt: 'test', encryptedData: 'test' },
                { iv: 123, salt: 'test', encryptedData: 'test' },
                { iv: 'test', salt: 123, encryptedData: 'test' },
                { iv: 'test', salt: 'test', encryptedData: 123 }
            ];

            testCases.forEach(testCase => {
                expect(encryptionService.isEncrypted(testCase)).toBe(false);
            });
        });
    });

    describe('Password Validation', () => {
        it('should validate strong passwords', () => {
            const strongPasswords = [
                'TestPassword123',
                'MySecure123!',
                'Complex1Pass',
                'Valid8Password'
            ];

            strongPasswords.forEach(password => {
                const result = encryptionService.validatePassword(password);
                expect(result.valid).toBe(true);
                expect(result.message).toBe('Password is valid');
            });
        });

        it('should reject empty password', () => {
            const result = encryptionService.validatePassword('');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Password cannot be empty');
        });

        it('should reject null/undefined password', () => {
            const result = encryptionService.validatePassword(null as any);
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Password cannot be empty');
        });

        it('should reject short passwords', () => {
            const result = encryptionService.validatePassword('Test1');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Password must be at least 8 characters long');
        });

        it('should reject passwords without uppercase letters', () => {
            const result = encryptionService.validatePassword('testpassword123');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Password must contain at least one uppercase letter');
        });

        it('should reject passwords without lowercase letters', () => {
            const result = encryptionService.validatePassword('TESTPASSWORD123');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Password must contain at least one lowercase letter');
        });

        it('should reject passwords without numbers', () => {
            const result = encryptionService.validatePassword('TestPassword');
            expect(result.valid).toBe(false);
            expect(result.message).toBe('Password must contain at least one number');
        });
    });

    describe('Base64 Conversion', () => {
        it('should convert ArrayBuffer to Base64 correctly', () => {
            const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            const buffer = testData.buffer;
            
            const result = encryptionService['arrayBufferToBase64'](buffer);
            
            expect(result).toBe('SGVsbG8=');
        });

        it('should convert Base64 to ArrayBuffer correctly', () => {
            const base64 = 'SGVsbG8=';
            
            const result = encryptionService['base64ToArrayBuffer'](base64);
            const resultArray = new Uint8Array(result);
            
            expect(Array.from(resultArray)).toEqual([72, 101, 108, 108, 111]);
        });

        it('should handle empty data', () => {
            const emptyBuffer = new ArrayBuffer(0);
            const base64 = encryptionService['arrayBufferToBase64'](emptyBuffer);
            expect(base64).toBe('');
            
            const backToBuffer = encryptionService['base64ToArrayBuffer'](base64);
            expect(backToBuffer.byteLength).toBe(0);
        });
    });

    describe('Configuration Updates', () => {
        it('should update configuration correctly', () => {
            const newConfig: Partial<EncryptionConfig> = {
                iterations: 200000
            };

            encryptionService.updateConfig(newConfig);

            expect(encryptionService['config']).toEqual({
                iterations: 200000,
                keyLength: 256
            });
        });

        it('should merge partial configuration updates', () => {
            const partialConfig: Partial<EncryptionConfig> = {
                keyLength: 128
            };

            encryptionService.updateConfig(partialConfig);

            expect(encryptionService['config']).toEqual({
                iterations: 100000,
                keyLength: 128
            });
        });
    });

    describe('Test Encryption Functionality', () => {
        it('should test encryption/decryption successfully', async () => {
            const password = 'TestPassword123';
            const mockEncryptedBuffer = new ArrayBuffer(16);
            const mockKey = { type: 'key' };

            mockCrypto.getRandomValues.mockImplementation((arr) => {
                arr.fill(1);
                return arr;
            });
            mockCrypto.subtle.importKey.mockResolvedValue({});
            mockCrypto.subtle.deriveKey.mockResolvedValue(mockKey);
            mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedBuffer);
            mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode('test-encryption-' + Date.now()));

            const result = await encryptionService.testEncryption(password);

            expect(result).toBe(true);
        });

        it('should return false when encryption test fails', async () => {
            const password = 'TestPassword123';
            mockCrypto.subtle.importKey.mockRejectedValue(new Error('Test error'));

            const result = await encryptionService.testEncryption(password);

            expect(result).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        it('should perform full encrypt/decrypt cycle with real Web Crypto API', async () => {
            // Skip if Web Crypto API is not available in test environment
            if (!global.crypto || !global.crypto.subtle) {
                return;
            }

            // Create a real encryption service for integration testing
            const realCrypto = require('crypto').webcrypto;
            if (realCrypto) {
                global.crypto = realCrypto;
                
                const realService = new EncryptionService(app);
                await realService.initialize();

                const testData = 'This is sensitive test data';
                const password = 'TestPassword123';

                const encrypted = await realService.encrypt(testData, password);
                const decrypted = await realService.decrypt(encrypted, password);

                expect(decrypted).toBe(testData);
                expect(realService.isEncrypted(encrypted)).toBe(true);
            }
        });
    });

    describe('Error Handling Edge Cases', () => {
        it('should handle malformed base64 data', () => {
            // Note: atob() in Node.js may not throw for some invalid inputs
            // This is implementation-dependent behavior
            const result = encryptionService['base64ToArrayBuffer']('invalid-base64!@#');
            expect(result).toBeInstanceOf(ArrayBuffer);
        });

        it('should handle encryption with wrong data types', async () => {
            await expect(encryptionService.encrypt(null as any, 'password')).rejects.toThrow();
            await expect(encryptionService.encrypt(undefined as any, 'password')).rejects.toThrow();
            await expect(encryptionService.encrypt('data', null as any)).rejects.toThrow();
            await expect(encryptionService.encrypt('data', undefined as any)).rejects.toThrow();
        });

        it('should handle decryption with malformed encrypted data', async () => {
            const malformedData = {
                iv: 'invalid-base64!@#',
                salt: 'dGVzdHNhbHQ=',
                encryptedData: 'dGVzdGVuY3J5cHRlZA=='
            };

            await expect(encryptionService.decrypt(malformedData, 'password')).rejects.toThrow();
        });
    });
});