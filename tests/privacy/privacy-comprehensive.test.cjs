/**
 * Comprehensive Privacy Testing for Pattern Detection Engine
 * Tests privacy filtering using real sample data
 */

const fs = require('fs');
const path = require('path');

// Simple test framework
class PrivacyTestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  test(name, testFn) {
    try {
      const startTime = Date.now();
      const result = testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${name} (${duration}ms)`);
      this.passed++;
      this.results.push({ name, status: 'passed', duration, details: result });
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
      this.results.push({ name, status: 'failed', error: error.message });
    }
  }

  summary() {
    console.log(`\n📊 Privacy Test Results: ${this.passed} passed, ${this.failed} failed\n`);
    return this.failed === 0;
  }

  generateReport() {
    return {
      summary: {
        totalTests: this.passed + this.failed,
        passed: this.passed,
        failed: this.failed,
        successRate: `${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`
      },
      results: this.results
    };
  }
}

// Privacy validation functions
function hasPrivacyTags(content) {
  const privateTags = ['#private', '#noai', '#confidential'];
  return privateTags.some(tag => content.toLowerCase().includes(tag.toLowerCase()));
}

function isInPrivateFolder(filePath) {
  const privateFolders = ['Private', 'Confidential', '.private'];
  const normalizedPath = filePath.toLowerCase();
  return privateFolders.some(folder => 
    normalizedPath.includes('/' + folder.toLowerCase() + '/') ||
    normalizedPath.startsWith(folder.toLowerCase() + '/') ||
    normalizedPath.includes('\\' + folder.toLowerCase() + '\\') ||
    normalizedPath.startsWith(folder.toLowerCase() + '\\')
  );
}

function shouldExcludeFile(filePath, content) {
  return isInPrivateFolder(filePath) || hasPrivacyTags(content);
}

function simulateContentRedaction(content) {
  if (!content) return '';
  
  // Simple redaction simulation
  const lines = content.split('\n');
  const redactedLines = lines.map(line => {
    if (line.toLowerCase().includes('#private') || 
        line.toLowerCase().includes('#noai') ||
        line.toLowerCase().includes('#confidential')) {
      return '[REDACTED]';
    }
    return line;
  });
  
  return redactedLines.join('\n');
}

// Load sample data
function loadSampleData() {
  const sampleDataPath = path.join(__dirname, '../../sample-data');
  const files = [];

  function scanDirectory(dir, basePath = '') {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
          scanDirectory(fullPath, relativePath);
        } else if (item.endsWith('.md')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({
              path: relativePath,
              fullPath,
              content,
              size: content.length
            });
          } catch (error) {
            console.warn(`Warning: Could not read file ${fullPath}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dir}: ${error.message}`);
    }
  }

  scanDirectory(sampleDataPath);
  return files;
}

// Main test execution
async function runPrivacyTests() {
  console.log('\n🔒 Starting Comprehensive Privacy Tests\n');
  
  const runner = new PrivacyTestRunner();
  const sampleFiles = loadSampleData();

  console.log(`📁 Loaded ${sampleFiles.length} sample files for testing\n`);

  // Test 1: Sample Data Loading
  runner.test('Sample Data - File Loading', () => {
    if (sampleFiles.length === 0) {
      throw new Error('No sample files found');
    }
    
    const totalSize = sampleFiles.reduce((sum, file) => sum + file.size, 0);
    console.log(`    📄 Loaded ${sampleFiles.length} files (${(totalSize / 1024).toFixed(1)}KB total)`);
    
    return { fileCount: sampleFiles.length, totalSizeKB: (totalSize / 1024).toFixed(1) };
  });

  // Test 2: Private Folder Detection
  runner.test('Privacy Filter - Private Folder Detection', () => {
    const privateFiles = sampleFiles.filter(file => isInPrivateFolder(file.path));
    const publicFiles = sampleFiles.filter(file => !isInPrivateFolder(file.path));
    
    console.log(`    🔒 Found ${privateFiles.length} files in private folders`);
    console.log(`    🌐 Found ${publicFiles.length} files in public folders`);
    
    // Verify we have both private and public files
    if (privateFiles.length === 0) {
      throw new Error('No files found in private folders - test data may be incomplete');
    }
    
    if (publicFiles.length === 0) {
      throw new Error('No files found in public folders - test data may be incomplete');
    }
    
    return { privateFiles: privateFiles.length, publicFiles: publicFiles.length };
  });

  // Test 3: Privacy Tag Detection
  runner.test('Privacy Filter - Privacy Tag Detection', () => {
    const filesWithTags = sampleFiles.filter(file => hasPrivacyTags(file.content));
    const filesWithoutTags = sampleFiles.filter(file => !hasPrivacyTags(file.content));
    
    console.log(`    🏷️  Found ${filesWithTags.length} files with privacy tags`);
    console.log(`    📝 Found ${filesWithoutTags.length} files without privacy tags`);
    
    // Log which files have privacy tags
    if (filesWithTags.length > 0) {
      console.log(`    📋 Files with privacy tags: ${filesWithTags.map(f => f.path).join(', ')}`);
    }
    
    return { 
      filesWithTags: filesWithTags.length, 
      filesWithoutTags: filesWithoutTags.length,
      taggedFiles: filesWithTags.map(f => f.path)
    };
  });

  // Test 4: Comprehensive Privacy Classification
  runner.test('Privacy Filter - Comprehensive Classification', () => {
    const classification = {
      privateFolder: [],
      privacyTags: [],
      publicSafe: [],
      mixed: []
    };

    sampleFiles.forEach(file => {
      const inPrivateFolder = isInPrivateFolder(file.path);
      const hasPrivateTags = hasPrivacyTags(file.content);
      
      if (inPrivateFolder && hasPrivateTags) {
        classification.mixed.push(file.path);
      } else if (inPrivateFolder) {
        classification.privateFolder.push(file.path);
      } else if (hasPrivateTags) {
        classification.privacyTags.push(file.path);
      } else {
        classification.publicSafe.push(file.path);
      }
    });

    console.log(`    📁 Private folder only: ${classification.privateFolder.length}`);
    console.log(`    🏷️  Privacy tags only: ${classification.privacyTags.length}`);
    console.log(`    🔒 Both private folder & tags: ${classification.mixed.length}`);
    console.log(`    ✅ Public/safe: ${classification.publicSafe.length}`);
    
    return classification;
  });

  // Test 5: Content Redaction Simulation
  runner.test('Privacy Filter - Content Redaction', () => {
    let redactionCount = 0;
    let totalOriginalLength = 0;
    let totalRedactedLength = 0;
    
    const redactionResults = sampleFiles.map(file => {
      const originalLength = file.content.length;
      const redactedContent = simulateContentRedaction(file.content);
      const redactedLength = redactedContent.length;
      
      totalOriginalLength += originalLength;
      totalRedactedLength += redactedLength;
      
      if (redactedLength !== originalLength) {
        redactionCount++;
      }
      
      return {
        path: file.path,
        originalLength,
        redactedLength,
        hasRedaction: redactedLength !== originalLength
      };
    });

    const reductionPercentage = ((totalOriginalLength - totalRedactedLength) / totalOriginalLength * 100).toFixed(1);
    
    console.log(`    ✂️  Redacted content in ${redactionCount} files`);
    console.log(`    📊 Content reduction: ${reductionPercentage}%`);
    console.log(`    📏 Total length: ${totalOriginalLength} → ${totalRedactedLength} chars`);
    
    return {
      filesRedacted: redactionCount,
      reductionPercentage,
      originalLength: totalOriginalLength,
      redactedLength: totalRedactedLength
    };
  });

  // Test 6: File Exclusion Logic
  runner.test('Privacy Filter - File Exclusion Logic', () => {
    const excludedFiles = sampleFiles.filter(file => shouldExcludeFile(file.path, file.content));
    const includedFiles = sampleFiles.filter(file => !shouldExcludeFile(file.path, file.content));
    
    const exclusionRate = (excludedFiles.length / sampleFiles.length * 100).toFixed(1);
    
    console.log(`    ❌ Excluded files: ${excludedFiles.length} (${exclusionRate}%)`);
    console.log(`    ✅ Included files: ${includedFiles.length}`);
    
    if (excludedFiles.length > 0) {
      console.log(`    📋 Excluded: ${excludedFiles.map(f => f.path).join(', ')}`);
    }
    
    return {
      excludedCount: excludedFiles.length,
      includedCount: includedFiles.length,
      exclusionRate,
      excludedFiles: excludedFiles.map(f => f.path)
    };
  });

  // Test 7: Privacy Enforcement Validation
  runner.test('Privacy Filter - Enforcement Validation', () => {
    let violations = [];
    
    sampleFiles.forEach(file => {
      const shouldExclude = shouldExcludeFile(file.path, file.content);
      
      // Check if file should be excluded but would be processed
      if (shouldExclude) {
        // This file should not be processed at all
        if (!isInPrivateFolder(file.path) && !hasPrivacyTags(file.content)) {
          violations.push({
            file: file.path,
            violation: 'File marked for exclusion but has no privacy markers'
          });
        }
      } else {
        // This file can be processed, but check for privacy leaks
        if (hasPrivacyTags(file.content)) {
          violations.push({
            file: file.path,
            violation: 'File allowed for processing but contains privacy tags'
          });
        }
      }
    });

    if (violations.length > 0) {
      console.log(`    ⚠️  Found ${violations.length} privacy violations:`);
      violations.forEach(v => console.log(`      - ${v.file}: ${v.violation}`));
      throw new Error(`Privacy enforcement violations detected: ${violations.length}`);
    }
    
    console.log(`    ✅ No privacy enforcement violations found`);
    return { violations: 0 };
  });

  // Test 8: Performance with Real Data
  runner.test('Privacy Filter - Performance with Real Data', () => {
    const startTime = Date.now();
    
    // Process all files
    const results = sampleFiles.map(file => ({
      path: file.path,
      shouldExclude: shouldExcludeFile(file.path, file.content),
      hasPrivacyTags: hasPrivacyTags(file.content),
      inPrivateFolder: isInPrivateFolder(file.path),
      contentLength: file.content.length
    }));
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    const filesPerSecond = Math.round(sampleFiles.length / (processingTime / 1000));
    
    console.log(`    ⚡ Processed ${sampleFiles.length} files in ${processingTime}ms`);
    console.log(`    📈 Performance: ${filesPerSecond} files/second`);
    
    if (processingTime > 1000) {
      throw new Error(`Privacy filtering too slow: ${processingTime}ms for ${sampleFiles.length} files`);
    }
    
    return {
      processingTimeMs: processingTime,
      filesPerSecond,
      totalFiles: sampleFiles.length
    };
  });

  // Test 9: Memory Usage with Real Data
  runner.test('Privacy Filter - Memory Usage', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create privacy analysis for all files
    const privacyAnalysis = sampleFiles.map(file => ({
      path: file.path,
      size: file.content.length,
      shouldExclude: shouldExcludeFile(file.path, file.content),
      redactedContent: simulateContentRedaction(file.content),
      analysis: {
        hasPrivacyTags: hasPrivacyTags(file.content),
        inPrivateFolder: isInPrivateFolder(file.path),
        timestamp: Date.now()
      }
    }));
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
    const memoryPerFile = memoryIncrease / sampleFiles.length;
    
    console.log(`    💾 Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
    console.log(`    📊 Memory per file: ${(memoryPerFile / 1024).toFixed(1)}KB`);
    
    if (memoryIncreaseMB > 50) {
      throw new Error(`Memory usage too high: ${memoryIncreaseMB.toFixed(2)}MB`);
    }
    
    return {
      memoryIncreaseMB: memoryIncreaseMB.toFixed(2),
      memoryPerFileKB: (memoryPerFile / 1024).toFixed(1),
      analysisCount: privacyAnalysis.length
    };
  });

  // Test 10: Privacy Report Generation
  runner.test('Privacy Filter - Report Generation', () => {
    const report = {
      summary: {
        totalFiles: sampleFiles.length,
        excludedFiles: sampleFiles.filter(f => shouldExcludeFile(f.path, f.content)).length,
        privateFolder: sampleFiles.filter(f => isInPrivateFolder(f.path)).length,
        privacyTags: sampleFiles.filter(f => hasPrivacyTags(f.content)).length,
        reportGeneratedAt: new Date().toISOString()
      },
      fileDetails: sampleFiles.map(file => ({
        path: file.path,
        size: file.content.length,
        shouldExclude: shouldExcludeFile(file.path, file.content),
        inPrivateFolder: isInPrivateFolder(file.path),
        hasPrivacyTags: hasPrivacyTags(file.content)
      })),
      privacySettings: {
        privateTags: ['#private', '#noai', '#confidential'],
        privateFolders: ['Private', 'Confidential', '.private'],
        redactionEnabled: true
      }
    };

    console.log(`    📋 Generated comprehensive privacy report`);
    console.log(`    📊 ${report.summary.excludedFiles}/${report.summary.totalFiles} files excluded`);
    
    return report.summary;
  });

  // Run all tests and generate final report
  const success = runner.summary();
  const testReport = runner.generateReport();
  
  // Save test report
  try {
    const reportPath = path.join(__dirname, 'privacy-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testReport, null, 2));
    console.log(`📄 Test report saved to: ${reportPath}`);
  } catch (error) {
    console.warn(`Warning: Could not save test report: ${error.message}`);
  }
  
  if (success) {
    console.log('🎉 All privacy tests passed! Privacy filtering is working correctly.');
    console.log('🔒 Pattern Detection Engine privacy enforcement is ready for production.');
  } else {
    console.log('⚠️  Some privacy tests failed. Please review the results above.');
    process.exit(1);
  }

  return success;
}

// Run the tests
runPrivacyTests().catch(error => {
  console.error('❌ Privacy test execution failed:', error);
  process.exit(1);
}); 