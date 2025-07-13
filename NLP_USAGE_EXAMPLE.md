# Advanced NLP Pattern Recognition Usage Examples

This document demonstrates how to use the new advanced NLP pattern recognition features in Retrospect AI.

## Overview

The enhanced pattern recognition system now includes:

1. **Productivity Theme Extraction** - Identifies recurring themes in your work
2. **Blocker Detection** - Spots procrastination, time management, and workflow issues  
3. **Multi-dimensional Sentiment Analysis** - Analyzes emotions, arousal levels, and productivity mood
4. **Context-aware Analysis** - Understands the nuances of your writing style
5. **Pattern Correlation** - Connects productivity patterns with mood and activities

## Configuration

Enable advanced NLP in settings:

```javascript
// Settings configuration
{
  enableAdvancedNLP: true,
  nlpAnalysisDepth: 'moderate', // 'basic', 'moderate', 'deep'
  blockerDetectionSensitivity: 'medium', // 'low', 'medium', 'high'
  patternThreshold: 0.6,
  enableTrendAnalysis: true,
  enableSemanticAnalysis: true,
  cacheAnalysisResults: true
}
```

## Example Journal Entry Analysis

### Input Text
```
Today I felt overwhelmed with the project deadline approaching. I kept procrastinating on the presentation slides because I wasn't sure about the data analysis. Had three interruptions from team meetings that broke my focus. Managed to finish the database queries but still behind schedule. Feeling anxious about tomorrow's demo.
```

### NLP Analysis Results

#### 1. Productivity Themes Extracted
```javascript
[
  {
    theme: "project management",
    confidence: 0.8,
    keywords: ["project", "deadline", "schedule"],
    frequency: 0.15,
    context: ["project deadline approaching", "still behind schedule"]
  },
  {
    theme: "problem solving", 
    confidence: 0.6,
    keywords: ["data analysis", "database queries"],
    frequency: 0.10,
    context: ["wasn't sure about the data analysis", "finish the database queries"]
  }
]
```

#### 2. Productivity Blockers Detected
```javascript
[
  {
    type: "procrastination",
    severity: "medium",
    confidence: 0.75,
    indicators: ["procrastinating", "wasn't sure"],
    context: "kept procrastinating on the presentation slides because I wasn't sure about the data analysis",
    suggestions: [
      "Break task into smaller chunks",
      "Use time-boxing technique", 
      "Identify root cause of avoidance"
    ]
  },
  {
    type: "workflow_disruption",
    severity: "high", 
    confidence: 0.85,
    indicators: ["interruptions", "broke my focus"],
    context: "Had three interruptions from team meetings that broke my focus",
    suggestions: [
      "Implement focus blocks",
      "Turn off notifications",
      "Communicate boundaries to team"
    ]
  },
  {
    type: "time_management",
    severity: "medium",
    confidence: 0.70,
    indicators: ["deadline pressure", "behind schedule"], 
    context: "project deadline approaching... still behind schedule",
    suggestions: [
      "Review and adjust schedules",
      "Use time-blocking",
      "Prioritize tasks using Eisenhower matrix"
    ]
  }
]
```

#### 3. Multi-dimensional Sentiment Analysis
```javascript
{
  overall: {
    polarity: -0.4,        // Negative sentiment
    subjectivity: 0.7,     // Fairly subjective
    label: "negative"
  },
  emotions: {
    joy: 0.1,
    anger: 0.2,
    fear: 0.6,             // High anxiety/fear
    sadness: 0.3,
    surprise: 0.0,
    trust: 0.2
  },
  arousal: "moderate",      // Neither calm nor highly energetic
  confidence_level: "uncertain",  // "wasn't sure" indicates uncertainty
  productivity_sentiment: "overwhelmed"  // Dominant productivity emotion
}
```

## Integration with Pattern Recognition

The enhanced `PatternRecognitionService` now provides:

### Advanced Pattern Data
```javascript
{
  type: 'productivity_themes',
  confidence: 0.8,
  timeRange: 'recent',
  description: 'Identified 2 productivity themes: project management, problem solving',
  themes: [/* ProductivityTheme[] */],
  nlpKeywords: ['project', 'deadline', 'data analysis', 'database']
}
```

### Enhanced Insights
```javascript
[
  {
    category: 'Productivity Blockers',
    insight: 'High-severity blockers detected: workflow_disruption. Implement focus blocks, Turn off notifications, Communicate boundaries to team',
    confidence: 0.85,
    supportingData: [/* BlockerPattern[] */],
    timestamp: Date.now()
  },
  {
    category: 'Emotional Well-being', 
    insight: 'Productivity sentiment: overwhelmed. Associated emotions: fear',
    confidence: 0.7,
    supportingData: [/* SentimentAnalysis */],
    timestamp: Date.now()
  }
]
```

## Commands Usage

### 1. Generate Comprehensive Analysis
```bash
# Use the command palette or ribbon icon
> Comprehensive Journal Analysis
```

This will:
- Extract productivity themes using TF-IDF
- Detect blockers with pattern matching
- Perform sentiment analysis
- Generate actionable insights
- Cache results for performance

### 2. Pattern-Only Analysis  
```bash
> Analyze Journal Patterns
```

Focuses specifically on behavioral patterns without trends.

### 3. Trend Analysis
```bash
> Analyze Journal Trends  
```

Analyzes changes over time with NLP insights.

## Performance Considerations

- **Caching**: NLP results are cached for 6-24 hours depending on analysis type
- **Incremental Processing**: Only new content triggers re-analysis
- **Depth Settings**: 
  - `basic`: Fast keyword-based analysis
  - `moderate`: Balanced NLP with core features (recommended)
  - `deep`: Full semantic analysis (slower but comprehensive)

## Privacy & Security

- All NLP processing happens locally using the installed libraries
- No data is sent to external services beyond your configured OpenAI API for insights
- Analysis results are cached locally and cleared on plugin unload
- Encrypted API key storage is still available for OpenAI interactions

## Customization

The NLP service can be extended with additional:
- Custom productivity theme categories
- Domain-specific blocker patterns  
- Personalized sentiment indicators
- Industry-specific keyword vocabularies

See the `NLPAnalysisService.ts` source code for customization points.