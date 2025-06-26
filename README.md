# Retrospect AI

> **Transform your daily notes into meaningful weekly reflections with AI**

A simple, focused Obsidian plugin that creates thoughtful weekly summaries from your journal entries using OpenAI.

## ✨ What it does

- **📖 One-Click Summaries**: Click the book icon or run a command to generate weekly reflections
- **🔍 Smart Collection**: Automatically finds notes from the past 7 days (configurable)
- **🔒 Privacy First**: Skips notes with `#private` tag to protect sensitive content
- **🤖 AI-Powered**: Uses OpenAI to create thoughtful, encouraging reflections
- **📁 Organized**: Saves summaries in `Summaries/` folder with backlinks to source notes
- **⚡ Lightning Fast**: Simple, focused codebase with no unnecessary complexity

## 🚀 Quick Start

### 1. Install
- Download the latest release
- Extract to your `.obsidian/plugins/retrospect-ai/` folder
- Enable "Journal Reflection" in Community Plugins settings

### 2. Setup
- Open plugin settings (Settings → Community Plugins → Journal Reflection)
- Add your OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))
- Choose your preferred model (GPT-4o Mini recommended for cost/quality balance)

### 3. Use
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
| **OpenAI Model** | Which model to use | GPT-4o Mini |
| **Days to Include** | How far back to look for entries | 7 days |
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

- **Local Processing**: Only sends selected content to OpenAI
- **Privacy Tags**: Automatically excludes notes with `#private`
- **No Storage**: OpenAI doesn't store your data when using the API
- **Full Control**: You choose what gets analyzed

## 🛠️ Technical Details

- **Lightweight**: ~200 lines of focused code
- **Fast**: Direct OpenAI integration, no unnecessary abstractions
- **Reliable**: Simple architecture means fewer things can break
- **Extensible**: Clean codebase makes future enhancements easy

## 🎨 Customization Ideas

While the plugin is intentionally simple, you could extend it by:
- Modifying the AI prompt for different reflection styles
- Adding custom date ranges
- Creating templates for different journal types
- Adding more privacy filters

## 🤝 Contributing

This plugin embraces simplicity! If you have ideas:
1. Keep it focused on weekly journal reflection
2. Maintain the clean, readable codebase
3. Prioritize user experience over features

## 📄 License

MIT License - feel free to use, modify, and share!

## 🙏 Acknowledgments

Built for the Obsidian community with a focus on simplicity and user value over technical complexity.

---

**Ready to transform your journaling practice?** Install Journal Reflection today and start gaining deeper insights from your daily notes! 📖✨ 