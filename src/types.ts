// src/types.ts

import { EncryptedData } from "./services";

export interface JournalReflectionSettings {
    openaiApiKey: string | EncryptedData;
    openaiModel: string;
    daysToInclude: number;
    excludePrivate: boolean;
    periodicNoteFolders: string[];
    reflectionFolder: string;
    encryptionEnabled?: boolean;
    encryptionSetup?: boolean;
    analysisEnabled?: boolean;
    patternThreshold?: number;
    enableTrendAnalysis?: boolean;
    enableSemanticAnalysis?: boolean;
    cacheAnalysisResults?: boolean;
    enableAdvancedNLP?: boolean;
    nlpAnalysisDepth?: "basic" | "moderate" | "deep";
    blockerDetectionSensitivity?: "low" | "medium" | "high";
    // Analysis Scope Settings
    enabledAnalysisScopes?: boolean;
    analysisScope?: "whole-life" | "work-only" | "custom";
    customAnalysisScope?: {
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
    scanFrequency?: "manual" | "daily" | "weekly";
    lastAutoScan?: number;
}