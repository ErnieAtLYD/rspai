import { PrivacyFilter, PrivacySettings, DEFAULT_PRIVACY_SETTINGS } from '../../src/privacy-filter';
import { PrivacyAwareScanner } from '../../src/privacy-aware-scanner';
import { Logger, LogLevel } from '../../src/logger';

/**
 * Task ID 3 Verification Test: Develop Privacy Filter System
 * 
 * Test Strategy:
 * 1. Test exclusion of notes with #private and #noai tags
 * 2. Verify partial note exclusion works correctly
 * 3. Test custom exclusion markers
 * 4. Ensure folder exclusions are respected
 * 5. Verify privacy settings persist across plugin restarts
 */
// Mock App interface for testing
interface MockApp {
  vault: {
    getMarkdownFiles(): Array<{ path: string; name: string; extension: string; stat: { mtime: number; size: number } }>;
    getAbstractFileByPath(path: string): { path: string; name: string; extension: string; stat: { mtime: number; size: number } } | undefined;
    read(file: { path: string }): Promise<string>;
    adapter: {
      stat(path: string): Promise<{ ctime: number; mtime: number; size: number }>;
    };
  };
}

// Mock App implementation for testing
class MockObsidianApp implements MockApp {
  vault = {
    getMarkdownFiles: () => this.mockFiles,
    getAbstractFileByPath: (path: string) => this.mockFiles.find(f => f.path === path),
    read: async (file: { path: string }) => this.mockFileContents[file.path] || '',
    adapter: {
      stat: async (path: string) => ({
        ctime: Date.now() - 86400000, // 1 day ago
        mtime: Date.now() - 3600000,  // 1 hour ago
        size: this.mockFileContents[path]?.length || 0
      })
    }
  };

  private mockFiles: Array<{
    path: string;
    name: string;
    extension: string;
    stat: { mtime: number; size: number };
  }> = [];
  private mockFileContents: Record<string, string> = {};

  addMockFile(path: string, content: string) {
    const filename = path.split('/').pop() || '';
    const extension = filename.split('.').pop() || '';
    
    this.mockFiles.push({
      path,
      name: filename,
      extension,
      stat: {
        mtime: Date.now() - 3600000,
        size: content.length
      }
    });
    
    this.mockFileContents[path] = content;
  }

  clearMockFiles() {
    this.mockFiles = [];
    this.mockFileContents = {};
  }
}

