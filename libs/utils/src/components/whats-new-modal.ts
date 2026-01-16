import type { App, Plugin } from "obsidian";
import { MarkdownRenderer, Modal } from "obsidian";
import { formatChangelogSections, getChangelogSince } from "../string/changelog-parser";

/**
 * Default URLs for the What's New modal.
 * These can be overridden in the config.
 */
export const DEFAULT_WHATS_NEW_LINKS = {
	/**
	 * Default tools page showcasing all plugins and productivity software.
	 */
	TOOLS: "https://matejvavroproductivity.com/tools/",

	/**
	 * Default YouTube channel with Obsidian tutorials and productivity tips.
	 * Includes subscription confirmation parameter.
	 */
	YOUTUBE: "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
} as const;

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
		support: string;

		/**
		 * URL to full changelog page.
		 */
		changelog: string;

		/**
		 * Base URL for documentation (used to resolve relative links in changelog).
		 * Example: "https://docs.example.com" or "https://docs.example.com/"
		 */
		documentation: string;

		/**
		 * URL to tools page showcasing all plugins and productivity tools.
		 * Defaults to DEFAULT_WHATS_NEW_LINKS.TOOLS if not provided.
		 */
		tools?: string;

		/**
		 * URL to YouTube channel with tutorials and productivity tips.
		 * Defaults to DEFAULT_WHATS_NEW_LINKS.YOUTUBE if not provided.
		 */
		youtube?: string;
	};
}

