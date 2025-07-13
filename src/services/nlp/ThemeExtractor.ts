// src/services/nlp/ThemeExtractor.ts

import { TextProcessor } from './TextProcessor';
import { getNatural, NaturalModule } from './nlp-loader';

export interface ProductivityTheme {
	theme: string;
	confidence: number;
	keywords: string[];
	frequency: number;
	context: string[];
}

export class ThemeExtractor {
	private textProcessor: TextProcessor;
	private themeModels: Map<string, { keywords: string[]; weight: number }>;

	constructor(textProcessor: TextProcessor) {
		this.textProcessor = textProcessor;
		this.themeModels = new Map();
		this.initializeThemeModels();
	}

	private initializeThemeModels(): void {
		this.themeModels.set("deep_work", {
			keywords: [
				"focus", "concentrat", "deep", "immersiv", "flow", "uninterrupt",
				"prolong", "sustain", "absorb", "engag", "attent", "mindful"
			],
			weight: 1.2
		});

		this.themeModels.set("collaboration", {
			keywords: [
				"team", "collabor", "meet", "discuss", "partner", "group",
				"share", "coordin", "commun", "sync", "brainstorm", "together"
			],
			weight: 1.0
		});

		this.themeModels.set("learning", {
			keywords: [
				"learn", "study", "research", "explor", "understand", "master",
				"skill", "knowledg", "cours", "train", "develop", "grow"
			],
			weight: 1.1
		});

		this.themeModels.set("creative_work", {
			keywords: [
				"creat", "design", "innovat", "origin", "invent", "artisti",
				"imaginat", "inspir", "vision", "concept", "ideation", "experiment"
			],
			weight: 1.0
		});

		this.themeModels.set("planning", {
			keywords: [
				"plan", "strateg", "organ", "schedul", "priorit", "structur",
				"roadmap", "goal", "object", "timelinee", "agenda", "framework"
			],
			weight: 0.9
		});

		this.themeModels.set("execution", {
			keywords: [
				"execut", "implement", "deliver", "complet", "achiev", "finish",
				"produc", "output", "result", "accomplish", "realiz", "fulfill"
			],
			weight: 1.0
		});
	}

	calculateThemeRelevance(tokens: string[], themeKeywords: string[]): number {
		const matches = tokens.filter(token =>
			themeKeywords.some(keyword => token.includes(keyword))
		);
		return matches.length / tokens.length;
	}

	async extractThemes(text: string): Promise<ProductivityTheme[]> {
		const processed = await this.textProcessor.processText(text);
		const themes: ProductivityTheme[] = [];

		// Multi-dimensional theme analysis using TF-IDF
		const natural = await getNatural();
		const tfidf = new natural.TfIdf();
		tfidf.addDocument(processed.cleanedText);

		for (const [themeName, model] of this.themeModels) {
			const relevance = this.calculateThemeRelevance(processed.tokens, model.keywords);
			
			if (relevance > 0.05) {
				// Calculate frequency based on TF-IDF scores
				const themeTerms = tfidf.listTerms(0)
					.filter(term => model.keywords.some(kw => term.term.includes(kw)))
					.slice(0, 5);

				const frequency = themeTerms.reduce((sum, term) => sum + term.tfidf, 0);
				const confidence = Math.min(relevance * model.weight, 1.0);

				themes.push({
					theme: themeName,
					confidence,
					keywords: processed.keywords.filter(kw => 
						model.keywords.some(mk => kw.includes(mk))
					),
					frequency,
					context: themeTerms.map(t => t.term)
				});
			}
		}

		return themes.sort((a, b) => b.confidence - a.confidence);
	}
}