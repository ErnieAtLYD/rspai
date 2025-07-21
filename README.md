# Retrospect AI

> **Transform your daily notes into meaningful weekly reflections with AI**

A simple, focused Obsidian plugin that creates thoughtful weekly summaries from your journal entries using OpenAI or local Ollama models.

## ✨ What it does

### Core Features
- **📖 One-Click Summaries**: Click the book icon or run a command to generate weekly reflections
- **🔍 Smart Collection**: Automatically finds notes from the past 7 days (configurable)
- **🔒 Privacy First**: Skips notes with `#private` tag to protect sensitive content
- **🤖 AI-Powered**: Uses OpenAI or local Ollama models to create thoughtful, encouraging reflections
- **📁 Organized**: Saves summaries in `Summaries/` folder with backlinks to source notes
- **⚡ Lightning Fast**: Service-based architecture with efficient dependency injection
- **🔧 Well-Tested**: Comprehensive test suite with 43+ unit tests ensuring reliability

### Advanced Analysis Engine
- **🧠 Pattern Recognition**: Detect behavioral patterns in mood, activities, sleep, and productivity
- **📈 Trend Analysis**: Identify trends over time with word count, sentiment, and topic diversity tracking
- **💡 AI-Powered Insights**: Generate deep semantic insights and actionable recommendations
- **⚡ High-Performance Caching**: Multi-level caching with TTL and disk persistence for instant results
- **📊 Comprehensive Reports**: Generate detailed analysis reports with patterns, trends, and insights
- **🎯 Configurable Analysis**: Adjustable confidence thresholds and analysis preferences
- **⏰ Automatic Scanning**: Optional scheduled analysis with configurable frequency (daily/weekly)

## 🚀 Quick Start

### 1. Install

#### Option A: Using BRAT (Recommended for beta versions)
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Obsidian's Community Plugins
2. Enable BRAT in your plugin settings
3. Open Command Palette (`Ctrl/Cmd + P`) and run "BRAT: Add a beta plugin for testing"
4. Enter this repository URL: `https://github.com/ErnieAtLYD/retrospect-ai`
5. Click "Add Plugin" and enable "Journal Reflection" in Community Plugins settings

#### Option B: Manual Installation
- Download the latest release from GitHub
- Extract to your `.obsidian/plugins/retrospect-ai/` folder
- Enable "Journal Reflection" in Community Plugins settings

### 2. Setup

#### Option A: OpenAI (Cloud AI)
- Open plugin settings (Settings → Community Plugins → Journal Reflection)
- Set LLM Provider to "OpenAI"
- Add your OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))
- **🔐 Security**: Choose to encrypt your API key with a master password (recommended)
- Choose your preferred model (GPT-4o Mini recommended for cost/quality balance)

