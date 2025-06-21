# RetrospectAI - MVP Release

> **AI-powered note analysis and reflection tool for Obsidian**

Transform your daily notes into actionable insights with privacy-first AI analysis.

## ✨ Core Features

### 📝 **Smart Note Analysis**
- Analyze current note structure, sections, and metadata
- Extract word counts, links, tags, and key elements
- Fast processing with intelligent caching

### 🤖 **AI-Powered Insights** 
- Generate personalized insights from your notes
- Support for OpenAI (GPT-4, GPT-3.5) and local Ollama models
- Configurable analysis depth and writing styles

### 📋 **Simple Summary Creation**
- Create structured summaries of your notes
- Automatic backlink generation
- Organized in dedicated Summaries folder

### 🔒 **Privacy Protection**
- Configurable privacy tags (`#private`, `#noai`, `#confidential`)
- Exclude specific folders from AI analysis
- Local processing option with Ollama

## 🚀 Quick Start

### Installation
1. Download the latest release
2. Extract to your `.obsidian/plugins/` folder
3. Enable "RetrospectAI" in Obsidian's Community Plugins settings

### Setup
1. Open plugin settings
2. Configure your AI provider:
   - **OpenAI**: Add your API key and select model
   - **Ollama**: Set endpoint (default: `http://localhost:11434`) and model
3. Customize privacy settings if needed

### Usage

#### Analyze Your Current Note
- **Ribbon Icon**: Click the brain icon in the left sidebar
- **Command**: `Ctrl/Cmd + P` → "Analyze Current Note"
- **Result**: View note structure, metadata, and basic stats

#### Get AI Insights
- **Command**: `Ctrl/Cmd + P` → "Analyze Current Note with AI"
- **Result**: AI-generated insights and patterns from your note
- **Privacy**: Automatically excludes private content

#### Create Simple Summaries
- **Command**: `Ctrl/Cmd + P` → "Create Simple Summary"
- **Result**: Structured summary note with analysis results
- **Location**: Saved in `Summaries/` folder with backlinks

## ⚙️ Configuration

### AI Providers

**OpenAI (Recommended)**
- Models: GPT-4o Mini, GPT-4o, GPT-3.5 Turbo
- Best for: Comprehensive analysis and insights
- Setup: Requires API key from OpenAI

**Ollama (Privacy-First)**
- Models: Llama 2, Mistral, CodeLlama, etc.
- Best for: Local processing, privacy-sensitive content
- Setup: Install Ollama locally, no API key needed

### Privacy Settings

**Privacy Tags** (Default: `private, noai, confidential`)
- Add tags to any note to exclude from AI analysis
- Example: `#private` or `#noai`

**Private Folders** (Default: `Private/, Personal/, Confidential/`)
- Entire folders excluded from AI processing
- Supports nested folder patterns

**Writing Styles**
- **Personal**: Encouraging and supportive tone
- **Business**: Analytical and action-oriented
- **Academic**: Neutral and research-focused

## 🎯 Use Cases

### Daily Reflection
1. Write your daily notes as usual
2. Use "Analyze with AI" to get insights
3. Create summaries for weekly/monthly review

### Meeting Notes
1. Take meeting notes in Obsidian
2. Generate AI analysis for action items
3. Create structured summaries for follow-up

### Research Notes
1. Collect research in notes
2. Analyze for patterns and connections
3. Generate summaries for synthesis

### Journal Analysis
1. Keep personal journal entries
2. Use privacy tags for sensitive content
3. Get insights on patterns and growth

## 🛠️ Troubleshooting

### AI Connection Issues
- **OpenAI**: Verify API key is correct and has credits
- **Ollama**: Ensure Ollama is running (`ollama serve`)
- **Test**: Use "Test AI Connection" command

### Privacy Concerns
- **Local Processing**: Use Ollama for complete privacy
- **Content Filtering**: Configure privacy tags and folders
- **Debug Mode**: Enable in settings to see what's being processed

### Performance
- **Caching**: Enable caching for faster repeated analysis
- **File Size**: Large files (>5MB) may process slowly
- **Batch Processing**: Plugin processes one note at a time

## 📋 Commands Reference

| Command | Description | Shortcut |
|---------|-------------|----------|
| Analyze Current Note | Basic note structure analysis | Ribbon icon |
| Analyze Current Note with AI | AI-powered insights generation | None |
| Create Simple Summary | Generate structured summary note | None |
| Test AI Connection | Verify AI provider connectivity | None |
| Clear Processing Cache | Reset analysis cache | None |

## 🔄 What's Next?

This MVP focuses on core functionality that works reliably. Future versions may include:
- Vault-wide pattern detection
- Advanced correlation analysis
- Batch processing capabilities
- Custom prompt templates
- Integration with other plugins

## 📄 License

MIT License - feel free to modify and distribute.

## 🤝 Contributing

This is a focused MVP release. For bug reports or feature requests, please create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your Obsidian and plugin versions

---

**Made with ❤️ for the Obsidian community**

*Transform your notes into insights, one analysis at a time.*