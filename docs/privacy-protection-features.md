# Privacy Protection Features Documentation

## Overview

The RetrospectAI plugin takes privacy seriously and includes comprehensive privacy protection features that automatically detect and respect sensitive content. This document explains how these features work, how to configure them, and how they protect your data.

## Table of Contents

- [Privacy Protection Philosophy](#privacy-protection-philosophy)
- [Automatic Privacy Detection](#automatic-privacy-detection)
- [Privacy Indicators](#privacy-indicators)
- [Configuration Options](#configuration-options)
- [How Privacy Protection Works](#how-privacy-protection-works)
- [Privacy Levels](#privacy-levels)
- [User Control](#user-control)
- [Technical Implementation](#technical-implementation)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Privacy Protection Philosophy

### Core Principles

1. **Privacy by Default**: Privacy protection is enabled by default
2. **Automatic Detection**: No manual configuration required for basic protection
3. **Graceful Degradation**: Full functionality maintained even when AI is disabled
4. **User Control**: Users can override protection when appropriate
5. **Transparent Operation**: Clear indicators when privacy protection is active

### What Gets Protected

- **Personal Information**: Financial data, health information, personal relationships
- **Confidential Content**: Work-related sensitive information, legal documents
- **Private Thoughts**: Personal journals, private reflections
- **Sensitive Discussions**: Private conversations, confidential meetings

## Automatic Privacy Detection

The plugin automatically detects private content through multiple methods:

### 1. Tag-Based Detection

The system recognizes these privacy tags and automatically disables AI analysis:

#### Primary Privacy Tags
- `#private` - General private content
- `#noai` - Explicitly disable AI analysis
- `#confidential` - Confidential business/personal information
- `#personal` - Personal information and thoughts
- `#sensitive` - Sensitive content requiring protection

#### Extended Privacy Tags
- `#health` - Health-related information
- `#financial` - Financial data and information
- `#legal` - Legal documents and discussions
- `#family` - Family-related private content
- `#relationship` - Personal relationship information

**Example:**
```markdown
# My Personal Journal Entry #private #personal

Today I had a difficult conversation with my manager about...
```
*Result: AI analysis automatically disabled*

### 2. Folder-Based Detection

Content in these folder names automatically triggers privacy protection:

#### Recognized Private Folders
- `Private/`
- `Confidential/`
- `Personal/`
- `Sensitive/`
- `Health/`
- `Financial/`
- `Legal/`
- `Family/`
- `Relationships/`

#### Case-Insensitive Matching
- Works with any capitalization: `private/`, `PRIVATE/`, `Private/`
- Supports subfolders: `Documents/Private/`, `Work/Confidential/`

**Example:**
```
vault/
├── Public Notes/
├── Work/
│   └── Confidential/     ← AI disabled for all content here
│       └── salary-negotiation.md
└── Private/              ← AI disabled for all content here
    └── personal-thoughts.md
```

### 3. Content-Level Detection

The privacy filter scans content for sensitive patterns:

#### Financial Information
- Credit card numbers (partial detection)
- Bank account references
- Salary and compensation discussions
- Investment information

#### Personal Identifiers
- Social security number patterns
- Phone number patterns
- Email addresses in sensitive contexts
- Home addresses

#### Health Information
- Medical conditions and treatments
- Mental health discussions
- Health insurance information
- Medical appointment details

#### Relationship Information
- Intimate personal relationships
- Family conflicts or issues
- Private conversations
- Personal emotional content

**Example:**
```markdown
# Meeting Notes

Discussed the new project timeline and budget allocation of $50,000.
My personal salary increase to $75,000 was also approved.
```
*Result: AI analysis disabled due to financial information detection*

## Privacy Indicators

### When Privacy Protection is Active

Users receive clear indicators when privacy protection is engaged:

#### 1. Summary Notice
```markdown
## Privacy Notice
AI insights have been disabled for this note due to privacy settings.
Basic structural analysis and formatting are still available.
```

#### 2. Console Logging
```
[RetrospectAI] Privacy protection: Disabling AI insights for file: private-journal.md
[RetrospectAI] Reason: Privacy tag detected (#private)
```

#### 3. Reduced Feature Set
- Executive Summary: Not generated
- Key Insights: Not generated
- AI Pattern Analysis: Not generated
- AI Recommendations: Not generated
- Connection Opportunities: Basic version only

### What's Still Available

Even with privacy protection active, users still receive:

- **Content Structure Analysis**: Headings, sections, formatting
- **Basic Statistics**: Word count, reading time, structure complexity
- **Tag and Link Analysis**: Non-AI based link detection
- **Basic Pattern Detection**: Rule-based pattern recognition
- **Formatted Output**: Professional summary formatting
- **Metadata Processing**: File information and timestamps

## Configuration Options

### Plugin Settings

Access via: Settings → Community Plugins → RetrospectAI → Settings

#### Primary Privacy Setting

**Respect Privacy in Summaries**
- **Default**: Enabled (recommended)
- **Description**: Automatically disable AI insights for private content
- **Impact**: When disabled, AI analysis runs on all content regardless of privacy tags

#### Writing Style Impact

Privacy protection works with all writing styles:
- **Personal Style**: Falls back to structural analysis with encouraging tone
- **Business Style**: Provides professional structural summary
- **Academic Style**: Delivers objective content analysis

### Advanced Configuration

For enterprise or advanced users:

#### Custom Privacy Tags
```typescript
// Configuration option for custom privacy tags
customPrivacyTags: [
  '#internal',
  '#restricted',
  '#classified'
]
```

#### Folder Pattern Customization
```typescript
// Configuration for custom private folder patterns
privatefolderPatterns: [
  'confidential',
  'restricted',
  'internal-only'
]
```

#### Content Detection Sensitivity
```typescript
// Adjust sensitivity of content-level detection
privacyDetectionSensitivity: 'high' | 'medium' | 'low'
```

## How Privacy Protection Works

### Detection Process Flow

1. **File-Level Check**: Scan for privacy tags in frontmatter and content
2. **Folder-Level Check**: Check if file path contains private folder names
3. **Content-Level Check**: Scan content for sensitive information patterns
4. **Decision Matrix**: Determine if AI should be disabled
5. **Graceful Fallback**: Provide structural analysis if AI is disabled

### Decision Matrix

| Detection Type | Privacy Tag | Private Folder | Sensitive Content | AI Enabled |
|---------------|-------------|----------------|-------------------|------------|
| None | ❌ | ❌ | ❌ | ✅ |
| Tag Only | ✅ | ❌ | ❌ | ❌ |
| Folder Only | ❌ | ✅ | ❌ | ❌ |
| Content Only | ❌ | ❌ | ✅ | ❌ |
| Multiple | ✅ | ✅ | ✅ | ❌ |

### Error Handling

The system implements fail-safe privacy protection:

```typescript
try {
  const isPrivate = await this.privacyFilter.isFilePrivate(file);
  const hasPrivateContent = await this.privacyFilter.hasPrivateContent(content);
  return !(isPrivate || hasPrivateContent);
} catch (error) {
  console.error("Privacy check failed, defaulting to privacy protection");
  return false; // Fail-safe: disable AI if privacy check fails
}
```

## Privacy Levels

### Level 1: Basic Protection (Default)
- Tag-based detection
- Common folder patterns
- Basic content scanning
- Suitable for most users

### Level 2: Enhanced Protection
- Extended tag recognition
- Custom folder patterns
- Advanced content analysis
- Recommended for sensitive work

### Level 3: Maximum Protection
- All detection methods active
- Custom privacy rules
- Content encryption support
- Enterprise-grade protection

## User Control

### Overriding Privacy Protection

Users can override privacy protection when appropriate:

#### 1. Global Override
- Disable "Respect Privacy in Summaries" in settings
- AI analysis will run on all content
- Use with caution

#### 2. Per-File Override
- Remove privacy tags from specific files
- Move files out of private folders
- Temporary override for specific analysis

#### 3. Selective Privacy
- Use privacy tags selectively
- Organize content with folder structure
- Granular control over what gets AI analysis

### Privacy Audit

Users can review privacy decisions:

#### Log Review
```
[Privacy] File: journal-entry.md - Status: Protected (Tag: #private)
[Privacy] File: work-notes.md - Status: Analyzed (No privacy markers)
[Privacy] File: financial-plan.md - Status: Protected (Content: financial data)
```

#### Privacy Report
- Summary of protected vs. analyzed files
- Breakdown by protection reason
- Recommendations for privacy optimization

## Technical Implementation

### Privacy Filter Architecture

```typescript
class PrivacyFilter {
  async isFilePrivate(filePath: string): Promise<boolean> {
    // Check file tags and folder structure
  }
  
  async hasPrivateContent(content: string): Promise<boolean> {
    // Scan content for sensitive patterns
  }
  
  private checkPrivacyTags(tags: string[]): boolean {
    // Validate against known privacy tags
  }
  
  private checkFolderPath(path: string): boolean {
    // Check for private folder patterns
  }
  
  private scanContentPatterns(content: string): boolean {
    // Pattern matching for sensitive content
  }
}
```

### Integration Points

#### With Summary Note Creator
```typescript
const shouldUseAI = await this.shouldEnableAIForFile(originalFile, options);

if (options.enableAIInsights && !shouldUseAI) {
  this.logger.info(`Privacy protection: Disabling AI insights for file: ${originalFile.path}`);
  options.enableAIInsights = false;
}
```

#### With AI Services
```typescript
if (this.privacyFilter && await this.privacyFilter.isFilePrivate(file)) {
  return this.generateBasicSummary(content);
} else {
  return this.generateAIEnhancedSummary(content);
}
```

## Best Practices

### For Users

1. **Use Privacy Tags Consistently**: Apply `#private` to sensitive content
2. **Organize with Folders**: Use "Private" folders for sensitive documents
3. **Review Settings Regularly**: Ensure privacy settings match your needs
4. **Audit Privacy Decisions**: Check logs to verify protection is working
5. **Educate Team Members**: Ensure all users understand privacy features

### For Administrators

1. **Default to Privacy**: Keep privacy protection enabled by default
2. **Train Users**: Educate on proper privacy tag usage
3. **Monitor Usage**: Review privacy logs for compliance
4. **Custom Configuration**: Set up custom tags and patterns for organization
5. **Regular Updates**: Keep privacy detection patterns updated

### For Developers

1. **Fail-Safe Design**: Always err on the side of privacy protection
2. **Clear Logging**: Provide detailed logs for privacy decisions
3. **User Feedback**: Give clear indicators when privacy protection is active
4. **Performance**: Ensure privacy checks don't impact performance
5. **Testing**: Thoroughly test privacy detection with various content types

## Troubleshooting

### Common Issues

#### Privacy Protection Not Working
- **Check Settings**: Ensure "Respect Privacy in Summaries" is enabled
- **Verify Tags**: Confirm privacy tags are properly formatted
- **Test Content**: Try with known private content patterns
- **Check Logs**: Review console for privacy-related messages

#### AI Disabled Unexpectedly
- **Review Content**: Check for unintended privacy triggers
- **Check Folder Structure**: Verify file isn't in private folder
- **Tag Review**: Look for privacy tags in frontmatter
- **Content Patterns**: Check for sensitive information patterns

#### Inconsistent Behavior
- **Cache Issues**: Restart Obsidian to clear caches
- **Plugin Conflicts**: Disable other plugins temporarily
- **Settings Sync**: Verify settings are properly saved
- **File Permissions**: Check file system permissions

### Debugging Steps

1. **Enable Debug Logging**: Turn on verbose logging in settings
2. **Test with Simple Content**: Create test files with known privacy markers
3. **Check Privacy Filter**: Verify privacy filter is properly initialized
4. **Review Decision Logic**: Check console logs for privacy decisions
5. **Contact Support**: Provide logs when reporting issues

### Privacy Validation

To verify privacy protection is working:

1. Create a test note with `#private` tag
2. Run summary creation
3. Verify AI insights are disabled
4. Check console logs for privacy messages
5. Confirm basic analysis is still available

---

This privacy protection system ensures that your sensitive information remains protected while still providing valuable analysis capabilities. The multi-layered approach with automatic detection, clear indicators, and user control provides comprehensive privacy protection suitable for both personal and professional use. 