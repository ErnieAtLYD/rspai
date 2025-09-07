// Tests for SettingsUI functionality

import { jest } from "@jest/globals";
import type { App } from "obsidian";

// Mock Obsidian classes
import mockObsidian from "./mocks/obsidian.js";
const { Setting } = mockObsidian;

// Make Setting available globally for the tests
global.Setting = Setting;

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
	callback(0);
	return 0;
}) as typeof global.requestAnimationFrame;

// Mock dependencies
interface MockPlugin {
	settings: {
		llmProvider: "openai" | "ollama";
		openaiApiKey: string;
		openaiModel: string;
		ollamaBaseUrl: string;
		ollamaModel: string;
		ollamaTimeout: number;
		daysToInclude: number;
		excludePrivate: boolean;
		periodicNoteFolders: string[];
		reflectionFolder: string;
		encryptionEnabled: boolean;
		encryptionSetup: boolean;
		communicationStyle: "direct" | "gentle" | "encouraging";
		analysisDepth: "basic" | "standard" | "detailed";
		analysisScope: "whole-life" | "work-only" | "custom";
		enableTrendAnalysis: boolean;
		enableSemanticAnalysis: boolean;
		cacheAnalysisResults: boolean;
		enableAdvancedNLP: boolean;
		nlpAnalysisDepth: "basic" | "moderate" | "deep";
		blockerDetectionSensitivity: "low" | "medium" | "high";
		patternThreshold: number;
		enableAutoScan: boolean;
		customAnalysisScope: {
			name: string;
			includeKeywords: string[];
			excludeKeywords: string[];
			includeFolders: string[];
			excludeFolders: string[];
			includeTags: string[];
			excludeTags: string[];
		};
	};
	saveSettings: jest.Mock;
	updateServiceConfigurations: jest.Mock;
	runAutoScan: jest.Mock;
}

const mockPlugin: MockPlugin = {
	settings: {
		llmProvider: "openai",
		openaiApiKey: "test-key",
		openaiModel: "gpt-4o-mini",
		ollamaBaseUrl: "http://localhost:11434",
		ollamaModel: "llama3.1:8b",
		ollamaTimeout: 30000,
		daysToInclude: 7,
		excludePrivate: true,
		periodicNoteFolders: ["Daily Notes"],
		reflectionFolder: "Summaries",
		encryptionEnabled: false,
		encryptionSetup: false,
		communicationStyle: "encouraging",
		analysisDepth: "standard",
		analysisScope: "whole-life",
		enableTrendAnalysis: true,
		enableSemanticAnalysis: true,
		cacheAnalysisResults: true,
		enableAdvancedNLP: true,
		nlpAnalysisDepth: "moderate",
		blockerDetectionSensitivity: "medium",
		patternThreshold: 0.6,
		enableAutoScan: false,
		customAnalysisScope: {
			name: "",
			includeKeywords: [],
			excludeKeywords: [],
			includeFolders: [],
			excludeFolders: [],
			includeTags: [],
			excludeTags: [],
		},
	},
	saveSettings: jest.fn().mockResolvedValue(undefined as never),
	updateServiceConfigurations: jest.fn().mockResolvedValue(undefined as never),
	runAutoScan: jest.fn(),
};

interface MockApp {
	vault: {
		getAbstractFileByPath: jest.Mock;
		createFolder: jest.Mock;
	};
}

const mockApp: MockApp = {
	vault: {
		getAbstractFileByPath: jest.fn(),
		createFolder: jest.fn().mockResolvedValue(undefined as never),
	},
};

// Mock DEFAULT_SETTINGS
const DEFAULT_SETTINGS = {
	customAnalysisScope: {
		name: "",
		includeKeywords: [],
		excludeKeywords: [],
		includeFolders: [],
		excludeFolders: [],
		includeTags: [],
		excludeTags: [],
	},
};

// Import the class to test after mocking
jest.mock("../src/main", () => ({
	default: jest.fn(),
	DEFAULT_SETTINGS,
}));

// Now import the SettingsUI class
import { JournalReflectionSettingTab } from "../src/ui/SettingsUI";

// Define mock element interface that more closely matches HTMLElement
interface MockElement {
	tagName: string;
	textContent: string;
	empty: jest.Mock;
	classList: {
		add: jest.Mock;
		contains: jest.Mock;
		toggle: jest.Mock;
	};
	style: Record<string, unknown>;
	addEventListener: jest.Mock;
	appendChild: jest.Mock;
	querySelector: jest.Mock;
	createSpan: jest.Mock;
	createEl: jest.Mock;
	createDiv: jest.Mock;
	setAttribute: jest.Mock;
	href: string;
	title: string;
}

