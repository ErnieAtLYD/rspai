# RetrospectAI Sample Dataset

This directory contains a comprehensive sample dataset for testing the RetrospectAI Obsidian plugin. The dataset is designed to validate all privacy protection features and provide realistic content for AI analysis development.

## 📁 Dataset Structure

### Daily Notes (`daily-notes/`)
**Purpose**: Simulate regular journaling with mixed content types
- `2024-01-15.md` - Basic daily note with privacy sections
- `2024-01-16.md` - Advanced formatting with Obsidian features

**Privacy Testing**:
- ✅ Section-level redaction (`### Meeting Notes #private`)
- ✅ Task-level privacy (`- [ ] Review investment portfolio #private`)
- ✅ Mixed public/private content

### Weekly Reviews (`weekly-reviews/`)
**Purpose**: Structured reflection and goal tracking
- `2024-W03.md` - Comprehensive weekly review with metrics

**Privacy Testing**:
- ✅ Public content (goals, achievements, metrics)
- ✅ No privacy markers (should remain unfiltered)

### Project Logs (`project-logs/`)
**Purpose**: Technical project documentation and progress tracking
- `Mobile App Development.md` - Detailed project log with budget info

**Privacy Testing**:
- ✅ Section-level privacy (`## Budget Tracking #private`)
- ✅ Mixed technical and confidential content
- ✅ Structured data (tables, code blocks)

### Meeting Notes (`meeting-notes/`)
**Purpose**: Professional meeting documentation
- `Team Standup - 2024-01-17.md` - Team meeting with private notes

**Privacy Testing**:
- ✅ HTML comment markers (`<!-- #private -->...<!-- /#private -->`)
- ✅ Mixed team and confidential information

### Learning Notes (`learning-notes/`)
**Purpose**: Educational content and personal development
- `TypeScript Advanced Patterns.md` - Technical learning with personal thoughts

**Privacy Testing**:
- ✅ Section-level privacy (`### Challenges #private`)
- ✅ Technical content with personal reflections

### Private Folder (`Private/`)
**Purpose**: Test folder-based exclusion
- `personal-finances.md` - Complete financial information

**Privacy Testing**:
- ✅ Folder-based exclusion (entire file should be excluded)
- ✅ Multiple privacy tags (`#private #confidential`)

### Confidential Folder (`Confidential/`)
**Purpose**: Test case-sensitive folder exclusion
- `salary-negotiation.md` - Sensitive workplace information

**Privacy Testing**:
- ✅ Folder-based exclusion (entire file should be excluded)
- ✅ Alternative privacy tag (`#noai`)

## 🛡️ Privacy Protection Test Scenarios

### 1. File-Level Exclusion
**Files**: `Private/personal-finances.md`, `Confidential/salary-negotiation.md`
**Expected**: Complete file exclusion from analysis
**Triggers**: 
- Folder location (`Private/`, `Confidential/`)
- Privacy tags (`#private`, `#confidential`, `#noai`)

### 2. Section-Level Redaction
**Files**: Multiple files with `#private` sections
**Expected**: Only private sections replaced with `[REDACTED]`
**Examples**:
- `### Meeting Notes #private` → `### [REDACTED]`
- `## Budget Tracking #private` → `## [REDACTED]`

### 3. Content Between Markers
**Files**: `meeting-notes/Team Standup - 2024-01-17.md`
**Expected**: Content between HTML comments redacted
**Pattern**: `<!-- #private -->...<!-- /#private -->`

### 4. Mixed Content Handling
**Files**: All files except those in excluded folders
**Expected**: Public content preserved, private content redacted
**Validation**: Verify no privacy tags remain in filtered content

### 5. Task-Level Privacy
**Files**: `daily-notes/2024-01-15.md`
**Expected**: Individual tasks with privacy tags redacted
**Example**: `- [ ] Review investment portfolio #private` → `- [ ] [REDACTED]`

## 📊 Content Statistics

| Category | Files | Total Size | Privacy Markers | Excluded Folders |
|----------|-------|------------|-----------------|------------------|
| Daily Notes | 2 | ~4KB | 3 sections | 0 |
| Weekly Reviews | 1 | ~3KB | 0 sections | 0 |
| Project Logs | 1 | ~5KB | 1 section | 0 |
| Meeting Notes | 1 | ~4KB | 1 section | 0 |
| Learning Notes | 1 | ~6KB | 1 section | 0 |
| Private | 1 | ~4KB | Multiple tags | 1 folder |
| Confidential | 1 | ~5KB | 1 tag | 1 folder |
| **Total** | **8** | **~31KB** | **6+ markers** | **2 folders** |

## 🧪 Testing Instructions

### Manual Testing
1. Copy this entire `sample-data/` directory to your Obsidian vault
2. Run the RetrospectAI plugin with privacy protection enabled
3. Verify the following outcomes:

### Expected Results

#### ✅ Files That Should Be Completely Excluded
- `Private/personal-finances.md` (folder + tags)
- `Confidential/salary-negotiation.md` (folder + tag)

#### ✅ Files That Should Be Partially Filtered
- `daily-notes/2024-01-15.md` (2 private sections)
- `daily-notes/2024-01-16.md` (1 private section)
- `project-logs/Mobile App Development.md` (1 private section)
- `meeting-notes/Team Standup - 2024-01-17.md` (1 private section)
- `learning-notes/TypeScript Advanced Patterns.md` (1 private section)

#### ✅ Files That Should Remain Unchanged
- `weekly-reviews/2024-W03.md` (no privacy markers)

### Verification Checklist
- [ ] No privacy tags (`#private`, `#confidential`, `#noai`) in filtered content
- [ ] Private sections replaced with `[REDACTED]` placeholder
- [ ] Public content preserved and readable
- [ ] File structure and formatting maintained
- [ ] Excluded files not present in analysis results

## 🔧 Customization

### Adding More Test Cases
To expand the dataset:
1. Create new files following the naming convention
2. Include various privacy marker combinations
3. Test edge cases (empty sections, nested privacy, etc.)

### Privacy Settings Testing
Test different privacy configurations:
- Modify excluded folders list
- Change privacy tags
- Toggle section redaction on/off
- Test case sensitivity settings

## 📝 Notes

- All financial and personal information is **fictional**
- Names and companies are **made up** for testing purposes
- Content is designed to be **realistic but not real**
- Dataset covers **common journaling patterns** in Obsidian

---
**Dataset Version**: 1.0  
**Last Updated**: January 2024  
**Compatible With**: RetrospectAI v1.0+ 