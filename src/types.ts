// src/types.ts

import { EncryptedData } from "./services";

export interface JournalReflectionSettings {
	// LLM Provider Settings
	llmProvider: 'openai' | 'ollama';
	// OpenAI Settings
	openaiApiKey: string | EncryptedData;
	openaiModel: string;
	openaiMaxTokens?: number;
	openaiTemperature?: number;
	// Ollama Settings
	ollamaBaseUrl: string;
	ollamaModel: string;
	ollamaTimeout: number;
	// General Settings
	daysToInclude: number;
	excludePrivate: boolean;
	periodicNoteFolders: string[];
	reflectionFolder: string;
	encryptionEnabled?: boolean;
	encryptionSetup?: boolean;
	// Analysis Settings
	communicationStyle?: 'direct' | 'gentle' | 'encouraging';
	analysisDepth?: 'basic' | 'standard' | 'detailed';
	analysisEnabled?: boolean;
	patternThreshold?: number;
	enableTrendAnalysis?: boolean;
	enableSemanticAnalysis?: boolean;
	cacheAnalysisResults?: boolean;
	// Legacy Advanced NLP Settings (kept for compatibility)
	enableAdvancedNLP?: boolean;
	nlpAnalysisDepth?: 'basic' | 'moderate' | 'deep';
	blockerDetectionSensitivity?: 'low' | 'medium' | 'high';
	// Analysis Scope Settings
	enabledAnalysisScopes?: boolean;
	analysisScope?: 'whole-life' | 'work-only' | 'custom';
	customAnalysisScope: {
		name: string;
		includeKeywords: string[];
		excludeKeywords: string[];
		includeFolders: string[];
		excludeFolders: string[];
		includeTags: string[];
		excludeTags: string[];
	};
	// Scan Frequency Settings
	enableAutoScan?: boolean;
	scanFrequency?: 'manual' | 'daily' | 'weekly';
	lastAutoScan?: number;
}