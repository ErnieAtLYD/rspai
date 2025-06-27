# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Retrospect AI**, an Obsidian plugin that creates AI-powered weekly journal summaries. The plugin analyzes journal entries from the past week and generates thoughtful reflections using OpenAI's API.

## Common Development Commands

### Build and Development
- `npm run dev` - Start development build with watch mode
- `npm run build` - Build for production (includes TypeScript check)
- `npm run version` - Bump version and update manifest files

### Testing
- `npm test` - Run Jest tests
- Tests are configured to run from `src/` and `tests/` directories
- Uses ts-jest for TypeScript support
- Includes mock for Obsidian API in `tests/mocks/obsidian.js`

### Type Checking
- `tsc -noEmit -skipLibCheck` - Type check without emitting files (part of build process)

## Architecture Overview

### Core Components

**Main Plugin Class** (`src/main.ts`)
- Extends Obsidian's `Plugin` class
- Handles plugin lifecycle, settings, and core functionality
- Single-file architecture (~850 lines) for simplicity

**Key Features:**
- **Weekly Summary Generation**: Scans recent notes, filters private content, sends to OpenAI
- **Settings Management**: Configurable OpenAI API key, model selection, date ranges
- **Privacy Protection**: Automatically excludes notes with `#private` tag
- **Smart File Discovery**: Searches configured periodic note folders or falls back to vault-wide search

### Settings System

**Settings Interface** (`JournalReflectionSettings`)
- `openaiApiKey`: User's OpenAI API key
- `openaiModel`: Selected OpenAI model (default: gpt-4o-mini)
- `daysToInclude`: Number of days to look back (default: 7)
- `excludePrivate`: Whether to skip #private tagged notes
- `periodicNoteFolders`: Array of folder paths to search for journal entries
- `reflectionFolder`: Where to save generated summaries

**Settings Migration**: Handles migration from old `journalFolder` string to new `periodicNoteFolders` array

### File Operations

**Note Discovery Strategy:**
1. First tries to find files in configured `periodicNoteFolders`
2. Falls back to vault-wide search if no folders configured or no files found
3. Applies date filtering based on `daysToInclude` setting

**Privacy Filtering:**
- Scans note content for `#private` tag
- Skips entire notes containing this tag when building summary content

### OpenAI Integration

**API Configuration:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Default model: `gpt-4o-mini`
- Max tokens: 1000
- Temperature: 0.7

**Prompt Structure:**
- Focuses on themes, emotional journey, insights, and future reflection areas
- Encourages supportive, wise friend tone
- Includes all filtered note content for comprehensive analysis

## Development Guidelines

### Code Style (from cursor rules)
- Use 4-space indentation
- Prefer explicit return types for functions
- Use meaningful variable and function names
- Follow camelCase for variables, PascalCase for classes
- Always implement proper cleanup in `onunload()`

### Obsidian Plugin Best Practices
- Always use `this.registerEvent()` for event listeners
- Use `this.app.vault` for file operations
- Check file existence before operations using `this.app.vault.adapter.exists()`
- Handle errors gracefully with try/catch blocks
- Provide user feedback via `Notice` class

### Settings Development
- Validate settings before saving in `validateSettings()`
- Use `Object.assign()` pattern for loading settings with defaults
- Save settings immediately on user changes
- Implement migration logic for breaking changes

### Error Handling Patterns
- Wrap risky operations in try/catch
- Log detailed errors to console
- Provide user-friendly error messages via Notice
- Don't let errors crash the plugin

## File Structure

```
src/
├── main.ts                 # Single main file containing all functionality
├── (no other source files - intentionally simple)

tests/
├── setup.ts               # Test setup configuration
├── mocks/obsidian.js      # Mock Obsidian API for testing

root/
├── manifest.json          # Plugin manifest
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Jest test configuration
├── esbuild.config.mjs    # Build configuration
└── styles.css            # Plugin styles
```

## Testing Strategy

- Uses Jest with ts-jest for TypeScript support
- Mocks Obsidian API for unit testing
- Test timeout set to 30 seconds for potential AI integration tests
- Coverage reporting configured for src/ directory

## Build Process

**Development:** Uses esbuild with watch mode, inline sourcemaps
**Production:** Minified build with tree shaking, no sourcemaps
**TypeScript:** Strict type checking with skipLibCheck for faster builds

## Key Dependencies

- **obsidian**: Core Obsidian API
- **moment**: Date/time handling
- **esbuild**: Fast bundling and development
- **typescript**: Type checking
- **jest + ts-jest**: Testing framework

## Plugin Distribution

- Builds to `main.js` in root directory
- `manifest.json` defines plugin metadata
- `versions.json` tracks version history
- Uses semantic versioning via `version-bump.mjs`

## Security Considerations

- API keys stored in plugin settings (encrypted by Obsidian)
- Privacy filtering prevents accidental sharing of sensitive notes
- No data persistence beyond OpenAI API calls
- Validates folder paths to prevent directory traversal

## Performance Notes

- Lightweight codebase (~200 lines of core logic)
- Efficient file discovery with folder-first strategy
- Minimal DOM manipulation and memory usage
- Proper cleanup of event listeners and resources