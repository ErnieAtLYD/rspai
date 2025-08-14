# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Retrospect AI**, an Obsidian plugin that creates AI-powered weekly journal summaries and comprehensive behavioral analysis. The plugin analyzes journal entries to generate thoughtful reflections, detect patterns, identify trends, and provide actionable insights using either OpenAI's API or local Ollama models for enhanced privacy.

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
- **AIService**: Handles LLM interactions with support for OpenAI API and local Ollama models
- **FileOperationsService**: Manages file discovery, content extraction, and summary creation
- **EncryptionService**: Provides AES-256 encryption for secure API key storage
- **CacheService**: High-performance caching with TTL and disk persistence for analysis results
- **PatternRecognitionService**: Behavioral pattern detection, trend analysis, and insight generation
- **AnalysisManager**: Central orchestrator for comprehensive AI-powered analysis
- **ErrorHandlingService**: Centralized error classification, retry mechanisms, and user notification system
- **NLPAnalysisService**: Advanced natural language processing for theme extraction, sentiment analysis, and blocker detection
- **Logger**: Structured logging service with configurable levels and error handler integration

**User Interface** (`src/modals.ts`)
- **MasterPasswordModal**: Prompts for master password to decrypt API keys
- **EncryptionSetupModal**: Guides users through encryption setup process
- **EncryptionManagementModal**: Manages encryption settings and testing

