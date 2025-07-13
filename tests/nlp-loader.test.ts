import { getNlp, getSentiment, getNatural } from '../src/services/nlp/nlp-loader';

describe('NLP Dynamic Loader', () => {
    test('should load compromise library dynamically', async () => {
        const nlp = await getNlp();
        expect(typeof nlp).toBe('function');
        
        const doc = nlp('Hello world test sentence.');
        expect(doc).toBeDefined();
        expect(typeof doc.sentences).toBe('function');
    });

    test('should load sentiment library dynamically', async () => {
        const SentimentClass = await getSentiment();
        expect(typeof SentimentClass).toBe('function');
        
        const analyzer = new SentimentClass();
        expect(analyzer).toBeDefined();
        expect(typeof analyzer.analyze).toBe('function');
        
        const result = analyzer.analyze('I am happy today');
        expect(result).toBeDefined();
        expect(typeof result.score).toBe('number');
    });

    test('should load natural library dynamically', async () => {
        const natural = await getNatural();
        expect(natural).toBeDefined();
        expect(typeof natural.TfIdf).toBe('function');
        expect(Array.isArray(natural.stopwords)).toBe(true);
        expect(typeof natural.PorterStemmer.stem).toBe('function');
        
        const tfidf = new natural.TfIdf();
        expect(tfidf).toBeDefined();
        expect(typeof tfidf.addDocument).toBe('function');
    });

    test('should cache loaded libraries for subsequent calls', async () => {
        const nlp1 = await getNlp();
        const nlp2 = await getNlp();
        expect(nlp1).toBe(nlp2); // Should be the same cached instance
        
        const sentiment1 = await getSentiment();
        const sentiment2 = await getSentiment();
        expect(sentiment1).toBe(sentiment2); // Should be the same cached instance
        
        const natural1 = await getNatural();
        const natural2 = await getNatural();
        expect(natural1).toBe(natural2); // Should be the same cached instance
    });
});