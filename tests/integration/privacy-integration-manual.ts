import { PrivacyAwareScanner } from '../../src/privacy-aware-scanner';
import { Logger, LogLevel } from '../../src/logger';

/**
 * Mock Obsidian App interface for testing
 */
interface MockApp {
  vault: {
    getMarkdownFiles(): Array<{ path: string; name: string; extension: string; stat: { mtime: number; size: number } }>;
    getAbstractFileByPath(path: string): any;
    read(file: { path: string }): Promise<string>;
    adapter: {
      stat(path: string): Promise<{ ctime: number; mtime: number; size: number }>;
    };
  };
}

/**
 * Mock Obsidian App for testing
 */
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

/**
 * Manual integration tests for Privacy-Aware Scanner
 * Run this file directly with: npx ts-node tests/integration/privacy-integration-manual.ts
 */
class PrivacyIntegrationTests {
  private mockApp: MockObsidianApp;
  private logger: Logger;
  private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

  constructor() {
    this.mockApp = new MockObsidianApp();
    this.logger = new Logger('IntegrationTest', true, LogLevel.INFO);
  }

  /**
   * Assert helper for tests
   */
  private assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Run a single test
   */
  private async runTest(name: string, testFn: () => Promise<void>) {
    console.log(`\n🧪 Running test: ${name}`);
    try {
      await testFn();
      this.testResults.push({ name, passed: true });
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      this.testResults.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.mockApp.clearMockFiles();
    }
  }

  /**
   * Test file-level privacy exclusion
   */
  private async testFileExclusion() {
    // Setup test files
    this.mockApp.addMockFile('notes/public.md', '# Public Note\nThis is public content.');
    this.mockApp.addMockFile('notes/private.md', '# Private Note #private\nThis is sensitive content.');
    this.mockApp.addMockFile('notes/confidential.md', '# Confidential Data #confidential\nSecret information.');

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger);
    const { files, results } = await scanner.scanVaultWithPrivacy();

    // Verify results
    this.assert(results.totalFiles === 3, `Expected 3 total files, got ${results.totalFiles}`);
    this.assert(results.excludedFiles === 2, `Expected 2 excluded files, got ${results.excludedFiles}`);
    this.assert(results.filteredFiles === 0, `Expected 0 filtered files, got ${results.filteredFiles}`);

    // Check specific files
    const publicFile = files.find(f => f.path === 'notes/public.md');
    const privateFile = files.find(f => f.path === 'notes/private.md');
    const confidentialFile = files.find(f => f.path === 'notes/confidential.md');

