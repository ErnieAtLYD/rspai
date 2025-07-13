import { SentimentAnalyzer } from '../src/services/nlp/SentimentAnalyzer';
import { TextProcessor } from '../src/services/nlp/TextProcessor';

describe('SentimentAnalyzer with Dynamic Imports', () => {
    let sentimentAnalyzer: SentimentAnalyzer;
    let textProcessor: TextProcessor;

    beforeEach(() => {
        textProcessor = new TextProcessor();
        sentimentAnalyzer = new SentimentAnalyzer(textProcessor);
    });

    test('should analyze positive sentiment', async () => {
        const positiveText = 'I am very happy and excited about this great news!';
        
        const result = await sentimentAnalyzer.analyzeSentiment(positiveText);
        
        expect(result).toBeDefined();
        expect(result.overall.label).toBe('positive');
        expect(result.overall.polarity).toBeGreaterThan(0);
        expect(typeof result.confidence_level).toBe('number');
        expect(['optimistic', 'neutral', 'concerned']).toContain(result.productivity_sentiment);
        expect(['calm', 'moderate', 'energetic']).toContain(result.arousal);
    });

    test('should analyze negative sentiment', async () => {
        const negativeText = 'I am very sad and disappointed about this terrible situation.';
        
        const result = await sentimentAnalyzer.analyzeSentiment(negativeText);
        
        expect(result).toBeDefined();
        expect(result.overall.label).toBe('negative');
        expect(result.overall.polarity).toBeLessThan(0);
    });

    test('should analyze neutral sentiment', async () => {
        const neutralText = 'The weather today is cloudy with some sun.';
        
        const result = await sentimentAnalyzer.analyzeSentiment(neutralText);
        
        expect(result).toBeDefined();
        expect(result.overall.label).toBe('neutral');
        expect(Math.abs(result.overall.polarity)).toBeLessThanOrEqual(0.1);
    });

    test('should detect emotions in text', async () => {
        const emotionalText = 'I am so happy and excited but also a bit worried about the outcome.';
        
        const result = await sentimentAnalyzer.analyzeSentiment(emotionalText);
        
        expect(result.emotions).toBeDefined();
        expect(typeof result.emotions.joy).toBe('number');
        expect(typeof result.emotions.fear).toBe('number');
        expect(typeof result.emotions.anger).toBe('number');
        expect(typeof result.emotions.sadness).toBe('number');
        expect(typeof result.emotions.surprise).toBe('number');
        expect(typeof result.emotions.trust).toBe('number');
    });

    test('should handle empty text gracefully', async () => {
        const result = await sentimentAnalyzer.analyzeSentiment('');
        
        expect(result).toBeDefined();
        expect(result.overall.label).toBe('neutral');
        expect(result.overall.polarity).toBe(0);
    });

    test('should return consistent results for same input', async () => {
        const text = 'This is a consistent test input for sentiment analysis.';
        
        const result1 = await sentimentAnalyzer.analyzeSentiment(text);
        const result2 = await sentimentAnalyzer.analyzeSentiment(text);
        
        expect(result1.overall.polarity).toBe(result2.overall.polarity);
        expect(result1.overall.label).toBe(result2.overall.label);
    });
});