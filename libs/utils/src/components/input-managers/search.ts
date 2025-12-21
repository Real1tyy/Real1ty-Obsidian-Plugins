import { InputManager } from "./base";

export class SearchFilterInputManager extends InputManager {
	constructor(
		parentEl: HTMLElement,
		cssPrefix: string,
		onFilterChange: () => void,
		initiallyVisible: boolean = false,
		placeholder: string = "Search ...",
		onHide?: () => void,
		debounceMs?: number
	) {
		super(parentEl, placeholder, cssPrefix, onFilterChange, initiallyVisible, onHide, debounceMs);
		this.cssClass = `${cssPrefix}-search-input`;
		if (this.inputEl) {
			this.inputEl.className = this.cssClass;
		}
	}

	shouldInclude(value: string): boolean {
		if (!this.currentValue) return true;

		return value.toLowerCase().includes(this.currentValue.toLowerCase());
	}
}