#### Option B: Ollama (Local AI - Recommended for Privacy)
- Install Ollama from [ollama.com](https://ollama.com)
- Download a model: `ollama pull llama3.1:8b` (recommended)
- Open plugin settings (Settings → Community Plugins → Journal Reflection)
- Set LLM Provider to "Ollama"
- Verify Base URL is correct (default: `http://localhost:11434`)
- Set Model to your installed model (e.g., `llama3.1:8b`)

**Why Choose Ollama?**
- **🔒 Complete Privacy**: All processing happens locally on your device
- **💰 Zero Cost**: No API fees after initial setup
- **🌐 Offline Operation**: Works without internet connection
- **🎛️ Full Control**: Customize models and parameters to your preferences

### 3. Setup Encryption (OpenAI users only - Recommended)
- Click "Manage Encryption" in plugin settings
- Choose "Setup Encryption" for enhanced security
- Create a strong master password (8+ chars, mixed case, numbers)
- Your API key will be encrypted with AES-256 encryption
- Master password is required each session but never stored
- *Note: Ollama users don't need encryption since no API keys are required*

### 4. Use
- **Ribbon Icon**: Click the 📖 book icon in the left sidebar
- **Command Palette**: Access multiple commands:
  - "Create Weekly Journal Summary" - Generate AI-powered weekly reflections
  - "Analyze Patterns" - Detect behavioral patterns in your notes
  - "Analyze Trends" - Identify trends over 14-day periods
  - "Comprehensive Analysis" - Full analysis with AI insights and summaries
  - "Clear Analysis Cache" - Reset cached analysis results
- **Result**: Beautiful reflections and detailed analysis reports appear in your `Summaries/` folder

## 🎯 Perfect For

- **Daily Journaling**: Reflect on your week's entries
- **Personal Growth**: Identify patterns and insights
- **Life Review**: Create meaningful weekly retrospectives
- **Mindfulness**: Gain perspective on your thoughts and experiences

## ⚙️ Settings

### Core Settings
| Setting | Description | Default |
|---------|-------------|---------|
| **LLM Provider** | Choose between OpenAI or Ollama | OpenAI |
| **OpenAI API Key** | Your API key for generating reflections (OpenAI only) | *Required for OpenAI* |
| **API Key Storage** | Choose encrypted or plain text storage (OpenAI only) | Plain Text |
| **OpenAI Model** | Which OpenAI model to use | GPT-4o Mini |
| **Ollama Base URL** | Ollama server endpoint | http://localhost:11434 |
| **Ollama Model** | Local model name (must be installed) | llama3.1:8b |
| **Ollama Timeout** | Request timeout in milliseconds | 30000 |
| **Days to Include** | How far back to look for entries | 7 days |
| **Periodic Note Folders** | Folders to search for journal entries | Daily Notes |
| **Reflection Output Folder** | Where to save generated summaries | Summaries |
| **Exclude Private Notes** | Skip notes with #private tag | Enabled |

### Analysis Engine Settings
| Setting | Description | Default |
|---------|-------------|---------|
| **Analysis Enabled** | Enable/disable analysis engine features | Enabled |
| **Pattern Threshold** | Minimum confidence for pattern detection | 0.6 |
| **Trend Analysis** | Enable trend analysis over time | Enabled |
| **Semantic Analysis** | Enable AI-powered insight generation | Enabled |
| **Cache Analysis Results** | Enable caching for better performance | Enabled |

### Automatic Scanning Settings
| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Auto-scan** | Automatically run analysis at specified intervals | Disabled |
| **Scan Frequency** | How often to run automatic analysis | Manual |
| **Available Frequencies** | Manual only, Daily, Weekly | Manual |

## 💡 How It Works

### Manual Analysis
1. **Scans** your vault for notes modified in the last N days
2. **Filters** out any notes containing `#private` tag
3. **Combines** the content and sends to your chosen AI provider (OpenAI or Ollama) with a thoughtful prompt
4. **Creates** a structured reflection focusing on:
   - Key themes and patterns
   - Emotional journey and growth
   - Important events or insights
   - Areas for future reflection

### Automatic Scanning
When enabled, the plugin will:
1. **Monitor** your journal entries automatically based on the configured frequency
2. **Run** comprehensive analysis (patterns, trends, and insights) at scheduled intervals
3. **Generate** reports in your Summaries folder without manual intervention
4. **Track** the last scan time to prevent duplicate analysis
5. **Provide** a "Run Now" button for immediate manual analysis

## 📝 Example Output

### Weekly Reflection
```markdown
# Weekly Reflection - 2024-01-21

*Generated on 2024-01-21 at 14:30*

## Key Themes This Week
This week showed a beautiful progression in your creative projects...

## Emotional Journey
I notice a shift from Monday's uncertainty to Friday's confidence...

## Important Insights
Your reflection on work-life balance reveals...

## Areas for Future Reflection
Consider exploring how your morning routine impacts...

---

## Source Notes
- [[2024-01-15 Daily Note]]
- [[2024-01-16 Daily Note]]
- [[Team Meeting Notes]]
- [[Weekend Thoughts]]

---
*This reflection was generated from 4 journal entries from the past 7 days.*
```

### Pattern Analysis Report
```markdown
# Pattern Analysis - 2024-01-21

*Generated on 2024-01-21 at 14:30*

## Detected Patterns

### Mood Patterns (Confidence: 0.85)
- **Positive Mood Indicators**: Frequent mentions of "excited", "happy", "accomplished"
- **Pattern**: Mood tends to improve throughout the week
- **Peak Days**: Fridays show consistently positive language

### Activity Patterns (Confidence: 0.92)
- **Exercise**: Regular morning workouts mentioned 5/7 days
- **Social Activities**: Weekend social events consistently noted
- **Work Focus**: Deep work sessions primarily on Tuesday-Thursday

### Productivity Patterns (Confidence: 0.78)
- **High Productivity**: Mornings after exercise sessions
- **Low Productivity**: Late afternoons, especially Mondays
- **Focus Areas**: Creative projects receive most concentrated attention

## AI-Powered Insights
- Your exercise routine appears to be a key driver of positive mood
- Social connections on weekends help reset and recharge for the week
- Consider protecting Tuesday-Thursday deep work time more deliberately

---
*Analysis based on 7 days of journal entries with 92% confidence.*
```

## 🔒 Privacy & Security

- **🔐 Encrypted Storage**: Optional AES-256 encryption for your API key with master password (OpenAI)
- **🏠 Local Processing**: Choose between cloud AI (OpenAI) or fully local processing (Ollama)
- **🏷️ Privacy Tags**: Automatically excludes notes with `#private`
- **🚫 No Storage**: OpenAI doesn't store your data when using the API; Ollama keeps everything local
- **⚖️ Full Control**: You choose what gets analyzed and where it's processed
- **🔑 Zero Knowledge**: Master passwords are never stored or transmitted
- **🖥️ Complete Privacy**: Ollama processes everything locally - your data never leaves your device

### Security Features

- **AES-256-GCM Encryption**: Military-grade encryption using Web Crypto API
- **PBKDF2 Key Derivation**: 100,000 iterations for password strengthening
- **Session Management**: Master password cached only during active session
- **Secure Validation**: Password strength requirements with real-time feedback
- **Graceful Fallback**: Easy migration between encrypted and plain text storage

## 🦙 Ollama Setup & Configuration

### Installation
1. Download and install Ollama from [ollama.com](https://ollama.com)
2. Start the Ollama service (usually runs automatically on installation)
3. Download a model: `ollama pull llama3.1:8b` (or your preferred model)

### Recommended Models
- **llama3.1:8b** - Best balance of performance and quality (default)
- **llama3.1:7b** - Smaller, faster option for lower-end hardware
- **mistral:7b** - Alternative high-quality model with excellent reasoning
- **codellama:7b** - Specialized for code-related tasks and technical writing
- **qwen2.5:7b** - Excellent multilingual support and creative writing

### Configuration Tips
- **Base URL**: Default is `http://localhost:11434` (change if Ollama runs elsewhere)
- **Model**: Must match exactly with installed model name (check with `ollama list`)
- **Timeout**: Increase for slower hardware or larger models (default: 30 seconds)

### Troubleshooting
- **Connection Failed**: Ensure Ollama is running (`ollama serve` in terminal)
- **Model Not Found**: Verify model is installed (`ollama list`)
- **Slow Responses**: Increase timeout in settings or use a smaller model
- **Memory Issues**: Close other applications or use quantized models (e.g., `llama3.1:8b-q4_0`)
- **Network Issues**: Check firewall settings and localhost access

### Performance Tips
- **GPU Acceleration**: Ollama automatically uses GPU if available (NVIDIA/AMD)
- **Model Size**: Larger models (13b, 70b) provide better quality but require more resources
- **Quantization**: Q4_0 and Q8_0 variants balance quality and speed
- **System Requirements**: 8GB RAM minimum for 7b models, 16GB+ recommended for 13b+

### Benefits of Ollama
- **Complete Privacy**: All processing happens locally on your device
- **No API Costs**: Free inference after initial setup and model download
- **Offline Operation**: Works without internet connection once models are downloaded
- **Customization**: Fine-tune models for specific journal analysis needs
- **No Rate Limits**: Process as many notes as you want without restrictions
- **Data Sovereignty**: Your personal thoughts and insights never leave your control

## 🛠️ Technical Details

### Architecture
- **Service-Based Design**: Modular architecture with dependency injection
  - `ServiceManager`: Central container for service lifecycle management
  - `EncryptionService`: AES-256 encryption with PBKDF2 key derivation
  - `AIService`: Multi-provider AI integration (OpenAI/Ollama) with error handling
  - `FileOperationsService`: Smart file discovery and content processing
  - `CacheService`: High-performance caching with TTL and disk persistence
  - `PatternRecognitionService`: Behavioral pattern detection and trend analysis
  - `AnalysisManager`: Central orchestrator for comprehensive analysis workflows
- **TypeScript**: Full type safety with comprehensive interfaces and strict typing
- **Web Crypto API**: Native browser encryption for maximum security and performance
- **Comprehensive Testing**: 43+ unit tests with full coverage of encryption functionality
- **Analysis Engine**: Multi-layered analysis system with pattern recognition, trend analysis, and AI insights
- **Performance Caching**: Intelligent caching system with 6-24 hour TTL based on analysis type

### Quality & Reliability
- **Robust Error Handling**: Graceful degradation and user-friendly error messages
- **Memory Management**: Proper cleanup and disposal of sensitive data
- **Performance Optimized**: Lazy initialization, singleton pattern, and intelligent caching for efficiency
- **Security First**: No secrets in logs, secure random generation, password validation
- **Analysis Pipeline**: Concurrent analysis management with configurable confidence thresholds
- **Cache Management**: LRU eviction, memory limits, and optional disk persistence for analysis results

## 🎨 Customization Ideas

The plugin's service-based architecture makes it easy to extend:

### Service Extensions
- **AIService**: Modify prompts or add support for other AI providers
- **EncryptionService**: Implement additional encryption algorithms or key storage methods
- **FileOperationsService**: Add custom file filters or processing logic
- **ServiceManager**: Register new services for additional functionality
- **PatternRecognitionService**: Add custom pattern detection algorithms
- **AnalysisManager**: Extend analysis workflows and report formats
- **CacheService**: Implement additional caching strategies or storage backends

### Feature Ideas
- Custom reflection templates and styles
- Additional AI provider support (Anthropic Claude, Google Gemini)
- Advanced privacy filters and content sanitization
- Export formats (PDF, markdown, structured data)
- ✅ **Scheduled automatic reflections** - *Now available with configurable daily/weekly scanning*
- Integration with other Obsidian plugins
- Custom pattern recognition rules
- Analysis dashboard with visualizations
- Historical trend comparison and analysis
- Machine learning model training on personal patterns
- Ollama model management UI (download, update, switch models)
- Hybrid processing (local + cloud for different analysis types)

## 🧪 Development & Testing

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
```

### Development Commands
```bash
npm run dev             # Start development build with watch mode
npm run build           # Build for production with TypeScript check
npm run version         # Bump version and update manifest files
```

### Test Coverage
- **EncryptionService**: 43 comprehensive tests covering all security-critical functionality
- **Mocked Environment**: Complete Obsidian API mocks for isolated testing
- **Integration Tests**: Real Web Crypto API testing when available
- **Error Scenarios**: Extensive edge case and error condition testing

## 🤝 Contributing

This plugin embraces simplicity and security! If you have ideas:
1. Keep it focused on weekly journal reflection
2. Maintain the clean, readable codebase with comprehensive tests
3. Prioritize user experience and security over features
4. Add tests for any new functionality
5. Follow the service-based architecture patterns

## 📄 License

MIT License - feel free to use, modify, and share!

## 🙏 Acknowledgments

Built for the Obsidian community with a focus on simplicity and user value over technical complexity.

---

**Ready to transform your journaling practice?** Install Journal Reflection today and start gaining deeper insights from your notes! 📖✨ 