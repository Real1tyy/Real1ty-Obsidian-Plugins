/**
 * Creates a function that ensures an async operation runs only once,
 * returning the same promise for concurrent calls.
 *
 * Useful for initialization patterns where you want to ensure
 * expensive async operations (like indexing, API calls, etc.)
 * only happen once even if called multiple times.
 *
 * @param fn The async function to memoize
 * @returns A function that returns the same promise on subsequent calls
 *
 * @example
 * ```typescript
 * const initializeOnce = onceAsync(async () => {
 *   await heavyInitialization();
 *   console.log("Initialized!");
 * });
 *
 * // All these calls will share the same promise
 * await initializeOnce();
 * await initializeOnce(); // Won't run again
 * await initializeOnce(); // Won't run again
 * ```
 */
export function onceAsync<T>(fn: () => Promise<T>): () => Promise<T> {
	let promise: Promise<T> | null = null;

	return () => {
		if (!promise) {
			try {
				promise = fn();
			} catch (error) {
				// Convert synchronous errors to rejected promises
				promise = Promise.reject(error);
			}
		}
		return promise;
	};
}

/**
 * Creates a function that ensures an async operation runs only once per key,
 * useful for caching expensive operations with different parameters.
 *
 * @param fn The async function to memoize
 * @returns A function that memoizes results by key
 *
 * @example
 * ```typescript
 * const fetchUserOnce = onceAsyncKeyed(async (userId: string) => {
 *   return await api.getUser(userId);
 * });
 *
 * // Each unique userId will only be fetched once
 * await fetchUserOnce("user1");
 * await fetchUserOnce("user1"); // Returns cached promise
 * await fetchUserOnce("user2"); // New fetch for different key
 * ```
 */
export function onceAsyncKeyed<TArgs extends readonly unknown[], TReturn>(
	fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
	const cache = new Map<string, Promise<TReturn>>();

	return (...args: TArgs) => {
		const key = JSON.stringify(args);

		if (!cache.has(key)) {
			cache.set(key, fn(...args));
		}

		return cache.get(key)!;
	};
}

/**
 * Creates a resettable version of onceAsync that can be cleared and re-run.
 *
 * @param fn The async function to memoize
 * @returns Object with execute and reset methods
 *
 * @example
 * ```typescript
 * const { execute: initialize, reset } = onceAsyncResettable(async () => {
 *   await heavyInitialization();
 * });
 *
 * await initialize(); // Runs
 * await initialize(); // Cached
 *
 * reset(); // Clear cache
 * await initialize(); // Runs again
 * ```
 */
export function onceAsyncResettable<T>(fn: () => Promise<T>): {
	execute: () => Promise<T>;
	reset: () => void;
} {
	let promise: Promise<T> | null = null;

	return {
		execute: () => {
			if (!promise) {
				try {
					promise = fn();
				} catch (error) {
					// Convert synchronous errors to rejected promises
					promise = Promise.reject(error);
				}
			}
			return promise;
		},
		reset: () => {
			promise = null;
		},
	};
}
