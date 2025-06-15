# RetrospectAI - Obsidian Plugin

RetrospectAI is an Obsidian plugin that provides AI-powered retrospective analysis of your notes while respecting your privacy.

## Features

- **AI-Powered Analysis**: Extract patterns, insights, and summaries from your personal notes
- **Multiple AI Providers**: Choose between cloud-based (OpenAI) or local (Ollama) AI processing
- **Privacy-First Design**: Comprehensive privacy protection with local processing options
- **Smart Content Processing**: Advanced markdown parsing with metadata extraction
- **Flexible Configuration**: Extensive settings for customizing analysis behavior

## Privacy First

RetrospectAI includes comprehensive privacy protection to ensure sensitive content never reaches AI services:

- **File-level exclusion** using privacy tags (`#private`, `#noai`, `#confidential`)
- **Folder-based exclusion** for organizing private content
- **Section-level redaction** for mixed public/private documents
- **Local processing** - privacy filtering happens before any external API calls
- **Privacy levels**: Choose between local-only, hybrid, or cloud processing

📖 **[Read the complete Privacy Guide](docs/privacy-guide.md)** to learn how to protect your sensitive content.

## AI Setup & Configuration

RetrospectAI supports multiple AI providers. **You only need to set up ONE provider** based on your preferences:

### Option 1: OpenAI (Cloud-based) 🌐

**Best for**: Users who want the most advanced AI capabilities and don't mind cloud processing.

