// src/services/nlp/BlockerDetector.ts

import { TextProcessor } from './TextProcessor';

export interface BlockerPattern {
	type:
		| "procrastination"
		| "time_management"
		| "workflow_disruption"
		| "energy_motivation"
		| "external";
	severity: "low" | "medium" | "high";
	confidence: number;
	indicators: string[];
	context: string;
	suggestions?: string[];
}

export class BlockerDetector {
	private textProcessor: TextProcessor;
	private blockerPatterns: Map<string, { keywords: string[]; severity: "low" | "medium" | "high" }>;

	constructor(textProcessor: TextProcessor) {
		this.textProcessor = textProcessor;
		this.blockerPatterns = new Map();
		this.initializeBlockerPatterns();
	}

	private initializeBlockerPatterns(): void {
		this.blockerPatterns.set("procrastination", {
			keywords: [
				"procrastin", "delay", "postpone", "avoid", "distract", "waste",
				"lazy", "unmotiv", "scroll", "social", "youtube", "netflix"
			],
			severity: "medium"
		});

		this.blockerPatterns.set("time_management", {
			keywords: [
				"rush", "deadline", "late", "behind", "overwhelm", "juggl",
				"multitask", "switch", "interrupt", "urgent", "chaotic"
			],
			severity: "high"
		});

		this.blockerPatterns.set("workflow_disruption", {
			keywords: [
				"interrupt", "distract", "break", "stop", "switch", "context",
				"meeting", "call", "notification", "alert", "ping"
			],
			severity: "medium"
		});

		this.blockerPatterns.set("energy_motivation", {
			keywords: [
				"tired", "exhaust", "burn", "drain", "low", "energy",
				"motivation", "uninspir", "demotiv", "stuck", "block"
			],
			severity: "high"
		});

		this.blockerPatterns.set("external", {
			keywords: [
				"technical", "system", "crash", "bug", "slow", "network",
				"tool", "broken", "error", "fail", "issue", "problem"
			],
			severity: "low"
		});
	}

	private async detectPatternInText(text: string, pattern: { keywords: string[] }): Promise<string[]> {
		const processed = await this.textProcessor.processText(text);
		return processed.tokens.filter(token =>
			pattern.keywords.some(keyword => token.includes(keyword))
		);
	}

	private calculatePatternConfidence(matches: string[], totalTokens: number): number {
		return matches.length / totalTokens;
	}

	private getSeverityLevel(type: string, confidence: number): "low" | "medium" | "high" {
		const basePattern = this.blockerPatterns.get(type);
		if (!basePattern) return "low";

		if (confidence > 0.15) return "high";
		if (confidence > 0.08) return "medium";
		return "low";
	}

	private generateSuggestions(type: string): string[] {
		const suggestions: Record<string, string[]> = {
			procrastination: [
				"Try the Pomodoro Technique",
				"Break tasks into smaller chunks",
				"Remove distractions from workspace"
			],
			time_management: [
				"Prioritize tasks using Eisenhower Matrix",
				"Block time for deep work",
				"Batch similar activities"
			],
			workflow_disruption: [
				"Set specific times for checking messages",
				"Use focus mode or do not disturb",
				"Communicate boundaries to team"
			],
			energy_motivation: [
				"Take regular breaks",
				"Ensure adequate sleep and nutrition",
				"Consider task switching or delegation"
			],
			external: [
				"Identify and document technical issues",
				"Have backup tools and workflows",
				"Escalate persistent problems"
			]
		};

		return suggestions[type] || [];
	}

	async detectBlockers(text: string): Promise<BlockerPattern[]> {
		const processed = await this.textProcessor.processText(text);
		const blockers: BlockerPattern[] = [];

		for (const [blockerType, pattern] of this.blockerPatterns) {
			const matches = await this.detectPatternInText(text, pattern);
			
			if (matches.length > 0) {
				const confidence = this.calculatePatternConfidence(matches, processed.tokens.length);
				
				if (confidence > 0.02) { // Minimum threshold
					const severity = this.getSeverityLevel(blockerType, confidence);
					
					blockers.push({
						type: blockerType as any,
						severity,
						confidence,
						indicators: matches,
						context: processed.cleanedText.substring(0, 200),
						suggestions: this.generateSuggestions(blockerType)
					});
				}
			}
		}

		return blockers.sort((a, b) => b.confidence - a.confidence);
	}
}