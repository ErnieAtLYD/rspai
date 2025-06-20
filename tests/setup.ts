/**
 * Jest setup file for Pattern Detection Engine testing
 */

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock performance.now for consistent timing in tests
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now())
  }
});

// Mock crypto for content hashing
Object.defineProperty(global, 'crypto', {
  value: {
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'mock-hash-value')
    }))
  }
});

// Increase timeout for AI integration tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Test utilities - exported for use in test files
export const testUtils = {
  createMockFile: (path: string, content: string) => ({
    path,
    name: path.split('/').pop() || '',
    extension: 'md',
    stat: {
      mtime: Date.now(),
      size: content.length,
      ctime: Date.now()
    },
    vault: {
      read: jest.fn().mockResolvedValue(content)
    }
  }),

  createMockApp: () => ({
    vault: {
      getMarkdownFiles: jest.fn(() => []),
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      adapter: {
        stat: jest.fn(),
        exists: jest.fn()
      }
    },
    metadataCache: {
      getFileCache: jest.fn()
    }
  }),

  waitFor: async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }
}; 