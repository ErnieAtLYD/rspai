/**
 * Theme Detection Usage Example
 * Demonstrates how to integrate and use the theme detection system
 * with the existing NLP infrastructure.
 */

import { CoreNLPProcessor } from './nlp-processor';
import { CoreThemeDetectionEngine } from './theme-detection-engine';
import { CoreThemeSimilarityCalculator } from './theme-similarity-calculator';
import { CoreThemeValidator } from './theme-validator';
import {
  ThemeDetectionConfig,
  ThemeDetectionResult,
  DetectedTheme,
  ThemeCategory
} from './theme-detection-interfaces';
import { ProcessedDocument } from './nlp-interfaces';

/**
 * Example class showing how to use the theme detection system
 */
export class ThemeDetectionExample {
  private nlpProcessor: CoreNLPProcessor;
  private themeEngine: CoreThemeDetectionEngine;
  private similarityCalculator: CoreThemeSimilarityCalculator;
  private validator: CoreThemeValidator;

  constructor() {
    // Initialize the NLP processor with appropriate configuration
    this.nlpProcessor = new CoreNLPProcessor({
      enableTokenization: true,
      enableStopwordRemoval: true,
      enableNormalization: true,
      enableTfIdf: true,
      enableNGrams: true,
      nGramRange: [1, 3],
      maxFeatures: 1000,
      enableCaching: true
    });

    // Initialize theme detection engine
    this.themeEngine = new CoreThemeDetectionEngine(this.nlpProcessor, {
      minClusterSize: 3,
      maxClusters: 15,
      similarityThreshold: 0.4,
      clusteringMethod: 'hierarchical',
      minTopicWords: 5,
      maxTopicWords: 12,
      topicCoherenceThreshold: 0.4,
      enableTemporalAnalysis: true,
      minConfidenceScore: 0.5,
      minThemeFrequency: 2,
      maxThemes: 30,
      enableCaching: true
    });

    this.similarityCalculator = new CoreThemeSimilarityCalculator();
    this.validator = new CoreThemeValidator();
  }

  /**
   * Complete example of theme detection workflow
   */
  async analyzeNotesForThemes(noteContents: Array<{ content: string; path: string; date: Date }>): Promise<ThemeDetectionResult> {
    console.log('🔍 Starting theme detection analysis...');
    
    // Step 1: Process documents with NLP
    console.log('📝 Processing documents with NLP...');
    const processedDocuments: ProcessedDocument[] = [];
    
    for (const note of noteContents) {
      try {
        const processed = await this.nlpProcessor.processDocument(note.content, note.path);
        // Update timestamps to match note dates
        processed.createdAt = note.date;
        processed.lastModified = note.date;
        processedDocuments.push(processed);
      } catch (error) {
        console.warn(`Failed to process document ${note.path}:`, error.message);
      }
    }

    console.log(`✅ Processed ${processedDocuments.length} documents`);

    // Step 2: Detect themes
    console.log('🎯 Detecting themes...');
    const themeResult = await this.themeEngine.detectThemes(processedDocuments);
    
    console.log(`🎉 Detected ${themeResult.themes.length} themes in ${themeResult.processingTime}ms`);

    // Step 3: Validate themes
    console.log('✅ Validating theme quality...');
    const validation = this.validator.validateThemeCollection(themeResult.themes, processedDocuments);
    
    console.log(`📊 Overall quality score: ${(validation.overallQuality * 100).toFixed(1)}%`);
    console.log(`⚠️  Found ${validation.issues.length} issues`);

    // Step 4: Display results
    this.displayThemeResults(themeResult, validation);

    return themeResult;
  }

  /**
   * Example of incremental theme detection
   */
  async updateThemesWithNewNotes(
    existingResult: ThemeDetectionResult,
    newNotes: Array<{ content: string; path: string; date: Date }>
  ): Promise<ThemeDetectionResult> {
    console.log('🔄 Updating themes with new notes...');

    // Process new documents
    const newProcessedDocs: ProcessedDocument[] = [];
    for (const note of newNotes) {
      const processed = await this.nlpProcessor.processDocument(note.content, note.path);
      processed.createdAt = note.date;
      newProcessedDocs.push(processed);
    }

    // Update themes incrementally
    const updatedResult = await this.themeEngine.updateThemes(newProcessedDocs, existingResult);
    
    console.log(`🎯 Updated analysis with ${newNotes.length} new documents`);
    console.log(`📈 Theme count: ${existingResult.themes.length} → ${updatedResult.themes.length}`);

    return updatedResult;
  }