    this.assert(publicFile?.privacy?.isExcluded === false, 'Public file should not be excluded');
    this.assert(privateFile?.privacy?.isExcluded === true, 'Private file should be excluded');
    this.assert(privateFile?.privacy?.exclusionReason === 'privacy_tags', 'Private file exclusion reason should be privacy_tags');
    this.assert(confidentialFile?.privacy?.isExcluded === true, 'Confidential file should be excluded');
    this.assert(confidentialFile?.privacy?.exclusionReason === 'privacy_tags', 'Confidential file exclusion reason should be privacy_tags');
  }

  /**
   * Test folder-based exclusion
   */
  private async testFolderExclusion() {
    // Setup test files
    this.mockApp.addMockFile('Work/project.md', '# Work Project\nPublic work content.');
    this.mockApp.addMockFile('Private/personal.md', '# Personal Notes\nPersonal content.');
    this.mockApp.addMockFile('Confidential/secrets.md', '# Company Secrets\nConfidential data.');

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger);
    const { files, results } = await scanner.scanVaultWithPrivacy();

    // Verify results
    this.assert(results.totalFiles === 3, `Expected 3 total files, got ${results.totalFiles}`);
    this.assert(results.excludedFiles === 2, `Expected 2 excluded files, got ${results.excludedFiles}`);

    // Check specific files
    const workFile = files.find(f => f.path === 'Work/project.md');
    const privateFile = files.find(f => f.path === 'Private/personal.md');
    const confidentialFile = files.find(f => f.path === 'Confidential/secrets.md');

    this.assert(workFile?.privacy?.isExcluded === false, 'Work file should not be excluded');
    this.assert(privateFile?.privacy?.isExcluded === true, 'Private folder file should be excluded');
    this.assert(privateFile?.privacy?.exclusionReason === 'excluded_folder', 'Private file exclusion reason should be excluded_folder');
    this.assert(confidentialFile?.privacy?.isExcluded === true, 'Confidential folder file should be excluded');
    this.assert(confidentialFile?.privacy?.exclusionReason === 'excluded_folder', 'Confidential file exclusion reason should be excluded_folder');
  }

  /**
   * Test section-level content filtering
   */
  private async testSectionFiltering() {
    const mixedContent = `# Project Update

## Progress
We completed phase 1 successfully.

## Budget Details #private
Spent $50,000 of $100,000 budget.
Need to discuss overruns with finance.

## Next Steps
Continue with phase 2 planning.`;

    this.mockApp.addMockFile('notes/mixed.md', mixedContent);

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger);
    const { files, results } = await scanner.scanVaultWithPrivacy();

    // Verify results
    this.assert(results.totalFiles === 1, `Expected 1 total file, got ${results.totalFiles}`);
    this.assert(results.excludedFiles === 0, `Expected 0 excluded files, got ${results.excludedFiles}`);
    this.assert(results.filteredFiles === 1, `Expected 1 filtered file, got ${results.filteredFiles}`);

    // Check file privacy status
    const file = files[0];
    this.assert(file.privacy?.isExcluded === false, 'Mixed content file should not be excluded');
    this.assert(file.privacy?.isFiltered === true, 'Mixed content file should be filtered');
    this.assert(file.privacy?.originalLength === mixedContent.length, 'Original length should match input');
    this.assert((file.privacy?.filteredLength || 0) < mixedContent.length, 'Filtered length should be less than original');
  }

  /**
   * Test privacy verification
   */
  private async testPrivacyVerification() {
    const testContent = `# Test Document

## Public Section
This is public information.

## Private Section #private
This should be redacted.

## Another Public Section
More public content.`;

    this.mockApp.addMockFile('notes/test.md', testContent);

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger, {
      verifyPrivacy: true
    });

    const { results } = await scanner.scanVaultWithPrivacy();

    // Should pass verification
    this.assert(results.verifiedFiles === 1, `Expected 1 verified file, got ${results.verifiedFiles}`);
    this.assert(results.failedVerification === 0, `Expected 0 failed verifications, got ${results.failedVerification}`);
    this.assert(results.verificationFailures.length === 0, `Expected 0 verification failures, got ${results.verificationFailures.length}`);
  }

  /**
   * Test file size limits
   */
  private async testFileSizeLimits() {
    const smallContent = 'Small file content.';
    const largeContent = 'x'.repeat(1024 * 1024); // 1MB content

    this.mockApp.addMockFile('notes/small.md', smallContent);
    this.mockApp.addMockFile('notes/large.md', largeContent);

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger, {
      maxFileSize: 500 * 1024 // 500KB limit
    });

    const { files, results } = await scanner.scanVaultWithPrivacy();

    this.assert(results.totalFiles === 2, `Expected 2 total files, got ${results.totalFiles}`);
    this.assert(results.skippedFiles === 1, `Expected 1 skipped file, got ${results.skippedFiles}`);

    const smallFile = files.find(f => f.path === 'notes/small.md');
    const largeFile = files.find(f => f.path === 'notes/large.md');

    this.assert(smallFile?.privacy !== undefined, 'Small file should have privacy analysis');
    this.assert(largeFile?.privacy === undefined, 'Large file should not have privacy analysis due to size');
  }

  /**
   * Test privacy settings updates
   */
  private async testSettingsUpdate() {
    this.mockApp.addMockFile('notes/secret.md', '# Secret Note #secret\nSecret content.');

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger, {
      privacySettings: {
        exclusionTags: ['#private'] // Initially only #private
      }
    });

    // First scan - file should not be excluded
    let { results } = await scanner.scanVaultWithPrivacy();
    this.assert(results.excludedFiles === 0, `Expected 0 excluded files initially, got ${results.excludedFiles}`);

    // Update settings to include #secret
    scanner.updatePrivacySettings({
      exclusionTags: ['#private', '#secret']
    });

    // Second scan - file should now be excluded
    ({ results } = await scanner.scanVaultWithPrivacy());
    this.assert(results.excludedFiles === 1, `Expected 1 excluded file after settings update, got ${results.excludedFiles}`);
  }

  /**
   * Test comprehensive privacy audit
   */
  private async testPrivacyAudit() {
    // Setup diverse test files
    this.mockApp.addMockFile('Public/note1.md', '# Public Note 1\nPublic content.');
    this.mockApp.addMockFile('Private/note2.md', '# Private Note 2\nPrivate content.');
    this.mockApp.addMockFile('Work/note3.md', '# Work Note #confidential\nConfidential work content.');
    this.mockApp.addMockFile('Personal/note4.md', `# Personal Note

## Public Thoughts
Some public thoughts.

## Private Thoughts #private
Some private thoughts.`);

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger);
    const audit = await scanner.getPrivacyAudit();

    // Verify audit structure
    this.assert(audit.scanResults !== undefined, 'Audit should have scan results');
    this.assert(audit.privacyReport !== undefined, 'Audit should have privacy report');
    this.assert(audit.recommendations !== undefined, 'Audit should have recommendations');

    // Check scan results
    this.assert(audit.scanResults.totalFiles === 4, `Expected 4 total files in audit, got ${audit.scanResults.totalFiles}`);
    this.assert(audit.scanResults.excludedFiles > 0, `Expected some excluded files in audit, got ${audit.scanResults.excludedFiles}`);
    this.assert(audit.scanResults.filteredFiles > 0, `Expected some filtered files in audit, got ${audit.scanResults.filteredFiles}`);

    // Check recommendations
    this.assert(Array.isArray(audit.recommendations), 'Recommendations should be an array');
    this.assert(audit.recommendations.length > 0, 'Should have at least one recommendation');
  }

  /**
   * Test error handling
   */
  private async testErrorHandling() {
    // Add a file that will cause read error
    this.mockApp.addMockFile('notes/error.md', 'Content');
    
    // Mock read to throw error
    const originalRead = this.mockApp.vault.read;
    this.mockApp.vault.read = async (file: any) => {
      if (file.path === 'notes/error.md') {
        throw new Error('File read error');
      }
      return originalRead.call(this.mockApp.vault, file);
    };

    const scanner = new PrivacyAwareScanner(this.mockApp as any, this.logger);
    const { files, results } = await scanner.scanVaultWithPrivacy();

    // Should complete scan despite error
    this.assert(results.totalFiles === 1, `Expected 1 total file despite error, got ${results.totalFiles}`);
    
    // File should be included without privacy analysis
    const file = files[0];
    this.assert(file.path === 'notes/error.md', 'Error file should be included');
    this.assert(file.privacy === undefined, 'Error file should not have privacy analysis');
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Privacy Integration Tests\n');
    console.log('=' .repeat(50));

    await this.runTest('File-Level Privacy Exclusion', () => this.testFileExclusion());
    await this.runTest('Folder-Based Exclusion', () => this.testFolderExclusion());
    await this.runTest('Section-Level Content Filtering', () => this.testSectionFiltering());
    await this.runTest('Privacy Verification', () => this.testPrivacyVerification());
    await this.runTest('File Size Limits', () => this.testFileSizeLimits());
    await this.runTest('Settings Update', () => this.testSettingsUpdate());
    await this.runTest('Privacy Audit', () => this.testPrivacyAudit());
    await this.runTest('Error Handling', () => this.testErrorHandling());

    // Print summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(50));

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n🔍 FAILED TESTS:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.name}: ${result.error}`);
      });
    }

    console.log('\n🎉 Integration testing complete!');
    
    return { passed, failed, total: this.testResults.length };
  }
}

/**
 * Run the tests if this file is executed directly
 */
if (require.main === module) {
  const tests = new PrivacyIntegrationTests();
  tests.runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { PrivacyIntegrationTests }; 