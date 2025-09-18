import type { BehaviorSubject, Subscription } from "rxjs";

export interface BaseRule {
	id: string;
	expression: string;
	enabled: boolean;
}

/**
 * Generic base class for evaluating JavaScript expressions against frontmatter objects.
 * Provides reactive compilation of rules via RxJS subscription and safe evaluation.
 */
export abstract class BaseEvaluator<TRule extends BaseRule, TSettings> {
	protected compiledRules: Array<
		TRule & { fn: (frontmatter: Record<string, unknown>) => boolean }
	> = [];
	private settingsSubscription: Subscription | null = null;

	constructor(settingsStore: BehaviorSubject<TSettings>) {
		const initialRules = this.extractRules(settingsStore.value);
		this.compileRules(initialRules);

		this.settingsSubscription = settingsStore.subscribe((settings) => {
			const newRules = this.extractRules(settings);
			this.compileRules(newRules);
		});
	}

	/**
	 * Extract rules from settings object. Must be implemented by subclasses.
	 */
	protected abstract extractRules(settings: TSettings): TRule[];

	/**
	 * Compile rules into executable functions with error handling.
	 */
	private compileRules(rules: TRule[]): void {
		this.compiledRules = [];

		for (const rule of rules) {
			if (!rule.enabled || !rule.expression.trim()) continue;

			try {
				const cleanExpression = rule.expression.trim();

				// Create a function that takes 'fm' (frontmatter) as parameter
				// and evaluates the expression in that context
				const fn = new Function("fm", `return (${cleanExpression});`) as (
					frontmatter: Record<string, unknown>
				) => boolean;

				// Test the function with a dummy object to catch syntax errors early
				fn({});

				this.compiledRules.push({
					...rule,
					expression: cleanExpression,
					fn,
				});
			} catch (error) {
				console.warn(`Invalid rule expression "${rule.expression}":`, error);
			}
		}
	}

	/**
	 * Evaluate a single rule against frontmatter. Returns the result or undefined if error.
	 */
	protected evaluateRule(
		rule: TRule & { fn: (frontmatter: Record<string, unknown>) => boolean },
		frontmatter: Record<string, unknown>
	): boolean | undefined {
		try {
			return rule.fn(frontmatter);
		} catch (error) {
			console.warn(`Error evaluating rule "${rule.expression}":`, error);
			return undefined;
		}
	}

	/**
	 * Convert evaluation result to boolean - only explicit true is considered truthy.
	 */
	protected isTruthy(result: boolean | undefined): boolean {
		return result === true;
	}

	/**
	 * Clean up subscriptions and compiled rules.
	 */
	destroy(): void {
		if (this.settingsSubscription) {
			this.settingsSubscription.unsubscribe();
			this.settingsSubscription = null;
		}
		this.compiledRules = [];
	}

	/**
	 * Get the number of active (compiled) rules.
	 */
	getActiveRuleCount(): number {
		return this.compiledRules.length;
	}

	/**
	 * Get information about all rules including their validity.
	 */
	getRuleInfo(): Array<{ expression: string; isValid: boolean; enabled: boolean }> {
		const validExpressions = new Set(this.compiledRules.map((r) => r.expression));

		return this.compiledRules.map((rule) => ({
			expression: rule.expression,
			isValid: validExpressions.has(rule.expression),
			enabled: rule.enabled,
		}));
	}
}
