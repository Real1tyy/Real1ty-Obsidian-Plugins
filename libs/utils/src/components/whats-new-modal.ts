import type { App, Plugin } from "obsidian";
import { MarkdownRenderer, Modal } from "obsidian";
import { formatChangelogSections, getChangelogSince } from "../string/changelog-parser";

export interface WhatsNewModalConfig {
	/**
	 * The CSS class prefix/suffix to use for styling.
	 * Example: "custom-calendar" will generate classes like "custom-calendar-whats-new-modal"
	 */
	cssPrefix: string;

	/**
	 * Display name of the plugin.
	 * Example: "Custom Calendar"
	 */
	pluginName: string;

	/**
	 * Raw changelog markdown content to parse.
	 */
	changelogContent: string;

	/**
	 * Links to external resources.
	 */
	links: {
		/**
		 * URL to support/donate page.
		 */
		support?: string;

		/**
		 * URL to full changelog page.
		 */
		changelog?: string;

		/**
		 * URL to documentation.
		 */
		documentation?: string;
	};
}

/**
 * Generic "What's New" modal that displays changelog entries between versions.
 * Supports custom CSS prefixes, plugin names, and configurable links.
 */
export class WhatsNewModal extends Modal {
	constructor(
		app: App,
		private plugin: Plugin,
		private config: WhatsNewModalConfig,
		private fromVersion: string,
		private toVersion: string
	) {
		super(app);
	}

	/**
	 * Helper to create CSS class names with the configured prefix.
	 */
	private cls(suffix: string): string {
		return `${this.config.cssPrefix}-${suffix}`;
	}

	/**
	 * Helper to add CSS class to an element.
	 */
	private addCls(el: HTMLElement, suffix: string): void {
		el.classList.add(this.cls(suffix));
	}

	/**
	 * Makes external links in rendered markdown clickable by adding click handlers.
	 * Finds all anchor tags with external URLs (http/https) and adds click events
	 * that open the links in the user's default browser.
	 */
	private makeExternalLinksClickable(container: HTMLElement): void {
		const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");

		// Convert NodeList to Array for iteration
		Array.from(links).forEach((link) => {
			const href = link.getAttribute("href");

			// Only handle external HTTP(S) links
			if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
				link.addEventListener("click", (event: MouseEvent) => {
					event.preventDefault();
					window.open(href, "_blank");
				});

				// Add visual indicator that it's an external link
				link.addClass("external-link");
			}
		});
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.addCls(contentEl, "whats-new-modal");

		// Header section
		const header = contentEl.createDiv({ cls: this.cls("whats-new-header") });
		header.createEl("h2", {
			text: `${this.config.pluginName} updated to v${this.toVersion}`,
		});

		header.createEl("p", {
			text: `Changes since v${this.fromVersion}`,
			cls: this.cls("whats-new-subtitle"),
		});

		// Support section (optional)
		if (this.config.links.support) {
			const supportSection = contentEl.createDiv({
				cls: this.cls("whats-new-support"),
			});

			supportSection.createEl("h3", { text: "Support My Work" });

			const supportText = supportSection.createEl("p");
			supportText.createSpan({ text: "If you enjoy using this plugin, please consider " });
			supportText.createEl("a", {
				text: "supporting my work",
				href: this.config.links.support,
			});
			supportText.createSpan({
				text: ". Your support helps keep this plugin maintained and improved!",
			});

			contentEl.createEl("hr");
		}

		// Changelog content
		const changelogSections = getChangelogSince(
			this.config.changelogContent,
			this.fromVersion,
			this.toVersion
		);

		if (changelogSections.length === 0) {
			contentEl.createEl("p", {
				text: "No significant changes found in this update.",
				cls: this.cls("whats-new-empty"),
			});
		} else {
			const changelogContainer = contentEl.createDiv({
				cls: this.cls("whats-new-content"),
			});

			const markdownContent = formatChangelogSections(changelogSections);

			await MarkdownRenderer.render(
				this.app,
				markdownContent,
				changelogContainer,
				"/",
				this.plugin
			);

			// Make external links clickable
			this.makeExternalLinksClickable(changelogContainer);
		}

		// Action buttons
		const buttonContainer = contentEl.createDiv({
			cls: this.cls("whats-new-buttons"),
		});

		// Full changelog button (optional)
		if (this.config.links.changelog) {
			const changelogBtn = buttonContainer.createEl("button", {
				text: "Full Changelog",
			});
			changelogBtn.addEventListener("click", () => {
				window.open(this.config.links.changelog, "_blank");
			});
		}

		// Documentation button (optional)
		if (this.config.links.documentation) {
			const docsBtn = buttonContainer.createEl("button", {
				text: "Documentation",
			});
			docsBtn.addEventListener("click", () => {
				window.open(this.config.links.documentation, "_blank");
			});
		}

		// Close button (always present)
		const closeBtn = buttonContainer.createEl("button", {
			text: "Close",
			cls: this.cls("mod-cta"),
		});
		closeBtn.addEventListener("click", () => this.close());
	}

	onClose() {
		this.contentEl.empty();
	}
}