/**
 * Generic "What's New" modal that displays changelog entries between versions.
 * Supports custom CSS prefixes, plugin names, and configurable links.
 *
 * ## CSS Classes
 *
 * This modal uses the following CSS classes (with your custom prefix).
 * Replace `{prefix}` with your `cssPrefix` value (e.g., "my-plugin").
 *
 * ### Main Container
 * - `.{prefix}-whats-new-modal` - Applied to the main content element
 * - `.{prefix}-whats-new-modal .modal` - Modal dialog styling (max-width, width)
 *
 * ### Header Section
 * - `.{prefix}-whats-new-header` - Container for the header section
 *   - Contains h2 (title) and subtitle paragraph
 * - `.{prefix}-whats-new-header h2` - Main title styling
 * - `.{prefix}-whats-new-subtitle` - Subtitle text ("Changes since vX.X.X")
 *
 * ### Support Section
 * - `.{prefix}-whats-new-support` - Support section container
 *   - Contains donation, tools, and YouTube links
 *   - Should have background, padding, border-radius
 * - `.{prefix}-whats-new-support h3` - Support section heading
 * - `.{prefix}-whats-new-support p` - Support section paragraph text (one per row)
 * - `.{prefix}-whats-new-support a` - Links in support section (consistent styling)
 * - `.{prefix}-whats-new-support a:hover` - Link hover state
 *
 * ### Changelog Content
 * - `.{prefix}-whats-new-content` - Changelog content container
 *   - Should have max-height, overflow-y: auto for scrolling
 * - `.{prefix}-whats-new-content h2` - Version headings in changelog
 * - `.{prefix}-whats-new-content h3` - Section headings in changelog
 * - `.{prefix}-whats-new-content ul` - Changelog lists
 * - `.{prefix}-whats-new-content li` - Changelog list items
 * - `.{prefix}-whats-new-content code` - Inline code in changelog
 * - `.{prefix}-whats-new-content pre` - Code blocks in changelog
 * - `.{prefix}-whats-new-content a.external-link` - External links (auto-added)
 * - `.{prefix}-whats-new-empty` - Empty state message
 *
 * ### Sticky Footer
 * - `.{prefix}-whats-new-sticky-footer` - Footer container (should be sticky)
 * - `.{prefix}-whats-new-modal hr` - Separator line in footer
 * - `.{prefix}-whats-new-separator` - Separator with custom class
 * - `.{prefix}-whats-new-buttons` - Button container
 * - `.{prefix}-whats-new-buttons button` - Individual buttons
 * - `.{prefix}-mod-cta` - Primary/CTA button state (applied to Close button)
 *
 * ## Example CSS Implementation
 *
 * ```css
 * // Main Container
 * .my-plugin-whats-new-modal .modal {
 *   max-width: 800px;
 *   width: 90%;
 * }
 *
 * // Header
 * .my-plugin-whats-new-header {
 *   margin-bottom: 1.5rem;
 * }
 *
 * .my-plugin-whats-new-header h2 {
 *   margin-bottom: 0.5rem;
 *   color: var(--text-normal);
 * }
 *
 * .my-plugin-whats-new-subtitle {
 *   color: var(--text-muted);
 *   font-size: 0.9rem;
 *   margin: 0;
 * }
 *
 * // Support Section (with donation, tools, and YouTube links)
 * .my-plugin-whats-new-support {
 *   margin: 1.5rem 0;
 *   padding: 1rem;
 *   background-color: var(--background-secondary);
 *   border-radius: 8px;
 * }
 *
 * .my-plugin-whats-new-support h3 {
 *   margin-top: 0;
 *   margin-bottom: 0.5rem;
 *   font-size: 1rem;
 * }
 *
 * .my-plugin-whats-new-support p {
 *   margin: 0.5rem 0;
 *   color: var(--text-normal);
 * }
 *
 * .my-plugin-whats-new-support a {
 *   color: var(--link-color);
 *   text-decoration: none;
 * }
 *
 * .my-plugin-whats-new-support a:hover {
 *   text-decoration: underline;
 * }
 *
 * // Changelog Content (Scrollable Area)
 * .my-plugin-whats-new-content {
 *   max-height: 500px;
 *   overflow-y: auto;
 *   margin-bottom: 1.5rem;
 *   padding-right: 0.5rem;
 *   border-radius: 8px;
 * }
 *
 * .my-plugin-whats-new-content h2 {
 *   font-size: 1.3rem;
 *   margin-top: 1.5rem;
 *   margin-bottom: 0.5rem;
 *   color: var(--text-accent);
 * }
 *
 * .my-plugin-whats-new-content h3 {
 *   font-size: 1.1rem;
 *   margin-top: 1rem;
 *   margin-bottom: 0.5rem;
 * }
 *
 * .my-plugin-whats-new-content ul {
 *   padding-left: 1.5rem;
 * }
 *
 * .my-plugin-whats-new-content li {
 *   margin-bottom: 0.5rem;
 *   line-height: 1.6;
 * }
 *
 * .my-plugin-whats-new-content code {
 *   background: var(--code-background);
 *   padding: 0.2em 0.4em;
 *   border-radius: 3px;
 *   font-size: 0.9em;
 * }
 *
 * .my-plugin-whats-new-content pre {
 *   background: var(--code-background);
 *   padding: 1rem;
 *   border-radius: 6px;
 *   overflow-x: auto;
 * }
 *
 * .my-plugin-whats-new-content a.external-link {
 *   color: var(--link-external-color);
 * }
 *
 * .my-plugin-whats-new-content a.external-link::after {
 *   content: "↗";
 *   margin-left: 0.2em;
 *   font-size: 0.8em;
 * }
 *
 * .my-plugin-whats-new-empty {
 *   text-align: center;
 *   color: var(--text-muted);
 *   padding: 2rem;
 *   font-style: italic;
 * }
 *
 * // Sticky Footer
 * .my-plugin-whats-new-sticky-footer {
 *   position: sticky;
 *   bottom: 0;
 *   background: var(--background-primary);
 *   padding-top: 1rem;
 *   margin-top: 1rem;
 *   z-index: 10;
 *   border-top: 1px solid var(--background-modifier-border);
 * }
 *
 * .my-plugin-whats-new-modal hr,
 * .my-plugin-whats-new-separator {
 *   margin: 0 0 1rem 0;
 *   border: none;
 *   border-top: 1px solid var(--background-modifier-border);
 * }
 *
 * .my-plugin-whats-new-buttons {
 *   display: flex;
 *   gap: 0.5rem;
 *   justify-content: flex-end;
 *   flex-wrap: wrap;
 *   margin-top: 1rem;
 *   padding-bottom: 0.5rem;
 * }
 *
 * .my-plugin-whats-new-buttons button {
 *   padding: 0.5rem 1rem;
 *   border-radius: 4px;
 *   cursor: pointer;
 *   border: 1px solid var(--background-modifier-border);
 *   background: var(--interactive-normal);
 *   color: var(--text-normal);
 *   transition: background-color 0.2s;
 * }
 *
 * .my-plugin-whats-new-buttons button:hover {
 *   background: var(--interactive-hover);
 * }
 *
 * .my-plugin-whats-new-buttons button.my-plugin-mod-cta {
 *   background: var(--interactive-accent);
 *   color: var(--text-on-accent);
 *   border-color: var(--interactive-accent);
 * }
 *
 * .my-plugin-whats-new-buttons button.my-plugin-mod-cta:hover {
 *   background: var(--interactive-accent-hover);
 * }
 * ```
 *
 * @example
 * ```typescript
 * const modal = new WhatsNewModal(app, plugin, {
 *   cssPrefix: "my-plugin",
 *   pluginName: "My Plugin",
 *   changelogContent: rawChangelog,
 *   links: {
 *     support: "https://...",
 *     changelog: "https://...",
 *     documentation: "https://..."
 *   }
 * }, "1.0.0", "2.0.0");
 * modal.open();
 * ```
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
	 * Handles both absolute URLs (http/https) and relative URLs (starting with /).
	 * Relative URLs are resolved against the documentation base URL.
	 */
	private makeExternalLinksClickable(container: HTMLElement): void {
		const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");

		// Convert NodeList to Array for iteration
		Array.from(links).forEach((link) => {
			const href = link.getAttribute("href");
			if (!href) return;

			let finalUrl: string | null = null;

			// Handle absolute HTTP(S) links
			if (href.startsWith("http://") || href.startsWith("https://")) {
				finalUrl = href;
			}
			// Handle relative links (starting with /)
			else if (href.startsWith("/")) {
				// Get base documentation URL and ensure proper slash handling
				const baseUrl = this.config.links.documentation;
				const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
				finalUrl = `${normalizedBase}${href}`;
			}

			// Add click handler for external links
			if (finalUrl) {
				link.addEventListener("click", (event: MouseEvent) => {
					event.preventDefault();
					window.open(finalUrl, "_blank");
				});

				// Add visual indicator that it's an external link
				link.classList.add("external-link");
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

		// Support section
		const supportSection = contentEl.createDiv({
			cls: this.cls("whats-new-support"),
		});

		supportSection.createEl("h3", { text: "Support My Work" });

		// Support/donate
		const supportText = supportSection.createEl("p");
		supportText.createSpan({ text: "If you enjoy using this plugin, please consider " });
		supportText.createEl("a", {
			text: "supporting my work",
			href: this.config.links.support,
		});
		supportText.createSpan({
			text: ". Your support helps keep this plugin maintained and improved!",
		});

		// Other tools
		const toolsText = supportSection.createEl("p");
		toolsText.createSpan({ text: "Check out my " });
		toolsText.createEl("a", {
			text: "other plugins and productivity tools",
			href: this.config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS,
		});
		toolsText.createSpan({
			text: " to enhance your workflow even further.",
		});

		// YouTube channel
		const youtubeText = supportSection.createEl("p");
		youtubeText.createSpan({ text: "Subscribe to my " });
		youtubeText.createEl("a", {
			text: "YouTube channel",
			href: this.config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE,
		});
		youtubeText.createSpan({
			text: " for Obsidian tutorials and productivity tips!",
		});

		contentEl.createEl("hr");

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

		// Sticky footer section (hr + buttons)
		const stickyFooter = contentEl.createDiv({
			cls: this.cls("whats-new-sticky-footer"),
		});

		// Separator line
		stickyFooter.createEl("hr", {
			cls: this.cls("whats-new-separator"),
		});

		// Action buttons
		const buttonContainer = stickyFooter.createDiv({
			cls: this.cls("whats-new-buttons"),
		});

		// Full changelog button
		const changelogBtn = buttonContainer.createEl("button", {
			text: "Changelog",
		});
		changelogBtn.addEventListener("click", () => {
			window.open(this.config.links.changelog, "_blank");
		});

		// Documentation button
		const docsBtn = buttonContainer.createEl("button", {
			text: "Documentation",
		});
		docsBtn.addEventListener("click", () => {
			window.open(this.config.links.documentation, "_blank");
		});

		// Tools button
		const toolsBtn = buttonContainer.createEl("button", {
			text: "Other Plugins",
		});
		toolsBtn.addEventListener("click", () => {
			window.open(this.config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS, "_blank");
		});

		// YouTube button
		const youtubeBtn = buttonContainer.createEl("button", {
			text: "YouTube",
		});
		youtubeBtn.addEventListener("click", () => {
			window.open(this.config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE, "_blank");
		});

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
