// src/ui/settings/settingsConfig.ts
import { SettingDefinition } from './SettingBuilder';

/**
 * The SettingsSection interface is responsible for defining the configuration of a settings section.
 */
export interface SettingsSection {
  title: string;
  icon: string;
  collapsible?: boolean;
  settings: SettingDefinition[];
}

import JournalReflectionPlugin from "../../main";

/**
 * 
 * @param plugin 
 * @returns 
 */
export function createSettingsConfig(plugin: JournalReflectionPlugin): SettingsSection[] {
  return [
    {
      title: "AI Provider",
      icon: "🤖",
      settings: [
        {
          type: 'dropdown',
          name: "AI Provider",
          description: "Choose your preferred AI provider. OpenAI requires an API key, Ollama runs locally for enhanced privacy.",
          key: 'llmProvider',
          options: [
            { value: 'openai', label: 'OpenAI' },
            { value: 'ollama', label: 'Ollama' }
          ],
          defaultValue: 'openai'
        },
        // OpenAI specific settings
        // TODO: Implement openEncryptionModal method
        // {
        //   type: 'button',
        //   name: "API Key Security",
        //   description: "Manage encryption settings for your API key.",
        //   key: 'manageEncryption',
        //   buttonText: "Manage Encryption",
        //   action: () => plugin.openEncryptionModal(),
        //   conditional: (settings) => settings.llmProvider === 'openai'
        // },
        {
          type: 'text',
          name: "OpenAI API Key",
          description: "Your OpenAI API key for generating reflections",
          key: 'openaiApiKey',
          placeholder: "sk-...",
          inputType: 'password',
          defaultValue: '',
          conditional: (settings) => settings.llmProvider === 'openai'
        },
        {
          type: 'dropdown',
          name: "OpenAI Model",
          description: "Which OpenAI model to use for analysis and summaries",
          key: 'openaiModel',
          options: [
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
          ],
          defaultValue: 'gpt-4o-mini',
          conditional: (settings) => settings.llmProvider === 'openai'
        },
        // Ollama specific settings
        {
          type: 'text',
          name: "Ollama Base URL",
          description: "The base URL where Ollama is running (usually http://localhost:11434)",
          key: 'ollamaBaseUrl',
          placeholder: "http://localhost:11434",
          defaultValue: 'http://localhost:11434',
          conditional: (settings) => settings.llmProvider === 'ollama'
        },
        {
          type: 'text',
          name: "Ollama Model",
          description: "The Ollama model to use (ensure it's downloaded first)",
          key: 'ollamaModel',
          placeholder: "llama3.1:8b",
          defaultValue: 'llama3.1:8b',
          conditional: (settings) => settings.llmProvider === 'ollama'
        },
        // TODO: Implement testOllamaConnection method
        // {
        //   type: 'button',
        //   name: "Test Connection",
        //   description: "Test if Ollama is running and the model is available",
        //   key: 'testOllamaConnection',
        //   buttonText: "Test Connection",
        //   action: () => plugin.testOllamaConnection(),
        //   conditional: (settings) => settings.llmProvider === 'ollama'
        // }
      ]
    },
    {
      title: "Analysis Settings",
      icon: "⚙️",
      settings: [
        {
          type: 'dropdown',
          name: "Communication Style",
          description: "How should AI communicate insights with you?",
          key: 'communicationStyle',
          options: [
            { value: 'direct', label: 'Direct - Straightforward and concise' },
            { value: 'gentle', label: 'Gentle - Supportive and nurturing' },
            { value: 'encouraging', label: 'Encouraging - Uplifting and motivational' }
          ],
          defaultValue: 'encouraging'
        },
        {
          type: 'dropdown',
          name: "Analysis Scope",
          description: "Choose the scope of analysis to focus on specific areas",
          key: 'analysisScope',
          options: [
            { value: 'whole-life', label: 'Whole Life - Analyze all entries' },
            { value: 'work-only', label: 'Work Only - Focus on work-related entries' },
            { value: 'custom', label: 'Custom - Define your own scope' }
          ],
          defaultValue: 'whole-life'
        },
        {
          type: 'dropdown',
          name: "Analysis Depth",
          description: "How deep should the analysis be?",
          key: 'analysisDepth',
          options: [
            { value: 'basic', label: 'Basic - Quick insights and patterns' },
            { value: 'standard', label: 'Standard - Balanced analysis with good detail' },
            { value: 'detailed', label: 'Detailed - Comprehensive deep-dive analysis' }
          ],
          defaultValue: 'standard'
        },
        {
          type: 'toggle',
          name: "Enable Trend Analysis",
          description: "Analyze patterns and changes over time in your journal entries",
          key: 'enableTrendAnalysis',
          defaultValue: true
        },
        {
          type: 'toggle',
          name: "Enable AI-Powered Insights",
          description: "Use AI to generate deep semantic insights and personalized recommendations",
          key: 'enableSemanticAnalysis',
          defaultValue: true
        },
        {
          type: 'toggle',
          name: "Cache Analysis Results",
          description: "Cache analysis results to improve performance (recommended)",
          key: 'cacheAnalysisResults',
          defaultValue: true
        }
      ]
    },
    {
      title: "Auto-Scan Settings",
      icon: "🕐",
      settings: [
        {
          type: 'toggle',
          name: "Enable Auto-scan",
          description: "Automatically run analysis at specified intervals",
          key: 'enableAutoScan',
          defaultValue: false
        },
        {
          type: 'dropdown',
          name: "Scan Frequency",
          description: "How often to automatically run analysis",
          key: 'scanFrequency',
          options: [
            { value: 'manual', label: 'Manual - Only when triggered manually' },
            { value: 'daily', label: 'Daily - Run analysis every 24 hours' },
            { value: 'weekly', label: 'Weekly - Run analysis every 7 days' }
          ],
          defaultValue: 'weekly',
          conditional: (settings) => Boolean(settings.enableAutoScan)
        },
        {
          type: 'button',
          name: "Run Auto-scan Now",
          description: "Trigger an immediate analysis run (useful for testing)",
          key: 'runAutoScanNow',
          buttonText: "Run Now",
          action: () => plugin.runAutoScan(),
          conditional: (settings) => Boolean(settings.enableAutoScan)
        }
      ]
    },
    {
      title: "Privacy & Content",
      icon: "🔒",
      settings: [
        {
          type: 'toggle',
          name: "Exclude Private Notes",
          description: "Skip notes that contain the #private tag to protect sensitive content",
          key: 'excludePrivate',
          defaultValue: true
        },
        {
          type: 'text',
          name: "Periodic Note Folders",
          description: "Comma-separated paths to your periodic note folders",
          key: 'periodicNoteFolders',
          placeholder: "Daily Notes, Journal",
          defaultValue: '',
          validation: (_value: string) => {
            // Custom validation logic here
            return null;
          }
        },
        {
          type: 'text',
          name: "Reflection Output Folder",
          description: "Where to save generated reflections (will be created if it doesn't exist)",
          key: 'reflectionFolder',
          defaultValue: 'Summaries'
        },
        {
          type: 'slider',
          name: "Days to Include",
          description: "How many days back to look for journal entries",
          key: 'daysToInclude',
          min: 1,
          max: 30,
          step: 1,
          defaultValue: 7,
          dynamicTooltip: true
        }
      ]
    },
    {
      title: "Advanced",
      icon: "🔧",
      collapsible: true,
      settings: [
        {
          type: 'slider',
          name: "Pattern Recognition Sensitivity",
          description: "Adjust how sensitive pattern detection is (lower = more patterns detected)",
          key: 'patternThreshold',
          min: 0.1,
          max: 1.0,
          step: 0.1,
          defaultValue: 0.6,
          dynamicTooltip: true
        },
        {
          type: 'toggle',
          name: "Enable Advanced NLP Analysis",
          description: "Use advanced NLP for deeper insights including productivity themes, blocker detection, and multi-dimensional sentiment analysis",
          key: 'enableAdvancedNLP',
          defaultValue: true
        },
        {
          type: 'dropdown',
          name: "Blocker Detection Sensitivity",
          description: "Adjust how sensitive the system is to detecting productivity blockers",
          key: 'blockerDetectionSensitivity',
          options: [
            { value: 'low', label: 'Low - Only detect obvious blockers' },
            { value: 'medium', label: 'Medium - Balanced detection' },
            { value: 'high', label: 'High - Detect subtle blockers' }
          ],
          defaultValue: 'medium',
          conditional: (settings) => Boolean(settings.enableAdvancedNLP)
        }
      ]
    }
  ];
}