  /**
   * Example of finding similar themes
   */
  findSimilarThemes(targetTheme: DetectedTheme, allThemes: DetectedTheme[]): Array<{ theme: DetectedTheme; similarity: number }> {
    console.log(`🔍 Finding themes similar to "${targetTheme.title}"...`);

    const similarities = allThemes
      .filter(theme => theme.id !== targetTheme.id)
      .map(theme => ({
        theme,
        similarity: this.similarityCalculator.calculateThemeSimilarity(targetTheme, theme)
      }))
      .filter(result => result.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity);

    console.log(`🎯 Found ${similarities.length} similar themes`);
    
    return similarities;
  }

  /**
   * Example of theme categorization and filtering
   */
  filterThemesByCategory(themes: DetectedTheme[], categories: ThemeCategory[]): DetectedTheme[] {
    return themes.filter(theme => categories.includes(theme.category));
  }

  /**
   * Example of temporal analysis
   */
  analyzeThemeEvolution(theme: DetectedTheme): {
    trend: 'increasing' | 'decreasing' | 'stable';
    recentActivity: boolean;
    timespan: string;
  } {
    const daysSinceFirst = (Date.now() - theme.firstOccurrence.getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceLast = (Date.now() - theme.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24);
    
    return {
      trend: theme.temporalPattern.trend > 0.2 ? 'increasing' : 
             theme.temporalPattern.trend < -0.2 ? 'decreasing' : 'stable',
      recentActivity: daysSinceLast < 7,
      timespan: `${Math.round(daysSinceFirst)} days`
    };
  }

  /**
   * Example of extracting actionable insights
   */
  extractInsights(themeResult: ThemeDetectionResult): {
    topThemes: DetectedTheme[];
    emergingThemes: DetectedTheme[];
    stableThemes: DetectedTheme[];
    recommendations: string[];
  } {
    const sortedThemes = themeResult.themes
      .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency));

    const topThemes = sortedThemes.slice(0, 5);
    
    const emergingThemes = themeResult.themes
      .filter(theme => theme.temporalPattern.trend > 0.3)
      .sort((a, b) => b.temporalPattern.trend - a.temporalPattern.trend)
      .slice(0, 3);

