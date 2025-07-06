// Test setup for Jest
import { TextEncoder, TextDecoder } from 'util';

// Mock Web Crypto API for Node.js environment
const mockCrypto = {
    getRandomValues: (arr: Uint8Array) => {
        // Use Node.js crypto for actual randomness in tests
        const crypto = require('crypto');
        const buffer = crypto.randomBytes(arr.length);
        arr.set(buffer);
        return arr;
    },
    subtle: {
        importKey: jest.fn(),
        deriveKey: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
    }
};

// Set up global mocks
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.crypto = mockCrypto as any;
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

// Mock console methods to reduce noise in test output
const originalConsole = console;
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});