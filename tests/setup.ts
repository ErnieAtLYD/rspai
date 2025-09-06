// Test setup for Jest
import { TextEncoder, TextDecoder } from 'util';
import * as crypto from 'crypto';

// Mock Web Crypto API for Node.js environment
const mockCrypto = {
    getRandomValues: (arr: Uint8Array) => {
        // Use Node.js crypto for actual randomness in tests
        const buffer = crypto.randomBytes(arr.length);
        arr.set(buffer);
        return arr;
    },
    subtle: {
        importKey: jest.fn(),
        deriveKey: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        digest: jest.fn().mockImplementation(async (_algorithm: string, data: ArrayBuffer) => {
            // Mock SHA-256 digest for testing
            const hash = crypto.createHash('sha256');
            hash.update(Buffer.from(data));
            return hash.digest().buffer;
        })
    }
};

// Set up global mocks
global.TextEncoder = TextEncoder as typeof global.TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;
global.crypto = mockCrypto as unknown as Crypto;
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

// Mock console methods to reduce noise in test output
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});