    const stableThemes = themeResult.themes
      .filter(theme => Math.abs(theme.temporalPattern.trend) < 0.2 && theme.frequency > 5)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);

    const recommendations = this.generateRecommendations(themeResult);

    return {
      topThemes,
      emergingThemes,
      stableThemes,
      recommendations
    };
  }

  /**
   * Display theme results in a readable format
   */
  private displayThemeResults(result: ThemeDetectionResult, validation: any): void {
    console.log('\n📊 THEME DETECTION RESULTS');
    console.log('=' .repeat(50));
    
    console.log(`\n📈 Summary:`);
    console.log(`  • Documents analyzed: ${result.documentsAnalyzed}`);
    console.log(`  • Themes detected: ${result.themes.length}`);
    console.log(`  • Clusters created: ${result.clusters.length}`);
    console.log(`  • Processing time: ${result.processingTime}ms`);
    console.log(`  • Overall coherence: ${(result.overallCoherence * 100).toFixed(1)}%`);
    console.log(`  • Document coverage: ${(result.coverage * 100).toFixed(1)}%`);

    console.log(`\n🎯 Top Themes:`);
    const topThemes = result.themes
      .sort((a, b) => (b.confidence * b.frequency) - (a.confidence * a.frequency))
      .slice(0, 5);

    topThemes.forEach((theme, index) => {
      console.log(`  ${index + 1}. ${theme.title}`);
      console.log(`     Category: ${theme.category}`);
      console.log(`     Confidence: ${(theme.confidence * 100).toFixed(1)}%`);
      console.log(`     Frequency: ${theme.frequency} occurrences`);
      console.log(`     Keywords: ${theme.keywords.slice(0, 5).map(k => k.term).join(', ')}`);
      console.log(`     Timespan: ${theme.timespan} days`);
      console.log('');
    });

    if (validation.issues.length > 0) {
      console.log(`\n⚠️  Quality Issues:`);
      validation.issues.forEach((issue: any) => {
        console.log(`  • ${issue.message} (${issue.severity})`);
      });
    }

    if (validation.suggestions.length > 0) {
      console.log(`\n💡 Suggestions:`);
      validation.suggestions.forEach((suggestion: string) => {
        console.log(`  • ${suggestion}`);
      });
    }
  }

  /**
   * Generate actionable recommendations based on theme analysis
   */
  private generateRecommendations(result: ThemeDetectionResult): string[] {
    const recommendations: string[] = [];

    // Analyze theme distribution
    const categoryDistribution = new Map<ThemeCategory, number>();
    result.themes.forEach(theme => {
      categoryDistribution.set(theme.category, (categoryDistribution.get(theme.category) || 0) + 1);
    });

    // Find dominant categories
    const sortedCategories = Array.from(categoryDistribution.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length > 0) {
      const [topCategory, count] = sortedCategories[0];
      if (count > result.themes.length * 0.4) {
        recommendations.push(`Your notes are heavily focused on ${topCategory} (${count} themes). Consider diversifying your writing topics.`);
      }
    }

    // Analyze temporal patterns
    const recentThemes = result.themes.filter(theme => {
      const daysSince = (Date.now() - theme.lastOccurrence.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30;
    });

    if (recentThemes.length < result.themes.length * 0.3) {
      recommendations.push('Many of your themes haven\'t appeared recently. Consider revisiting past topics or developing new interests.');
    }

    // Analyze theme strength
    const weakThemes = result.themes.filter(theme => theme.confidence < 0.6);
    if (weakThemes.length > result.themes.length * 0.5) {
      recommendations.push('Many themes have low confidence scores. Consider writing more detailed entries about topics that interest you.');
    }

    // Analyze coverage
    if (result.coverage < 0.7) {
      recommendations.push('Theme detection covers less than 70% of your documents. You may have many unique, one-off topics - consider developing recurring themes.');
    }

    return recommendations;
  }

  /**
   * Example configuration for different use cases
   */
  static getConfigForUseCase(useCase: 'journal' | 'research' | 'project-notes' | 'creative-writing'): Partial<ThemeDetectionConfig> {
    switch (useCase) {
      case 'journal':
        return {
          minClusterSize: 2,
          maxClusters: 20,
          similarityThreshold: 0.3,
          minThemeFrequency: 2,
          enableTemporalAnalysis: true,
          evidenceWeighting: {
            recencyWeight: 0.4,
            frequencyWeight: 0.2,
            contextWeight: 0.2,
            lengthWeight: 0.1,
            qualityWeight: 0.1
          }
        };

      case 'research':
        return {
          minClusterSize: 3,
          maxClusters: 30,
          similarityThreshold: 0.4,
          minThemeFrequency: 3,
          topicCoherenceThreshold: 0.5,
          evidenceWeighting: {
            recencyWeight: 0.2,
            frequencyWeight: 0.3,
            contextWeight: 0.3,
            lengthWeight: 0.1,
            qualityWeight: 0.1
          }
        };

      case 'project-notes':
        return {
          minClusterSize: 2,
          maxClusters: 15,
          similarityThreshold: 0.5,
          minThemeFrequency: 2,
          enableTemporalAnalysis: true,
          evidenceWeighting: {
            recencyWeight: 0.3,
            frequencyWeight: 0.3,
            contextWeight: 0.2,
            lengthWeight: 0.1,
            qualityWeight: 0.1
          }
        };

      case 'creative-writing':
        return {
          minClusterSize: 2,
          maxClusters: 25,
          similarityThreshold: 0.3,
          minThemeFrequency: 1,
          enableTemporalAnalysis: false,
          evidenceWeighting: {
            recencyWeight: 0.1,
            frequencyWeight: 0.2,
            contextWeight: 0.4,
            lengthWeight: 0.2,
            qualityWeight: 0.1
          }
        };

      default:
        return {};
    }
  }
}

/**
 * Simple usage example
 */
export async function simpleThemeDetectionExample() {
  const example = new ThemeDetectionExample();
  
  // Sample note data
  const sampleNotes = [
    {
      content: "Today I worked on the new React project. The component architecture is coming together nicely. Need to focus on state management next.",
      path: "work/project-update-1.md",
      date: new Date('2024-01-15')
    },
    {
      content: "Had a great workout at the gym today. Focused on strength training and cardio. Feeling more energetic lately.",
      path: "health/workout-log-1.md", 
      date: new Date('2024-01-16')
    },
    {
      content: "Continued work on the React project. Implemented Redux for state management. The app is becoming more complex but manageable.",
      path: "work/project-update-2.md",
      date: new Date('2024-01-18')
    },
    {
      content: "Morning run in the park. The weather was perfect. Planning to increase my running distance gradually.",
      path: "health/running-log-1.md",
      date: new Date('2024-01-19')
    },
    {
      content: "Team meeting about the React project went well. We discussed the architecture and planned the next sprint. Excited about the progress.",
      path: "work/meeting-notes-1.md",
      date: new Date('2024-01-20')
    }
  ];

  try {
    const result = await example.analyzeNotesForThemes(sampleNotes);
    const insights = example.extractInsights(result);
    
    console.log('\n🎯 Key Insights:');
    console.log(`Top themes: ${insights.topThemes.map(t => t.title).join(', ')}`);
    console.log(`Emerging themes: ${insights.emergingThemes.map(t => t.title).join(', ')}`);
    console.log(`Recommendations: ${insights.recommendations.join(' ')}`);
    
    return result;
  } catch (error) {
    console.error('Theme detection failed:', error);
    throw error;
  }
} 