**Key Features:**
- **Weekly Summary Generation**: Scans recent notes, filters private content, sends to configured LLM provider
- **Advanced Pattern Recognition**: Detects mood, activity, sleep, and productivity patterns
- **Trend Analysis**: Identifies behavioral trends and changes over time
- **AI-Powered Insights**: Generates actionable insights for personal growth
- **Comprehensive Analysis Engine**: Combines patterns, trends, and insights with caching
- **Settings Management**: Configurable OpenAI API key, model selection, date ranges
- **Privacy Protection**: Automatically excludes notes with `#private` tag
- **Smart File Discovery**: Searches configured periodic note folders or falls back to vault-wide search
- **Encrypted Storage**: Optional AES-256 encryption for API keys with master password protection
- **Performance Caching**: Multi-level caching system for analysis results with disk persistence

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
- `llmProvider`: LLM provider selection ('openai' | 'ollama', default: 'openai')
- `openaiApiKey`: User's OpenAI API key (string or encrypted data)
- `openaiModel`: Selected OpenAI model (default: gpt-4o-mini)
- `ollamaBaseUrl`: Ollama server URL (default: http://localhost:11434)
- `ollamaModel`: Ollama model name (default: llama3.1:8b)
- `ollamaTimeout`: Request timeout for Ollama in milliseconds (default: 30000)
- `daysToInclude`: Number of days to look back (default: 7)
- `excludePrivate`: Whether to skip #private tagged notes
- `periodicNoteFolders`: Array of folder paths to search for journal entries
- `reflectionFolder`: Where to save generated summaries
- `encryptionEnabled`: Whether API key encryption is enabled
- `encryptionSetup`: Whether encryption has been set up
- `analysisEnabled`: Enable/disable analysis engine features (default: true)
- `patternThreshold`: Minimum confidence for pattern detection (default: 0.6)
- `enableTrendAnalysis`: Enable trend analysis over time (default: true)
- `enableSemanticAnalysis`: Enable AI-powered insight generation (default: true)
- `cacheAnalysisResults`: Enable caching of analysis results (default: true)

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

**Provider Architecture:**
- Supports multiple LLM providers through abstract provider interface
- Dynamic provider switching based on user configuration
- Consistent API across different providers

**OpenAI Provider:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Default model: `gpt-4o-mini`
- Requires API key authentication
- Max tokens: 1000, Temperature: 0.7

**Ollama Provider:**
- Endpoint: `{baseUrl}/api/generate`
- Default model: `llama3.1:8b`
- Local inference, no API key required
- Configurable timeout (default: 30 seconds)

**Prompt Structure:**
- Focuses on themes, emotional journey, insights, and future reflection areas
- Encourages supportive, wise friend tone
- Includes all filtered note content for comprehensive analysis

**Error Handling:**
- Provider-specific error handling (API key validation, model availability)
- User-friendly error messages with troubleshooting guidance
- Fallback strategies for network issues and timeouts

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

### Error Handling Service

**ErrorHandlingService** (`src/services/ErrorHandlingService.ts`)
- **Centralized Error Management**: Single point for error classification, handling, and recovery
- **Error Classification System**: Categorizes errors by type (CRITICAL, USER, API, FILESYSTEM, VALIDATION, NETWORK) and specific error codes
- **Retry Mechanisms**: Intelligent retry logic with exponential backoff and jitter for network and transient errors
- **Error History Tracking**: Maintains error history per component/operation with size limits (50 entries max)
- **User Notification**: Configurable user-facing error messages and Obsidian Notice integration
- **Structured Logging**: Integration with Logger service for detailed error tracking

**Error Types and Codes:**
- **CRITICAL**: Plugin initialization failures, service registration errors
- **USER**: API key issues, invalid configurations
- **API**: Rate limiting, network errors, response errors
- **FILESYSTEM**: File/folder not found, permission denied, disk space
- **VALIDATION**: Invalid settings, configuration errors
- **NETWORK**: Connection failures, timeouts

**Retry Strategy:**
- Exponential backoff with 15% jitter to prevent thundering herd
- Maximum delay cap of 30 seconds
- Configurable retry attempts (default: 3)
- Automatic retry for network/rate-limit errors only
- Non-retryable errors: API key invalid, file not found, permission denied

### NLP Analysis Service

**NLPAnalysisService** (`src/services/NLPAnalysisService.ts`)
- **Advanced Text Processing**: Uses compromise.js, natural, and sentiment libraries for sophisticated NLP
- **Dynamic Library Loading**: Lazy-loads NLP dependencies for better performance
- **Multi-layered Analysis**: Combines rule-based and statistical approaches

**Core NLP Modules** (`src/services/nlp/`)
- **TextProcessor**: Text cleaning, tokenization, keyword extraction, and consistent hashing
- **ThemeExtractor**: Productivity theme identification with confidence scoring
- **SentimentAnalyzer**: Emotional analysis with polarity, subjectivity, and productivity-specific sentiment
- **BlockerDetector**: Identifies productivity blockers (procrastination, time management, workflow disruption)

**Analysis Capabilities:**
- **Productivity Theme Extraction**: Identifies recurring productivity themes with confidence scores
- **Sentiment Analysis**: Multi-dimensional emotional analysis including arousal and confidence levels
- **Blocker Detection**: Categorizes productivity obstacles with severity levels and actionable suggestions
- **Text Preprocessing**: Intelligent text cleaning while preserving semantic meaning
- **Caching Integration**: Results cached for performance with configurable TTL

**Dependencies:**
- **compromise**: 14.14.4 - Natural language understanding and processing
- **natural**: 8.1.0 - Tokenization, stemming, and statistical analysis
- **sentiment**: 5.0.2 - Sentiment analysis with AFINN-based scoring

### Logger Service

**Logger** (`src/services/Logger.ts`)
- **Structured Logging**: Service-specific logging with contextual information
- **Log Levels**: Debug, info, warn, error with appropriate console methods
- **Error Handler Integration**: Seamless integration with ErrorHandlingService for error tracking
- **Context Support**: Rich context objects for detailed debugging information
- **Late Binding**: Supports error handler injection after service initialization

**Usage Pattern:**
```typescript
const logger = new Logger('ServiceName', errorHandler);
logger.info('Operation completed', { duration: 123, items: 5 });
logger.error('Failed to process', error, { context: 'additional info' });
```

### Analysis Engine Architecture

**AnalysisManager** (`src/services/AnalysisManager.ts`)
- **Central Orchestrator**: Coordinates all analysis operations across services
- **Multiple Analysis Types**: Supports pattern-only, trend-only, and comprehensive analysis
- **Caching Integration**: Intelligent caching with configurable TTL for performance
- **Analysis History**: Tracks and persists analysis results for trend comparison
- **Concurrent Analysis Management**: Prevents duplicate analysis requests
- **Report Generation**: Creates formatted markdown reports with insights

**PatternRecognitionService** (`src/services/PatternRecognitionService.ts`)
- **Behavioral Pattern Detection**: 
  - Mood patterns (positive, negative, neutral emotional states)
  - Activity patterns (exercise, social, work, creative activities)
  - Sleep patterns (sleep-related concerns and focus areas)
  - Productivity patterns (high/low productivity indicators)
- **Trend Analysis**: 
  - Word count trends over time
  - Sentiment analysis trends (extensible)
  - Topic diversity analysis (extensible)
- **AI-Powered Insights**: Uses OpenAI to generate deep semantic insights
- **Rule-Based Insights**: Fallback analysis for reliable basic insights
- **Configurable Thresholds**: Adjustable confidence levels for pattern detection

**CacheService** (`src/services/CacheService.ts`)
- **Multi-Level Caching**: Supports analysis results, patterns, trends, and insights
- **TTL Management**: Configurable time-to-live for different cache types
- **Disk Persistence**: Optional cache survival across plugin restarts
- **Memory Management**: Size limits with LRU eviction policy
- **Cache Key Generation**: Intelligent key generation based on content and parameters
- **Statistics Tracking**: Cache hit ratios and memory usage monitoring

**Analysis Workflow:**
1. **Input Processing**: Files are discovered and content extracted
2. **Pattern Detection**: Behavioral patterns identified with confidence scores
3. **Trend Analysis**: Temporal trends calculated across multiple data points
4. **Insight Generation**: AI and rule-based insights synthesized
5. **Report Creation**: Comprehensive reports generated and cached
6. **Result Persistence**: Analysis history maintained for comparison

**Command Integration:**
- `analyze-patterns`: Generate pattern analysis reports
- `analyze-trends`: Create trend analysis over 14-day periods
- `comprehensive-analysis`: Full analysis with AI insights and summaries
- `clear-analysis-cache`: Cache management and cleanup

**Performance Optimizations:**
- **Intelligent Caching**: 6-24 hour TTL based on analysis type
- **Incremental Analysis**: Avoids re-analyzing unchanged content
- **Background Processing**: Non-blocking analysis execution
- **Memory Efficiency**: Streaming content processing for large datasets

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

### Moment.js Compatibility
**Important:** This plugin uses moment.js for date operations, which requires special handling due to Obsidian's namespace exports:

**Implementation Pattern:**
```typescript
import { moment as momentNamespace } from "obsidian";

// Define interface for moment function based on actual usage  
interface MomentFunction {
    (): moment.Moment;
    (input?: moment.MomentInput): moment.Moment;
    // ... additional overloads
}

// Handle Obsidian's moment namespace export with proper typing
const moment: MomentFunction = 
    (momentNamespace as unknown as { default?: MomentFunction }).default || 
    (momentNamespace as unknown as MomentFunction);
```

**Key Considerations:**
- Obsidian exports moment.js differently across API versions
- Always use the fallback pattern shown above for compatibility
- Import from `obsidian` package, not direct moment.js imports
- Type safety is maintained through the MomentFunction interface
- This pattern ensures compatibility across different Obsidian versions

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
├── types.ts               # TypeScript type definitions
├── types/
│   └── sentiment.d.ts     # Type definitions for sentiment library
├── ui/
│   └── SettingsUI.ts      # Enhanced settings user interface
└── services/
    ├── index.ts           # Service exports
    ├── ServiceManager.ts  # Dependency injection container
    ├── BaseService.ts     # Abstract base service class
    ├── AIService.ts       # Multi-provider LLM integration (OpenAI/Ollama)
    ├── FileOperationsService.ts # File discovery and processing
    ├── EncryptionService.ts # AES-256 encryption implementation
    ├── CacheService.ts    # High-performance caching with TTL and persistence
    ├── PatternRecognitionService.ts # Behavioral pattern detection and trend analysis
    ├── AnalysisManager.ts # Central analysis orchestrator and report generation
    ├── ErrorHandlingService.ts # Centralized error management and retry logic
    ├── NLPAnalysisService.ts # Advanced natural language processing
    ├── Logger.ts          # Structured logging service
    └── nlp/
        ├── index.ts       # NLP module exports
        ├── nlp-loader.ts  # Dynamic NLP library loading
        ├── TextProcessor.ts # Text cleaning and preprocessing
        ├── ThemeExtractor.ts # Productivity theme identification
        ├── SentimentAnalyzer.ts # Emotional analysis
        └── BlockerDetector.ts # Productivity blocker detection

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

### Runtime Dependencies
- **obsidian**: Core Obsidian API
- **compromise**: 14.14.4 - Natural language understanding and processing
- **natural**: 8.1.0 - Tokenization, stemming, and statistical NLP analysis
- **sentiment**: 5.0.2 - AFINN-based sentiment analysis

### Development Dependencies
- **esbuild**: Fast bundling and development
- **typescript**: Type checking with ESM support
- **jest + ts-jest**: Testing framework with TypeScript support
- **babel-jest**: JavaScript transformation for testing

## Plugin Distribution

- Builds to `main.js` in root directory
- `manifest.json` defines plugin metadata
- `versions.json` tracks version history
- Uses semantic versioning via `version-bump.mjs`

## Ollama Setup and Configuration

**Installation:**
1. Download and install Ollama from [ollama.com](https://ollama.com)
2. Start the Ollama service (usually runs automatically on installation)
3. Download a model: `ollama pull llama3.1:8b` (or your preferred model)

**Recommended Models:**
- **llama3.1:8b** - Good balance of performance and quality (default)
- **llama3.1:7b** - Smaller, faster option
- **mistral:7b** - Alternative high-quality model
- **codellama:7b** - Specialized for code-related tasks

**Configuration:**
- **Base URL**: Default is `http://localhost:11434` (change if Ollama runs elsewhere)
- **Model**: Must match exactly with installed model name
- **Timeout**: Increase for slower hardware or larger models

**Troubleshooting:**
- **Connection Failed**: Ensure Ollama is running (`ollama serve`)
- **Model Not Found**: Verify model is installed (`ollama list`)
- **Slow Responses**: Increase timeout or use smaller model
- **Memory Issues**: Close other applications or use quantized models

**Benefits of Ollama:**
- **Complete Privacy**: All processing happens locally
- **No API Costs**: Free inference after initial setup
- **Offline Operation**: Works without internet connection
- **Customization**: Fine-tune models for specific journal analysis needs

## Security Considerations

- **API Key Storage**: Choose between plain text (default) or AES-256 encrypted storage
- **Master Password Protection**: Optional encryption with user-defined master passwords
- **Privacy Filtering**: Prevents accidental sharing of sensitive notes tagged with #private
- **No Data Persistence**: No local storage of API responses beyond LLM provider calls
- **Local Processing**: Ollama option keeps all data on-device for maximum privacy
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