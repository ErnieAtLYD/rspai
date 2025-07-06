# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Retrospect AI**, an Obsidian plugin that creates AI-powered weekly journal summaries. The plugin analyzes journal entries from the past week and generates thoughtful reflections using OpenAI's API.

## Architectural Evolution

### From Single-File to Service-Based Architecture

**Original Approach:** This plugin initially used a single-file architecture (`main.ts`) for simplicity and rapid development. This approach worked well for the core functionality of scanning notes and generating AI summaries.

**Drivers for Change:** The introduction of AES-256 encryption for API key storage introduced several complexities that made the single-file approach unsustainable:

1. **Security Requirements**: Encryption functionality requires careful separation of concerns, secure key management, and proper lifecycle handling
2. **Testing Complexity**: Cryptographic operations need isolated unit testing with proper mocking strategies
3. **Code Maintainability**: The encryption feature alone added ~600 lines of code, making the single file unwieldy
4. **Dependency Management**: Encryption service needs to interact with settings, UI components, and the main plugin in complex ways

**Why Service-Based Architecture:** The move to a service-based architecture was driven by specific needs:

- **Security Isolation**: EncryptionService can be tested independently and has clear boundaries for sensitive operations
- **Dependency Injection**: Services can be mocked for testing without affecting the entire plugin
- **Modularity**: Each service has a single responsibility (AI operations, file operations, encryption)
- **Lifecycle Management**: Services can be initialized, configured, and disposed of independently
- **Future Extensibility**: New features can be added as services without modifying existing code

**Justification for Complexity:** While this architecture adds complexity, it provides critical benefits:

- **Security**: Encryption operations are isolated and can be thoroughly tested
- **Testability**: Each service can be unit tested with proper mocking
- **Maintainability**: Code is organized by functionality rather than bundled together
- **Reliability**: Clear service boundaries reduce the risk of side effects
- **Scalability**: New features can be added without increasing technical debt

The added complexity is justified by the security-critical nature of the encryption feature and the need for a robust, testable foundation for future development.

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

