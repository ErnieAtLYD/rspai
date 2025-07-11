// src/services/index.ts

export { ServiceManager } from "./ServiceManager";
export type { IService, ServiceRegistration, ServiceConstructor, ServiceFactory } from "./ServiceManager";
export { BaseService } from "./BaseService";
export { AIService } from "./AIService";
export type { AIServiceConfig } from "./AIService";
export { FileOperationsService } from "./FileOperationsService";
export type { FileOperationsConfig } from "./FileOperationsService";
export { EncryptionService } from "./EncryptionService";
export type { EncryptionConfig, EncryptedData } from "./EncryptionService";
export { CacheService } from "./CacheService";
export type { CacheEntry, CacheOptions, CacheConfig } from "./CacheService";
export { PatternRecognitionService } from "./PatternRecognitionService";
export type { PatternData, TrendData, InsightData, PatternRecognitionConfig } from "./PatternRecognitionService";
export { AnalysisManager } from "./AnalysisManager";
export type { AnalysisRequest, AnalysisOptions, AnalysisResult, AnalysisManagerConfig } from "./AnalysisManager";
export { ErrorHandlingService } from "./ErrorHandlingService";
export type { ErrorHandlingConfig, ErrorContext, ErrorHandlerOptions } from "./ErrorHandlingService";
export { RetrospectError, ErrorType, ErrorCode } from "./ErrorHandlingService";