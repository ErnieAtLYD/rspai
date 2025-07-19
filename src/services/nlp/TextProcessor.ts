// src/services/nlp/TextProcessor.ts

import { getNlp, getNatural, CompromiseDoc } from './nlp-loader';

export interface EntityData {
	people: string[];
	places: string[];
	organizations: string[];
}

export class TextProcessor {
	private stemmer: any = null;
	private stopWords: Set<string> | null = null;

	private async ensureNaturalDependencies(): Promise<void> {
		if (!this.stemmer || !this.stopWords) {
			const natural = await getNatural();
			this.stemmer = natural.PorterStemmer;
			this.stopWords = new Set(natural.stopwords);
		}
	}

	cleanText(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^\w\s]/g, " ") // Remove punctuation
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim();
	}

	async tokenizeText(text: string): Promise<string[]> {
		await this.ensureNaturalDependencies();
		const natural = await getNatural();
		const tokenizer = new natural.WordTokenizer();
		return tokenizer.tokenize(text)
			.filter((token: string) => token.length > 2 && !this.stopWords!.has(token))
			.map((token: string) => this.stemmer.stem(token));
	}

	extractEntities(doc: CompromiseDoc): EntityData {
		return {
			people: doc.people().out("array"),
			places: doc.places().out("array"),
			organizations: doc.organizations().out("array")
		};
	}

	async extractKeywords(text: string): Promise<string[]> {
		const natural = await getNatural();
		const tfidf = new natural.TfIdf();
		tfidf.addDocument(text);
		
		const keywords: string[] = [];
		const terms = tfidf.listTerms(0);
		
		// Extract top keywords based on TF-IDF scores
		terms
			.sort((a, b) => b.tfidf - a.tfidf)
			.slice(0, 10)
			.forEach(item => {
				if (item.tfidf > 0.1) {
					keywords.push(item.term);
				}
			});
		
		return keywords;
	}

	async processText(text: string): Promise<{
		cleanedText: string;
		tokens: string[];
		entities: EntityData | null;
		keywords: string[];
	}> {
		const cleanedText = this.cleanText(text);
		const tokens = await this.tokenizeText(cleanedText);
		
		let entities: EntityData | null = null;
		try {
			const nlp = await getNlp();
			const doc = nlp(text);
			entities = this.extractEntities(doc);
		} catch (error) {
			// Could use logger here if needed, but this is a lightweight fallback
			console.warn("Entity extraction failed:", error);
		}
		
		const keywords = await this.extractKeywords(cleanedText);
		
		return {
			cleanedText,
			tokens,
			entities,
			keywords
		};
	}

	generateTextHash(text: string): string {
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash &= hash;
		}
		return hash.toString(36);
	}
}