// Define interface for accessing private methods in tests
interface SettingsTabWithPrivateMethods {
	renderSections(containerEl: MockElement, sections: unknown[]): void;
	renderSection(containerEl: MockElement, section: unknown): void;
	setupCollapsibleHeader(header: unknown, content: unknown, title: string, icon: string): void;
	onSettingUpdate(key: string, value: unknown): Promise<void>;
	addValidation(setting: unknown, config: unknown): void;
}

describe("JournalReflectionSettingTab", () => {
	let settingsTab: JournalReflectionSettingTab;
	let mockContainerEl: MockElement;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a helper function for comprehensive DOM mocking
		const createMockElement = (
			tag?: string,
			attrs?: Record<string, unknown>
		): MockElement => ({
			tagName: tag?.toUpperCase() || "DIV",
			textContent: (attrs?.text as string) || "",
			empty: jest.fn(),
			classList: {
				add: jest.fn(),
				contains: jest.fn().mockReturnValue(false),
				toggle: jest.fn(),
			},
			style: {} as Record<string, unknown>,
			addEventListener: jest.fn(),
			appendChild: jest.fn(),
			querySelector: jest.fn().mockReturnValue(null),
			createSpan: jest.fn().mockImplementation((attrs?: Record<string, unknown>) =>
				createMockElement("span", attrs)
			),
			createEl: jest.fn().mockImplementation((tag?: string, attrs?: Record<string, unknown>) =>
				createMockElement(tag, attrs)
			),
			createDiv: jest.fn().mockImplementation((attrs?: Record<string, unknown>) =>
				createMockElement("div", attrs)
			),
			setAttribute: jest.fn(),
			href: (attrs?.href as string) || "",
			title: (attrs?.title as string) || "",
		});

		mockContainerEl = createMockElement();

		settingsTab = new JournalReflectionSettingTab(
			mockApp as unknown as App,
			mockPlugin as never
		);
		
		// Override the containerEl property to use our mock
		Object.defineProperty(settingsTab, 'containerEl', {
			value: mockContainerEl,
			writable: true
		});
	});

	describe("Constructor", () => {
		test("should initialize with app and plugin", () => {
			expect(settingsTab.plugin).toBe(mockPlugin);
			expect(settingsTab.app).toBe(mockApp);
		});

		test("should initialize SettingBuilder and FolderValidator", () => {
			// Verify that the constructor completes without errors
			expect(settingsTab).toBeInstanceOf(JournalReflectionSettingTab);
		});
	});

	describe("display", () => {
		test("should clear container and create main sections", () => {
			settingsTab.display();

			expect(mockContainerEl.empty).toHaveBeenCalled();
			expect(mockContainerEl.createEl).toHaveBeenCalledWith("h2", {
				text: "Retrospect AI Settings",
			});

			// Check that section containers are created
			expect(mockContainerEl.createDiv).toHaveBeenCalledWith({
				cls: "retrospect-section",
			});
		});

		test("should render settings sections", () => {
			settingsTab.display();

			// Should create multiple sections based on the settings config
			expect(mockContainerEl.createDiv).toHaveBeenCalledTimes(5); // 5 sections in config
		});
	});

	describe("renderSections", () => {
		test("should render each section", () => {
			const mockSections = [
				{
					title: "Test Section",
					icon: "🧪",
					settings: []
				}
			];

			(settingsTab as unknown as SettingsTabWithPrivateMethods).renderSections(mockContainerEl, mockSections);

			expect(mockContainerEl.createDiv).toHaveBeenCalledWith({
				cls: "retrospect-section",
			});
		});
	});

	describe("renderSection", () => {
		test("should render section header", () => {
			const mockSection = {
				title: "Test Section",
				icon: "🧪",
				settings: []
			};

			(settingsTab as unknown as SettingsTabWithPrivateMethods).renderSection(mockContainerEl, mockSection);

			expect(mockContainerEl.createEl).toHaveBeenCalledWith("h3", {
				text: "🧪 Test Section",
				cls: undefined,
			});
		});

		test("should render collapsible section", () => {
			const mockSection = {
				title: "Test Section",
				icon: "🧪",
				collapsible: true,
				settings: []
			};

			(settingsTab as unknown as SettingsTabWithPrivateMethods).renderSection(mockContainerEl, mockSection);

			expect(mockContainerEl.createEl).toHaveBeenCalledWith("h3", {
				text: "🧪 Test Section",
				cls: "retrospect-collapsible-header",
			});

			expect(mockContainerEl.createDiv).toHaveBeenCalledWith({
				cls: "retrospect-collapsible-content retrospect-collapsed",
			});
		});
	});

	describe("setupCollapsibleHeader", () => {
		test("should setup click handler for collapsible header", () => {
			const mockHeader = {
				style: {} as Record<string, unknown>,
				addEventListener: jest.fn(),
				textContent: ""
			};
			const mockContent = {
				classList: {
					contains: jest.fn().mockReturnValue(true),
					toggle: jest.fn()
				}
			};

			(settingsTab as unknown as SettingsTabWithPrivateMethods).setupCollapsibleHeader(
				mockHeader,
				mockContent,
				"Test Title",
				"🧪"
			);

			expect(mockHeader.style.cursor).toBe("pointer");
			expect(mockHeader.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
		});
	});

	describe("onSettingUpdate", () => {
		test("should handle llmProvider change", async () => {
			await (settingsTab as unknown as SettingsTabWithPrivateMethods).onSettingUpdate("llmProvider", "ollama");

			expect(mockPlugin.updateServiceConfigurations).toHaveBeenCalled();
		});

		test("should handle enableAutoScan change", async () => {
			const displaySpy = jest.spyOn(settingsTab, 'display');
			
			await (settingsTab as unknown as SettingsTabWithPrivateMethods).onSettingUpdate("enableAutoScan", true);

			expect(displaySpy).toHaveBeenCalled();
		});

		test("should handle analysisScope change", async () => {
			const displaySpy = jest.spyOn(settingsTab, 'display');
			
			await (settingsTab as unknown as SettingsTabWithPrivateMethods).onSettingUpdate("analysisScope", "work-only");

			expect(displaySpy).toHaveBeenCalled();
		});

		test("should handle enableAdvancedNLP change", async () => {
			const displaySpy = jest.spyOn(settingsTab, 'display');
			
			await (settingsTab as unknown as SettingsTabWithPrivateMethods).onSettingUpdate("enableAdvancedNLP", false);

			expect(displaySpy).toHaveBeenCalled();
		});

		test("should handle other setting changes", async () => {
			const displaySpy = jest.spyOn(settingsTab, 'display');
			
			await (settingsTab as unknown as SettingsTabWithPrivateMethods).onSettingUpdate("daysToInclude", 14);

			// Should not trigger display for other settings
			expect(displaySpy).not.toHaveBeenCalled();
		});
	});

	describe("addValidation", () => {
		test("should validate periodicNoteFolders", () => {
			const mockSetting = new Setting(mockContainerEl as unknown as HTMLElement);
			const mockConfig = {
				key: "periodicNoteFolders",
				type: "text" as const,
				name: "Test",
				description: "Test",
				defaultValue: ""
			};

			// This should not throw an error
			expect(() => {
				(settingsTab as unknown as SettingsTabWithPrivateMethods).addValidation(mockSetting, mockConfig);
			}).not.toThrow();
		});

		test("should validate reflectionFolder", () => {
			const mockSetting = new Setting(mockContainerEl as unknown as HTMLElement);
			const mockConfig = {
				key: "reflectionFolder",
				type: "text" as const,
				name: "Test",
				description: "Test",
				defaultValue: ""
			};

			// This should not throw an error
			expect(() => {
				(settingsTab as unknown as SettingsTabWithPrivateMethods).addValidation(mockSetting, mockConfig);
			}).not.toThrow();
		});

		test("should handle other config keys", () => {
			const mockSetting = new Setting(mockContainerEl as unknown as HTMLElement);
			const mockConfig = {
				key: "otherSetting",
				type: "text" as const,
				name: "Test",
				description: "Test",
				defaultValue: ""
			};

			// This should not throw an error
			expect(() => {
				(settingsTab as unknown as SettingsTabWithPrivateMethods).addValidation(mockSetting, mockConfig);
			}).not.toThrow();
		});
	});

	describe("Integration Tests", () => {
		test("should display without errors", () => {
			expect(() => {
				settingsTab.display();
			}).not.toThrow();
		});

		test("should handle setting updates without errors", async () => {
			await expect(
				(settingsTab as unknown as SettingsTabWithPrivateMethods).onSettingUpdate("llmProvider", "openai")
			).resolves.not.toThrow();
		});

		test("should create settings UI components", () => {
			settingsTab.display();

			// Verify basic structure was created
			expect(mockContainerEl.empty).toHaveBeenCalled();
			expect(mockContainerEl.createEl).toHaveBeenCalledWith("h2", {
				text: "Retrospect AI Settings",
			});
			expect(mockContainerEl.createDiv).toHaveBeenCalled();
		});
	});

	describe("Settings Configuration", () => {
		test("should use proper plugin type in settings config", () => {
			// Test that the settings config is created without type errors
			settingsTab.display();

			// The fact that display() runs without throwing indicates
			// that createSettingsConfig works with the proper plugin type
			expect(mockContainerEl.empty).toHaveBeenCalled();
		});
	});
});