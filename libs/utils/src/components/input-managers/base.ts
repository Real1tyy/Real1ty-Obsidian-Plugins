export type InputManagerFilterChangeCallback = () => void;

const DEFAULT_DEBOUNCE_MS = 150;

export abstract class InputManager {
	protected containerEl: HTMLElement;
	protected inputEl: HTMLInputElement | null = null;
	protected debounceTimer: number | null = null;
	protected currentValue = "";
	protected persistentlyVisible = false;
	protected onHide?: () => void;
	protected hiddenClass: string;
	protected debounceMs: number;
	protected cssClass: string;

	constructor(
		protected parentEl: HTMLElement,
		protected placeholder: string,
		protected cssPrefix: string,
		protected onFilterChange: InputManagerFilterChangeCallback,
		initiallyVisible: boolean,
		onHide?: () => void,
		debounceMs: number = DEFAULT_DEBOUNCE_MS
	) {
		this.hiddenClass = `${cssPrefix}-hidden`;
		this.debounceMs = debounceMs;
		this.cssClass = `${cssPrefix}-input`;

		const classes = initiallyVisible
			? `${cssPrefix}-container`
			: `${cssPrefix}-container ${this.hiddenClass}`;

		this.containerEl = this.parentEl.createEl("div", {
			cls: classes,
		});

		this.onHide = onHide;

		this.render();
	}

	private render(): void {
		this.inputEl = this.containerEl.createEl("input", {
			type: "text",
			cls: this.cssClass,
			placeholder: this.placeholder,
		});

		this.inputEl.addEventListener("input", () => {
			this.handleInputChange();
		});

		this.inputEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Escape") {
				// Only allow hiding if not persistently visible
				if (!this.persistentlyVisible) {
					this.hide();
				} else {
					// Just blur the input if persistently visible
					this.inputEl?.blur();
				}
			} else if (evt.key === "Enter") {
				this.applyFilterImmediately();
			}
		});
	}

	private handleInputChange(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = window.setTimeout(() => {
			this.applyFilterImmediately();
		}, this.debounceMs);
	}

	protected applyFilterImmediately(): void {
		const newValue = this.inputEl?.value.trim() ?? "";

		if (newValue !== this.currentValue) {
			this.updateFilterValue(newValue);
		}
	}

	protected updateFilterValue(value: string): void {
		this.currentValue = value;

		this.onFilterChange();
	}

	getCurrentValue(): string {
		return this.currentValue;
	}

	show(): void {
		this.containerEl.removeClass(this.hiddenClass);

		this.inputEl?.focus();
	}

	hide(): void {
		// Don't allow hiding if persistently visible
		if (this.persistentlyVisible) {
			return;
		}

		this.containerEl.addClass(this.hiddenClass);

		if (this.inputEl) {
			this.inputEl.value = "";
		}

		this.updateFilterValue("");

		this.onHide?.();
	}

	focus(): void {
		this.inputEl?.focus();
	}

	isVisible(): boolean {
		return !this.containerEl.hasClass(this.hiddenClass);
	}

	setPersistentlyVisible(value: boolean): void {
		this.persistentlyVisible = value;

		if (value) {
			this.show();
		} else {
			this.hide();
		}
	}

	destroy(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);

			this.debounceTimer = null;
		}

		this.containerEl.remove();

		this.inputEl = null;
	}

	abstract shouldInclude(data: unknown): boolean;
}
