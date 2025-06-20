# Privacy Quick Reference

## Privacy Tags
Add anywhere in a file to exclude it entirely:
- `#private`
- `#noai` 
- `#confidential`

## Excluded Folders
Files in these folders are automatically excluded:
- `Private/`
- `Confidential/`
- `.private/`

## Section Privacy

### Heading Privacy
```markdown
## Sensitive Section #private
Content here will be redacted
```

### Block Privacy (HTML Comments)
```markdown
<!-- #private -->
Private content here
<!-- /#private -->
```

### Block Privacy (Markdown)
```markdown
#private start
Private content here
#private end
```

### Paragraph Privacy
```markdown
This paragraph contains sensitive info. #private
```

## Quick Examples

**File exclusion:**
```markdown
# Meeting Notes #private
Everything in this file is private
```

**Mixed content:**
```markdown
# Project Update

## Progress
We completed phase 1 successfully.

## Budget Details #confidential
Spent $50,000 of $100,000 budget.

## Next Steps  
Continue with phase 2 planning.
```

**Temporary privacy:**
```markdown
# Draft Proposal

<!-- #private -->
TODO: Need to verify these numbers with finance
Cost estimate might be too high
<!-- /#private -->

## Executive Summary
This proposal outlines our new initiative...
```

---
📖 **[Full Privacy Guide](privacy-guide.md)** | 🔧 **[Setup Guide](privacy-setup-guide.md)** | ❓ **[Troubleshooting & FAQ](privacy-troubleshooting-faq.md)** | 🛡️ **[Privacy Features](privacy-protection-features.md)**