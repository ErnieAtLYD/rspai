import { TFile } from 'obsidian';
import { VaultScanner } from '../../src/vault-scanner';
import { Logger } from '../../src/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Task ID 4 Practical Verification: Real Data Test
 * 
 * This test uses the actual sample-data files to verify the vault scanner
 * works with real Obsidian markdown files according to the test strategy.
 */

describe('Task ID 2: Vault Scanner - Real Data Verification', () => {
  let logger: Logger;
  let mockApp: any;
  let vaultScanner: VaultScanner;
  
  const sampleDataPath = path.join(__dirname, '../../sample-data');
  
  beforeAll(() => {
    // Verify sample data exists
    expect(fs.existsSync(sampleDataPath)).toBe(true);
  });

  beforeEach(() => {
    logger = new Logger('VaultScannerRealTest', true, 0);
    
    // Create a more realistic mock that reads actual files
    mockApp = createRealisticMockApp();
    vaultScanner = new VaultScanner(mockApp, logger);
  });

  describe('Real File System Integration', () => {
    it('should scan actual sample data files', async () => {
      console.log('\n🔍 Testing with real sample data files...');
      
      // Act: Scan the vault
      const startTime = Date.now();
      const results = await vaultScanner.scanVault();
      const scanTime = Date.now() - startTime;
      
      // Assert: Should find the expected files
      expect(results.length).toBeGreaterThan(0);
      expect(scanTime).toBeLessThan(1000); // Should complete quickly
      
      console.log(`✅ Scanned ${results.length} files in ${scanTime}ms`);
      
      // Verify file types and structure
      const mdFiles = results.filter(f => f.extension === 'md');
      expect(mdFiles.length).toBe(results.length); // All should be markdown
      
      // Log file details for verification
      console.log('\n📁 Files found:');
      results.forEach(file => {
        console.log(`   ${file.path} (${file.size} bytes, modified: ${new Date(file.modifiedAt).toISOString()})`);
      });
      
      // Verify daily notes detection
      const dailyNotes = results.filter(f => f.isDailyNote);
      console.log(`📅 Daily notes detected: ${dailyNotes.length}`);
      dailyNotes.forEach(note => {
        console.log(`   ${note.path} - Date: ${note.detectedDate?.toISOString()}`);
      });
      
      // Verify weekly notes detection  
      const weeklyNotes = results.filter(f => f.isWeeklyNote);
      console.log(`📊 Weekly notes detected: ${weeklyNotes.length}`);
    });

    it('should handle directory-specific scanning with real data', async () => {
      console.log('\n🔍 Testing directory-specific scanning...');
      
      // Test scanning specific directories that exist in sample-data
      const directories = ['daily-notes', 'meeting-notes', 'learning-notes'];
      
      for (const dir of directories) {
        const dirPath = path.join(sampleDataPath, dir);
        if (fs.existsSync(dirPath)) {
          console.log(`\n📂 Scanning directory: ${dir}`);
          
          const startTime = Date.now();
          const results = await vaultScanner.scanVault(dir);
          const scanTime = Date.now() - startTime;
          
          console.log(`   Found ${results.length} files in ${scanTime}ms`);
          
          // Verify all results are from the specified directory
          results.forEach(file => {
            expect(file.path).toMatch(new RegExp(`^${dir}/`));
            console.log(`   ✓ ${file.path}`);
          });
        }
      }
    });

    it('should demonstrate incremental scanning performance', async () => {
      console.log('\n🔍 Testing incremental scanning performance...');
      
      // Initial scan
      console.log('Initial scan...');
      const initialStart = Date.now();
      const initialResults = await vaultScanner.scanVault();
      const initialTime = Date.now() - initialStart;
      
      console.log(`✅ Initial scan: ${initialResults.length} files in ${initialTime}ms`);
      
      // Get index stats
      const stats = vaultScanner.getIndexStats();
      console.log(`📊 Index stats: ${stats.totalFiles} total files, last scan: ${stats.lastScan}`);
      
      // Second scan (should be faster due to caching)
      console.log('\nIncremental scan...');
      const incrementalStart = Date.now();
      const incrementalResults = await vaultScanner.scanVault();
      const incrementalTime = Date.now() - incrementalStart;
      
      console.log(`✅ Incremental scan: ${incrementalResults.length} files in ${incrementalTime}ms`);
      
      // Assert incremental scan is faster (or at least not significantly slower)
      expect(incrementalResults.length).toBe(initialResults.length);
      expect(incrementalTime).toBeLessThan(initialTime + 100); // Allow some variance
      
      console.log(`⚡ Performance improvement: ${((initialTime - incrementalTime) / initialTime * 100).toFixed(1)}% faster`);
    });

    it('should provide accurate file metadata', async () => {
      console.log('\n🔍 Testing file metadata accuracy...');
      
      const results = await vaultScanner.scanVault();
      
      // Verify metadata for each file
      for (const fileMetadata of results.slice(0, 3)) { // Test first 3 files
        const actualPath = path.join(sampleDataPath, fileMetadata.path);
        
        if (fs.existsSync(actualPath)) {
          const actualStats = fs.statSync(actualPath);
          
          console.log(`\n📄 Verifying: ${fileMetadata.path}`);
          console.log(`   Reported size: ${fileMetadata.size} bytes`);
          console.log(`   Actual size: ${actualStats.size} bytes`);
          console.log(`   Reported modified: ${new Date(fileMetadata.modifiedAt).toISOString()}`);
          console.log(`   Actual modified: ${actualStats.mtime.toISOString()}`);
          
          // Allow some tolerance for timing differences
          expect(Math.abs(fileMetadata.size - actualStats.size)).toBeLessThan(100);
          expect(Math.abs(fileMetadata.modifiedAt - actualStats.mtime.getTime())).toBeLessThan(5000);
          
          console.log(`   ✅ Metadata accuracy verified`);
        }
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for small vault', async () => {
      console.log('\n⚡ Performance benchmark test...');
      
      const iterations = 5;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        // Create fresh scanner to avoid caching
        const testScanner = new VaultScanner(mockApp, logger);
        
        const start = Date.now();
        const results = await testScanner.scanVault();
        const time = Date.now() - start;
        
        times.push(time);
        console.log(`   Iteration ${i + 1}: ${results.length} files in ${time}ms`);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log(`📊 Performance Summary:`);
      console.log(`   Average: ${avgTime.toFixed(1)}ms`);
      console.log(`   Min: ${minTime}ms`);
      console.log(`   Max: ${maxTime}ms`);
      console.log(`   Variance: ${(maxTime - minTime)}ms`);
      
      // Performance assertions
      expect(avgTime).toBeLessThan(500); // Should average under 500ms
      expect(maxTime).toBeLessThan(1000); // No single scan over 1 second
      
      console.log(`✅ Performance benchmarks met`);
    });
  });

  // Helper function to create a realistic mock app that reads actual files
  function createRealisticMockApp() {
    const mockFiles: TFile[] = [];
    
    // Recursively find all .md files in sample-data
    function findMarkdownFiles(dir: string, basePath = ''): void {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = basePath ? path.join(basePath, item) : item;
        
        if (fs.statSync(fullPath).isDirectory()) {
          // Skip .DS_Store and other system files
          if (!item.startsWith('.')) {
            findMarkdownFiles(fullPath, relativePath);
          }
        } else if (item.endsWith('.md')) {
          const stats = fs.statSync(fullPath);
          mockFiles.push({
            path: relativePath,
            name: item,
            extension: 'md',
            stat: {
              mtime: stats.mtime.getTime(),
              size: stats.size
            }
          } as TFile);
        }
      }
    }
    
    findMarkdownFiles(sampleDataPath);
    
    return {
      vault: {
        getMarkdownFiles: () => mockFiles,
        getFiles: () => mockFiles,
        getAbstractFileByPath: (path: string) => {
          return mockFiles.find(f => f.path === path) || null;
        },
        adapter: {
          stat: async (filePath: string) => {
            const fullPath = path.join(sampleDataPath, filePath);
            if (fs.existsSync(fullPath)) {
              const stats = fs.statSync(fullPath);
              return {
                ctime: stats.ctime.getTime(),
                mtime: stats.mtime.getTime(),
                size: stats.size
              };
            }
            return null;
          }
        }
      }
    };
  }
}); 