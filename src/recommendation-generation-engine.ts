// Core Recommendation Generation Engine
// Transforms insights into actionable recommendations with AI and template-based generation

import {
	RecommendationGenerator,
	RecommendationGenerationConfig,
	RecommendationGenerationContext,
	RecommendationGenerationResult,
	GeneratedRecommendation,
	RecommendationOpportunity,
	RecommendationCluster,
	RecommendationTemplate,
	RecommendationType,
	RecommendationUrgency,
	RecommendationDifficulty,
	RecommendationTimeframe,
	ValidationResult,
	ValidationIssue,
	RecommendationEvidence,
	TemplateVariation,
} from "./recommendation-generation-interfaces";

import { Insight, ActionStep } from "./summary-generation-interfaces";

import { AIModelAdapter } from "./ai-interfaces";

export class CoreRecommendationGenerator implements RecommendationGenerator {
	private config: RecommendationGenerationConfig;
	private templates: Map<string, RecommendationTemplate>;
	private aiModel?: AIModelAdapter;

	constructor(config?: Partial<RecommendationGenerationConfig>) {
		this.config = this.mergeWithDefaults(config || {});
		this.templates = new Map();
		this.aiModel = this.config.aiModel;
		this.initializeDefaultTemplates();
	}

	// Core generation method
	async generateRecommendations(
		insights: Insight[],
		context: RecommendationGenerationContext,
		config?: Partial<RecommendationGenerationConfig>
	): Promise<RecommendationGenerationResult> {
		const startTime = Date.now();
		const effectiveConfig = config
			? { ...this.config, ...config }
			: this.config;

		try {
			// Step 1: Identify opportunities
			const opportunities = await this.identifyOpportunities(insights);

			// Step 2: Filter and prioritize opportunities
			const filteredOpportunities = this.filterOpportunities(
				opportunities,
				effectiveConfig
			);

			// Step 3: Generate recommendations
			const recommendations = await this.generateFromOpportunities(
				filteredOpportunities,
				context,
				effectiveConfig
			);

			// Step 4: Validate and enhance recommendations
			const validatedRecommendations =
				await this.validateAndEnhanceRecommendations(
					recommendations,
					context
				);

			// Step 5: Cluster and prioritize
			const clusters = await this.clusterRecommendations(
				validatedRecommendations
			);
			const prioritizedRecommendations = this.prioritizeRecommendations(
				validatedRecommendations,
				context
			);

			// Step 6: Generate result metadata
			const result = this.buildGenerationResult(
				prioritizedRecommendations,
				clusters,
				opportunities,
				startTime
			);

			return result;
		} catch (error) {
			console.error("Error generating recommendations:", error);
			return this.createErrorResult(error, startTime);
		}
	}

	// Specialized generation methods
	async generateQuickWins(
		insights: Insight[],
		maxCount = 5
	): Promise<GeneratedRecommendation[]> {
		const opportunities = await this.identifyOpportunities(insights);
		const quickWinOpportunities = opportunities
			.filter((opp) => this.isQuickWin(opp))
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, maxCount);

		const context: RecommendationGenerationContext = {
			insights,
			userPreferences: this.config.userPreferences,
			contextualFactors: this.config.contextualFactors,
			timeframe: {
				start: new Date(),
				end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
			scope: "weekly",
		};

		return this.generateFromOpportunities(
			quickWinOpportunities,
			context,
			this.config
		);
	}

	async generateStrategicRecommendations(
		insights: Insight[],
		timeframe: RecommendationTimeframe
	): Promise<GeneratedRecommendation[]> {
		const opportunities = await this.identifyOpportunities(insights);
		const strategicOpportunities = opportunities
			.filter((opp) => this.isStrategic(opp, timeframe))
			.sort((a, b) => b.confidence - a.confidence);

		const context: RecommendationGenerationContext = {
			insights,
			userPreferences: this.config.userPreferences,
			contextualFactors: this.config.contextualFactors,
			timeframe: this.getTimeframeRange(timeframe),
			scope: timeframe === "long-term" ? "quarterly" : "monthly",
		};

		return this.generateFromOpportunities(
			strategicOpportunities,
			context,
			this.config
		);
	}

