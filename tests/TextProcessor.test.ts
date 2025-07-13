import { TextProcessor } from '../src/services/nlp/TextProcessor';

describe('TextProcessor with Dynamic Imports', () => {
    let textProcessor: TextProcessor;

    beforeEach(() => {
        textProcessor = new TextProcessor();
    });

    test('should process text asynchronously', async () => {
        const testText = 'This is a test sentence for processing. It has multiple words and entities.';
        
        const result = await textProcessor.processText(testText);
        
        expect(result).toBeDefined();
        expect(result.cleanedText).toBeDefined();
        expect(Array.isArray(result.tokens)).toBe(true);
        expect(Array.isArray(result.keywords)).toBe(true);
        expect(result.entities).toBeDefined();
    });

    test('should clean text properly', () => {
        const dirtyText = 'Hello, WORLD!!! This has... punctuation???';
        const cleanText = textProcessor.cleanText(dirtyText);
        
        expect(cleanText).toBe('hello world this has punctuation');
    });

    test('should tokenize text asynchronously', async () => {
        const text = 'testing tokenization with some words';
        const tokens = await textProcessor.tokenizeText(text);
        
        expect(Array.isArray(tokens)).toBe(true);
        expect(tokens.length).toBeGreaterThan(0);
        // Should filter out short words and stopwords
        expect(tokens).not.toContain('a');
        expect(tokens).not.toContain('the');
    });

    test('should extract keywords asynchronously', async () => {
        const text = 'machine learning artificial intelligence data science algorithms neural networks';
        const keywords = await textProcessor.extractKeywords(text);
        
        expect(Array.isArray(keywords)).toBe(true);
        expect(keywords.length).toBeGreaterThan(0);
    });

    test('should generate consistent text hash', () => {
        const text = 'consistent text for hashing';
        const hash1 = textProcessor.generateTextHash(text);
        const hash2 = textProcessor.generateTextHash(text);
        
        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
        expect(hash1.length).toBeGreaterThan(0);
    });
});