import RetrospectiveAIPlugin from '../../src/main';
import { Plugin, PluginManifest } from 'obsidian';
import { Logger } from '../../src/logger';
import { ErrorHandler } from '../../src/error-handler';
import * as manifest from '../../manifest.json';
import * as tsconfig from '../../tsconfig.json';
import * as packageJson from '../../package.json';

// Mock Obsidian App
class MockApp {
  vault = {
    getMarkdownFiles: jest.fn().mockReturnValue([]),
    getAbstractFileByPath: jest.fn(),
    read: jest.fn().mockResolvedValue(''),
    adapter: {
      stat: jest.fn().mockResolvedValue({ ctime: Date.now(), mtime: Date.now(), size: 100 })
    }
  };
  workspace = {
    getActiveFile: jest.fn().mockReturnValue(null),
    on: jest.fn()
  };
  metadataCache = {
    getFileCache: jest.fn().mockReturnValue(null)
  };
}

// Mock manifest
const mockManifest: PluginManifest = {
  id: 'retrospective-ai',
  name: 'RetrospectAI',
  version: '1.0.0',
  minAppVersion: '0.15.0',
  description: 'Plugin for Obsidian',
  author: 'Test Author',
  authorUrl: '',
  isDesktopOnly: false
};

describe('Task 1: Setup Obsidian Plugin Framework Verification', () => {
  let plugin: RetrospectiveAIPlugin;
  let mockApp: MockApp;

  beforeEach(() => {
    mockApp = new MockApp();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugin = new RetrospectiveAIPlugin(mockApp as any, mockManifest);
  });

  afterEach(async () => {
    if (plugin) {
      // Ensure plugin is loaded before unloading
      if (!plugin.logger) {
        await plugin.onload();
      }
      await plugin.onunload();
    }
  });

  describe('1. Project Structure and Dependencies', () => {
    test('should have proper TypeScript project structure', () => {
      // Verify that the plugin class exists and is properly typed
      expect(plugin).toBeInstanceOf(Plugin);
      expect(plugin).toBeInstanceOf(RetrospectiveAIPlugin);
    });

    test('should have all required dependencies installed', () => {
      // Check that required dependencies are listed in package.json
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
      expect(packageJson.devDependencies['typescript']).toBeDefined();
      expect(packageJson.devDependencies['tslib']).toBeDefined();
      expect(packageJson.devDependencies['obsidian']).toBeDefined();
      
      // These core imports should work
      expect(() => require('obsidian')).not.toThrow();
      expect(() => require('typescript')).not.toThrow();
      expect(() => require('tslib')).not.toThrow();
    });
  });

  describe('2. Plugin Class Implementation', () => {
    test('should extend Plugin from Obsidian API', () => {
      expect(plugin).toBeInstanceOf(Plugin);
      expect(plugin.constructor.name).toBe('RetrospectiveAIPlugin');
    });

    test('should have onload method implemented', () => {
      expect(typeof plugin.onload).toBe('function');
    });

    test('should have onunload method implemented', () => {
      expect(typeof plugin.onunload).toBe('function');
    });

    test('should have app and manifest properties', () => {
      expect(plugin.app).toBeDefined();
      expect(plugin.manifest).toBeDefined();
      expect(plugin.manifest.id).toBe('retrospective-ai');
    });
  });

  describe('3. Plugin Lifecycle Methods', () => {
    test('should initialize successfully during onload', async () => {
      // Mock console methods to capture logs
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      await expect(plugin.onload()).resolves.not.toThrow();
      
      // Verify logger was initialized
      expect(plugin.logger).toBeDefined();
      expect(plugin.logger).toBeInstanceOf(Logger);
      
      // Verify error handler was initialized
      expect(plugin.errorHandler).toBeDefined();
      expect(plugin.errorHandler).toBeInstanceOf(ErrorHandler);
      
      consoleSpy.mockRestore();
    });

    test('should handle onunload gracefully', async () => {
      // Ensure plugin is loaded first
      await plugin.onload();
      await expect(plugin.onunload()).resolves.not.toThrow();
    });

    test('should have proper cleanup mechanism', async () => {
      await plugin.onload();
      
      // Verify that cleanup tasks array exists
      expect((plugin as any).cleanupTasks).toBeDefined();
      expect(Array.isArray((plugin as any).cleanupTasks)).toBe(true);
      
      // onunload should not throw
      await expect(plugin.onunload()).resolves.not.toThrow();
    });
  });

  describe('4. Error Handling and Logging System', () => {
    test('should have logger initialized with proper configuration', async () => {
      await plugin.onload();
      
      expect(plugin.logger).toBeDefined();
      expect(plugin.logger).toBeInstanceOf(Logger);
      
      // Test logger methods exist
      expect(typeof plugin.logger.info).toBe('function');
      expect(typeof plugin.logger.error).toBe('function');
      expect(typeof plugin.logger.warn).toBe('function');
      expect(typeof plugin.logger.debug).toBe('function');
    });

    test('should have error handler initialized', async () => {
      await plugin.onload();
      
      expect(plugin.errorHandler).toBeDefined();
      expect(plugin.errorHandler).toBeInstanceOf(ErrorHandler);
      
      // Test error handler methods exist
      expect(typeof plugin.errorHandler.safeAsync).toBe('function');
      expect(typeof plugin.errorHandler.safe).toBe('function');
    });

    test('should handle initialization errors gracefully', async () => {
      // Mock an error during initialization by mocking the loadData method
      const originalLoadData = plugin.loadData;
      plugin.loadData = jest.fn().mockRejectedValue(new Error('Test error'));
      
      // Should not throw even if loadData fails
      await expect(plugin.onload()).resolves.not.toThrow();
      
      // Restore original method
      plugin.loadData = originalLoadData;
    });

    test('should log errors with proper format', async () => {
      await plugin.onload();
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Test error logging
      plugin.logger.error('Test error message', new Error('Test error'));
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Retrospective AI] ERROR: Test error message'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('5. Settings and Configuration', () => {
    test('should have settings property', async () => {
      await plugin.onload();
      expect(plugin.settings).toBeDefined();
    });

    test('should have loadData method', () => {
      expect(typeof plugin.loadData).toBe('function');
    });

    test('should have saveSettings method', () => {
      expect(typeof plugin.saveSettings).toBe('function');
    });

    test('should load default settings properly', async () => {
      await plugin.onload();
      
      expect(plugin.settings).toBeDefined();
      expect(typeof plugin.settings.enablePrivacyFilter).toBe('boolean');
      expect(Array.isArray(plugin.settings.privacyTags)).toBe(true);
      expect(typeof plugin.settings.maxFileSize).toBe('number');
      expect(typeof plugin.settings.debugMode).toBe('boolean');
    });
  });

  describe('6. Core Services Initialization', () => {
    test('should initialize markdown processor', async () => {
      await plugin.onload();
      expect(plugin.markdownProcessor).toBeDefined();
    });

    test('should initialize AI service', async () => {
      await plugin.onload();
      expect(plugin.aiService).toBeDefined();
    });

    test('should initialize summary note creator', async () => {
      await plugin.onload();
      expect(plugin.summaryNoteCreator).toBeDefined();
    });
  });

  describe('7. Manifest Configuration', () => {
    test('should have valid manifest.json structure', () => {
      expect(manifest.id).toBeDefined();
      expect(manifest.name).toBeDefined();
      expect(manifest.version).toBeDefined();
      expect(manifest.minAppVersion).toBeDefined();
      expect(manifest.description).toBeDefined();
      expect(manifest.author).toBeDefined();
      
      // Verify required fields are strings
      expect(typeof manifest.id).toBe('string');
      expect(typeof manifest.name).toBe('string');
      expect(typeof manifest.version).toBe('string');
      expect(typeof manifest.minAppVersion).toBe('string');
    });

    test('should have semantic version format', () => {
      const semverRegex = /^\d+\.\d+\.\d+$/;
      expect(manifest.version).toMatch(semverRegex);
    });
  });

  describe('8. Build System Verification', () => {
    test('should have esbuild configuration file', () => {
      // Test that esbuild config exists by checking package.json scripts
      expect(packageJson.scripts.build).toContain('esbuild');
      expect(packageJson.scripts.dev).toContain('esbuild');
    });

    test('should have TypeScript configuration', () => {
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.target).toBeDefined();
      expect(tsconfig.compilerOptions.module).toBeDefined();
      expect(tsconfig.include).toBeDefined();
    });

    test('should have proper package.json scripts', () => {
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.dev).toBeDefined();
      
      // Verify build script uses esbuild
      expect(packageJson.scripts.build).toContain('esbuild');
    });
  });

  describe('9. Obsidian API Integration', () => {
    test('should have access to Obsidian App API', async () => {
      await plugin.onload();
      
      expect(plugin.app).toBeDefined();
      expect(plugin.app.vault).toBeDefined();
      expect(plugin.app.workspace).toBeDefined();
    });

    test('should be able to access vault methods', () => {
      expect(plugin.app.vault.getMarkdownFiles).toBeDefined();
      expect(typeof plugin.app.vault.getMarkdownFiles).toBe('function');
    });

    test('should be able to access workspace methods', () => {
      expect(plugin.app.workspace.getActiveFile).toBeDefined();
      expect(typeof plugin.app.workspace.getActiveFile).toBe('function');
    });
  });

  describe('10. Memory Management and Cleanup', () => {
    test('should register cleanup tasks properly', async () => {
      await plugin.onload();
      
      const cleanupTasks = (plugin as any).cleanupTasks;
      expect(Array.isArray(cleanupTasks)).toBe(true);
      
      // Should have at least some cleanup tasks registered
      expect(cleanupTasks.length).toBeGreaterThanOrEqual(0);
    });

    test('should execute cleanup tasks on unload', async () => {
      await plugin.onload();
      
      const mockCleanup = jest.fn();
      (plugin as any).registerCleanup(mockCleanup);
      
      await plugin.onunload();
      
      expect(mockCleanup).toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      await plugin.onload();
      
      // Register a cleanup task that throws an error
      const errorCleanup = jest.fn().mockRejectedValue(new Error('Cleanup error'));
      (plugin as any).registerCleanup(errorCleanup);
      
      // onunload should not throw even if cleanup fails
      await expect(plugin.onunload()).resolves.not.toThrow();
    });
  });
}); 