	async generateHabitRecommendations(
		insights: Insight[]
	): Promise<GeneratedRecommendation[]> {
		const opportunities = await this.identifyOpportunities(insights);
		const habitOpportunities = opportunities
			.filter((opp) => opp.opportunityType === "habit")
			.sort((a, b) => b.confidence - a.confidence);

		const context: RecommendationGenerationContext = {
			insights,
			userPreferences: this.config.userPreferences,
			contextualFactors: this.config.contextualFactors,
			timeframe: {
				start: new Date(),
				end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
			scope: "monthly",
		};

		return this.generateFromOpportunities(
			habitOpportunities,
			context,
			this.config
		);
	}

	// Opportunity identification
	async identifyOpportunities(
		insights: Insight[]
	): Promise<RecommendationOpportunity[]> {
		const opportunities: RecommendationOpportunity[] = [];

		for (const insight of insights) {
			const insightOpportunities =
				await this.analyzeInsightForOpportunities(insight);
			opportunities.push(...insightOpportunities);
		}

		return this.deduplicateOpportunities(opportunities);
	}

	// Template-based generation
	async generateWithTemplate(
		opportunity: RecommendationOpportunity,
		template: RecommendationTemplate
	): Promise<GeneratedRecommendation> {
		const variables = this.extractTemplateVariables(opportunity, template);
		const variation = this.selectTemplateVariation(template, opportunity);

		const recommendation: GeneratedRecommendation = {
			id: this.generateRecommendationId(),
			title: this.fillTemplate(
				variation?.titleVariation || template.titleTemplate,
				variables
			),
			description: this.fillTemplate(
				variation?.descriptionVariation || template.descriptionTemplate,
				variables
			),
			type: template.type,
			category: opportunity.insight.category,

			urgency: this.determineUrgency(opportunity),
			difficulty: this.determineDifficulty(opportunity, template),
			timeframe: this.determineTimeframe(opportunity, template),
			directness:
				variation?.directnessAdjustment ||
				this.config.userPreferences.preferredDirectness,

			confidence: Math.min(
				opportunity.confidence,
				template.effectiveness
			),
			relevanceScore: this.calculateRelevanceScore(opportunity),
			impactPotential: this.estimateImpactPotential(opportunity),
			feasibilityScore: this.estimateFeasibility(opportunity),

			sourceInsights: [opportunity.insightId],
			evidence: this.extractEvidence(opportunity),
			actionSteps: this.generateActionSteps(opportunity, template),

			risks: this.identifyRisks(opportunity),
			prerequisites: this.identifyPrerequisites(opportunity),
			alternatives: this.generateAlternatives(opportunity),

			successMetrics: this.generateSuccessMetrics(opportunity),
			trackingMethods: this.generateTrackingMethods(opportunity),
			reviewTimeframe: this.determineReviewTimeframe(opportunity),

			generatedAt: new Date(),
			generationMethod: "template",
			tags: this.generateTags(opportunity, template),
		};

		return recommendation;
	}

	// AI-based generation
	async generateWithAI(
		opportunity: RecommendationOpportunity,
		context: RecommendationGenerationContext
	): Promise<GeneratedRecommendation> {
		if (!this.aiModel || !this.config.enableAIGeneration) {
			throw new Error("AI generation not available");
		}

		try {
			const prompt = this.buildRecommendationPrompt(opportunity, context);
			const response = await this.aiModel.generateCompletion(prompt, {
				maxTokens: this.config.maxTokens,
				temperature: this.config.temperature,
			});

			const parsedRecommendation = this.parseAIResponse(
				response,
				opportunity
			);
			return this.enhanceAIRecommendation(
				parsedRecommendation,
				opportunity,
				context
			);
		} catch (error) {
			console.error("AI generation failed:", error);
			// Fallback to template if AI fails
			if (this.config.fallbackToTemplates) {
				const template = this.findBestTemplate(opportunity);
				if (template) {
					return this.generateWithTemplate(opportunity, template);
				}
			}
			throw error;
		}
	}

	// Clustering and prioritization
	async clusterRecommendations(
		recommendations: GeneratedRecommendation[]
	): Promise<RecommendationCluster[]> {
		const clusters: RecommendationCluster[] = [];
		const processed = new Set<string>();

		for (const recommendation of recommendations) {
			if (processed.has(recommendation.id)) continue;

			const relatedRecommendations = this.findRelatedRecommendations(
				recommendation,
				recommendations.filter((r) => !processed.has(r.id))
			);

			if (relatedRecommendations.length > 1) {
				const cluster = this.createCluster(relatedRecommendations);
				clusters.push(cluster);
				relatedRecommendations.forEach((r) => processed.add(r.id));
			}
		}

		return clusters;
	}

	prioritizeRecommendations(
		recommendations: GeneratedRecommendation[],
		context: RecommendationGenerationContext
	): GeneratedRecommendation[] {
		return recommendations.sort((a, b) => {
			const scoreA = this.calculatePriorityScore(a, context);
			const scoreB = this.calculatePriorityScore(b, context);
			return scoreB - scoreA;
		});
	}

	// Validation and quality control
	validateRecommendation(
		recommendation: GeneratedRecommendation
	): ValidationResult {
		const issues: ValidationIssue[] = [];

		// Check required fields
		if (!recommendation.title?.trim()) {
			issues.push({
				type: "missing-field",
				field: "title",
				message: "Recommendation title is required",
				severity: "high",
			});
		}

		if (!recommendation.description?.trim()) {
			issues.push({
				type: "missing-field",
				field: "description",
				message: "Recommendation description is required",
				severity: "high",
			});
		}

		// Check confidence bounds
		if (recommendation.confidence < 0 || recommendation.confidence > 1) {
			issues.push({
				type: "invalid-value",
				field: "confidence",
				message: "Confidence must be between 0 and 1",
				severity: "medium",
			});
		}

		// Check for actionability
		if (
			!recommendation.actionSteps ||
			recommendation.actionSteps.length === 0
		) {
			issues.push({
				type: "quality-concern",
				field: "actionSteps",
				message: "Recommendation should include specific action steps",
				severity: "medium",
			});
		}

		const isValid =
			issues.filter((i) => i.severity === "high").length === 0;
		const confidence = Math.max(0, 1 - issues.length * 0.1);

		return {
			isValid,
			issues,
			suggestions: this.generateValidationSuggestions(issues),
			confidence,
		};
	}

	assessFeasibility(
		recommendation: GeneratedRecommendation,
		context: RecommendationGenerationContext
	): number {
		let feasibilityScore = 0.5; // Base score

		// Adjust based on difficulty
		switch (recommendation.difficulty) {
			case "easy":
				feasibilityScore += 0.3;
				break;
			case "moderate":
				feasibilityScore += 0.1;
				break;
			case "challenging":
				feasibilityScore -= 0.1;
				break;
			case "complex":
				feasibilityScore -= 0.3;
				break;
		}

		// Adjust based on available time
		switch (context.contextualFactors.availableTime) {
			case "flexible":
				feasibilityScore += 0.2;
				break;
			case "moderate":
				break;
			case "limited":
				feasibilityScore -= 0.2;
				break;
		}

		// Adjust based on prerequisites
		if (recommendation.prerequisites.length > 3) {
			feasibilityScore -= 0.1;
		}

		return Math.max(0, Math.min(1, feasibilityScore));
	}

	assessImpact(
		recommendation: GeneratedRecommendation,
		insights: Insight[]
	): number {
		let impactScore = recommendation.impactPotential;

		// Boost score based on number of supporting insights
		const supportingInsights = insights.filter((i) =>
			recommendation.sourceInsights.includes(i.id)
		);

		if (supportingInsights.length > 1) {
			impactScore += 0.1 * (supportingInsights.length - 1);
		}

		// Adjust based on urgency
		switch (recommendation.urgency) {
			case "urgent":
				impactScore += 0.2;
				break;
			case "high":
				impactScore += 0.1;
				break;
			case "medium":
				break;
			case "low":
				impactScore -= 0.1;
				break;
		}

		return Math.max(0, Math.min(1, impactScore));
	}

	// Configuration management
	updateConfig(config: Partial<RecommendationGenerationConfig>): void {
		this.config = { ...this.config, ...config };
		if (config.aiModel) {
			this.aiModel = config.aiModel;
		}
	}

	getConfig(): RecommendationGenerationConfig {
		return { ...this.config };
	}

	addTemplate(template: RecommendationTemplate): void {
		this.templates.set(template.id, template);
	}

	removeTemplate(templateId: string): boolean {
		return this.templates.delete(templateId);
	}

	getTemplates(): RecommendationTemplate[] {
		return Array.from(this.templates.values());
	}

	// Private helper methods
	private async analyzeInsightForOpportunities(
		insight: Insight
	): Promise<RecommendationOpportunity[]> {
		const opportunities: RecommendationOpportunity[] = [];

		// Analyze based on insight type and content
		const opportunityTypes = this.identifyOpportunityTypes(insight);

		for (const type of opportunityTypes) {
			const opportunity: RecommendationOpportunity = {
				insightId: insight.id,
				insight,
				opportunityType: type,
				confidence: this.calculateOpportunityConfidence(insight, type),
				reasoning: this.generateOpportunityReasoning(insight, type),
				suggestedActions: this.generateSuggestedActions(insight, type),
				potentialImpact: this.assessPotentialImpact(insight, type),
				implementationNotes: this.generateImplementationNotes(
					insight,
					type
				),
			};

			if (opportunity.confidence >= this.config.minConfidenceThreshold) {
				opportunities.push(opportunity);
			}
		}

		return opportunities;
	}

	private identifyOpportunityTypes(insight: Insight): RecommendationType[] {
		const types: RecommendationType[] = [];

		// Pattern-based type identification
		const description = insight.description.toLowerCase();
		const content = description;

		// Action-oriented patterns
		if (this.containsActionPatterns(content)) {
			types.push("action");
		}

		// Habit patterns
		if (this.containsHabitPatterns(content)) {
			types.push("habit");
		}

		// Decision patterns
		if (this.containsDecisionPatterns(content)) {
			types.push("decision");
		}

		// Learning patterns
		if (this.containsLearningPatterns(content)) {
			types.push("learning");
		}

		// Optimization patterns
		if (this.containsOptimizationPatterns(content)) {
			types.push("optimization");
		}

		// Category-based type mapping
		switch (insight.category) {
			case "wellbeing":
				types.push("health");
				break;
			case "productivity":
				types.push("productivity");
				break;
			case "goals":
				types.push("career");
				break;
			case "learning":
				types.push("reflection");
				break;
		}

		return [...new Set(types)]; // Remove duplicates
	}

	private containsActionPatterns(content: string): boolean {
		const actionPatterns = [
			"should do",
			"need to",
			"could try",
			"might consider",
			"action required",
			"next step",
			"implement",
			"execute",
		];
		return actionPatterns.some((pattern) => content.includes(pattern));
	}

	private containsHabitPatterns(content: string): boolean {
		const habitPatterns = [
			"regularly",
			"daily",
			"weekly",
			"routine",
			"habit",
			"consistently",
			"practice",
			"maintain",
			"develop",
		];
		return habitPatterns.some((pattern) => content.includes(pattern));
	}

	private containsDecisionPatterns(content: string): boolean {
		const decisionPatterns = [
			"decide",
			"choice",
			"option",
			"alternative",
			"consider",
			"evaluate",
			"weigh",
			"determine",
			"select",
		];
		return decisionPatterns.some((pattern) => content.includes(pattern));
	}

	private containsLearningPatterns(content: string): boolean {
		const learningPatterns = [
			"learn",
			"study",
			"research",
			"understand",
			"explore",
			"investigate",
			"skill",
			"knowledge",
			"training",
		];
		return learningPatterns.some((pattern) => content.includes(pattern));
	}

	private containsOptimizationPatterns(content: string): boolean {
		const optimizationPatterns = [
			"improve",
			"optimize",
			"enhance",
			"streamline",
			"efficiency",
			"better",
			"faster",
			"easier",
			"automate",
		];
		return optimizationPatterns.some((pattern) =>
			content.includes(pattern)
		);
	}

	private calculateOpportunityConfidence(
		insight: Insight,
		type: RecommendationType
	): number {
		let confidence = insight.confidence || 0.5;

		// Boost confidence for insights with strong evidence
		if (insight.evidence && insight.evidence.length > 2) {
			confidence += 0.1;
		}

		// Boost confidence for recent insights
		if (insight.timeframe && this.isRecent(insight.timeframe.end)) {
			confidence += 0.1;
		}

		// Boost confidence for insights with evidence
		if (insight.evidence && insight.evidence.length > 3) {
			confidence += 0.1;
		}

		return Math.min(1, confidence);
	}

	private isRecent(date: Date): boolean {
		const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
		return daysSince <= 7; // Within last week
	}

	private generateOpportunityReasoning(
		insight: Insight,
		type: RecommendationType
	): string {
		const templates = {
			action: `Based on the pattern "${insight.description}", there's an opportunity to take specific action to address this area.`,
			habit: `The recurring nature of "${insight.description}" suggests an opportunity to develop or modify habits.`,
			decision: `The insight "${insight.description}" indicates a decision point that could benefit from structured evaluation.`,
			learning: `The pattern "${insight.description}" reveals a knowledge gap that could be addressed through learning.`,
			optimization: `The insight "${insight.description}" suggests an opportunity to improve or optimize current approaches.`,
		};

		return (
			(templates as Record<string, string>)[type] ||
			`The insight "${insight.description}" presents an opportunity for ${type}-related improvement.`
		);
	}

	private generateSuggestedActions(
		insight: Insight,
		type: RecommendationType
	): string[] {
		// This would be more sophisticated in a real implementation
		const baseActions = [
			"Analyze the current situation",
			"Set specific goals",
			"Create an action plan",
			"Track progress regularly",
		];

		const typeSpecificActions = {
			habit: [
				"Start with small changes",
				"Use habit stacking",
				"Set up environmental cues",
			],
			learning: [
				"Identify learning resources",
				"Set aside dedicated time",
				"Find a mentor or community",
			],
			optimization: [
				"Measure current performance",
				"Identify bottlenecks",
				"Test improvements",
			],
		};

		return [
			...baseActions,
			...((typeSpecificActions as Record<string, string[]>)[type] || []),
		];
	}

	private assessPotentialImpact(
		insight: Insight,
		type: RecommendationType
	): string {
		const impactLevel = insight.importance || 0.5;

		if (impactLevel > 0.8)
			return "High potential impact on overall well-being and productivity";
		if (impactLevel > 0.6)
			return "Moderate potential impact with noticeable improvements";
		if (impactLevel > 0.4) return "Some potential impact in specific areas";
		return "Limited but meaningful impact";
	}

	private generateImplementationNotes(
		insight: Insight,
		type: RecommendationType
	): string {
		return `Consider your current context and available resources when implementing changes related to "${insight.description}".`;
	}

	private mergeWithDefaults(
		config: Partial<RecommendationGenerationConfig>
	): RecommendationGenerationConfig {
		return {
			strategy: "balanced",
			enableAIGeneration: true,
			fallbackToTemplates: true,
			maxRecommendations: 10,
			minConfidenceThreshold: 0.3,
			includeRiskAssessment: true,
			includeActionSteps: true,
			includeAlternatives: true,
			excludeTypes: [],
			prioritizeUrgency: true,
			balanceByCategory: true,
			userPreferences: {
				preferredDirectness: "recommendation",
				preferredTimeframes: ["short-term", "medium-term"],
				preferredTypes: [],
				riskTolerance: "medium",
				detailLevel: "standard",
				includePersonalTouch: true,
			},
			contextualFactors: {
				currentLifePhase: "mid-career",
				availableTime: "moderate",
				currentStressLevel: "medium",
				majorLifeEvents: [],
				seasonalFactors: [],
				workContext: "hybrid",
			},
			enableDuplicateDetection: true,
			enableFeasibilityCheck: true,
			enableImpactAssessment: true,
			temperature: 0.7,
			maxTokens: 500,
			...config,
		};
	}

	private initializeDefaultTemplates(): void {
		// Add some basic templates - this would be expanded in a real implementation
		const actionTemplate: RecommendationTemplate = {
			id: "basic-action",
			name: "Basic Action Recommendation",
			type: "action",
			category: "productivity",
			titleTemplate: "Take action on {{insight_topic}}",
			descriptionTemplate:
				"Based on your pattern of {{insight_description}}, consider taking specific action to {{suggested_outcome}}.",
			actionStepsTemplate: [
				"Assess the current situation",
				"Define specific goals",
				"Create an implementation plan",
				"Set up tracking mechanisms",
			],
			applicableInsightTypes: ["pattern", "observation", "anomaly"],
			minimumConfidence: 0.3,
			requiredEvidence: 1,
			variables: [
				"insight_topic",
				"insight_description",
				"suggested_outcome",
			],
			variations: [],
			usage: "frequent",
			effectiveness: 0.7,
		};

		this.addTemplate(actionTemplate);
	}

	// Additional helper methods would be implemented here...
	private deduplicateOpportunities(
		opportunities: RecommendationOpportunity[]
	): RecommendationOpportunity[] {
		// Simple deduplication based on insight ID and opportunity type
		const seen = new Set<string>();
		return opportunities.filter((opp) => {
			const key = `${opp.insightId}-${opp.opportunityType}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	private filterOpportunities(
		opportunities: RecommendationOpportunity[],
		config: RecommendationGenerationConfig
	): RecommendationOpportunity[] {
		return opportunities
			.filter((opp) => !config.excludeTypes.includes(opp.opportunityType))
			.filter((opp) => opp.confidence >= config.minConfidenceThreshold)
			.slice(0, config.maxRecommendations);
	}

	private async generateFromOpportunities(
		opportunities: RecommendationOpportunity[],
		context: RecommendationGenerationContext,
		config: RecommendationGenerationConfig
	): Promise<GeneratedRecommendation[]> {
		const recommendations: GeneratedRecommendation[] = [];

		for (const opportunity of opportunities) {
			try {
				let recommendation: GeneratedRecommendation;

				if (config.enableAIGeneration && this.aiModel) {
					recommendation = await this.generateWithAI(
						opportunity,
						context
					);
				} else {
					const template = this.findBestTemplate(opportunity);
					if (template) {
						recommendation = await this.generateWithTemplate(
							opportunity,
							template
						);
					} else {
						continue; // Skip if no template available
					}
				}

				recommendations.push(recommendation);
			} catch (error) {
				console.error(
					`Failed to generate recommendation for opportunity ${opportunity.insightId}:`,
					error
				);
			}
		}

		return recommendations;
	}

	private async validateAndEnhanceRecommendations(
		recommendations: GeneratedRecommendation[],
		context: RecommendationGenerationContext
	): Promise<GeneratedRecommendation[]> {
		const enhanced: GeneratedRecommendation[] = [];

		for (const recommendation of recommendations) {
			const validation = this.validateRecommendation(recommendation);
			if (validation.isValid) {
				// Enhance with feasibility and impact scores
				recommendation.feasibilityScore = this.assessFeasibility(
					recommendation,
					context
				);
				recommendation.impactPotential = this.assessImpact(
					recommendation,
					context.insights
				);
				enhanced.push(recommendation);
			}
		}

		return enhanced;
	}

	private buildGenerationResult(
		recommendations: GeneratedRecommendation[],
		clusters: RecommendationCluster[],
		opportunities: RecommendationOpportunity[],
		startTime: number
	): RecommendationGenerationResult {
		const averageConfidence =
			recommendations.length > 0
				? recommendations.reduce((sum, r) => sum + r.confidence, 0) /
					recommendations.length
				: 0;

		const diversityScore = this.calculateDiversityScore(recommendations);
		const feasibilityScore =
			recommendations.length > 0
				? recommendations.reduce(
						(sum, r) => sum + r.feasibilityScore,
						0
					) / recommendations.length
				: 0;
		const impactScore =
			recommendations.length > 0
				? recommendations.reduce(
						(sum, r) => sum + r.impactPotential,
						0
					) / recommendations.length
				: 0;

		return {
			recommendations,
			clusters,
			totalOpportunities: opportunities.length,
			opportunitiesProcessed: opportunities.length,
			recommendationsGenerated: recommendations.length,
			averageConfidence,
			diversityScore,
			feasibilityScore,
			impactScore,
			generationTime: Date.now() - startTime,
			templatesUsed: this.getUsedTemplates(recommendations),
			warnings: [],
			priorityRecommendations: recommendations
				.slice(0, 5)
				.map((r) => r.id),
			quickWins: recommendations
				.filter((r) => this.isQuickWinRecommendation(r))
				.map((r) => r.id),
			longTermGoals: recommendations
				.filter((r) => r.timeframe === "long-term")
				.map((r) => r.id),
		};
	}

	private createErrorResult(
		error: Error | string,
		startTime: number
	): RecommendationGenerationResult {
		return {
			recommendations: [],
			clusters: [],
			totalOpportunities: 0,
			opportunitiesProcessed: 0,
			recommendationsGenerated: 0,
			averageConfidence: 0,
			diversityScore: 0,
			feasibilityScore: 0,
			impactScore: 0,
			generationTime: Date.now() - startTime,
			templatesUsed: [],
			warnings: [
				`Generation failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			],
			priorityRecommendations: [],
			quickWins: [],
			longTermGoals: [],
		};
	}

	// Placeholder implementations for remaining methods
	private isQuickWin(opportunity: RecommendationOpportunity): boolean {
		return (
			opportunity.confidence > 0.7 &&
			opportunity.opportunityType === "action"
		);
	}

	private isStrategic(
		opportunity: RecommendationOpportunity,
		timeframe: RecommendationTimeframe
	): boolean {
		return (
			timeframe === "long-term" &&
			["goal", "learning", "optimization"].includes(
				opportunity.opportunityType
			)
		);
	}

	private getTimeframeRange(timeframe: RecommendationTimeframe): {
		start: Date;
		end: Date;
	} {
		const start = new Date();
		const end = new Date();

		switch (timeframe) {
			case "immediate":
				end.setDate(end.getDate() + 1);
				break;
			case "short-term":
				end.setDate(end.getDate() + 30);
				break;
			case "medium-term":
				end.setDate(end.getDate() + 90);
				break;
			case "long-term":
				end.setDate(end.getDate() + 365);
				break;
		}

		return { start, end };
	}

	private findBestTemplate(
		opportunity: RecommendationOpportunity
	): RecommendationTemplate | null {
		const templates = Array.from(this.templates.values())
			.filter((t) => t.type === opportunity.opportunityType)
			.sort((a, b) => b.effectiveness - a.effectiveness);

		return templates[0] || null;
	}

	private generateRecommendationId(): string {
		return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private extractTemplateVariables(
		opportunity: RecommendationOpportunity,
		template: RecommendationTemplate
	): Record<string, string> {
		return {
			insight_topic: opportunity.insight.description
				.split(" ")
				.slice(0, 3)
				.join(" "),
			insight_description: opportunity.insight.description,
			suggested_outcome: opportunity.potentialImpact,
		};
	}

	private selectTemplateVariation(
		template: RecommendationTemplate,
		opportunity: RecommendationOpportunity
	): TemplateVariation | null {
		// Simple selection logic - could be more sophisticated
		return template.variations[0] || null;
	}

	private fillTemplate(
		template: string,
		variables: Record<string, string>
	): string {
		let result = template;
		for (const [key, value] of Object.entries(variables)) {
			result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
		}
		return result;
	}

	private determineUrgency(
		opportunity: RecommendationOpportunity
	): RecommendationUrgency {
		if (opportunity.confidence > 0.8) return "high";
		if (opportunity.confidence > 0.6) return "medium";
		return "low";
	}

	private determineDifficulty(
		opportunity: RecommendationOpportunity,
		template: RecommendationTemplate
	): RecommendationDifficulty {
		// Simple heuristic based on action steps
		const stepCount = template.actionStepsTemplate.length;
		if (stepCount <= 2) return "easy";
		if (stepCount <= 4) return "moderate";
		if (stepCount <= 6) return "challenging";
		return "complex";
	}

	private determineTimeframe(
		opportunity: RecommendationOpportunity,
		template: RecommendationTemplate
	): RecommendationTimeframe {
		// Simple mapping based on type
		switch (opportunity.opportunityType) {
			case "action":
				return "short-term";
			case "habit":
				return "medium-term";
			case "learning":
				return "long-term";
			default:
				return "medium-term";
		}
	}

	private calculateRelevanceScore(
		opportunity: RecommendationOpportunity
	): number {
		return opportunity.confidence; // Simplified
	}

	private estimateImpactPotential(
		opportunity: RecommendationOpportunity
	): number {
		return opportunity.insight.importance || 0.5; // Simplified
	}

	private estimateFeasibility(
		opportunity: RecommendationOpportunity
	): number {
		return 0.7; // Simplified default
	}

	private extractEvidence(
		opportunity: RecommendationOpportunity
	): RecommendationEvidence[] {
		return (
			opportunity.insight.evidence?.map((e) => ({
				insightId: opportunity.insightId,
				excerpt: e.excerpt,
				relevanceScore: e.relevanceScore || 0.5,
				supportType: "direct" as const,
				filePath: e.documentPath,
				timestamp: e.timestamp,
			})) || []
		);
	}

	private generateActionSteps(
		opportunity: RecommendationOpportunity,
		template: RecommendationTemplate
	): ActionStep[] {
		return template.actionStepsTemplate.map((step, index) => ({
			id: `step_${index + 1}`,
			title: step,
			description: step,
			order: index + 1,
			estimatedTime: "30 minutes",
			difficulty: "medium" as const,
			required: true,
			dependencies: index > 0 ? [`step_${index}`] : [],
		}));
	}

	private identifyRisks(opportunity: RecommendationOpportunity): string[] {
		return [
			"May require significant time investment",
			"Results may vary based on individual circumstances",
		];
	}

	private identifyPrerequisites(
		opportunity: RecommendationOpportunity
	): string[] {
		return [
			"Clear understanding of current situation",
			"Commitment to follow through",
		];
	}

	private generateAlternatives(
		opportunity: RecommendationOpportunity
	): string[] {
		return [
			"Consider a gradual approach",
			"Seek support from others",
			"Start with a smaller scope",
		];
	}

	private generateSuccessMetrics(
		opportunity: RecommendationOpportunity
	): string[] {
		return [
			"Measurable improvement in target area",
			"Consistent implementation of action steps",
		];
	}

	private generateTrackingMethods(
		opportunity: RecommendationOpportunity
	): string[] {
		return [
			"Weekly progress reviews",
			"Objective measurement tools",
			"Feedback from others",
		];
	}

	private determineReviewTimeframe(
		opportunity: RecommendationOpportunity
	): string {
		return "2 weeks";
	}

	private generateTags(
		opportunity: RecommendationOpportunity,
		template: RecommendationTemplate
	): string[] {
		return [
			opportunity.opportunityType,
			opportunity.insight.category,
			template.name.toLowerCase().replace(/\s+/g, "-"),
		];
	}

	private buildRecommendationPrompt(
		opportunity: RecommendationOpportunity,
		context: RecommendationGenerationContext
	): string {
		return `Generate a specific, actionable recommendation based on this insight:

Insight: ${opportunity.insight.description}
Type: ${opportunity.opportunityType}
Context: ${JSON.stringify(context.contextualFactors)}

Please provide:
1. A clear, specific title
2. A detailed description
3. 3-5 concrete action steps
4. Potential risks and mitigation strategies
5. Success metrics

Format as JSON with the following structure:
{
  "title": "...",
  "description": "...",
  "actionSteps": ["...", "..."],
  "risks": ["...", "..."],
  "successMetrics": ["...", "..."]
}`;
	}

	private parseAIResponse(
		response: string,
		opportunity: RecommendationOpportunity
	): Partial<GeneratedRecommendation> {
		try {
			const parsed = JSON.parse(response);
			return {
				title: parsed.title,
				description: parsed.description,
				actionSteps:
					parsed.actionSteps?.map((step: string, index: number) => ({
						id: `step_${index + 1}`,
						title: step,
						description: step,
						order: index + 1,
						estimatedTime: "30 minutes",
						difficulty: "medium" as const,
						required: true,
						dependencies: [],
					})) || [],
				risks: parsed.risks || [],
				successMetrics: parsed.successMetrics || [],
			};
		} catch (error) {
			throw new Error(`Failed to parse AI response: ${error.message}`);
		}
	}

	private enhanceAIRecommendation(
		partial: Partial<GeneratedRecommendation>,
		opportunity: RecommendationOpportunity,
		context: RecommendationGenerationContext
	): GeneratedRecommendation {
		return {
			id: this.generateRecommendationId(),
			title: partial.title || "AI-Generated Recommendation",
			description: partial.description || opportunity.reasoning,
			type: opportunity.opportunityType,
			category: opportunity.insight.category,
			urgency: this.determineUrgency(opportunity),
			difficulty: "moderate",
			timeframe: "medium-term",
			directness: this.config.userPreferences.preferredDirectness,
			confidence: opportunity.confidence,
			relevanceScore: this.calculateRelevanceScore(opportunity),
			impactPotential: this.estimateImpactPotential(opportunity),
			feasibilityScore: this.estimateFeasibility(opportunity),
			sourceInsights: [opportunity.insightId],
			evidence: this.extractEvidence(opportunity),
			actionSteps: partial.actionSteps || [],
			risks: partial.risks || [],
			prerequisites: [],
			alternatives: [],
			successMetrics: partial.successMetrics || [],
			trackingMethods: [],
			reviewTimeframe: "2 weeks",
			generatedAt: new Date(),
			generationMethod: "ai",
			tags: [opportunity.opportunityType, opportunity.insight.category],
		};
	}

	private findRelatedRecommendations(
		recommendation: GeneratedRecommendation,
		candidates: GeneratedRecommendation[]
	): GeneratedRecommendation[] {
		const related = [recommendation];

		for (const candidate of candidates) {
			if (candidate.id === recommendation.id) continue;

			// Check for similarity in type, category, or source insights
			if (
				candidate.type === recommendation.type ||
				candidate.category === recommendation.category ||
				candidate.sourceInsights.some((id) =>
					recommendation.sourceInsights.includes(id)
				)
			) {
				related.push(candidate);
			}
		}

		return related;
	}

	private createCluster(
		recommendations: GeneratedRecommendation[]
	): RecommendationCluster {
		const theme = this.generateClusterTheme(recommendations);
		const combinedImpact =
			recommendations.reduce((sum, r) => sum + r.impactPotential, 0) /
			recommendations.length;

		return {
			id: `cluster_${Date.now()}_${Math.random()
				.toString(36)
				.substr(2, 9)}`,
			theme,
			recommendations,
			combinedImpact,
			synergies: this.identifyClusterSynergies(recommendations),
			conflicts: this.identifyClusterConflicts(recommendations),
			priorityOrder: recommendations
				.sort((a, b) => b.confidence - a.confidence)
				.map((r) => r.id),
		};
	}

	private generateClusterTheme(
		recommendations: GeneratedRecommendation[]
	): string {
		const types = [...new Set(recommendations.map((r) => r.type))];
		const categories = [...new Set(recommendations.map((r) => r.category))];

		if (types.length === 1) {
			return `${types[0]} recommendations`;
		}
		if (categories.length === 1) {
			return `${categories[0]} improvements`;
		}
		return "Related recommendations";
	}

	private identifyClusterSynergies(
		recommendations: GeneratedRecommendation[]
	): string[] {
		return [
			"Recommendations can be implemented together for greater impact",
		];
	}

	private identifyClusterConflicts(
		recommendations: GeneratedRecommendation[]
	): string[] {
		return []; // Simplified - no conflicts detected
	}

	private calculatePriorityScore(
		recommendation: GeneratedRecommendation,
		context: RecommendationGenerationContext
	): number {
		let score = recommendation.confidence * 0.3;
		score += recommendation.impactPotential * 0.3;
		score += recommendation.feasibilityScore * 0.2;

		// Urgency bonus
		switch (recommendation.urgency) {
			case "urgent":
				score += 0.2;
				break;
			case "high":
				score += 0.1;
				break;
			case "medium":
				break;
			case "low":
				score -= 0.1;
				break;
		}

		return Math.max(0, Math.min(1, score));
	}

	private generateValidationSuggestions(issues: ValidationIssue[]): string[] {
		return issues.map((issue) => {
			switch (issue.type) {
				case "missing-field":
					return `Add ${issue.field} to complete the recommendation`;
				case "invalid-value":
					return `Correct the ${issue.field} value to be within valid range`;
				case "quality-concern":
					return `Improve ${issue.field} to enhance recommendation quality`;
				default:
					return `Address ${issue.field} issue`;
			}
		});
	}

	private calculateDiversityScore(
		recommendations: GeneratedRecommendation[]
	): number {
		if (recommendations.length === 0) return 0;

		const types = new Set(recommendations.map((r) => r.type));
		const categories = new Set(recommendations.map((r) => r.category));

		return (types.size + categories.size) / (recommendations.length * 2);
	}

	private getUsedTemplates(
		recommendations: GeneratedRecommendation[]
	): string[] {
		return [
			...new Set(
				recommendations
					.filter((r) => r.generationMethod === "template")
					.map(
						(r) =>
							r.tags.find((tag) => tag.includes("template")) ||
							"unknown"
					)
			),
		];
	}

	private isQuickWinRecommendation(
		recommendation: GeneratedRecommendation
	): boolean {
		return (
			recommendation.difficulty === "easy" &&
			recommendation.timeframe === "short-term" &&
			recommendation.impactPotential > 0.6
		);
	}
}
