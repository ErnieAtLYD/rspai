# Privacy Filter Troubleshooting & FAQ

## Table of Contents
- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
- [Advanced Troubleshooting](#advanced-troubleshooting)
- [Frequently Asked Questions](#frequently-asked-questions)
- [Error Messages](#error-messages)
- [Performance Issues](#performance-issues)
- [Integration Problems](#integration-problems)
- [Getting Support](#getting-support)

---

## Quick Diagnostics

### 5-Minute Privacy Check

Run this quick test to verify your privacy filter is working:

#### Step 1: Create Test File
```markdown
# Privacy Test File #private

This file should be excluded from AI analysis.

## Public Section
This would normally be analyzed.

## Private Section #confidential  
This section should also be excluded.
```

#### Step 2: Check Exclusion
1. Save the file as `privacy-test.md`
2. Run RetrospectAI analysis on the file
3. **Expected result**: File should be excluded with privacy notice

#### Step 3: Verify Settings
1. Open Settings → RetrospectAI → Privacy
2. Confirm "Enable Privacy Filter" is ON
3. Verify "private" and "confidential" are in Privacy Tags list

#### Step 4: Check Visual Indicators
- **Editor**: `#private` and `#confidential` should be highlighted in red
- **File Explorer**: File should show privacy indicators if applicable

✅ **If all steps work**: Privacy filter is functioning correctly  
❌ **If any step fails**: Continue to detailed troubleshooting below

---

## Common Issues

### Issue 1: Privacy Tags Not Working

**Symptoms**:
- Files with privacy tags still being analyzed by AI
- No privacy notices appearing in analysis results
- Tags not highlighted in editor

**Diagnostic Steps**:

1. **Check Tag Spelling**
   ```markdown
   ✅ Correct: #private, #confidential, #personal
   ❌ Incorrect: #privte, #confidental, #persnal
   ```

2. **Verify Tag Format**
   ```markdown
   ✅ Correct: # Meeting Notes #private
   ✅ Correct: This is private content. #private
   ❌ Incorrect: #Meeting Notes private
   ❌ Incorrect: This is#private content
   ```

3. **Check Settings Configuration**
   - Settings → RetrospectAI → Privacy → Privacy Tags
   - Should contain: `private, confidential, personal, noai` (without # symbols)
   - Tags are case-insensitive: `Private` = `private` = `PRIVATE`

4. **Test with Simple Case**
   ```markdown
   # Test #private
   Simple test content.
   ```

**Solutions**:

**Solution A: Fix Tag Spelling**
1. Open your note
2. Correct any misspelled privacy tags
3. Save the file
4. Re-run analysis

**Solution B: Update Settings**
1. Go to Settings → RetrospectAI → Privacy
2. In "Privacy Tags" field, ensure correct tags are listed
3. Common tags: `private, confidential, personal, noai, sensitive`
4. Save settings and restart analysis

**Solution C: Clear Cache**
1. Open RetrospectAI settings
2. Click "Clear Processing Cache" (if available)
3. Or restart Obsidian completely
4. Re-run analysis

### Issue 2: Folder Exclusions Not Working

**Symptoms**:
- Files in "Private/" folder still being analyzed
- No folder-based privacy indicators
- Folder exclusions ignored

**Diagnostic Steps**:

1. **Check Folder Path Format**
   ```markdown
   ✅ Correct: Private/, Personal/, Confidential/
   ❌ Incorrect: Private, Personal, Confidential
   ❌ Incorrect: /Private/, /Personal/, /Confidential/
   ```

2. **Verify Folder Structure**
   ```
   vault/
   ├── Private/           ← Should be excluded
   │   └── test.md
   ├── Work/
   │   └── Confidential/  ← Should be excluded
   │       └── notes.md
   └── Public/            ← Should be included
       └── notes.md
   ```

3. **Check Case Sensitivity**
   - **Windows/Mac**: Case-insensitive (`private/` = `Private/`)
   - **Linux**: Case-sensitive by default

**Solutions**:

**Solution A: Fix Folder Paths**
1. Settings → RetrospectAI → Privacy → Privacy Folders
2. Ensure each folder path ends with `/`
3. Example: `Private/, Personal/, Work/Confidential/`
4. Save settings

**Solution B: Verify Folder Names**
1. Check actual folder names in your vault
2. Ensure they match the settings exactly
3. For nested folders, include full path: `Work/Confidential/`

**Solution C: Test with Simple Structure**
1. Create a folder named `Private/`
2. Add a test file: `Private/test.md`
3. Run analysis
4. File should be excluded

### Issue 3: Mixed Content Not Handled Correctly

**Symptoms**:
- Entire files excluded when only sections should be redacted
- Private sections not being redacted properly
- Redaction strategy not working as expected

**Diagnostic Steps**:

1. **Check Redaction Strategy Setting**
   - Settings → RetrospectAI → Privacy → Redaction Strategy
   - Options: "Exclude Entire File", "Redact Private Sections", "Summarize Without Details"

2. **Verify Section-Level Privacy Syntax**
   ```markdown
   # Meeting Notes
   
   ## Public Discussion
   This section should be analyzed.
   
   ## Private Notes #private
   This section should be redacted.
   
   ## Action Items
   This section should be analyzed.
   ```

3. **Test HTML Comment Markers**
   ```markdown
   # Project Notes
   
   Public content here.
   
   <!-- #private -->
   Private content here.
   <!-- /#private -->
   
   More public content.
   ```

**Solutions**:

**Solution A: Change Redaction Strategy**
1. Settings → RetrospectAI → Privacy
2. Change "Redaction Strategy" to "Redact Private Sections"
3. Save settings
4. Re-run analysis

**Solution B: Use Proper Section Markers**
1. Add privacy tags to section headings:
   ```markdown
   ## Private Section #private
   ```
2. Or use HTML comment blocks:
   ```markdown
   <!-- #private -->
   Private content
   <!-- /#private -->
   ```

**Solution C: Test Redaction**
1. Create a test file with mixed content
2. Use clear section markers
3. Verify redaction works correctly

### Issue 4: Visual Indicators Not Showing

**Symptoms**:
- Privacy tags not highlighted in editor
- No visual indicators in file explorer
- Missing privacy status indicators

**Diagnostic Steps**:

1. **Check Plugin Activation**
   - Settings → Community Plugins
   - Ensure RetrospectAI is enabled
   - Try disabling and re-enabling

2. **Verify CSS Loading**
   - Open Developer Console (Ctrl+Shift+I)
   - Look for CSS-related errors
   - Check if privacy styles are loaded

3. **Test with Fresh Restart**
   - Close Obsidian completely
   - Restart application
   - Open a file with privacy tags

**Solutions**:

**Solution A: Restart Obsidian**
1. Close Obsidian completely
2. Restart the application
3. Open a file with privacy tags
4. Check if indicators appear

**Solution B: Toggle Settings**
1. Settings → RetrospectAI → Privacy
2. Toggle "Enable Privacy Filter" OFF then ON
3. Save settings
4. Check visual indicators

**Solution C: Check Console Errors**
1. Open Developer Console (Ctrl+Shift+I)
2. Look for JavaScript errors
3. Report any errors to plugin support

### Issue 5: Audit Log Not Working

**Symptoms**:
- No privacy audit log file created
- Audit log empty despite privacy actions
- Cannot find audit log location

**Diagnostic Steps**:

1. **Check Audit Log Setting**
   - Settings → RetrospectAI → Privacy
   - Ensure "Enable Audit Log" is ON

2. **Verify Log File Location**
   - Default: `.obsidian/plugins/rspai/privacy-audit.log`
   - Check if file exists and is writable

3. **Test with Simple Privacy Action**
   - Create file with `#private` tag
   - Run analysis
   - Check if log entry is created

**Solutions**:

**Solution A: Enable Audit Logging**
1. Settings → RetrospectAI → Privacy
2. Toggle "Enable Audit Log" to ON
3. Save settings

**Solution B: Check File Permissions**
1. Navigate to `.obsidian/plugins/rspai/` folder
2. Ensure folder is writable
3. Check if `privacy-audit.log` can be created

**Solution C: Manual Log Test**
1. Create a test file with `#private` tag
2. Run RetrospectAI analysis
3. Check audit log for new entries
4. If no entries, check console for errors

---

## Advanced Troubleshooting

### Debug Mode Activation

**Enable Debug Logging**:
1. Settings → RetrospectAI → General
2. Enable "Debug Mode"
3. Open Developer Console (Ctrl+Shift+I)
4. Run privacy-related actions
5. Monitor console output

**Sample Debug Output**:
```
[RetrospectAI] Privacy filter: Checking file personal-journal.md
[RetrospectAI] Privacy filter: Found privacy tag #private
[RetrospectAI] Privacy filter: Excluding file due to privacy tag
[RetrospectAI] Privacy audit: Logged exclusion action
```

### Manual Privacy Filter Testing

**Create Test Environment**:
```
test-vault/
├── Private/
│   └── private-test.md #private
├── Public/
│   └── public-test.md
└── Mixed/
    └── mixed-test.md (with #private sections)
```

**Test Each Privacy Method**:

1. **File-Level Tag Test**
   ```markdown
   # Test File #private
   This entire file should be excluded.
   ```

2. **Folder-Level Test**
   - File: `Private/folder-test.md`
   - Should be excluded regardless of content

3. **Section-Level Test**
   ```markdown
   # Mixed Content Test
   
   ## Public Section
   This should be analyzed.
   
   ## Private Section #private
   This should be redacted.
   ```

4. **HTML Comment Test**
   ```markdown
   # HTML Comment Test
   
   Public content.
   
   <!-- #private -->
   Private content.
   <!-- /#private -->
   
   More public content.
   ```

### Performance Profiling

**Check Privacy Filter Performance**:
1. Enable debug mode
2. Run analysis on large vault
3. Monitor console for timing information
4. Look for performance bottlenecks

**Optimize for Large Vaults**:
- Use folder-based exclusions for bulk content
- Enable caching if available
- Consider batch processing options

### Integration Testing

**Test with Other Plugin Features**:
1. **AI Analysis Integration**
   - Verify AI features are disabled for private content
   - Check that structural analysis still works

2. **Summary Generation Integration**
   - Ensure private content excluded from summaries
   - Verify privacy notices in generated summaries

3. **Pattern Detection Integration**
   - Check that private content doesn't affect pattern detection
   - Verify privacy-aware pattern analysis

---

## Frequently Asked Questions

### General Privacy Questions

**Q: Is privacy filtering enabled by default?**
A: Yes, privacy filtering is enabled by default with standard privacy tags (`private`, `confidential`, `personal`, `noai`) and folders (`Private/`, `Personal/`, `Confidential/`).

**Q: Can I use custom privacy tags?**
A: Yes, you can add custom privacy tags in Settings → RetrospectAI → Privacy → Privacy Tags. Enter tags as comma-separated values without the # symbol.

**Q: Do privacy tags work in all languages?**
A: Privacy tags work with any language, but the tag names themselves should be in English (e.g., `#private`, `#confidential`) as configured in settings.

**Q: Can I exclude entire folders?**
A: Yes, add folder paths to Privacy Folders setting. Use format: `FolderName/` with trailing slash. Supports nested folders like `Work/Confidential/`.

### Technical Questions

**Q: How does redaction work technically?**
A: The privacy filter processes content before it reaches AI services. Private sections are either excluded entirely or replaced with `[REDACTED]` placeholders, depending on your redaction strategy.

**Q: Does privacy filtering affect performance?**
A: Minimal impact on small-medium vaults. Large vaults (>5000 files) may see <500ms additional processing time. Folder-based exclusions are more efficient than tag-based for bulk content.

**Q: Can I see what was filtered?**
A: Yes, enable audit logging in privacy settings. The audit log shows exactly what content was excluded and why.

**Q: Is private content ever sent to AI services?**
A: No, privacy filtering happens before any content is sent to AI services. Private content never leaves your local Obsidian installation.

### Configuration Questions

**Q: What's the difference between redaction strategies?**
A: 
- **Exclude Entire File**: Any privacy tag excludes the whole file
- **Redact Private Sections**: Only tagged sections are excluded
- **Summarize Without Details**: AI creates generic summaries without private details

**Q: Can I have different privacy levels?**
A: Yes, use different privacy tags for different levels (e.g., `#private`, `#confidential`, `#sensitive`) and configure them all in settings.

**Q: How do I exclude temporary drafts?**
A: Add `#draft` or `#temp` to your privacy tags, or use temporary HTML comment markers around draft content.

### Workflow Questions

**Q: How do I handle team collaboration with privacy?**
A: Establish team privacy tag conventions (e.g., `#team-confidential`, `#client-confidential`) and document them for all team members.

**Q: Can I use privacy with templates?**
A: Yes, include privacy tags in your templates. For example, daily note templates can include `#private` sections for personal reflections.

**Q: How do I migrate existing private content?**
A: Use find-and-replace to add privacy tags to existing content, or move private files to excluded folders like `Private/`.

---

## Error Messages

### Common Error Messages and Solutions

#### "Privacy filter initialization failed"
**Cause**: Privacy filter couldn't initialize properly
**Solution**: 
1. Restart Obsidian
2. Check plugin is properly installed
3. Verify settings file isn't corrupted

#### "Privacy settings validation error"
**Cause**: Invalid privacy tags or folder paths in settings
**Solution**:
1. Check privacy tags don't contain # symbols
2. Ensure folder paths end with /
3. Remove any invalid characters

#### "Audit log write permission denied"
**Cause**: Cannot write to audit log file
**Solution**:
1. Check file permissions on plugin folder
2. Ensure `.obsidian/plugins/rspai/` is writable
3. Try running Obsidian as administrator (Windows)

#### "Privacy tag parsing error"
**Cause**: Malformed privacy tags in content
**Solution**:
1. Check tag syntax: `#private` not `# private`
2. Ensure tags are properly spaced
3. Verify no special characters in tags

#### "Folder exclusion path error"
**Cause**: Invalid folder path in exclusion settings
**Solution**:
1. Use forward slashes: `Private/` not `Private\`
2. Include trailing slash: `Private/` not `Private`
3. Check folder actually exists

---

## Performance Issues

### Slow Privacy Processing

**Symptoms**:
- Long delays when analyzing files with privacy tags
- Obsidian becomes unresponsive during privacy filtering
- High CPU usage during analysis

**Solutions**:

1. **Optimize Privacy Settings**
   - Use folder-based exclusions for bulk private content
   - Reduce number of privacy tags if excessive
   - Consider "Exclude Entire File" strategy for better performance

2. **Enable Caching**
   - Check if caching is available in settings
   - Clear cache if it becomes corrupted
   - Restart Obsidian to refresh cache

3. **Batch Processing**
   - Process smaller batches of files
   - Avoid analyzing entire large vaults at once
   - Use incremental analysis when possible

### Memory Issues

**Symptoms**:
- Obsidian crashes during privacy filtering
- High memory usage
- System becomes slow

**Solutions**:

1. **Reduce Processing Load**
   - Exclude large folders from analysis
   - Process files in smaller batches
   - Close other applications during analysis

2. **Optimize Vault Structure**
   - Move large private files to excluded folders
   - Use folder exclusions instead of individual file tags
   - Consider splitting large vaults

---

## Integration Problems

### AI Service Integration Issues

**Symptoms**:
- Private content still being sent to AI services
- Inconsistent privacy protection
- AI analysis errors

**Solutions**:

1. **Verify Privacy Filter Order**
   - Ensure privacy filtering happens before AI processing
   - Check plugin initialization order
   - Restart plugin if necessary

2. **Test AI Integration**
   - Create test file with private content
   - Verify AI analysis is disabled
   - Check for privacy notices in results

### Summary Generation Issues

**Symptoms**:
- Private content appearing in summaries
- Missing privacy notices
- Inconsistent redaction

**Solutions**:

1. **Check Summary Settings**
   - Verify "Respect Privacy in Summaries" is enabled
   - Check summary generation integration
   - Test with simple private content

2. **Verify Redaction Strategy**
   - Ensure appropriate redaction strategy is selected
   - Test with mixed content files
   - Check redaction markers are working

---

## Getting Support

### Before Contacting Support

**Information to Gather**:
1. ✅ Plugin version (Settings → Community Plugins → RetrospectAI)
2. ✅ Obsidian version (Help → About)
3. ✅ Operating system and version
4. ✅ Privacy settings configuration
5. ✅ Sample file that demonstrates the issue
6. ✅ Console error messages (if any)
7. ✅ Steps to reproduce the problem

### Self-Help Checklist

**Before reporting a bug**:
- [ ] Tried restarting Obsidian
- [ ] Verified plugin is up to date
- [ ] Tested with simple example
- [ ] Checked this troubleshooting guide
- [ ] Enabled debug mode and checked console
- [ ] Tested with default settings

### How to Report Issues

**Effective Bug Reports Include**:
1. **Clear description** of the problem
2. **Steps to reproduce** the issue
3. **Expected behavior** vs actual behavior
4. **System information** (OS, versions)
5. **Configuration details** (privacy settings)
6. **Sample files** (with private content removed)
7. **Console errors** (if applicable)

**Example Bug Report**:
```
Title: Privacy tags not working on macOS

Description: Files with #private tags are still being analyzed by AI

Steps to Reproduce:
1. Create file with content: "# Test #private\nPrivate content"
2. Run RetrospectAI analysis
3. AI analysis proceeds despite #private tag

Expected: File should be excluded with privacy notice
Actual: File is analyzed normally

System Info:
- macOS 14.2
- Obsidian 1.5.3
- RetrospectAI 1.2.0

Privacy Settings:
- Enable Privacy Filter: ON
- Privacy Tags: private, confidential, personal, noai
- Redaction Strategy: Exclude Entire File

Console Errors: None
```

### Community Resources

- **Documentation**: Check all privacy documentation files
- **GitHub Issues**: Search existing issues before creating new ones
- **Community Forum**: Ask questions in Obsidian community
- **Plugin Support**: Contact plugin developer through official channels

---

## Summary

This troubleshooting guide covers the most common privacy filter issues and their solutions. The key points to remember:

1. **Start with quick diagnostics** to identify the problem
2. **Check settings configuration** for common mistakes
3. **Use debug mode** for detailed troubleshooting
4. **Test with simple examples** to isolate issues
5. **Gather complete information** before seeking support

Most privacy filter issues can be resolved by:
- Verifying tag spelling and format
- Checking folder path configuration
- Ensuring proper redaction strategy
- Restarting Obsidian or clearing cache

For persistent issues, enable debug mode and check the console for detailed error information. 