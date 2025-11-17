import type { ItemView } from "obsidian";

type AbstractCtor<T = Record<string, never>> = abstract new (...args: any[]) => T;

export interface Subscription {
	unsubscribe(): void;
}

export function MountableView<TBase extends AbstractCtor<ItemView>>(Base: TBase) {
	abstract class Mountable extends Base {
		// use ECMAScript private fields to avoid TS4094
		#mounted = false;
		#subs: Subscription[] = [];
		#resizeObserver: ResizeObserver | null = null;
		#resizeTimeout: ReturnType<typeof setTimeout> | null = null;
		#loadingEl: HTMLElement | null = null;

		// subclasses must implement these
		abstract mount(): Promise<void>;
		abstract unmount(): Promise<void>;

		addSub(sub: Subscription): void {
			this.#subs.push(sub);
		}

		/**
		 * Shows a loading indicator in the specified container.
		 *
		 * **Styling Requirements:**
		 * Inheritors must provide CSS styles in their plugin's `styles.css` file for the following classes:
		 *
		 * - `.mountable-loading-container` - Container element (flex layout recommended)
		 * - `.mountable-loading-spinner` - Spinner element (animation recommended)
		 * - `.mountable-loading-text` - Text element
		 *
		 * **Example CSS:**
		 * ```css
		 * .mountable-loading-container {
		 *   display: flex;
		 *   flex-direction: column;
		 *   align-items: center;
		 *   justify-content: center;
		 *   padding: 2rem;
		 *   min-height: 100px;
		 * }
		 *
		 * @keyframes mountable-spin {
		 *   0% { transform: rotate(0); }
		 *   100% { transform: rotate(360deg); }
		 * }
		 *
		 * .mountable-loading-spinner {
		 *   width: 20px;
		 *   height: 20px;
		 *   border: 2px solid var(--background-modifier-border);
		 *   border-top: 2px solid var(--interactive-accent);
		 *   border-radius: 50%;
		 *   animation: mountable-spin 1s linear infinite;
		 *   margin: 0 auto 8px;
		 * }
		 *
		 * .mountable-loading-text {
		 *   text-align: center;
		 *   color: var(--text-muted);
		 *   font-size: 0.9em;
		 * }
		 * ```
		 *
		 * **Custom Class Names:**
		 * You can override the default class names by passing custom classes:
		 * ```typescript
		 * this.showLoading(container, "Loading…", {
		 *   container: "my-custom-loading",
		 *   spinner: "my-custom-spinner",
		 *   text: "my-custom-text"
		 * });
		 * ```
		 *
		 * @param container - The container element where the loading indicator will be displayed
		 * @param text - The loading text to display (default: "Loading…")
		 * @param classes - Optional custom CSS class names to use instead of defaults
		 */
		showLoading(
			container: HTMLElement,
			text = "Loading…",
			classes?: {
				container?: string;
				spinner?: string;
				text?: string;
			}
		): void {
			this.hideLoading();
			const containerClass = classes?.container ?? "mountable-loading-container";
			const spinnerClass = classes?.spinner ?? "mountable-loading-spinner";
			const textClass = classes?.text ?? "mountable-loading-text";

			this.#loadingEl = container.createDiv(containerClass);
			this.#loadingEl.createDiv(spinnerClass);
			const t = this.#loadingEl.createDiv(textClass);
			t.textContent = text;
		}

		hideLoading(): void {
			this.#loadingEl?.remove();
			this.#loadingEl = null;
		}

		observeResize(el: HTMLElement, cb: () => void, delay = 100): void {
			if (!("ResizeObserver" in window)) return;
			this.#resizeObserver = new ResizeObserver(() => {
				if (this.#resizeTimeout) clearTimeout(this.#resizeTimeout);
				this.#resizeTimeout = setTimeout(cb, delay);
			});
			this.#resizeObserver.observe(el);
		}

		waitForLayout(el: HTMLElement, fallbackMs = 500): Promise<void> {
			return new Promise<void>((resolve) => {
				const check = () => {
					const r = el.getBoundingClientRect();
					r.width > 0 && r.height > 0 ? resolve() : requestAnimationFrame(check);
				};
				check();
				setTimeout(resolve, fallbackMs);
			});
		}

		createSubscription(cleanup: () => void): Subscription {
			return { unsubscribe: cleanup };
		}

		addEventListenerSub<K extends keyof HTMLElementEventMap>(
			el: HTMLElement,
			type: K,
			listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
			options?: boolean | AddEventListenerOptions
		): void {
			el.addEventListener(type, listener, options);
			this.addSub(this.createSubscription(() => el.removeEventListener(type, listener, options)));
		}

		addWorkspaceEventSub(eventName: string, callback: (...args: any[]) => void): void {
			const ref = this.app.workspace.on(eventName as any, callback);
			this.addSub(this.createSubscription(() => this.app.workspace.offref(ref)));
		}

		async onOpen(): Promise<void> {
			if (this.#mounted) return;
			this.#mounted = true;
			try {
				await this.mount();
			} catch (e) {
				this.#mounted = false;
				throw e;
			}
		}

		async onClose(): Promise<void> {
			try {
				await this.unmount();
			} finally {
				for (const s of this.#subs) {
					try {
						s.unsubscribe();
					} catch {}
				}
				this.#subs = [];
				if (this.#resizeTimeout) {
					clearTimeout(this.#resizeTimeout);
					this.#resizeTimeout = null;
				}
				this.#resizeObserver?.disconnect();
				this.#resizeObserver = null;
				this.hideLoading();
				this.#mounted = false;
			}
		}
	}

	return Mountable;
}
