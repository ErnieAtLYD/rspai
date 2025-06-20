/**
 * Integration tests for Pattern Detection Engine
 * Tests the complete pattern detection workflow with real components
 */

import { PatternDetectionValidator } from "../../src/pattern-detection-validator";
import { PrivacyFilter } from "../../src/privacy-filter";
import { Logger, LogLevel } from "../../src/logger";
import {
	PatternDefinition,
	PatternType,
	PatternClassification,
	AnalysisScope,
} from "../../src/pattern-detection-interfaces";

// Simple mock app for testing
const createMockApp = () => ({
	vault: {
		getMarkdownFiles: () => [],
		getAbstractFileByPath: () => null,
		read: () => Promise.resolve(""),
		adapter: {
			stat: () => Promise.resolve({ mtime: Date.now(), size: 100 }),
			exists: () => Promise.resolve(true),
		},
	},
	metadataCache: {
		getFileCache: () => null,
	},
});

describe("Pattern Detection Integration Tests", () => {
	let validator: PatternDetectionValidator;
	let privacyFilter: PrivacyFilter;
	let logger: Logger;
	let mockApp: any;

	beforeEach(() => {
		mockApp = createMockApp();
		logger = new Logger("PatternDetectionTest", false, LogLevel.ERROR);
		validator = new PatternDetectionValidator();
		privacyFilter = new PrivacyFilter(logger, {});
	});

	describe("Pattern Validation Workflow", () => {
		test("should validate complete pattern detection workflow", () => {
			// Create a realistic pattern that would be detected
			const productivityPattern: PatternDefinition = {
				id: "prod-pattern-001",
				type: "productivity-theme" as PatternType,
				name: "Morning Productivity Burst",
				description:
					"High productivity pattern observed in morning hours with task completion and energy",
				classification: "high" as PatternClassification,
				confidence: 0.87,
				supportingEvidence: [
					"completed 5 tasks before 10am",
					"felt energized and focused",
					"minimal distractions mentioned",
					"positive language around accomplishments",
				],
				frequency: {
					count: 12,
					period: "2 weeks",
					rate: 0.85,
					trend: "increasing",
				},
				temporal: {
					firstSeen: new Date("2024-01-01T08:00:00Z"),
					lastSeen: new Date("2024-01-14T09:30:00Z"),
					peakPeriods: ["08:00-10:00", "09:00-11:00"],
				},
				correlations: {
					relatedPatterns: [
						"energy-pattern-001",
						"focus-pattern-002",
					],
					strength: 0.73,
				},
				metadata: {
					detectedAt: new Date(),
					sourceFiles: [
						"daily-notes/2024-01-01.md",
						"daily-notes/2024-01-02.md",
						"daily-notes/2024-01-05.md",
					],
					analysisScope: "whole-life" as AnalysisScope,
					modelUsed: "gpt-4",
				},
			};

			// Validate the pattern
			const validationResult =
				validator.validatePatternDefinition(productivityPattern);

			expect(validationResult.isValid).toBe(true);
			expect(validationResult.errors).toHaveLength(0);
			expect(validationResult.warnings).toBeDefined();
		});

		test("should detect and validate sentiment patterns", () => {
			const sentimentPattern: PatternDefinition = {
				id: "sentiment-pattern-001",
				type: "sentiment-pattern" as PatternType,
				name: "Weekly Stress Cycle",
				description:
					"Recurring pattern of stress buildup mid-week followed by relief on weekends",
				classification: "medium" as PatternClassification,
				confidence: 0.72,
				supportingEvidence: [
					"stressed about deadlines",
					"feeling overwhelmed with work",
					"grateful for weekend break",
					"recharged and ready for Monday",
				],
				frequency: {
					count: 8,
					period: "4 weeks",
					rate: 0.67,
					trend: "stable",
				},
				temporal: {
					firstSeen: new Date("2024-01-01"),
					lastSeen: new Date("2024-01-28"),
					peakPeriods: ["Wednesday", "Thursday"],
				},
				correlations: {
					relatedPatterns: ["work-pattern-001"],
					strength: 0.65,
				},
				metadata: {
					detectedAt: new Date(),
					sourceFiles: [
						"weekly-reviews/2024-W01.md",
						"weekly-reviews/2024-W02.md",
					],
					analysisScope: "work-only" as AnalysisScope,
					modelUsed: "gpt-3.5-turbo",
				},
			};

			const result =
				validator.validatePatternDefinition(sentimentPattern);
			expect(result.isValid).toBe(true);
		});

		test("should validate habit patterns with temporal data", () => {
			const habitPattern: PatternDefinition = {
				id: "habit-pattern-001",
				type: "habit-pattern" as PatternType,
				name: "Evening Reading Routine",
				description:
					"Consistent evening reading habit with positive impact on sleep and mood",
				classification: "high" as PatternClassification,
				confidence: 0.91,
				supportingEvidence: [
					"read for 30 minutes before bed",
					"slept better after reading",
					"feeling calmer in the evening",
					"enjoying fiction books",
				],
				frequency: {
					count: 18,
					period: "3 weeks",
					rate: 0.85,
					trend: "increasing",
				},
				temporal: {
					firstSeen: new Date("2024-01-01T21:00:00Z"),
					lastSeen: new Date("2024-01-21T21:30:00Z"),
					peakPeriods: ["21:00-22:00"],
				},
				correlations: {
					relatedPatterns: ["sleep-pattern-001", "mood-pattern-001"],
					strength: 0.78,
				},
				metadata: {
					detectedAt: new Date(),
					sourceFiles: [
						"daily-notes/2024-01-01.md",
						"daily-notes/2024-01-15.md",
					],
					analysisScope: "personal-only" as AnalysisScope,
					modelUsed: "claude-3",
				},
			};

			const result = validator.validatePatternDefinition(habitPattern);
			expect(result.isValid).toBe(true);
			expect(result.warnings).toBeDefined();
		});
	});

	describe("Privacy Integration", () => {
		test("should respect privacy settings in pattern detection", async () => {
			// Test file with privacy tag
			const privateFile = {
				path: "private/personal-thoughts.md",
				name: "personal-thoughts.md",
				extension: "md",
				stat: { mtime: Date.now(), size: 500 },
				vault: mockApp.vault,
			};

			// Mock file content with privacy tag
			mockApp.vault.read = jest.fn().mockResolvedValue(`
# Personal Thoughts #private

This is sensitive personal information that should not be analyzed.
Contains private financial details and personal relationships.
      `);

			// Test privacy check
			const fileContent = await mockApp.vault.read();
			const shouldExclude = privacyFilter.shouldExcludeFile(
				privateFile.path,
				fileContent
			);

			// Should be excluded due to #private tag
			expect(shouldExclude).toBe(true);
		});

		test("should allow analysis of non-private files", async () => {
			const publicFile = {
				path: "notes/learning-notes.md",
				name: "learning-notes.md",
				extension: "md",
				stat: { mtime: Date.now(), size: 300 },
				vault: mockApp.vault,
			};

			mockApp.vault.read = jest.fn().mockResolvedValue(`
# Learning Notes

Today I learned about TypeScript patterns and best practices.
Really enjoying the process of understanding complex systems.
      `);

			const fileContent = await mockApp.vault.read();
			const shouldExclude = privacyFilter.shouldExcludeFile(
				publicFile.path,
				fileContent
			);

			// Should not be excluded
			expect(shouldExclude).toBe(false);
		});
	});

	describe("Performance and Validation", () => {
		test("should validate patterns efficiently", () => {
			const patterns: PatternDefinition[] = [];

			// Generate multiple patterns for performance testing
			for (let i = 0; i < 100; i++) {
				patterns.push({
					id: `test-pattern-${i}`,
					type: "productivity-theme" as PatternType,
					name: `Test Pattern ${i}`,
					description: `Test pattern description ${i}`,
					classification: "medium" as PatternClassification,
					confidence: 0.5 + (i % 5) * 0.1,
					supportingEvidence: [`evidence-${i}`],
					frequency: {
						count: i + 1,
						period: "1 week",
						rate: 0.5,
						trend: "stable",
					},
					temporal: {
						firstSeen: new Date(2024, 0, 1 + i),
						lastSeen: new Date(2024, 0, 7 + i),
						peakPeriods: [],
					},
					correlations: {
						relatedPatterns: [],
						strength: 0,
					},
					metadata: {
						detectedAt: new Date(),
						sourceFiles: [`file-${i}.md`],
						analysisScope: "whole-life" as AnalysisScope,
					},
				});
			}

			const startTime = Date.now();

			const results = patterns.map((pattern) =>
				validator.validatePatternDefinition(pattern)
			);

			const endTime = Date.now();
			const processingTime = endTime - startTime;

			// All patterns should be valid
			expect(results.every((r) => r.isValid)).toBe(true);

			// Should process 100 patterns in reasonable time (< 1 second)
			expect(processingTime).toBeLessThan(1000);

			// Average processing time per pattern should be very fast
			const avgTimePerPattern = processingTime / patterns.length;
			expect(avgTimePerPattern).toBeLessThan(10); // < 10ms per pattern
		});

		test("should handle validation errors gracefully", () => {
			const invalidPatterns = [
				// Missing required fields
				{ id: "test" } as any,

				// Invalid confidence
				{
					id: "test-2",
					type: "productivity-theme",
					confidence: 1.5, // > 1.0
					name: "Test",
					description: "Test",
				} as any,

				// Invalid type
				{
					id: "test-3",
					type: "invalid-type",
					confidence: 0.8,
					name: "Test",
					description: "Test",
				} as any,
			];

			invalidPatterns.forEach((pattern, index) => {
				const result = validator.validatePatternDefinition(pattern);
				expect(result.isValid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(0);

				// Each error should have meaningful information
				result.errors.forEach((error) => {
					expect(error.message).toBeTruthy();
					expect(error.field).toBeTruthy();
					expect(error.code).toBeTruthy();
				});
			});
		});
	});

	describe("Pattern Type Coverage", () => {
		test("should support all defined pattern types", () => {
			const allPatternTypes: PatternType[] = [
				"productivity-theme",
				"productivity-blocker",
				"sentiment-pattern",
				"sentiment-change",
				"procrastination-language",
				"distraction-language",
				"task-switching",
				"positive-momentum",
				"work-pattern",
				"habit-pattern",
				"mood-pattern",
				"health-pattern",
				"personal-activity",
			];

			allPatternTypes.forEach((type) => {
				const pattern: PatternDefinition = {
					id: `test-${type}`,
					type,
					name: `Test ${type}`,
					description: `Test pattern for ${type}`,
					classification: "medium" as PatternClassification,
					confidence: 0.75,
					supportingEvidence: ["test evidence"],
					frequency: {
						count: 1,
						period: "1 day",
						rate: 1.0,
						trend: "stable",
					},
					temporal: {
						firstSeen: new Date(),
						lastSeen: new Date(),
						peakPeriods: [],
					},
					correlations: {
						relatedPatterns: [],
						strength: 0,
					},
					metadata: {
						detectedAt: new Date(),
						sourceFiles: ["test.md"],
						analysisScope: "whole-life" as AnalysisScope,
					},
				};

				const result = validator.validatePatternDefinition(pattern);
				expect(result.isValid).toBe(true);
			});
		});
	});

	describe("Analysis Scope Validation", () => {
		test("should support all analysis scopes", () => {
			const allScopes: AnalysisScope[] = [
				"whole-life",
				"work-only",
				"personal-only",
				"custom",
			];

			allScopes.forEach((scope) => {
				const pattern: PatternDefinition = {
					id: `test-scope-${scope}`,
					type: "productivity-theme" as PatternType,
					name: `Test Scope ${scope}`,
					description: `Test pattern for scope ${scope}`,
					classification: "medium" as PatternClassification,
					confidence: 0.75,
					supportingEvidence: ["test evidence"],
					frequency: {
						count: 1,
						period: "1 day",
						rate: 1.0,
						trend: "stable",
					},
					temporal: {
						firstSeen: new Date(),
						lastSeen: new Date(),
						peakPeriods: [],
					},
					correlations: {
						relatedPatterns: [],
						strength: 0,
					},
					metadata: {
						detectedAt: new Date(),
						sourceFiles: ["test.md"],
						analysisScope: scope,
					},
				};

				const result = validator.validatePatternDefinition(pattern);
				expect(result.isValid).toBe(true);
			});
		});
	});

	describe("Edge Cases and Robustness", () => {
		test("should handle extreme values gracefully", () => {
			const extremePattern: PatternDefinition = {
				id: "extreme-pattern",
				type: "productivity-theme" as PatternType,
				name: "Extreme Pattern",
				description:
					"Pattern with extreme values for testing robustness",
				classification: "high" as PatternClassification,
				confidence: 1.0, // Maximum confidence
				supportingEvidence: Array.from(
					{ length: 1000 },
					(_, i) => `evidence-${i}`
				), // Large array
				frequency: {
					count: 10000, // Very high count
					period: "1 year",
					rate: 1.0, // Maximum rate
					trend: "increasing",
				},
				temporal: {
					firstSeen: new Date("2020-01-01"), // Far in past
					lastSeen: new Date("2024-12-31"), // Far in future
					peakPeriods: Array.from(
						{ length: 100 },
						(_, i) => `period-${i}`
					), // Many periods
				},
				correlations: {
					relatedPatterns: Array.from(
						{ length: 50 },
						(_, i) => `pattern-${i}`
					), // Many correlations
					strength: 1.0, // Maximum strength
				},
				metadata: {
					detectedAt: new Date(),
					sourceFiles: Array.from(
						{ length: 500 },
						(_, i) => `file-${i}.md`
					), // Many source files
					analysisScope: "whole-life" as AnalysisScope,
					modelUsed: "test-model",
				},
			};

			const result = validator.validatePatternDefinition(extremePattern);
			expect(result.isValid).toBe(true);
		});

		test("should provide detailed validation metadata", () => {
			const pattern: PatternDefinition = {
				id: "metadata-test",
				type: "productivity-theme" as PatternType,
				name: "Metadata Test",
				description: "Testing validation metadata",
				classification: "medium" as PatternClassification,
				confidence: 0.8,
				supportingEvidence: ["evidence"],
				frequency: {
					count: 1,
					period: "1 day",
					rate: 1,
					trend: "stable",
				},
				temporal: {
					firstSeen: new Date(),
					lastSeen: new Date(),
					peakPeriods: [],
				},
				correlations: { relatedPatterns: [], strength: 0 },
				metadata: {
					detectedAt: new Date(),
					sourceFiles: [],
					analysisScope: "whole-life",
				},
			};

			const result = validator.validatePatternDefinition(pattern);

			expect(result.metadata).toBeDefined();
			expect(result.metadata.validatedAt).toBeInstanceOf(Date);
			expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
			expect(result.metadata.itemsValidated).toBe(1);
		});
	});
});
