# Privacy Filter Setup Guide

## Table of Contents
- [Quick Setup (5 minutes)](#quick-setup-5-minutes)
- [Detailed Configuration](#detailed-configuration)
- [Settings Panel Walkthrough](#settings-panel-walkthrough)
- [Advanced Configuration](#advanced-configuration)
- [Integration with Other Features](#integration-with-other-features)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Setup (5 minutes)

### Step 1: Access Privacy Settings
1. Open Obsidian Settings (Ctrl/Cmd + ,)
2. Navigate to **Community Plugins** → **RetrospectAI** → **Settings**
3. Click on the **Privacy** tab

### Step 2: Enable Privacy Filter
- Toggle **"Enable Privacy Filter"** to ON (should be enabled by default)
- This activates all privacy protection features

### Step 3: Verify Default Settings
The plugin comes with sensible defaults:
- **Privacy Tags**: `private, confidential, personal, noai`
- **Privacy Folders**: `Private/, Personal/, Confidential/`
- **Redaction Strategy**: `Exclude Entire File`
- **Audit Log**: Disabled (can be enabled for compliance)

### Step 4: Test Privacy Protection
1. Create a test note with `#private` tag
2. Run RetrospectAI analysis
3. Verify the note is excluded from AI processing

✅ **You're done!** Privacy protection is now active.

---

## Detailed Configuration

### Privacy Tags Configuration

**What it does**: Marks content for exclusion based on hashtags in your notes.

**How to configure**:
1. In Privacy settings, find **"Privacy Tags"** field
2. Enter comma-separated tags (without the # symbol)
3. Default tags: `private, confidential, personal, noai`

**Examples of effective tag strategies**:
```markdown
# Work Strategy #confidential
# Personal Journal #private  
# Health Notes #personal
# Draft Ideas #noai
```

**Advanced tag combinations**:
```markdown
# Meeting Notes #work #confidential
This entire file will be excluded due to #confidential tag

## Public Discussion
This section would normally be included...

## Salary Negotiations #private
But this section is double-protected with #private
```

### Privacy Folders Configuration

**What it does**: Automatically excludes entire folders from AI analysis.

**How to configure**:
1. Find **"Privacy Folders"** field in settings
2. Enter folder paths separated by commas
3. Include trailing slash: `Private/`, not `Private`
4. Supports nested folders: `Work/Confidential/`

**Folder structure examples**:
```
vault/
├── Private/              ← Excluded (all contents)
│   ├── journal.md
│   └── personal-goals.md
├── Work/
│   ├── Confidential/     ← Excluded (all contents)
│   │   └── salary-info.md
│   └── public-notes.md   ← Included
└── Projects/             ← Included (all contents)
    └── project-plan.md
```

**Case sensitivity**:
- **Windows/Mac**: `private/` = `Private/` = `PRIVATE/`
- **Linux**: Case-sensitive by default, can be configured

### Redaction Strategy Options

**What it does**: Controls how files with mixed public/private content are handled.

**Available strategies**:

#### 1. "Exclude Entire File" (Default)
- **Behavior**: If ANY privacy tag is found, exclude the entire file
- **Best for**: Maximum privacy protection
- **Example**: File with one `#private` section → entire file excluded

#### 2. "Redact Private Sections"  
- **Behavior**: Remove only tagged sections, analyze the rest
- **Best for**: Mixed content files
- **Example**: 
  ```markdown
  # Meeting Notes
  
  ## Public Discussion
  We discussed the new project timeline.
  
  ## Private Notes #private
  [REDACTED]
  
  ## Action Items  
  Follow up with the team next week.
  ```

#### 3. "Summarize Without Details"
- **Behavior**: AI creates generic summaries without specific private details
- **Best for**: Maintaining structure while protecting sensitive info
- **Example**: "Document contains private sections that were excluded from detailed analysis"

### Audit Logging

**What it does**: Tracks all privacy actions for compliance and debugging.

**How to enable**:
1. Toggle **"Enable Audit Log"** to ON
2. Logs are saved to `.obsidian/plugins/rspai/privacy-audit.log`

**What gets logged**:
- Files excluded due to privacy tags
- Sections redacted
- Folder-based exclusions  
- Timestamp and reason for each action

**Sample audit log entry**:
```
2024-01-15 14:30:22 - EXCLUDED: personal-journal.md - Reason: Privacy tag (#private)
2024-01-15 14:30:45 - REDACTED: meeting-notes.md - Section: "Budget Discussion #confidential"
2024-01-15 14:31:02 - FOLDER_EXCLUDED: Private/health-notes.md - Folder: Private/
```

---

## Settings Panel Walkthrough

### Privacy Tab Layout

When you open RetrospectAI Settings → Privacy tab, you'll see:

```
Privacy Controls
├── ☑️ Enable Privacy Filter
├── 📝 Privacy Tags: [private, confidential, personal, noai]
├── 📁 Privacy Folders: [Private/, Personal/, Confidential/]  
├── ⚙️ Redaction Strategy: [Exclude Entire File ▼]
└── 📊 ☐ Enable Audit Log
```

### Setting Descriptions

| Setting | Description | Default Value |
|---------|-------------|---------------|
| **Enable Privacy Filter** | Master switch for all privacy features | ✅ Enabled |
| **Privacy Tags** | Hashtags that trigger privacy protection | `private, confidential, personal, noai` |
| **Privacy Folders** | Folder paths to exclude completely | `Private/, Personal/, Confidential/` |
| **Redaction Strategy** | How to handle mixed content | `Exclude Entire File` |
| **Enable Audit Log** | Track privacy actions for compliance | ❌ Disabled |

### Visual Indicators in Obsidian

When privacy protection is active, you'll see:

#### In the Editor:
- **Privacy tags highlighted in red**: `#private` appears with red background
- **Excluded sections marked**: Visual indicators for redacted content

#### In File Explorer:
- **Excluded files dimmed**: Files in privacy folders appear faded
- **Lock icons**: 🔒 next to excluded files and folders

#### In Analysis Results:
- **Privacy notices**: Clear messages when content is excluded
- **Reduced feature set**: Some AI features disabled for private content

---

## Advanced Configuration

### Custom Privacy Tag Workflows

#### Scenario 1: Team Collaboration
```markdown
# Team tags for different privacy levels
Privacy Tags: work-confidential, client-confidential, internal-only, draft

# Usage in notes:
## Client Meeting #client-confidential
## Internal Discussion #internal-only  
## Draft Ideas #draft
```

#### Scenario 2: Personal Vault Organization
```markdown
# Personal privacy hierarchy
Privacy Tags: private, health, financial, family, relationships

# Folder structure:
Private/
├── Health/
├── Financial/
└── Family/
```

#### Scenario 3: Academic Research
```markdown
# Research privacy tags
Privacy Tags: unpublished, confidential-data, participant-info, draft-analysis

# Mixed content handling:
Redaction Strategy: Redact Private Sections
```

### Advanced Folder Patterns

#### Nested Exclusions
```markdown
Privacy Folders: Private/, Work/Confidential/, Research/Unpublished/

# Matches:
✅ Private/anything.md
✅ Work/Confidential/salary.md  
✅ Research/Unpublished/draft-paper.md
❌ Work/Public/meeting-notes.md
```

#### Dynamic Folder Exclusions
```markdown
# Use wildcards for flexible patterns (if supported)
Privacy Folders: */Private/, */Confidential/, */.private/

# Matches any folder named Private, Confidential, or .private at any level
```

### Integration Patterns

#### With Daily Notes
```markdown
# Template for daily notes
# Daily Note - {{date}} #daily

## Work Updates
Public work information here...

## Personal Reflection #private
Private thoughts and feelings...

## Health Notes #health #private
Medical appointments and health tracking...
```

#### With Project Management
```markdown
# Project folder structure
Projects/
├── ProjectA/
│   ├── public-docs/
│   ├── Confidential/     ← Excluded folder
│   └── meeting-notes.md #work
├── ProjectB/
│   └── Private/          ← Excluded folder
```

---

## Integration with Other Features

### AI Analysis Integration

**How privacy affects AI features**:

| Feature | With Privacy Protection | Without Privacy Protection |
|---------|------------------------|---------------------------|
| **Summary Generation** | Structural analysis only | Full AI insights |
| **Pattern Detection** | Basic rule-based patterns | Advanced AI pattern recognition |
| **Content Recommendations** | Generic suggestions | Personalized AI recommendations |
| **Insight Extraction** | Manual extraction tools | Automated AI insights |

### Writing Style Integration

Privacy protection works with all writing styles:

#### Business Style + Privacy
- **Result**: Professional structural summaries
- **Example**: "Document contains confidential sections excluded from analysis"

#### Personal Style + Privacy  
- **Result**: Encouraging structural feedback
- **Example**: "Great job organizing your thoughts! Some private sections were kept secure."

#### Academic Style + Privacy
- **Result**: Objective content analysis
- **Example**: "Content structure analyzed. Confidential data sections excluded per privacy settings."

### Performance Impact

**Privacy filtering performance**:
- **Small vaults** (<1000 files): Negligible impact
- **Medium vaults** (1000-5000 files): <100ms additional processing
- **Large vaults** (>5000 files): <500ms additional processing

**Optimization tips**:
1. Use folder-based exclusions for large private sections
2. Enable caching for repeated analysis
3. Use specific privacy tags rather than broad patterns

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Privacy tags not working
**Symptoms**: Files with privacy tags still being analyzed

**Solutions**:
1. **Check spelling**: Ensure tags match settings exactly
   - Settings: `private, confidential`
   - Note: `#private` ✅, `#privte` ❌

2. **Verify tag format**: Use hashtags in notes, plain text in settings
   - Settings: `private` (no #)
   - Note: `#private` (with #)

3. **Check placement**: Tags should be properly formatted
   ```markdown
   ✅ # Meeting Notes #private
   ✅ This paragraph is private. #private
   ❌ This#private doesn't work
   ```

4. **Restart analysis**: Privacy is applied during analysis, not display
   - Clear processing cache
   - Re-run analysis

#### Issue: Folder exclusions not working
**Symptoms**: Files in privacy folders still being processed

**Solutions**:
1. **Check folder path format**:
   - ✅ `Private/` (with trailing slash)
   - ❌ `Private` (without trailing slash)

2. **Verify case sensitivity**:
   - Windows/Mac: `private/` = `Private/`
   - Linux: Check case-sensitive settings

3. **Check nested folders**:
   ```markdown
   Settings: Private/
   ✅ Private/journal.md
   ✅ Private/2024/january.md  
   ❌ Documents/Private/notes.md (need: Documents/Private/)
   ```

#### Issue: Mixed content not handled correctly
**Symptoms**: Entire files excluded when only sections should be

**Solutions**:
1. **Check redaction strategy**:
   - Current: "Exclude Entire File"
   - Change to: "Redact Private Sections"

2. **Use section-level privacy**:
   ```markdown
   # Meeting Notes
   
   ## Public Discussion
   Normal content here
   
   ## Private Notes #private
   This section will be redacted
   ```

3. **Test redaction markers**:
   ```markdown
   <!-- #private -->
   This content will be redacted
   <!-- /#private -->
   ```

#### Issue: Visual indicators not showing
**Symptoms**: No visual cues for private content

**Solutions**:
1. **Refresh Obsidian**: Restart the application
2. **Check CSS loading**: Look for console errors
3. **Verify plugin activation**: Ensure RetrospectAI is enabled
4. **Update indicators**: Toggle privacy settings to refresh

#### Issue: Audit log not working
**Symptoms**: No privacy actions logged

**Solutions**:
1. **Enable audit logging**: Check "Enable Audit Log" in settings
2. **Check file permissions**: Ensure plugin can write to log file
3. **Verify log location**: `.obsidian/plugins/rspai/privacy-audit.log`
4. **Test with simple case**: Create file with `#private` tag

### Debug Mode

**Enable debug logging**:
1. Settings → General → Debug Mode: ON
2. Open Developer Console (Ctrl+Shift+I)
3. Look for privacy-related log messages

**Sample debug output**:
```
[RetrospectAI] Privacy filter: Checking file personal-journal.md
[RetrospectAI] Privacy filter: Found tag #private in content
[RetrospectAI] Privacy filter: Excluding file due to privacy tag
[RetrospectAI] Privacy audit: Logged exclusion for personal-journal.md
```

### Getting Help

**Before reporting issues**:
1. ✅ Check this troubleshooting guide
2. ✅ Enable debug mode and check console
3. ✅ Test with simple example (file with `#private`)
4. ✅ Verify plugin is up to date

**When reporting issues, include**:
- Plugin version
- Obsidian version
- Operating system
- Privacy settings configuration
- Sample file that's not working
- Console error messages (if any)

---

## Best Practices

### Privacy Tag Strategy

#### Hierarchical Privacy Tags
```markdown
# Use specific tags for different privacy levels
- #private (general personal content)
- #confidential (sensitive business/work)
- #health (medical information)  
- #financial (money, investments, salary)
- #family (family-related private matters)
```

#### Contextual Privacy Tags
```markdown
# Combine privacy with context
- #work-confidential (work-related sensitive info)
- #personal-health (personal medical information)
- #draft-private (private draft content)
- #client-confidential (client-related confidential info)
```

### Folder Organization Strategy

#### Clear Hierarchy
```
vault/
├── Public/           ← All content analyzed
│   ├── Work/
│   ├── Learning/
│   └── Projects/
├── Private/          ← Completely excluded
│   ├── Journal/
│   ├── Health/
│   └── Financial/
└── Mixed/            ← Use section-level privacy
    ├── meeting-notes.md (with #private sections)
    └── project-logs.md (with #confidential sections)
```

#### Purpose-Based Folders
```
vault/
├── Work/
│   ├── Public/       ← Work content for analysis
│   └── Confidential/ ← Excluded work content
├── Personal/
│   ├── Learning/     ← Personal development content
│   └── Private/      ← Excluded personal content
└── Health/           ← Completely excluded folder
```

### Content Strategy

#### Mixed Content Best Practices
```markdown
# Use clear section headers with privacy tags
# Weekly Review

## Accomplishments
- Completed project milestone
- Presented to stakeholders

## Challenges #private
- Personal struggles with work-life balance
- Concerns about team dynamics

## Goals for Next Week  
- Finish documentation
- Schedule team meeting
```

#### Temporary Privacy
```markdown
# Use HTML comments for temporary privacy
# Project Planning

## Overview
Project goals and timeline

<!-- #private -->
## Budget Concerns
Need to discuss with finance team
Potential cost overruns in Q3
<!-- /#private -->

## Next Steps
Schedule stakeholder meeting
```

### Performance Optimization

#### Large Vault Strategies
1. **Use folder-based exclusions** for large private sections
2. **Enable caching** for repeated analysis
3. **Batch process** large numbers of files
4. **Regular cleanup** of privacy audit logs

#### Efficient Privacy Patterns
```markdown
# Efficient: Folder-based exclusion
Private/
├── journal-2024.md    ← Excluded via folder
├── health-records.md  ← Excluded via folder
└── financial-data.md  ← Excluded via folder

# Less efficient: Tag-based exclusion for many files
journal-2024.md #private     ← Individual tag check
health-records.md #private   ← Individual tag check  
financial-data.md #private   ← Individual tag check
```

### Security Best Practices

#### Defense in Depth
1. **Multiple privacy layers**: Use both tags and folders
2. **Regular audits**: Enable audit logging for compliance
3. **Test privacy**: Regularly verify exclusions work
4. **Backup privacy settings**: Document your privacy configuration

#### Compliance Considerations
```markdown
# For regulated industries:
1. Enable audit logging
2. Use "Exclude Entire File" strategy
3. Regular privacy audits
4. Document privacy procedures
5. Train team on privacy tags
```

### Team Collaboration

#### Shared Privacy Standards
```markdown
# Team privacy tag conventions
- #team-confidential (internal team discussions)
- #client-confidential (client-related sensitive info)
- #draft (work in progress, not ready for AI analysis)
- #personal (individual private content)
```

#### Privacy Documentation
```markdown
# Document team privacy practices
1. Create team privacy guide
2. Share privacy tag conventions  
3. Regular privacy training
4. Audit compliance together
```

---

## Summary

The RetrospectAI privacy filter system provides comprehensive protection for sensitive content through:

- ✅ **Automatic detection** via tags and folders
- ✅ **Flexible redaction strategies** for mixed content  
- ✅ **Visual indicators** for excluded content
- ✅ **Audit logging** for compliance
- ✅ **Performance optimization** for large vaults

**Key takeaways**:
1. Privacy protection is **enabled by default**
2. **Multiple protection layers** (tags, folders, sections)
3. **Flexible configuration** for different use cases
4. **Clear visual feedback** when privacy is active
5. **Comprehensive troubleshooting** support

For additional help, see:
- 📖 [Privacy Guide](privacy-guide.md) - Comprehensive privacy documentation
- 🔧 [Privacy Quick Reference](privacy-quick-reference.md) - Quick syntax guide
- ❓ [Privacy Protection Features](privacy-protection-features.md) - Technical details 