*See [Architectural Evolution](#architectural-evolution) for the rationale behind adopting a service-based architecture.*

### Core Components

**Main Plugin Class** (`src/main.ts`)
- Extends Obsidian's `Plugin` class
- Handles plugin lifecycle, settings, and UI coordination
- Uses service-based architecture for modularity and maintainability
- Manages service registration, initialization, and configuration updates

**Service Architecture** (`src/services/`)
- **ServiceManager**: Dependency injection container for managing services
- **BaseService**: Abstract base class providing common service functionality
- **AIService**: Handles OpenAI API interactions and prompt generation
- **FileOperationsService**: Manages file discovery, content extraction, and summary creation
- **EncryptionService**: Provides AES-256 encryption for secure API key storage

**User Interface** (`src/modals.ts`)
- **MasterPasswordModal**: Prompts for master password to decrypt API keys
- **EncryptionSetupModal**: Guides users through encryption setup process
- **EncryptionManagementModal**: Manages encryption settings and testing

**Key Features:**
- **Weekly Summary Generation**: Scans recent notes, filters private content, sends to OpenAI
- **Settings Management**: Configurable OpenAI API key, model selection, date ranges
- **Privacy Protection**: Automatically excludes notes with `#private` tag
- **Smart File Discovery**: Searches configured periodic note folders or falls back to vault-wide search
- **Encrypted Storage**: Optional AES-256 encryption for API keys with master password protection

### Service-Based Architecture

**ServiceManager** (`src/services/ServiceManager.ts`)
- Dependency injection container with lifecycle management
- Service registration with factory functions and dependency resolution
- Singleton pattern support for stateful services
- Proper cleanup and disposal of services

**Service Lifecycle:**
1. **Registration**: Services register with factory functions and dependencies
2. **Initialization**: Services initialize in dependency order
3. **Configuration**: Services can be reconfigured when settings change
4. **Disposal**: Services properly clean up resources on plugin unload

**Service Communication:**
- Services communicate through well-defined interfaces
- Main plugin coordinates between services
- Configuration changes propagate to all affected services

### Settings System

**Settings Interface** (`JournalReflectionSettings`)
- `openaiApiKey`: User's OpenAI API key (string or encrypted data)
- `openaiModel`: Selected OpenAI model (default: gpt-4o-mini)
- `daysToInclude`: Number of days to look back (default: 7)
- `excludePrivate`: Whether to skip #private tagged notes
- `periodicNoteFolders`: Array of folder paths to search for journal entries
- `reflectionFolder`: Where to save generated summaries
- `encryptionEnabled`: Whether API key encryption is enabled
- `encryptionSetup`: Whether encryption has been set up

**Settings Migration**: Handles migration from old `journalFolder` string to new `periodicNoteFolders` array

**Encryption Features:**
- Optional AES-256 encryption for API key storage
- Master password protection with validation
- Graceful fallback to plain text storage
- Encryption management UI for setup and testing

### File Operations Service

**Note Discovery Strategy:**
1. First tries to find files in configured `periodicNoteFolders`
2. Falls back to vault-wide search if no folders configured or no files found
3. Applies date filtering based on `daysToInclude` setting

**Privacy Filtering:**
- Scans note content for `#private` tag
- Skips entire notes containing this tag when building summary content

**Content Processing:**
- Extracts and combines content from multiple notes
- Handles file metadata and creation timestamps
- Creates backlinks to source notes in summaries

### AI Service

**API Configuration:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Default model: `gpt-4o-mini`
- Max tokens: 1000
- Temperature: 0.7

**Prompt Structure:**
- Focuses on themes, emotional journey, insights, and future reflection areas
- Encourages supportive, wise friend tone
- Includes all filtered note content for comprehensive analysis

**Error Handling:**
- Robust error handling for API failures
- User-friendly error messages
- Fallback strategies for network issues

### Encryption Service

**Security Features:**
- AES-256-GCM encryption for API key storage
- PBKDF2 key derivation with 100,000 iterations
- Cryptographically secure random salt generation
- Password strength validation

**Encryption Process:**
1. User provides master password and API key
2. Password is validated for strength requirements
3. Salt is generated and key is derived using PBKDF2
4. API key is encrypted using AES-256-GCM
5. Encrypted data includes salt, IV, and authentication tag

**Security Considerations:**
- Master password is never stored permanently
- Encryption keys are derived fresh each time
- Secure random number generation for cryptographic values
- Proper memory handling for sensitive data

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
├── main.ts                 # Main plugin class with service coordination
├── modals.ts              # User interface modals for encryption management
└── services/
    ├── index.ts           # Service exports
    ├── ServiceManager.ts  # Dependency injection container
    ├── BaseService.ts     # Abstract base service class
    ├── AIService.ts       # OpenAI API integration
    ├── FileOperationsService.ts # File discovery and processing
    └── EncryptionService.ts # AES-256 encryption implementation

tests/
├── setup.ts               # Test setup configuration
├── mocks/obsidian.js      # Mock Obsidian API for testing

archive/
├── (legacy files)         # Previous single-file architecture versions

root/
├── manifest.json          # Plugin manifest
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Jest test configuration
├── esbuild.config.mjs    # Build configuration
├── styles.css            # Plugin styles
└── styles/
    └── styles.css         # Additional styling
```

## Testing Strategy

- Uses Jest with ts-jest for TypeScript support
- Mocks Obsidian API for unit testing
- Test timeout set to 30 seconds for potential AI integration tests
- Coverage reporting configured for src/ directory
- Service-based architecture enables better unit testing with dependency injection
- Each service can be tested independently with mocked dependencies

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

- **API Key Storage**: Choose between plain text (default) or AES-256 encrypted storage
- **Master Password Protection**: Optional encryption with user-defined master passwords
- **Privacy Filtering**: Prevents accidental sharing of sensitive notes tagged with #private
- **No Data Persistence**: No local storage of API responses beyond OpenAI API calls
- **Path Validation**: Validates folder paths to prevent directory traversal attacks
- **Secure Cryptography**: Uses Web Crypto API for all encryption operations
- **Memory Safety**: Sensitive data is handled securely and not logged

## Performance Notes

- Modular service-based architecture with efficient dependency injection
- Singleton pattern for stateful services reduces memory overhead
- Efficient file discovery with folder-first strategy
- Minimal DOM manipulation and memory usage
- Proper cleanup of event listeners and resources through ServiceManager
- Lazy initialization of services only when needed

**Architecture Trade-offs:**
- Service-based architecture adds slight overhead compared to single-file approach
- Trade-off is justified by improved security, testability, and maintainability
- Performance impact is minimal for typical plugin usage scenarios
- Benefits of modularity and proper separation of concerns outweigh the minor overhead