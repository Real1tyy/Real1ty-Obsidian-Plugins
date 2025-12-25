import type { App, MetadataCache, TFile, Vault } from "obsidian";
import { BehaviorSubject, lastValueFrom } from "rxjs";
import { take, toArray } from "rxjs/operators";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Indexer, type IndexerConfig } from "../../src/core/indexer";

describe("Indexer", () => {
	let mockApp: App;
	let mockVault: Vault;
	let mockMetadataCache: MetadataCache;
	let configStore: BehaviorSubject<IndexerConfig>;
	let indexer: Indexer;

	// Mock event handlers storage
	const vaultHandlers: Map<string, Set<(...args: unknown[]) => void>> = new Map();

	beforeEach(() => {
		vaultHandlers.clear();

		// Mock vault with event system
		mockVault = {
			getMarkdownFiles: vi.fn(() => []),
			on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				if (!vaultHandlers.has(event)) {
					vaultHandlers.set(event, new Set());
				}
				vaultHandlers.get(event)?.add(handler);
				return {} as never;
			}),
			off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
				vaultHandlers.get(event)?.delete(handler);
			}),
		} as unknown as Vault;

		mockMetadataCache = {
			getFileCache: vi.fn(() => null),
		} as unknown as MetadataCache;

		mockApp = {
			vault: mockVault,
			metadataCache: mockMetadataCache,
		} as unknown as App;

		configStore = new BehaviorSubject<IndexerConfig>({
			directory: "TestFolder",
			excludedDiffProps: new Set(["mtime"]),
			scanConcurrency: 5,
			debounceMs: 10, // Shorter debounce for faster tests
		});

		indexer = new Indexer(mockApp, configStore);
	});

	afterEach(() => {
		indexer.stop();
	});

	describe("initialization", () => {
		it("should create indexer with default config", () => {
			const minimalConfig = new BehaviorSubject<IndexerConfig>({});
			const minimalIndexer = new Indexer(mockApp, minimalConfig);

			expect(minimalIndexer).toBeDefined();
			expect(minimalIndexer.events$).toBeDefined();
			expect(minimalIndexer.indexingComplete$).toBeDefined();

			minimalIndexer.stop();
		});

		it("should expose events$ and indexingComplete$ observables", () => {
			expect(indexer.events$).toBeDefined();
			expect(indexer.indexingComplete$).toBeDefined();
		});
	});

	describe("start and stop", () => {
		it("should register vault event listeners on start", async () => {
			await indexer.start();

			expect(mockVault.on).toHaveBeenCalledWith("create", expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith("modify", expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith("delete", expect.any(Function));
			expect(mockVault.on).toHaveBeenCalledWith("rename", expect.any(Function));
		});

		it("should unregister vault event listeners on stop", async () => {
			await indexer.start();
			indexer.stop();

			expect(mockVault.off).toHaveBeenCalled();
		});
	});

	describe("file scanning", () => {
		it("should scan all markdown files in configured directory", async () => {
			const mockFile: TFile = {
				path: "TestFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockVault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockMetadataCache.getFileCache).mockReturnValue({
				frontmatter: {
					title: "Test Note",
					tags: ["test"],
				},
			} as never);

			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));

			await indexer.start();

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("file-changed");
			expect(events[0].filePath).toBe("TestFolder/note.md");
			expect(events[0].source?.frontmatter).toEqual({
				title: "Test Note",
				tags: ["test"],
			});
		});

		it("should filter files not in configured directory", async () => {
			const mockFiles: TFile[] = [
				{
					path: "TestFolder/note.md",
					basename: "note",
					extension: "md",
					parent: { path: "TestFolder" },
					stat: { mtime: Date.now() },
				} as TFile,
				{
					path: "OtherFolder/other.md",
					basename: "other",
					extension: "md",
					parent: { path: "OtherFolder" },
					stat: { mtime: Date.now() },
				} as TFile,
			];

			vi.mocked(mockVault.getMarkdownFiles).mockReturnValue(mockFiles);
			vi.mocked(mockMetadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Test" },
			} as never);

			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));

			await indexer.start();

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].filePath).toBe("TestFolder/note.md");
		});

		it("should skip files without frontmatter", async () => {
			const mockFile: TFile = {
				path: "TestFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockVault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockMetadataCache.getFileCache).mockReturnValue(null);

			const events: unknown[] = [];
			const eventsSub = indexer.events$.subscribe((e) => events.push(e));

			await indexer.start();

			// Wait for indexing to complete
			await new Promise((resolve) => setTimeout(resolve, 100));

			eventsSub.unsubscribe();

			// Should complete without emitting any file-changed events
			expect(events).toHaveLength(0);
		});
	});

	describe("resync", () => {
		it("should clear cache and rescan on resync", async () => {
			const mockFile: TFile = {
				path: "TestFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockVault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockMetadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Test" },
			} as never);

			await indexer.start();

			// Resync should trigger another scan
			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));
			indexer.resync();

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].type).toBe("file-changed");
		});
	});

	describe("config changes", () => {
		it("should rescan when directory config changes", async () => {
			await indexer.start();

			const mockFile: TFile = {
				path: "NewFolder/note.md",
				basename: "note",
				extension: "md",
				parent: { path: "NewFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockVault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockMetadataCache.getFileCache).mockReturnValue({
				frontmatter: { title: "Test" },
			} as never);

			const eventsPromise = lastValueFrom(indexer.events$.pipe(take(1), toArray()));

			// Change directory config
			configStore.next({
				directory: "NewFolder",
			});

			const events = await eventsPromise;
			expect(events).toHaveLength(1);
			expect(events[0].filePath).toBe("NewFolder/note.md");
		});

		it("should not rescan when non-directory config changes", async () => {
			await indexer.start();

			const scanSpy = vi.spyOn(mockVault, "getMarkdownFiles");
			scanSpy.mockClear();

			// Change non-directory config
			configStore.next({
				directory: "TestFolder", // Same directory
				scanConcurrency: 20, // Different concurrency
			});

			// Wait a bit to ensure no scan happens
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Should not trigger new scan
			expect(scanSpy).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle errors during file processing", async () => {
			const mockFile: TFile = {
				path: "TestFolder/error.md",
				basename: "error",
				extension: "md",
				parent: { path: "TestFolder" },
				stat: { mtime: Date.now() },
			} as TFile;

			vi.mocked(mockVault.getMarkdownFiles).mockReturnValue([mockFile]);
			vi.mocked(mockMetadataCache.getFileCache).mockImplementation(() => {
				throw new Error("Cache error");
			});

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await indexer.start();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error processing file"),
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});
});
