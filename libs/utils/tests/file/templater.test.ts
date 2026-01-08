import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFromTemplate, isTemplaterAvailable } from "../../src/file";

// Mock normalizePath from obsidian
vi.mock("obsidian", async () => {
	const actual = await vi.importActual("obsidian");
	return {
		...actual,
		normalizePath: vi.fn((path: string) => path),
		Notice: vi.fn(),
	};
});

// Mock Templater plugin
const mockTemplaterPlugin = {
	templater: {
		create_new_note_from_template: vi.fn(),
	},
};

// Mock Obsidian types
const mockApp = {
	plugins: {
		getPlugin: vi.fn((id: string) => {
			if (id === "templater-obsidian") {
				return mockTemplaterPlugin;
			}
			return null;
		}),
	},
	vault: {
		getFileByPath: vi.fn(),
		getAbstractFileByPath: vi.fn(),
	},
	workspace: {
		onLayoutReady: vi.fn((callback: () => void) => {
			// Immediately call the callback for tests
			callback();
		}),
	},
	metadataCache: {
		getFileCache: vi.fn(),
	},
	fileManager: {
		processFrontMatter: vi.fn(),
	},
} as any;

const mockTFile = {
	path: "template.md",
	name: "template.md",
} as any;

describe("Templater Utils", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset all mock implementations
		mockApp.fileManager.processFrontMatter.mockReset();
		mockApp.metadataCache.getFileCache.mockReset();
	});
	describe("isTemplaterAvailable", () => {
		it("should return true when Templater plugin is available", () => {
			const result = isTemplaterAvailable(mockApp);
			expect(result).toBe(true);
		});

		it("should return false when Templater plugin is not available", () => {
			const appWithoutTemplater = {
				plugins: {
					getPlugin: vi.fn(() => null),
				},
			} as any;

			const result = isTemplaterAvailable(appWithoutTemplater);
			expect(result).toBe(false);
		});

		it("should return false when plugins.getPlugin is not available", () => {
			const appWithoutGetPlugin = {
				plugins: {},
			} as any;

			const result = isTemplaterAvailable(appWithoutGetPlugin);
			expect(result).toBe(false);
		});
	});

	describe("createFromTemplate", () => {
		it("should create file from template successfully", async () => {
			const mockCreatedFile = { path: "events/new-event.md" } as any;
			mockApp.vault.getFileByPath.mockReturnValue(mockTFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(
				mockCreatedFile
			);

			const result = await createFromTemplate(
				mockApp,
				"templates/event.md",
				"events",
				"new-event",
				false
			);

			expect(result).toBe(mockCreatedFile);
			expect(mockTemplaterPlugin.templater.create_new_note_from_template).toHaveBeenCalledWith(
				mockTFile,
				"events",
				"new-event",
				false
			);
		});

		it("should return null when Templater is not available", async () => {
			const appWithoutTemplater = {
				plugins: {
					getPlugin: vi.fn(() => null),
				},
				workspace: {
					onLayoutReady: vi.fn((callback: () => void) => callback()),
				},
				vault: {
					getFileByPath: vi.fn(),
				},
			} as any;

			// Use fake timers to control the timeout behavior
			vi.useFakeTimers();

			const promise = createFromTemplate(
				appWithoutTemplater,
				"templates/event.md",
				"events",
				"new-event"
			);

			// Fast-forward time to exceed the timeout (8000ms + some buffer)
			await vi.advanceTimersByTimeAsync(8500);

			const result = await promise;

			vi.useRealTimers();

			expect(result).toBeNull();
		});

		it("should return null when template file is not found", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(null);

			const result = await createFromTemplate(mockApp, "nonexistent.md", "events", "new-event");

			expect(result).toBeNull();
		});

		it("should handle Templater API errors gracefully", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockRejectedValue(
				new Error("Templater error")
			);

			const result = await createFromTemplate(mockApp, "templates/event.md", "events", "new-event");

			expect(result).toBeNull();
		});

		it("should handle case when Templater API returns undefined", async () => {
			mockApp.vault.getFileByPath.mockReturnValue(mockTFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(undefined);

			const result = await createFromTemplate(mockApp, "templates/event.md", "events", "new-event");

			expect(result).toBeNull();
		});

		it("should wait for Templater API to become available", async () => {
			let callCount = 0;
			const delayedTemplaterApp = {
				plugins: {
					getPlugin: vi.fn(() => {
						callCount++;
						// Return null first few times, then return the plugin
						if (callCount <= 2) {
							return null;
						}
						return mockTemplaterPlugin;
					}),
				},
				workspace: {
					onLayoutReady: vi.fn((callback: () => void) => callback()),
				},
				vault: {
					getFileByPath: vi.fn().mockReturnValue(mockTFile),
				},
			} as any;

			const mockCreatedFile = { path: "events/new-event.md" } as any;
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(
				mockCreatedFile
			);

			vi.useFakeTimers();

			const promise = createFromTemplate(
				delayedTemplaterApp,
				"templates/event.md",
				"events",
				"new-event"
			);

			// Advance time to trigger the polling mechanism
			await vi.advanceTimersByTimeAsync(500); // This should be enough for 2-3 polling attempts

			const result = await promise;

			vi.useRealTimers();

			expect(result).toBe(mockCreatedFile);
			expect(callCount).toBeGreaterThan(2);
		});

		it("should not wait for file if no frontmatter provided", async () => {
			const mockCreatedFile = {
				path: "events/new-event.md",
				name: "new-event.md",
			} as any;

			mockApp.vault.getFileByPath.mockReturnValue(mockTFile);
			mockTemplaterPlugin.templater.create_new_note_from_template.mockResolvedValue(
				mockCreatedFile
			);

			const result = await createFromTemplate(
				mockApp,
				"templates/event.md",
				"events",
				"new-event",
				false
			);

			expect(result).toBe(mockCreatedFile);
			// Should not attempt to process frontmatter
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});
});
