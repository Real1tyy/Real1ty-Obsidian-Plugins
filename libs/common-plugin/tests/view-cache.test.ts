import { beforeEach, describe, expect, it } from "vitest";
import type { ViewCacheManager, ViewSelectionCache } from "../src/types";
import {
	createEmptyViewSelection,
	createViewCache,
	InMemoryViewCache,
	isValidViewSelection,
} from "../src/view-cache";

describe("InMemoryViewCache", () => {
	let cache: InMemoryViewCache;

	beforeEach(() => {
		cache = new InMemoryViewCache();
	});

	describe("Basic Operations", () => {
		it("should initialize with empty cache", () => {
			expect(cache.getCacheSize()).toBe(0);
			expect(cache.getCachedFilePaths()).toEqual([]);
		});

		it("should store and retrieve view selections", () => {
			const filePath = "test/file.md";
			const selection: ViewSelectionCache = {
				selectedViewId: "tasks",
				selectedSubViewId: "subtask1",
			};

			cache.setViewSelection(filePath, selection);

			const retrieved = cache.getViewSelection(filePath);
			expect(retrieved).toEqual(selection);
			expect(cache.hasCache(filePath)).toBe(true);
			expect(cache.getCacheSize()).toBe(1);
		});

		it("should return null for non-existent cache entries", () => {
			expect(cache.getViewSelection("non-existent.md")).toBeNull();
			expect(cache.hasCache("non-existent.md")).toBe(false);
		});

		it("should handle empty or invalid file paths", () => {
			expect(cache.getViewSelection("")).toBeNull();
			expect(cache.hasCache("")).toBe(false);

			cache.setViewSelection("", { selectedViewId: "test", selectedSubViewId: null });
			expect(cache.getCacheSize()).toBe(0);
		});
	});

	describe("Cache Management", () => {
		beforeEach(() => {
			// Setup some test data
			cache.setViewSelection("file1.md", { selectedViewId: "view1", selectedSubViewId: null });
			cache.setViewSelection("file2.md", { selectedViewId: "view2", selectedSubViewId: "sub1" });
			cache.setViewSelection("folder/file3.md", {
				selectedViewId: "view3",
				selectedSubViewId: null,
			});
		});

		it("should clear all cache entries", () => {
			expect(cache.getCacheSize()).toBe(3);

			cache.clearCache();

			expect(cache.getCacheSize()).toBe(0);
			expect(cache.getCachedFilePaths()).toEqual([]);
			expect(cache.getViewSelection("file1.md")).toBeNull();
		});

		it("should remove specific cache entries", () => {
			expect(cache.removeCache("file1.md")).toBe(true);
			expect(cache.hasCache("file1.md")).toBe(false);
			expect(cache.getCacheSize()).toBe(2);

			expect(cache.removeCache("non-existent.md")).toBe(false);
			expect(cache.getCacheSize()).toBe(2);
		});

		it("should get all cached file paths", () => {
			const paths = cache.getCachedFilePaths();
			expect(paths).toHaveLength(3);
			expect(paths).toContain("file1.md");
			expect(paths).toContain("file2.md");
			expect(paths).toContain("folder/file3.md");
		});

		it("should clear cache entries by pattern", () => {
			// Clear all files in folder/
			const removedCount = cache.clearCacheByPattern(/^folder\//);
			expect(removedCount).toBe(1);
			expect(cache.getCacheSize()).toBe(2);
			expect(cache.hasCache("folder/file3.md")).toBe(false);

			// Clear all .md files
			const removedCount2 = cache.clearCacheByPattern(/\.md$/);
			expect(removedCount2).toBe(2);
			expect(cache.getCacheSize()).toBe(0);
		});
	});

	describe("Data Integrity", () => {
		it("should create deep copies to prevent external mutations", () => {
			const filePath = "test.md";
			const originalSelection: ViewSelectionCache = {
				selectedViewId: "original",
				selectedSubViewId: "sub-original",
			};

			cache.setViewSelection(filePath, originalSelection);

			// Mutate the original object
			originalSelection.selectedViewId = "mutated";
			originalSelection.selectedSubViewId = "sub-mutated";

			// Cache should still have the original values
			const retrieved = cache.getViewSelection(filePath);
			expect(retrieved?.selectedViewId).toBe("original");
			expect(retrieved?.selectedSubViewId).toBe("sub-original");
		});

		it("should handle null and undefined values correctly", () => {
			const filePath = "test.md";

			cache.setViewSelection(filePath, {
				selectedViewId: null,
				selectedSubViewId: undefined as any,
			});

			const retrieved = cache.getViewSelection(filePath);
			expect(retrieved?.selectedViewId).toBeNull();
			expect(retrieved?.selectedSubViewId).toBeUndefined();
		});
	});

	describe("Update Operations", () => {
		beforeEach(() => {
			cache.setViewSelection("test.md", {
				selectedViewId: "view1",
				selectedSubViewId: "sub1",
			});
		});

		it("should update existing cache entries partially", () => {
			const success = cache.updateViewSelection("test.md", {
				selectedSubViewId: "new-sub",
			});

			expect(success).toBe(true);

			const updated = cache.getViewSelection("test.md");
			expect(updated?.selectedViewId).toBe("view1"); // Unchanged
			expect(updated?.selectedSubViewId).toBe("new-sub"); // Updated
		});

		it("should fail to update non-existent cache entries", () => {
			const success = cache.updateViewSelection("non-existent.md", {
				selectedViewId: "new-view",
			});

			expect(success).toBe(false);
			expect(cache.hasCache("non-existent.md")).toBe(false);
		});

		it("should handle partial updates with null values", () => {
			cache.updateViewSelection("test.md", {
				selectedSubViewId: null,
			});

			const updated = cache.getViewSelection("test.md");
			expect(updated?.selectedViewId).toBe("view1");
			expect(updated?.selectedSubViewId).toBeNull();
		});
	});

	describe("Edge Cases", () => {
		it("should handle special characters in file paths", () => {
			const specialPaths = [
				"file with spaces.md",
				"file-with-dashes.md",
				"file_with_underscores.md",
				"file.with.dots.md",
				"folder/subfolder/deep-file.md",
				"中文文件.md",
				"файл.md",
			];

			for (const path of specialPaths) {
				cache.setViewSelection(path, {
					selectedViewId: `view-${path}`,
					selectedSubViewId: null,
				});

				expect(cache.hasCache(path)).toBe(true);
				expect(cache.getViewSelection(path)?.selectedViewId).toBe(`view-${path}`);
			}

			expect(cache.getCacheSize()).toBe(specialPaths.length);
		});

		it("should handle very long file paths", () => {
			const longPath = `${"a/".repeat(100)}very-long-path.md`;

			cache.setViewSelection(longPath, {
				selectedViewId: "long-view",
				selectedSubViewId: "long-sub",
			});

			expect(cache.hasCache(longPath)).toBe(true);
			expect(cache.getViewSelection(longPath)?.selectedViewId).toBe("long-view");
		});

		it("should handle large numbers of cache entries", () => {
			const numEntries = 1000;

			for (let i = 0; i < numEntries; i++) {
				cache.setViewSelection(`file${i}.md`, {
					selectedViewId: `view${i}`,
					selectedSubViewId: i % 2 === 0 ? `sub${i}` : null,
				});
			}

			expect(cache.getCacheSize()).toBe(numEntries);

			// Verify random entries
			expect(cache.getViewSelection("file500.md")?.selectedViewId).toBe("view500");
			expect(cache.getViewSelection("file501.md")?.selectedSubViewId).toBeNull();
			expect(cache.getViewSelection("file502.md")?.selectedSubViewId).toBe("sub502");
		});
	});
});

describe("ViewCache Factory and Utilities", () => {
	describe("createViewCache", () => {
		it("should create a new cache instance", () => {
			const cache = createViewCache();
			expect(cache).toBeDefined();
			expect(typeof cache.getViewSelection).toBe("function");
			expect(typeof cache.setViewSelection).toBe("function");
			expect(typeof cache.clearCache).toBe("function");
		});

		it("should create independent cache instances", () => {
			const cache1 = createViewCache();
			const cache2 = createViewCache();

			cache1.setViewSelection("test.md", { selectedViewId: "view1", selectedSubViewId: null });

			expect(cache1.hasCache("test.md")).toBe(true);
			expect(cache2.hasCache("test.md")).toBe(false);
		});
	});

	describe("isValidViewSelection", () => {
		it("should validate view selections correctly", () => {
			expect(isValidViewSelection(null)).toBe(false);
			expect(isValidViewSelection(undefined as any)).toBe(false);

			expect(
				isValidViewSelection({
					selectedViewId: null,
					selectedSubViewId: null,
				})
			).toBe(false);

			expect(
				isValidViewSelection({
					selectedViewId: "view1",
					selectedSubViewId: null,
				})
			).toBe(true);

			expect(
				isValidViewSelection({
					selectedViewId: "view1",
					selectedSubViewId: "sub1",
				})
			).toBe(true);

			expect(
				isValidViewSelection({
					selectedViewId: "",
					selectedSubViewId: null,
				})
			).toBe(true); // Empty string is still a valid ID
		});
	});

	describe("createEmptyViewSelection", () => {
		it("should create empty view selection", () => {
			const empty = createEmptyViewSelection();

			expect(empty.selectedViewId).toBeNull();
			expect(empty.selectedSubViewId).toBeNull();
			expect(isValidViewSelection(empty)).toBe(false);
		});

		it("should create independent empty selections", () => {
			const empty1 = createEmptyViewSelection();
			const empty2 = createEmptyViewSelection();

			empty1.selectedViewId = "modified";

			expect(empty1.selectedViewId).toBe("modified");
			expect(empty2.selectedViewId).toBeNull();
		});
	});
});

describe("ViewCacheManager Interface Compliance", () => {
	let cache: ViewCacheManager;

	beforeEach(() => {
		cache = createViewCache();
	});

	it("should implement all required interface methods", () => {
		expect(typeof cache.getViewSelection).toBe("function");
		expect(typeof cache.setViewSelection).toBe("function");
		expect(typeof cache.clearCache).toBe("function");
		expect(typeof cache.hasCache).toBe("function");
	});

	it("should work through the interface", () => {
		const filePath = "interface-test.md";
		const selection: ViewSelectionCache = {
			selectedViewId: "interface-view",
			selectedSubViewId: "interface-sub",
		};

		cache.setViewSelection(filePath, selection);

		expect(cache.hasCache(filePath)).toBe(true);
		expect(cache.getViewSelection(filePath)).toEqual(selection);

		cache.clearCache();
		expect(cache.hasCache(filePath)).toBe(false);
	});
});

describe("Default Behavior Support", () => {
	let cache: ViewCacheManager;

	beforeEach(() => {
		cache = createViewCache();
	});

	it("should return null for uncached files to support default behavior", () => {
		// This test verifies that the cache correctly returns null for uncached files
		// which allows the SidebarManager to use default selections instead of inheriting

		const newFile1 = "new-file-1.md";
		const newFile2 = "new-file-2.md";

		// Both files should return null (no cache)
		expect(cache.getViewSelection(newFile1)).toBeNull();
		expect(cache.getViewSelection(newFile2)).toBeNull();
		expect(cache.hasCache(newFile1)).toBe(false);
		expect(cache.hasCache(newFile2)).toBe(false);
	});

	it("should maintain independent cache entries for different files", () => {
		// This ensures that each file gets its own cache entry and doesn't inherit from others

		const file1 = "project1/notes.md";
		const file2 = "project2/tasks.md";

		// Set different selections for each file
		cache.setViewSelection(file1, {
			selectedViewId: "notes-view",
			selectedSubViewId: "notes-sub",
		});

		cache.setViewSelection(file2, {
			selectedViewId: "tasks-view",
			selectedSubViewId: "tasks-sub",
		});

		// Each file should have its own independent cache
		const file1Cache = cache.getViewSelection(file1);
		const file2Cache = cache.getViewSelection(file2);

		expect(file1Cache?.selectedViewId).toBe("notes-view");
		expect(file1Cache?.selectedSubViewId).toBe("notes-sub");

		expect(file2Cache?.selectedViewId).toBe("tasks-view");
		expect(file2Cache?.selectedSubViewId).toBe("tasks-sub");

		// A third file should still return null (defaults)
		expect(cache.getViewSelection("project3/other.md")).toBeNull();
	});
});
