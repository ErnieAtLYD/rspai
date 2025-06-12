# Privacy Guide for RetrospectAI

RetrospectAI respects your privacy and provides multiple ways to exclude sensitive content from AI analysis. This guide explains how to mark content as private and control what gets analyzed.

## Quick Start

To make content private from AI analysis, you can use any of these privacy tags:
- `#private` - General privacy marker
- `#noai` - Explicitly exclude from AI
- `#confidential` - Mark as confidential

## Privacy Methods

### 1. File-Level Privacy

#### Using Privacy Tags
Add any privacy tag anywhere in your file to exclude the entire file from AI analysis:

```markdown
# My Meeting Notes #private

Today we discussed sensitive company information...
```

#### Using Excluded Folders
Place files in these folders to automatically exclude them:
- `Private/` - General private folder
- `Confidential/` - Confidential documents
- `.private/` - Hidden private folder

Example:
```
vault/
├── Private/
│   ├── personal-journal.md     ← Excluded
│   └── salary-negotiations.md  ← Excluded
├── Work/
│   └── project-notes.md        ← Included
```

### 2. Section-Level Privacy

#### Privacy Tags in Headings
Mark entire sections as private by adding privacy tags to headings:

```markdown
# Project Overview
This section will be analyzed by AI.

## Sensitive Details #private
This entire section and all subsections will be redacted.

### Subsection
This content is also redacted because it's under a private heading.

## Public Information
This section will be analyzed normally.
```

**Result after privacy filtering:**
```markdown
# Project Overview
This section will be analyzed by AI.

## [REDACTED]

## Public Information
This section will be analyzed normally.
```

#### Privacy Markers
Use explicit start/end markers to redact specific content blocks:

**HTML Comment Style:**
```markdown
# Meeting Notes

## Attendees
- John Smith
- Jane Doe

<!-- #private -->
## Salary Discussion
John's current salary: $85,000
Proposed increase: $95,000
<!-- /#private -->

## Action Items
- Follow up on project timeline
```

**Markdown Style:**
```markdown
# Project Planning

## Timeline
Q1: Research phase

#private start
## Budget Information
Total budget: $500,000
Allocated to salaries: $300,000
#private end

## Next Steps
Schedule team meeting
```

#### Paragraph-Level Privacy
Mark individual paragraphs as private:

```markdown
# Daily Journal

Had a great day at work today. The team is making good progress.

Personal note about my relationship issues. #private
This paragraph will be redacted from AI analysis.

Back to work topics - need to finish the quarterly report.
```

## Privacy Settings

### Default Excluded Folders
By default, these folders are excluded from AI analysis:
- `Private/`
- `Confidential/`
- `.private/`

### Case Sensitivity
- **Default**: Folder names are case-insensitive (`private/` = `Private/`)
- **Linux users**: Can enable case-sensitive folder matching in settings

### Redaction Placeholder
Private content is replaced with `[REDACTED]` by default. This can be customized in plugin settings.

## Privacy Verification

### How to Check Privacy Protection
1. **File Exclusion**: Files with privacy tags or in excluded folders won't appear in AI analysis results
2. **Section Redaction**: Private sections show as `[REDACTED]` in processed content
3. **Privacy Log**: Check plugin console logs for privacy actions taken

### Privacy Audit
The plugin maintains a privacy audit log showing:
- Which files were excluded
- Which sections were redacted
- Folder-based exclusions
- Timestamp of all privacy actions

## Best Practices

### 1. Choose Your Privacy Level
- **File-level**: Use when entire document is sensitive
- **Section-level**: Use when only parts of document are sensitive
- **Folder-level**: Use for organizing private documents

### 2. Consistent Tagging
- Use the same privacy tags consistently (`#private` is recommended)
- Place tags where they're easily visible
- Consider using multiple tags for different sensitivity levels

### 3. Folder Organization
```
vault/
├── Private/           ← Personal, sensitive content
├── Confidential/      ← Work confidential content  
├── .private/          ← Hidden sensitive content
├── Work/              ← General work content (analyzed)
└── Personal/          ← General personal content (analyzed)
```

### 4. Section Markers
- Use HTML comments for content that should remain readable
- Use markdown markers for temporary privacy during drafting
- Place markers on separate lines for clarity

## Examples

### Example 1: Mixed Content Document
```markdown
# Weekly Review #noai

## Accomplishments
- Completed project milestone
- Attended team meeting

## Personal Reflection #private
Had some difficult conversations with my manager about...

## Goals for Next Week
- Finish documentation
- Prepare presentation
```

### Example 2: Temporary Privacy
```markdown
# Project Proposal

## Overview
This is a new initiative to improve our customer service.

<!-- #private -->
## Internal Notes
Need to discuss budget constraints with Sarah.
Marketing team concerns about timeline.
<!-- /#private -->

## Implementation Plan
Phase 1: Research and planning
Phase 2: Development
```

### Example 3: Folder-Based Privacy
```
vault/
├── Private/
│   ├── personal-goals.md      ← Never analyzed
│   └── family-notes.md        ← Never analyzed
├── Work/
│   ├── meeting-notes.md       ← Analyzed (unless tagged)
│   └── project-ideas.md       ← Analyzed (unless tagged)
```

## Troubleshooting

### Privacy Not Working?
1. **Check spelling**: Ensure privacy tags are spelled correctly
2. **Check placement**: Tags should be on their own or at end of lines
3. **Check folders**: Verify folder names match excluded list
4. **Check settings**: Confirm privacy features are enabled

### Content Still Visible?
1. **Rebuild analysis**: Privacy is applied during analysis, not display
2. **Check logs**: Look for privacy actions in plugin console
3. **Verify syntax**: Ensure markers are properly formatted

### Need Help?
- Check plugin console logs for privacy actions
- Review this guide for proper syntax
- Report issues on the plugin's GitHub repository

## Security Notes

- Privacy filtering happens **before** content is sent to AI services
- No private content is logged or transmitted
- Privacy actions are logged for audit purposes (without exposing content)
- All privacy processing happens locally in Obsidian

---

*Your privacy is important. This system is designed to give you complete control over what content is shared with AI services.* 