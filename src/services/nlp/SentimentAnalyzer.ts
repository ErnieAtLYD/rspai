// src/services/nlp/SentimentAnalyzer.ts

import { TextProcessor } from './TextProcessor';
import { getSentiment, SentimentAnalyzerLib } from './nlp-loader';

export interface SentimentAnalysis {
	overall: {
		polarity: number; // -1 to 1
		subjectivity: number; // 0 to 1
		label: "positive" | "neutral" | "negative";
	};
	emotions: {
		joy: number;
		anger: number;
		fear: number;
		sadness: number;
		surprise: number;
		trust: number;
	};
	arousal: "calm" | "moderate" | "energetic";
	productivity_sentiment: "optimistic" | "neutral" | "concerned";
	confidence_level: number;
}

export class SentimentAnalyzer {
	private textProcessor: TextProcessor;
	private sentimentAnalyzer: SentimentAnalyzerLib | null = null;

	constructor(textProcessor: TextProcessor) {
		this.textProcessor = textProcessor;
	}

	private async ensureSentimentAnalyzer(): Promise<SentimentAnalyzerLib> {
		if (!this.sentimentAnalyzer) {
			const SentimentClass = await getSentiment();
			this.sentimentAnalyzer = new SentimentClass();
		}
		return this.sentimentAnalyzer;
	}

	private calculateProductivitySentiment(polarity: number, emotions: any): "optimistic" | "neutral" | "concerned" {
		if (polarity > 0.3 && emotions.joy > emotions.sadness) {
			return "optimistic";
		} else if (polarity < -0.3 || emotions.sadness > emotions.joy) {
			return "concerned";
		}
		return "neutral";
	}

	private calculateArousal(emotions: any): "calm" | "moderate" | "energetic" {
		const energyScore = emotions.joy + emotions.surprise - emotions.sadness - emotions.fear;
		if (energyScore > 0.5) return "energetic";
		if (energyScore < -0.5) return "calm";
		return "moderate";
	}

	private async analyzeEmotions(text: string): Promise<any> {
		const processed = await this.textProcessor.processText(text);
		
		// Simple keyword-based emotion detection
		const emotionKeywords = {
			joy: ["happy", "joy", "excited", "pleased", "delighted", "satisfied", "accomplished"],
			anger: ["angry", "frustrated", "annoyed", "irritated", "mad", "furious"],
			fear: ["afraid", "scared", "worried", "anxious", "nervous", "concerned"],
			sadness: ["sad", "disappointed", "down", "depressed", "upset", "discouraged"],
			surprise: ["surprised", "amazed", "shocked", "unexpected", "astonished"],
			trust: ["confident", "secure", "trust", "reliable", "certain", "assured"]
		};

		const emotions: any = {};
		for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
			const matches = processed.tokens.filter(token =>
				keywords.some(keyword => token.includes(keyword))
			).length;
			emotions[emotion] = Math.min(matches / processed.tokens.length * 10, 1.0);
		}

		return emotions;
	}

	async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
		try {
			const sentimentAnalyzer = await this.ensureSentimentAnalyzer();
			const sentimentResult = sentimentAnalyzer.analyze(text);
			const polarity = Math.max(-1, Math.min(1, sentimentResult.score / 10));
			
			const emotions = await this.analyzeEmotions(text);
			const arousal = this.calculateArousal(emotions);
			const productivitySentiment = this.calculateProductivitySentiment(polarity, emotions);
			
			let label: "positive" | "neutral" | "negative";
			if (polarity > 0.1) label = "positive";
			else if (polarity < -0.1) label = "negative";
			else label = "neutral";

			return {
				overall: {
					polarity,
					subjectivity: 0.5, // Simplified - could be enhanced
					label
				},
				emotions,
				arousal,
				productivity_sentiment: productivitySentiment,
				confidence_level: Math.abs(polarity)
			};
		} catch (error) {
			// Silently return neutral sentiment on error for lightweight fallback
			return this.getNeutralSentiment();
		}
	}

	private getNeutralSentiment(): SentimentAnalysis {
		return {
			overall: {
				polarity: 0,
				subjectivity: 0,
				label: "neutral"
			},
			emotions: {
				joy: 0,
				anger: 0,
				fear: 0,
				sadness: 0,
				surprise: 0,
				trust: 0
			},
			arousal: "moderate",
			productivity_sentiment: "neutral",
			confidence_level: 0
		};
	}
}