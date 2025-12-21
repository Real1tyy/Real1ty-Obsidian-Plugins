import { buildPropertyMapping, sanitizeExpression } from "../../core/expression-utils";

import { InputManager } from "./base";

export class ExpressionFilterInputManager extends InputManager {
	private compiledFunc: ((...args: unknown[]) => boolean) | null = null;

	private propertyMapping = new Map<string, string>();

	private lastWarnedExpression: string | null = null;

	constructor(
		parentEl: HTMLElement,
		cssPrefix: string,
		onFilterChange: () => void,
		initiallyVisible: boolean = false,
		placeholder: string = "Status === 'Done'",
		onHide?: () => void,
		debounceMs?: number
	) {
		super(parentEl, placeholder, cssPrefix, onFilterChange, initiallyVisible, onHide, debounceMs);
		this.cssClass = `${cssPrefix}-expression-input`;
		if (this.inputEl) {
			this.inputEl.className = this.cssClass;
		}
	}

	protected updateFilterValue(filterValue: string): void {
		super.updateFilterValue(filterValue);

		this.compiledFunc = null;

		this.propertyMapping.clear();

		this.lastWarnedExpression = null;
	}

	shouldInclude(event: { meta?: Record<string, unknown> }): boolean {
		if (!this.currentValue) return true;

		const frontmatter = event.meta || {};

		try {
			const currentKeys = new Set(Object.keys(frontmatter));

			const existingKeys = new Set(this.propertyMapping.keys());

			const newKeys = [...currentKeys].filter((key) => !existingKeys.has(key));

			if (newKeys.length > 0) {
				const allKeys = new Set([...existingKeys, ...currentKeys]);

				this.propertyMapping = buildPropertyMapping(Array.from(allKeys));

				this.compiledFunc = null;
			}

			if (!this.compiledFunc) {
				const sanitized = sanitizeExpression(this.currentValue, this.propertyMapping);

				const params = Array.from(this.propertyMapping.values());

				// eslint-disable-next-line @typescript-eslint/no-implied-eval -- Dynamic function creation for expression evaluation with sanitized input
				this.compiledFunc = new Function(...params, `"use strict"; return ${sanitized};`) as (
					...args: unknown[]
				) => boolean;
			}

			const values = Array.from(this.propertyMapping.keys()).map(
				(key) => frontmatter[key] ?? undefined
			);

			const result = this.compiledFunc(...values);

			return result;
		} catch (error) {
			if (error instanceof ReferenceError) {
				const hasInequality = this.currentValue.includes("!==") || this.currentValue.includes("!=");

				return hasInequality;
			}

			if (this.lastWarnedExpression !== this.currentValue) {
				console.warn("Invalid filter expression:", this.currentValue, error);

				this.lastWarnedExpression = this.currentValue;
			}

			return false;
		}
	}
}
