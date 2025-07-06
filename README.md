# Retrospect AI

> **Transform your daily notes into meaningful weekly reflections with AI**

A simple, focused Obsidian plugin that creates thoughtful weekly summaries from your journal entries using OpenAI.

## ✨ What it does

- **📖 One-Click Summaries**: Click the book icon or run a command to generate weekly reflections
- **🔍 Smart Collection**: Automatically finds notes from the past 7 days (configurable)
- **🔒 Privacy First**: Skips notes with `#private` tag to protect sensitive content
- **🤖 AI-Powered**: Uses OpenAI to create thoughtful, encouraging reflections
- **📁 Organized**: Saves summaries in `Summaries/` folder with backlinks to source notes
- **⚡ Lightning Fast**: Service-based architecture with efficient dependency injection
- **🔧 Well-Tested**: Comprehensive test suite with 43+ unit tests ensuring reliability

## 🚀 Quick Start

### 1. Install
- Download the latest release
- Extract to your `.obsidian/plugins/retrospect-ai/` folder
- Enable "Journal Reflection" in Community Plugins settings

### 2. Setup
- Open plugin settings (Settings → Community Plugins → Journal Reflection)
- Add your OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))
- **🔐 Security**: Choose to encrypt your API key with a master password (recommended)
- Choose your preferred model (GPT-4o Mini recommended for cost/quality balance)

### 3. Setup Encryption (Recommended)
- Click "Manage Encryption" in plugin settings
- Choose "Setup Encryption" for enhanced security
- Create a strong master password (8+ chars, mixed case, numbers)
- Your API key will be encrypted with AES-256 encryption
- Master password is required each session but never stored

### 4. Use
- **Ribbon Icon**: Click the 📖 book icon in the left sidebar
- **Command Palette**: Run "Create Weekly Journal Summary"
- **Result**: A beautiful reflection appears in your `Summaries/` folder

## 🎯 Perfect For

- **Daily Journaling**: Reflect on your week's entries
- **Personal Growth**: Identify patterns and insights
- **Life Review**: Create meaningful weekly retrospectives
- **Mindfulness**: Gain perspective on your thoughts and experiences

## ⚙️ Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **OpenAI API Key** | Your API key for generating reflections | *Required* |
| **API Key Storage** | Choose encrypted or plain text storage | Plain Text |
| **OpenAI Model** | Which model to use | GPT-4o Mini |
| **Days to Include** | How far back to look for entries | 7 days |
| **Periodic Note Folders** | Folders to search for journal entries | Daily Notes |
| **Reflection Output Folder** | Where to save generated summaries | Summaries |
| **Exclude Private Notes** | Skip notes with #private tag | Enabled |

## 💡 How It Works

1. **Scans** your vault for notes modified in the last N days
2. **Filters** out any notes containing `#private` tag
3. **Combines** the content and sends to OpenAI with a thoughtful prompt
4. **Creates** a structured reflection focusing on:
   - Key themes and patterns
   - Emotional journey and growth
   - Important events or insights
   - Areas for future reflection

## 📝 Example Output

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

## 🔒 Privacy & Security

- **🔐 Encrypted Storage**: Optional AES-256 encryption for your API key with master password
- **🏠 Local Processing**: Only sends selected content to OpenAI
- **🏷️ Privacy Tags**: Automatically excludes notes with `#private`
- **🚫 No Storage**: OpenAI doesn't store your data when using the API
- **⚖️ Full Control**: You choose what gets analyzed
- **🔑 Zero Knowledge**: Master passwords are never stored or transmitted

### Security Features

- **AES-256-GCM Encryption**: Military-grade encryption using Web Crypto API
- **PBKDF2 Key Derivation**: 100,000 iterations for password strengthening
- **Session Management**: Master password cached only during active session
- **Secure Validation**: Password strength requirements with real-time feedback
- **Graceful Fallback**: Easy migration between encrypted and plain text storage

## 🛠️ Technical Details

### Architecture
- **Service-Based Design**: Modular architecture with dependency injection
  - `ServiceManager`: Central container for service lifecycle management
  - `EncryptionService`: AES-256 encryption with PBKDF2 key derivation
  - `AIService`: OpenAI API integration with error handling
  - `FileOperationsService`: Smart file discovery and content processing
- **TypeScript**: Full type safety with comprehensive interfaces and strict typing
- **Web Crypto API**: Native browser encryption for maximum security and performance
- **Comprehensive Testing**: 43+ unit tests with full coverage of encryption functionality

### Quality & Reliability
- **Robust Error Handling**: Graceful degradation and user-friendly error messages
- **Memory Management**: Proper cleanup and disposal of sensitive data
- **Performance Optimized**: Lazy initialization and singleton pattern for efficiency
- **Security First**: No secrets in logs, secure random generation, password validation

## 🎨 Customization Ideas

The plugin's service-based architecture makes it easy to extend:

### Service Extensions
- **AIService**: Modify prompts or add support for other AI providers
- **EncryptionService**: Implement additional encryption algorithms or key storage methods
- **FileOperationsService**: Add custom file filters or processing logic
- **ServiceManager**: Register new services for additional functionality

### Feature Ideas
- Custom reflection templates and styles
- Multiple AI provider support (Anthropic, local models)
- Advanced privacy filters and content sanitization
- Export formats (PDF, markdown, structured data)
- Scheduled automatic reflections
- Integration with other Obsidian plugins

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