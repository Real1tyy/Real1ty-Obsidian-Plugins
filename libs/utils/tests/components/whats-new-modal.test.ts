import type { App, Plugin } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsNewModalConfig } from "../../src/components/whats-new-modal";
import { WhatsNewModal } from "../../src/components/whats-new-modal";

// Mock window.open
const mockWindowOpen = vi.fn();
global.window.open = mockWindowOpen;

describe("WhatsNewModal - makeExternalLinksClickable", () => {
	let mockApp: App;
	let mockPlugin: Plugin;
	let config: WhatsNewModalConfig;
	let modal: WhatsNewModal;
	let container: HTMLElement;

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();

		// Create mock app and plugin
		mockApp = {} as App;
		mockPlugin = {} as Plugin;

		// Create config with all required links
		config = {
			cssPrefix: "test-plugin",
			pluginName: "Test Plugin",
			changelogContent: "## 1.0.0\n\nInitial release",
			links: {
				support: "https://example.com/support",
				changelog: "https://example.com/changelog",
				documentation: "https://docs.example.com",
			},
		};

		// Create modal instance
		modal = new WhatsNewModal(mockApp, mockPlugin, config, "0.9.0", "1.0.0");

		// Create a container for testing
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		// Clean up DOM
		document.body.removeChild(container);
	});

	describe("Absolute HTTP URLs", () => {
		it("should make HTTP links clickable", () => {
			// Create a link with http URL
			const link = document.createElement("a");
			link.href = "http://example.com/page";
			link.textContent = "Example Link";
			container.appendChild(link);

			// Call the private method through reflection
			(modal as any).makeExternalLinksClickable(container);

			// Click the link
			link.click();

			// Verify window.open was called with correct URL
			expect(mockWindowOpen).toHaveBeenCalledWith("http://example.com/page", "_blank");
			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should make HTTPS links clickable", () => {
			const link = document.createElement("a");
			link.href = "https://example.com/secure-page";
			link.textContent = "Secure Link";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://example.com/secure-page", "_blank");
			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should handle multiple absolute links", () => {
			const link1 = document.createElement("a");
			link1.href = "https://example.com/page1";
			link1.textContent = "Link 1";

			const link2 = document.createElement("a");
			link2.href = "http://example.com/page2";
			link2.textContent = "Link 2";

			container.appendChild(link1);
			container.appendChild(link2);

			(modal as any).makeExternalLinksClickable(container);

			link1.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("https://example.com/page1", "_blank");

			link2.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("http://example.com/page2", "_blank");
		});
	});

	describe("Relative URLs", () => {
		it("should resolve relative links with documentation base URL", () => {
			const link = document.createElement("a");
			link.href = "/integrations#activitywatch";
			link.textContent = "Learn more";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://docs.example.com/integrations#activitywatch",
				"_blank"
			);
			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should handle documentation URL with trailing slash", () => {
			// Update config with trailing slash
			config.links.documentation = "https://docs.example.com/";
			const modalWithTrailingSlash = new WhatsNewModal(
				mockApp,
				mockPlugin,
				config,
				"0.9.0",
				"1.0.0"
			);

			const link = document.createElement("a");
			link.href = "/guides/getting-started";
			link.textContent = "Getting Started";
			container.appendChild(link);

			(modalWithTrailingSlash as any).makeExternalLinksClickable(container);

			link.click();

			// Should not have double slashes
			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://docs.example.com/guides/getting-started",
				"_blank"
			);
		});

		it("should handle documentation URL without trailing slash", () => {
			// Config already has no trailing slash
			const link = document.createElement("a");
			link.href = "/api/reference";
			link.textContent = "API Reference";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://docs.example.com/api/reference",
				"_blank"
			);
		});

		it("should handle relative links with hash fragments", () => {
			const link = document.createElement("a");
			link.href = "/features#calendars";
			link.textContent = "Calendar Features";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://docs.example.com/features#calendars",
				"_blank"
			);
		});

		it("should handle relative links with query parameters", () => {
			const link = document.createElement("a");
			link.href = "/search?q=events";
			link.textContent = "Search Events";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://docs.example.com/search?q=events",
				"_blank"
			);
		});

		it("should handle deep relative paths", () => {
			const link = document.createElement("a");
			link.href = "/guides/advanced/custom-views";
			link.textContent = "Custom Views";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://docs.example.com/guides/advanced/custom-views",
				"_blank"
			);
		});
	});

	describe("Mixed link types", () => {
		it("should handle both absolute and relative links together", () => {
			const absoluteLink = document.createElement("a");
			absoluteLink.href = "https://github.com/repo";
			absoluteLink.textContent = "GitHub";

			const relativeLink = document.createElement("a");
			relativeLink.href = "/docs/api";
			relativeLink.textContent = "API Docs";

			container.appendChild(absoluteLink);
			container.appendChild(relativeLink);

			(modal as any).makeExternalLinksClickable(container);

			absoluteLink.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("https://github.com/repo", "_blank");

			relativeLink.click();
			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/docs/api", "_blank");
		});
	});

	describe("Edge cases", () => {
		it("should ignore links without href attribute", () => {
			const link = document.createElement("a");
			link.textContent = "No href";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).not.toHaveBeenCalled();
			expect(link.classList.contains("external-link")).toBe(false);
		});

		it("should ignore links with empty href", () => {
			const link = document.createElement("a");
			link.href = "";
			link.textContent = "Empty href";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});

		it("should ignore internal wiki links", () => {
			const link = document.createElement("a");
			link.href = "Page Name";
			link.setAttribute("data-href", "Page Name");
			link.classList.add("internal-link");
			link.textContent = "Internal Link";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).not.toHaveBeenCalled();
			// Should not add external-link class to internal links
			expect(link.classList.contains("external-link")).toBe(false);
		});

		it("should handle links with special characters in URL", () => {
			const link = document.createElement("a");
			link.href = "https://example.com/page?param=value&other=123";
			link.textContent = "Special Chars";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith(
				"https://example.com/page?param=value&other=123",
				"_blank"
			);
		});

		it("should prevent default link behavior", () => {
			const link = document.createElement("a");
			link.href = "https://example.com/page";
			link.textContent = "Test Link";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			// Create a mock event
			const event = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
			});

			const preventDefaultSpy = vi.spyOn(event, "preventDefault");

			link.dispatchEvent(event);

			expect(preventDefaultSpy).toHaveBeenCalled();
		});

		it("should handle nested elements within container", () => {
			const section = document.createElement("div");
			const paragraph = document.createElement("p");
			const link = document.createElement("a");
			link.href = "/nested/link";
			link.textContent = "Nested Link";

			paragraph.appendChild(link);
			section.appendChild(paragraph);
			container.appendChild(section);

			(modal as any).makeExternalLinksClickable(container);

			link.click();

			expect(mockWindowOpen).toHaveBeenCalledWith("https://docs.example.com/nested/link", "_blank");
		});

		it("should handle empty container", () => {
			expect(() => {
				(modal as any).makeExternalLinksClickable(container);
			}).not.toThrow();

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});

		it("should handle container with no links", () => {
			const div = document.createElement("div");
			div.textContent = "Just text, no links";
			container.appendChild(div);

			expect(() => {
				(modal as any).makeExternalLinksClickable(container);
			}).not.toThrow();

			expect(mockWindowOpen).not.toHaveBeenCalled();
		});
	});

	describe("CSS class application", () => {
		it("should add external-link class to absolute links", () => {
			const link = document.createElement("a");
			link.href = "https://example.com";
			link.textContent = "External";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should add external-link class to relative links", () => {
			const link = document.createElement("a");
			link.href = "/docs";
			link.textContent = "Docs";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			expect(link.classList.contains("external-link")).toBe(true);
		});

		it("should not add external-link class to non-http links", () => {
			const link = document.createElement("a");
			link.href = "mailto:test@example.com";
			link.textContent = "Email";
			container.appendChild(link);

			(modal as any).makeExternalLinksClickable(container);

			expect(link.classList.contains("external-link")).toBe(false);
		});
	});
});
