/**
 * External NLP libraries loaded dynamically for compatibility with various build environments.
 * Use the following async functions to access the libraries:
 *   - getNlp()
 *   - getSentiment()
 *   - getNatural()
 */

// Type definitions for the external libraries
export interface CompromiseDoc {
    sentences(): { out(format: string): string[] };
    people(): { out(format: string): string[] };
    places(): { out(format: string): string[] };
    organizations(): { out(format: string): string[] };
}

export interface SentimentAnalyzerLib {
    analyze(text: string): { score: number };
}

export interface NaturalModule {
    PorterStemmer: { stem(word: string): string };
    stopwords: string[];
    WordTokenizer: new () => { tokenize(text: string): string[] };
    TfIdf: new () => {
        addDocument(text: string): void;
        listTerms(docIndex: number): Array<{ term: string; tfidf: number }>;
        documents: string[];
    };
}

// Dynamic library instances
let nlp: ((text: string) => CompromiseDoc) | undefined;
let Sentiment: (new () => SentimentAnalyzerLib) | undefined;
let natural: NaturalModule | undefined;

export async function getNlp(): Promise<(text: string) => CompromiseDoc> {
    if (!nlp) {
        const mod = await import("compromise") as any;
        nlp = (mod.default || mod) as (text: string) => CompromiseDoc;
    }
    return nlp;
}

export async function getSentiment(): Promise<new () => SentimentAnalyzerLib> {
    if (!Sentiment) {
        const mod = await import("sentiment") as any;
        Sentiment = (mod.default || mod) as new () => SentimentAnalyzerLib;
    }
    return Sentiment;
}

export async function getNatural(): Promise<NaturalModule> {
    if (!natural) {
        const mod = await import("natural") as any;
        natural = mod as NaturalModule;
    }
    return natural;
}