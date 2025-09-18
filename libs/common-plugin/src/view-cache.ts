import type { ViewCacheManager, ViewSelectionCache } from "./types";

/**
 * In-memory cache for storing view selections per file path.
 *
 * This cache helps maintain user's dropdown selections when switching between files,
 * providing a better user experience by reducing context switching.
 *
 * Features:
 * - Fast O(1) lookups using Map
 * - Automatic cleanup capabilities
 * - Type-safe interface
 * - Memory-only storage (no persistence)
 */
export class InMemoryViewCache implements ViewCacheManager {
	private cache = new Map<string, ViewSelectionCache>();

	/**
	 * Retrieve cached view selection for a specific file path
	 * @param filePath - The full path of the file
	 * @returns Cached selection or null if not found
	 */
	getViewSelection(filePath: string): ViewSelectionCache | null {
		if (!filePath) {
			return null;
		}
		return this.cache.get(filePath) || null;
	}

	/**
	 * Store view selection for a specific file path
	 * @param filePath - The full path of the file
	 * @param selection - The view selection to cache
	 */
	setViewSelection(filePath: string, selection: ViewSelectionCache): void {
		if (!filePath) {
			return;
		}

		// Create a deep copy to prevent external mutations
		this.cache.set(filePath, {
			selectedViewId: selection.selectedViewId,
			selectedSubViewId: selection.selectedSubViewId,
		});
	}

	/**
	 * Check if a file path has cached selections
	 * @param filePath - The full path of the file
	 * @returns True if cache exists for this file
	 */
	hasCache(filePath: string): boolean {
		if (!filePath) {
			return false;
		}
		return this.cache.has(filePath);
	}

	/**
	 * Clear all cached selections
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Remove cache entry for a specific file path
	 * @param filePath - The full path of the file to remove from cache
	 */
	removeCache(filePath: string): boolean {
		if (!filePath) {
			return false;
		}
		return this.cache.delete(filePath);
	}

	/**
	 * Get all cached file paths (useful for debugging)
	 * @returns Array of file paths that have cached selections
	 */
	getCachedFilePaths(): string[] {
		return Array.from(this.cache.keys());
	}

	/**
	 * Get the total number of cached entries
	 * @returns Number of cached file selections
	 */
	getCacheSize(): number {
		return this.cache.size;
	}

	/**
	 * Clear cache entries that match a pattern (useful for cleanup)
	 * @param pattern - RegExp pattern to match file paths
	 * @returns Number of entries removed
	 */
	clearCacheByPattern(pattern: RegExp): number {
		let removedCount = 0;
		for (const filePath of this.cache.keys()) {
			if (pattern.test(filePath)) {
				this.cache.delete(filePath);
				removedCount++;
			}
		}
		return removedCount;
	}

	/**
	 * Update an existing cache entry without replacing it entirely
	 * @param filePath - The full path of the file
	 * @param updates - Partial updates to apply
	 * @returns True if update was successful, false if no existing cache
	 */
	updateViewSelection(filePath: string, updates: Partial<ViewSelectionCache>): boolean {
		if (!filePath || !this.hasCache(filePath)) {
			return false;
		}

		const existing = this.cache.get(filePath)!;
		this.cache.set(filePath, {
			selectedViewId:
				"selectedViewId" in updates ? (updates.selectedViewId ?? null) : existing.selectedViewId,
			selectedSubViewId:
				"selectedSubViewId" in updates
					? (updates.selectedSubViewId ?? null)
					: existing.selectedSubViewId,
		});
		return true;
	}
}

export function createViewCache(): ViewCacheManager {
	return new InMemoryViewCache();
}

export function isValidViewSelection(selection: ViewSelectionCache | null): boolean {
	if (!selection) {
		return false;
	}

	// At minimum, we need a main view selection
	return selection.selectedViewId !== null && selection.selectedViewId !== undefined;
}

export function createEmptyViewSelection(): ViewSelectionCache {
	return {
		selectedViewId: null,
		selectedSubViewId: null,
	};
}