describe('Task 3: Privacy Filter System Verification', () => {
  let mockApp: MockObsidianApp;
  let logger: Logger;
  let privacyFilter: PrivacyFilter;
  let privacyScanner: PrivacyAwareScanner;

  beforeEach(() => {
    mockApp = new MockObsidianApp();
    logger = new Logger('test', true, LogLevel.DEBUG);
    privacyFilter = new PrivacyFilter(logger);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    privacyScanner = new PrivacyAwareScanner(mockApp as any, logger);
  });

  describe('Test Strategy 1: Exclusion of notes with #private and #noai tags', () => {
    test('should exclude files with #private tag', async () => {
      const fileContent = `
# Meeting Notes #private

This is sensitive information that should not be analyzed.
Contains confidential details about the project.
      `;

      const shouldExclude = privacyFilter.shouldExcludeFile('notes/meeting.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should exclude files with #noai tag', async () => {
      const fileContent = `
# Personal Thoughts #noai

These are my private thoughts that I don't want AI to process.
Very personal and sensitive content here.
      `;

      const shouldExclude = privacyFilter.shouldExcludeFile('notes/personal.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should exclude files with #confidential tag', async () => {
      const fileContent = `
# Salary Information #confidential

Current salary: $95,000
Target salary: $115,000
Negotiation strategy details...
      `;

      const shouldExclude = privacyFilter.shouldExcludeFile('notes/salary.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should not exclude files without privacy tags', async () => {
      const fileContent = `
# Learning Notes

Today I learned about TypeScript patterns.
This is public content that can be analyzed.
      `;

      const shouldExclude = privacyFilter.shouldExcludeFile('notes/learning.md', fileContent);
      expect(shouldExclude).toBe(false);
    });

    test('should handle privacy tags in different positions', async () => {
      const contentVariations = [
        '# Title #private\nContent here',
        'Some content #private\nMore content',
        'Content\n## Section #noai\nPrivate section',
        'Regular content\n\nThis paragraph is sensitive. #confidential'
      ];

      for (const content of contentVariations) {
        const shouldExclude = privacyFilter.shouldExcludeFile('test.md', content);
        expect(shouldExclude).toBe(true);
      }
    });
  });

  describe('Test Strategy 2: Verify partial note exclusion works correctly', () => {
    test('should redact sections with privacy tags while keeping other content', async () => {
      const fileContent = `
# Project Update

## Progress
We completed phase 1 successfully.

## Budget Details #private
Spent $50,000 of $100,000 budget.
Financial details are confidential.

## Next Steps
Continue with phase 2 planning.
      `;

      const filteredContent = privacyFilter.filterContent(fileContent);
      
      // Should contain public sections
      expect(filteredContent).toContain('Project Update');
      expect(filteredContent).toContain('We completed phase 1 successfully');
      expect(filteredContent).toContain('Continue with phase 2 planning');
      
      // Should not contain private content
      expect(filteredContent).not.toContain('$50,000');
      expect(filteredContent).not.toContain('Financial details are confidential');
      
      // Should contain redaction placeholder
      expect(filteredContent).toContain('[REDACTED]');
    });

    test('should redact paragraphs with privacy tags', async () => {
      const fileContent = `
# Meeting Notes

Regular discussion about project timeline.

This paragraph contains sensitive salary information. #private

Back to regular content about project deliverables.
      `;

      const filteredContent = privacyFilter.filterContent(fileContent);
      
      expect(filteredContent).toContain('Regular discussion about project timeline');
      expect(filteredContent).toContain('Back to regular content about project deliverables');
      expect(filteredContent).not.toContain('sensitive salary information');
      expect(filteredContent).toContain('[REDACTED]');
    });

    test('should redact content between privacy markers', async () => {
      const fileContent = `
# Draft Proposal

## Executive Summary
This proposal outlines our new initiative.

<!-- #private -->
TODO: Need to verify these numbers with finance
Cost estimate might be too high
Internal discussion notes
<!-- /#private -->

## Implementation Plan
We will proceed with the following steps.
      `;

      const filteredContent = privacyFilter.filterContent(fileContent);
      
      expect(filteredContent).toContain('Executive Summary');
      expect(filteredContent).toContain('Implementation Plan');
      expect(filteredContent).not.toContain('TODO: Need to verify');
      expect(filteredContent).not.toContain('Cost estimate might be too high');
    });
  });

  describe('Test Strategy 3: Test custom exclusion markers', () => {
    test('should support custom exclusion tags', async () => {
      const customSettings: Partial<PrivacySettings> = {
        exclusionTags: ['#private', '#noai', '#secret', '#internal']
      };
      
      const customFilter = new PrivacyFilter(logger, customSettings);
      
      const fileContent = `
# Internal Meeting #secret

This contains proprietary information.
      `;

      const shouldExclude = customFilter.shouldExcludeFile('notes/internal.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should support custom redaction placeholder', async () => {
      const customSettings: Partial<PrivacySettings> = {
        redactionPlaceholder: '[CLASSIFIED]'
      };
      
      const customFilter = new PrivacyFilter(logger, customSettings);
      
      const fileContent = `
# Report

## Public Section
This is public information.

## Private Section #private
This is sensitive information.
      `;

      const filteredContent = customFilter.filterContent(fileContent);
      expect(filteredContent).toContain('[CLASSIFIED]');
      expect(filteredContent).not.toContain('[REDACTED]');
    });

    test('should handle case sensitivity settings', async () => {
      const fileContent = `
# Test File

Content in PRIVATE folder should be excluded.
      `;

      // Test case-sensitive folder exclusion
      const caseSensitiveSettings: Partial<PrivacySettings> = {
        caseSensitiveFolders: true,
        excludedFolders: ['Private']
      };
      
      const caseSensitiveFilter = new PrivacyFilter(logger, caseSensitiveSettings);
      
      // Should not exclude 'PRIVATE' when case-sensitive and looking for 'Private'
      expect(caseSensitiveFilter.shouldExcludeFile('PRIVATE/test.md', fileContent)).toBe(false);
      expect(caseSensitiveFilter.shouldExcludeFile('Private/test.md', fileContent)).toBe(true);
    });
  });

  describe('Test Strategy 4: Ensure folder exclusions are respected', () => {
    test('should exclude files in Private folder', async () => {
      const fileContent = 'Regular content without privacy tags';
      
      const shouldExclude = privacyFilter.shouldExcludeFile('Private/document.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should exclude files in Confidential folder', async () => {
      const fileContent = 'Regular content without privacy tags';
      
      const shouldExclude = privacyFilter.shouldExcludeFile('Confidential/report.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should exclude files in .private folder', async () => {
      const fileContent = 'Regular content without privacy tags';
      
      const shouldExclude = privacyFilter.shouldExcludeFile('.private/notes.md', fileContent);
      expect(shouldExclude).toBe(true);
    });

    test('should handle nested folder exclusions', async () => {
      const fileContent = 'Regular content';
      
      const testPaths = [
        'vault/Private/subfolder/document.md',
        'work/Confidential/2024/report.md',
        'notes/.private/personal/diary.md'
      ];

      for (const path of testPaths) {
        const shouldExclude = privacyFilter.shouldExcludeFile(path, fileContent);
        expect(shouldExclude).toBe(true);
      }
    });

    test('should not exclude files in non-private folders', async () => {
      const fileContent = 'Regular content without privacy tags';
      
      const testPaths = [
        'notes/learning.md',
        'work/projects/update.md',
        'personal/goals.md'
      ];

      for (const path of testPaths) {
        const shouldExclude = privacyFilter.shouldExcludeFile(path, fileContent);
        expect(shouldExclude).toBe(false);
      }
    });
  });

  describe('Test Strategy 5: Verify privacy settings persist across plugin restarts', () => {
    test('should maintain custom settings after reinitialization', async () => {
      const customSettings: Partial<PrivacySettings> = {
        exclusionTags: ['#custom', '#private'],
        excludedFolders: ['Custom', 'Private'],
        redactionPlaceholder: '[CUSTOM_REDACTED]',
        enableSectionRedaction: false
      };

      // Create filter with custom settings
      const filter1 = new PrivacyFilter(logger, customSettings);
      const settings1 = filter1.getSettings();

      // Simulate plugin restart by creating new filter with same settings
      const filter2 = new PrivacyFilter(logger, customSettings);
      const settings2 = filter2.getSettings();

      // Settings should be identical
      expect(settings1.exclusionTags).toEqual(settings2.exclusionTags);
      expect(settings1.excludedFolders).toEqual(settings2.excludedFolders);
      expect(settings1.redactionPlaceholder).toEqual(settings2.redactionPlaceholder);
      expect(settings1.enableSectionRedaction).toEqual(settings2.enableSectionRedaction);
    });

    test('should apply settings consistently across multiple operations', async () => {
      const customSettings: Partial<PrivacySettings> = {
        exclusionTags: ['#test'],
        redactionPlaceholder: '[TEST_REDACTED]'
      };

      const filter = new PrivacyFilter(logger, customSettings);
      
      const testContent = `
# Test Document

Public content here.

## Private Section #test
This should be redacted.
      `;

      // Test multiple operations with same filter
      const result1 = filter.filterContent(testContent);
      const result2 = filter.filterContent(testContent);
      const exclude1 = filter.shouldExcludeFile('test1.md', testContent);
      const exclude2 = filter.shouldExcludeFile('test2.md', testContent);

      // Results should be consistent
      expect(result1).toEqual(result2);
      expect(exclude1).toEqual(exclude2);
      expect(result1).toContain('[TEST_REDACTED]');
    });

    test('should handle settings updates correctly', async () => {
      const filter = new PrivacyFilter(logger);
      
      const testContent = 'Content with #newsecret tag';
      
      // Initially should not exclude
      expect(filter.shouldExcludeFile('test.md', testContent)).toBe(false);
      
      // Update settings to include new tag
      filter.updateSettings({
        exclusionTags: [...DEFAULT_PRIVACY_SETTINGS.exclusionTags, '#newsecret']
      });
      
      // Now should exclude
      expect(filter.shouldExcludeFile('test.md', testContent)).toBe(true);
    });
  });

  describe('Integration with PrivacyAwareScanner', () => {
    test('should integrate privacy filtering with vault scanning', async () => {
      // Setup test files
      mockApp.addMockFile('notes/public.md', '# Public Note\nThis is public content.');
      mockApp.addMockFile('notes/private.md', '# Private Note #private\nThis is sensitive content.');
      mockApp.addMockFile('Private/personal.md', '# Personal\nPrivate folder content.');
      mockApp.addMockFile('notes/mixed.md', `
# Mixed Content

## Public Section
This is public information.

## Private Section #confidential
This is confidential information.
      `);

      const { files, results } = await privacyScanner.scanVaultWithPrivacy();

      // Verify scan results
      expect(results.totalFiles).toBe(4);
      expect(results.excludedFiles).toBe(3); // private.md, personal.md, and mixed.md (contains #confidential)
      expect(results.filteredFiles).toBe(0); // No files are filtered (only partially redacted)

      // Verify specific file privacy status
      const publicFile = files.find(f => f.path === 'notes/public.md');
      const privateFile = files.find(f => f.path === 'notes/private.md');
      const personalFile = files.find(f => f.path === 'Private/personal.md');
      const mixedFile = files.find(f => f.path === 'notes/mixed.md');

      expect(publicFile?.privacy?.isExcluded).toBe(false);
      expect(privateFile?.privacy?.isExcluded).toBe(true);
      expect(privateFile?.privacy?.exclusionReason).toBe('privacy_tags');
      expect(personalFile?.privacy?.isExcluded).toBe(true);
      expect(personalFile?.privacy?.exclusionReason).toBe('excluded_folder');
      expect(mixedFile?.privacy?.isExcluded).toBe(true); // Contains #confidential tag, so excluded entirely
      expect(mixedFile?.privacy?.exclusionReason).toBe('privacy_tags');
    });
  });

  describe('Real-world Sample Data Verification', () => {
    test('should correctly handle sample data files', async () => {
      // Test with actual sample data structure
      const privateFinanceContent = `# Personal Finances - 2024 #private #confidential

## Investment Portfolio
- AAPL: 150 shares @ $185.50 avg
- Total Portfolio Value: $127,450`;

      const salaryNegotiationContent = `# Salary Negotiation Strategy #noai

## Current Situation
Current Salary: $95,000
Target Salary: $115,000`;

      // Both should be excluded due to privacy tags
      expect(privacyFilter.shouldExcludeFile('Private/personal-finances.md', privateFinanceContent)).toBe(true);
      expect(privacyFilter.shouldExcludeFile('Confidential/salary-negotiation.md', salaryNegotiationContent)).toBe(true);
      
      // Also excluded due to folder location
      expect(privacyFilter.shouldExcludeFile('Private/any-content.md', 'No privacy tags')).toBe(true);
      expect(privacyFilter.shouldExcludeFile('Confidential/any-content.md', 'No privacy tags')).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty content gracefully', async () => {
      expect(privacyFilter.shouldExcludeFile('test.md', '')).toBe(false);
      expect(privacyFilter.filterContent('')).toBe('');
    });

    test('should handle null/undefined content', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(privacyFilter.shouldExcludeFile('test.md', null as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(privacyFilter.filterContent(null as any)).toBe('');
    });

    test('should handle invalid file paths', async () => {
      expect(privacyFilter.shouldExcludeFile('', 'content')).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(privacyFilter.shouldExcludeFile(null as any, 'content')).toBe(false);
    });

    test('should handle complex markdown with privacy tags', async () => {
      const complexContent = `
# Complex Document

## Table with private data

| Name | Salary #private | Department |
|------|----------------|------------|
| John | $95,000        | Engineering |

## Code block
\`\`\`javascript
// This code is #private
const secret = "api_key_123";
\`\`\`

## Regular content
This is normal content.
      `;

      const filteredContent = privacyFilter.filterContent(complexContent);
      expect(filteredContent).toContain('Complex Document');
      expect(filteredContent).toContain('Regular content');
      expect(filteredContent).toContain('[REDACTED]');
    });
  });
}); 