#### Setup Steps:
1. **Get an OpenAI API Key**:
   - Visit [OpenAI API](https://platform.openai.com/api-keys)
   - Create an account and generate an API key
   - Note: This requires a paid OpenAI account with credits

2. **Configure in Obsidian**:
   - Open Settings → RetrospectAI → AI Settings
   - Toggle "Enable AI Analysis" to ON
   - Set "Primary AI Provider" to "OpenAI"
   - Set "Privacy Level" to "Cloud Services" or "Hybrid"
   - Enter your API key in "OpenAI API Key"
   - Choose your preferred model (GPT-3.5 Turbo, GPT-4, etc.)
   - Click "Test Connection" to verify setup

#### Supported Models:
- **GPT-3.5 Turbo**: Fast and cost-effective
- **GPT-4**: Most capable, higher cost
- **GPT-4 Turbo**: Latest model with improved performance

### Option 2: Ollama (Local) 🏠

**Best for**: Users who prioritize privacy and want completely local AI processing.

#### Setup Steps:
1. **Install Ollama**:
   ```bash
   # macOS
   brew install ollama
   
   # Or download from https://ollama.ai
   ```

2. **Start Ollama Service**:
   ```bash
   ollama serve
   ```

3. **Pull a Model**:
   ```bash
   # Recommended models:
   ollama pull llama2          # General purpose, 7B parameters
   ollama pull mistral         # Fast and efficient
   ollama pull codellama       # Good for code analysis
   ollama pull neural-chat     # Optimized for conversations
   ```

4. **Configure in Obsidian**:
   - Open Settings → RetrospectAI → AI Settings
   - Toggle "Enable AI Analysis" to ON
   - Set "Primary AI Provider" to "Ollama (Local)"
   - Set "Privacy Level" to "Local Only"
   - Set "Ollama Endpoint" to `http://localhost:11434` (default)
   - Set "Ollama Model" to your chosen model (e.g., `llama2`)
   - Click "Test Connection" to verify setup

#### Recommended Models:
- **llama2**: Best overall performance for personal analysis
- **mistral**: Faster processing, good for quick insights
- **neural-chat**: Optimized for conversational analysis

### Option 3: Mock Provider (Testing) 🧪

**Best for**: Testing the plugin functionality without setting up real AI services.

#### Setup Steps:
1. **Configure in Obsidian**:
   - Open Settings → RetrospectAI → AI Settings
   - Toggle "Enable AI Analysis" to ON
   - Set "Primary AI Provider" to "Mock (Testing)"
   - Click "Test Connection" to verify setup

The mock provider generates realistic-looking but fake AI responses for testing purposes.

## Usage

### Basic Analysis
1. **Open a note** you want to analyze
2. **Click the brain icon** in the ribbon, or
3. **Use Command Palette** (Ctrl/Cmd + P):
   - "RetrospectAI: Analyze Current Note" (basic analysis)
   - "RetrospectAI: Analyze Current Note with AI" (AI-powered analysis)

### AI-Powered Features
- **Pattern Detection**: Identifies habits, goals, and behavioral patterns
- **Sentiment Analysis**: Analyzes emotional tone and mood trends
- **Content Summarization**: Generates concise summaries of your reflections
- **Insight Generation**: Provides personalized insights and recommendations
- **Goal Tracking**: Identifies and tracks progress toward personal goals

### Commands Available
- `Analyze Current Note`: Basic markdown and metadata analysis
- `Analyze Current Note with AI`: Full AI-powered analysis with insights
- `Show AI Service Status`: Check AI provider status and metrics
- `Test AI Connection`: Verify your AI provider is working
- `Show Processing Statistics`: View plugin performance metrics
- `Clear Processing Cache`: Reset cached analysis results

## Privacy Levels Explained

- **Local Only**: All processing happens on your machine (requires Ollama)
- **Hybrid**: Sensitive content stays local, general content may use cloud AI
- **Cloud Services**: Allows cloud-based AI processing for all content

## Troubleshooting

### AI Not Working?
1. **Check AI is enabled**: Settings → RetrospectAI → AI Settings → "Enable AI Analysis"
2. **Verify provider setup**:
   - OpenAI: Valid API key with credits
   - Ollama: Service running and model downloaded
3. **Test connection**: Use "Test AI Connection" command
4. **Check console**: Open Developer Tools (Ctrl/Cmd + Shift + I) for error messages

### Common Issues
- **"AI is disabled"**: Enable AI in settings and configure a provider
- **OpenAI API errors**: Check API key and account credits
- **Ollama connection failed**: Ensure Ollama service is running (`ollama serve`)
- **Model not found**: Pull the model with `ollama pull <model-name>`

## Development & Testing

### Manual Testing Procedures

#### Setup Test Environment
1. **Build the plugin**: `npm run build`
2. **Deploy to test vault**: `npm run deploy:test`
3. **Open test vault** in Obsidian
4. **Enable the plugin** in Settings > Community Plugins

#### Basic Functionality Tests
- [ ] **Plugin loads without errors** (check console)
- [ ] **Ribbon icon appears** in left sidebar with "brain" icon
- [ ] **Clicking ribbon icon** triggers handler (check console logs)
- [ ] **Plugin unloads cleanly** when disabled
- [ ] **No memory leaks** after multiple load/unload cycles

#### AI Integration Tests
- [ ] **AI settings appear** in plugin settings
- [ ] **Provider selection works** (OpenAI, Ollama, Mock)
- [ ] **Connection testing works** for configured provider
- [ ] **AI analysis commands** execute without errors
- [ ] **Error handling** shows helpful messages for misconfiguration

#### Error Handling Tests
- [ ] **Logger outputs** appear in console with proper formatting
- [ ] **Error scenarios** are caught and logged appropriately
- [ ] **User notifications** appear for user-facing errors

#### Development Workflow
1. **Hot reloading**: Changes auto-rebuild and reload in test vault
2. **Console monitoring**: Watch for errors during development
3. **Settings validation**: Verify plugin settings save/load correctly

### Test Vault Structure
```
.obsidian-test/
├── .obsidian/
│   └── plugins/
│   └── retrospectai/
│   ├── main.js
│   └── manifest.json
├── Daily Notes/
│   ├── 2024-01-01.md
│   └── 2024-01-02.md
└── Sample Notes/
    ├── Meeting Notes.md
    └── Project Ideas.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.