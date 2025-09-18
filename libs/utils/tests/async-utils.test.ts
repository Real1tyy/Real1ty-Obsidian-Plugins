import { beforeEach, describe, expect, it, vi } from "vitest";
import { onceAsync, onceAsyncKeyed, onceAsyncResettable } from "../src/async-utils";

describe("onceAsync", () => {
	it("should execute the function only once", async () => {
		const mockFn = vi.fn().mockResolvedValue("result");
		const onceAsyncFn = onceAsync(mockFn);

		const result1 = await onceAsyncFn();
		const result2 = await onceAsyncFn();
		const result3 = await onceAsyncFn();

		expect(mockFn).toHaveBeenCalledTimes(1);
		expect(result1).toBe("result");
		expect(result2).toBe("result");
		expect(result3).toBe("result");
	});

	it("should return the same promise for concurrent calls", async () => {
		let resolvePromise: (value: string) => void;
		const mockFn = vi.fn().mockImplementation(() => {
			return new Promise<string>((resolve) => {
				resolvePromise = resolve;
			});
		});
		const onceAsyncFn = onceAsync(mockFn);

		// Start multiple concurrent calls
		const promise1 = onceAsyncFn();
		const promise2 = onceAsyncFn();
		const promise3 = onceAsyncFn();

		// Verify they are the same promise
		expect(promise1).toBe(promise2);
		expect(promise2).toBe(promise3);

		// Resolve the promise
		resolvePromise!("concurrent-result");

		const results = await Promise.all([promise1, promise2, promise3]);
		expect(results).toEqual(["concurrent-result", "concurrent-result", "concurrent-result"]);
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should handle rejected promises correctly", async () => {
		const error = new Error("Test error");
		const mockFn = vi.fn().mockRejectedValue(error);
		const onceAsyncFn = onceAsync(mockFn);

		await expect(onceAsyncFn()).rejects.toThrow("Test error");
		await expect(onceAsyncFn()).rejects.toThrow("Test error");

		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should work with different return types", async () => {
		const numberFn = onceAsync(async () => 42);
		const objectFn = onceAsync(async () => ({ key: "value" }));
		const arrayFn = onceAsync(async () => [1, 2, 3]);

		expect(await numberFn()).toBe(42);
		expect(await objectFn()).toEqual({ key: "value" });
		expect(await arrayFn()).toEqual([1, 2, 3]);
	});

	it("should handle functions that throw synchronously", async () => {
		const mockFn = vi.fn().mockImplementation(() => {
			throw new Error("Sync error");
		});
		const onceAsyncFn = onceAsync(mockFn);

		await expect(onceAsyncFn()).rejects.toThrow("Sync error");
		await expect(onceAsyncFn()).rejects.toThrow("Sync error");

		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should work with void return type", async () => {
		const mockFn = vi.fn().mockResolvedValue(undefined);
		const onceAsyncFn = onceAsync(mockFn);

		const result1 = await onceAsyncFn();
		const result2 = await onceAsyncFn();

		expect(result1).toBeUndefined();
		expect(result2).toBeUndefined();
		expect(mockFn).toHaveBeenCalledTimes(1);
	});
});

describe("onceAsyncKeyed", () => {
	it("should execute function once per unique key", async () => {
		const mockFn = vi.fn().mockImplementation(async (key: string) => `result-${key}`);
		const onceAsyncKeyedFn = onceAsyncKeyed(mockFn);

		const result1a = await onceAsyncKeyedFn("key1");
		const result1b = await onceAsyncKeyedFn("key1");
		const result2a = await onceAsyncKeyedFn("key2");
		const result2b = await onceAsyncKeyedFn("key2");

		expect(mockFn).toHaveBeenCalledTimes(2);
		expect(mockFn).toHaveBeenNthCalledWith(1, "key1");
		expect(mockFn).toHaveBeenNthCalledWith(2, "key2");

		expect(result1a).toBe("result-key1");
		expect(result1b).toBe("result-key1");
		expect(result2a).toBe("result-key2");
		expect(result2b).toBe("result-key2");
	});

	it("should handle multiple arguments as keys", async () => {
		const mockFn = vi.fn().mockImplementation(async (a: string, b: number) => `${a}-${b}`);
		const onceAsyncKeyedFn = onceAsyncKeyed(mockFn);

		const result1 = await onceAsyncKeyedFn("test", 1);
		const result2 = await onceAsyncKeyedFn("test", 1);
		const result3 = await onceAsyncKeyedFn("test", 2);

		expect(mockFn).toHaveBeenCalledTimes(2);
		expect(result1).toBe("test-1");
		expect(result2).toBe("test-1");
		expect(result3).toBe("test-2");
	});

	it("should return the same promise for concurrent calls with same key", async () => {
		let resolvePromise: (value: string) => void;
		const mockFn = vi.fn().mockImplementation(async (_key: string) => {
			return new Promise<string>((resolve) => {
				resolvePromise = resolve;
			});
		});
		const onceAsyncKeyedFn = onceAsyncKeyed(mockFn);

		const promise1 = onceAsyncKeyedFn("same-key");
		const promise2 = onceAsyncKeyedFn("same-key");
		const promise3 = onceAsyncKeyedFn("same-key");

		expect(promise1).toBe(promise2);
		expect(promise2).toBe(promise3);

		resolvePromise!("keyed-result");

		const results = await Promise.all([promise1, promise2, promise3]);
		expect(results).toEqual(["keyed-result", "keyed-result", "keyed-result"]);
		expect(mockFn).toHaveBeenCalledTimes(1);
	});

	it("should handle complex object arguments", async () => {
		const mockFn = vi
			.fn()
			.mockImplementation(async (obj: { id: number; name: string }) => obj.name);
		const onceAsyncKeyedFn = onceAsyncKeyed(mockFn);

		const obj1 = { id: 1, name: "test1" };
		const obj2 = { id: 1, name: "test1" }; // Same content, different reference
		const obj3 = { id: 2, name: "test2" };

		const result1 = await onceAsyncKeyedFn(obj1);
		const result2 = await onceAsyncKeyedFn(obj2); // Should use cached result
		const result3 = await onceAsyncKeyedFn(obj3); // Different key

		expect(mockFn).toHaveBeenCalledTimes(2);
		expect(result1).toBe("test1");
		expect(result2).toBe("test1");
		expect(result3).toBe("test2");
	});

	it("should handle rejected promises with keys", async () => {
		const error = new Error("Keyed error");
		const mockFn = vi.fn().mockImplementation(async (key: string) => {
			if (key === "error-key") {
				throw error;
			}
			return `success-${key}`;
		});
		const onceAsyncKeyedFn = onceAsyncKeyed(mockFn);

		await expect(onceAsyncKeyedFn("error-key")).rejects.toThrow("Keyed error");
		await expect(onceAsyncKeyedFn("error-key")).rejects.toThrow("Keyed error");

		const successResult = await onceAsyncKeyedFn("success-key");
		expect(successResult).toBe("success-success-key");

		expect(mockFn).toHaveBeenCalledTimes(2);
	});
});

describe("onceAsyncResettable", () => {
	let mockFn: ReturnType<typeof vi.fn>;
	let resettable: ReturnType<typeof onceAsyncResettable>;

	beforeEach(() => {
		mockFn = vi.fn().mockResolvedValue("resettable-result");
		resettable = onceAsyncResettable(mockFn);
	});

	it("should execute function only once until reset", async () => {
		const result1 = await resettable.execute();
		const result2 = await resettable.execute();

		expect(mockFn).toHaveBeenCalledTimes(1);
		expect(result1).toBe("resettable-result");
		expect(result2).toBe("resettable-result");
	});

	it("should allow re-execution after reset", async () => {
		const result1 = await resettable.execute();
		expect(mockFn).toHaveBeenCalledTimes(1);

		resettable.reset();

		const result2 = await resettable.execute();
		expect(mockFn).toHaveBeenCalledTimes(2);
		expect(result1).toBe("resettable-result");
		expect(result2).toBe("resettable-result");
	});

	it("should handle multiple resets", async () => {
		await resettable.execute();
		resettable.reset();
		resettable.reset(); // Multiple resets should be safe
		await resettable.execute();

		expect(mockFn).toHaveBeenCalledTimes(2);
	});

	it("should return the same promise for concurrent calls before reset", async () => {
		let resolvePromise: (value: string) => void;
		const slowMockFn = vi.fn().mockImplementation(() => {
			return new Promise<string>((resolve) => {
				resolvePromise = resolve;
			});
		});
		const slowResettable = onceAsyncResettable(slowMockFn);

		const promise1 = slowResettable.execute();
		const promise2 = slowResettable.execute();

		expect(promise1).toBe(promise2);

		resolvePromise!("concurrent-resettable");

		const results = await Promise.all([promise1, promise2]);
		expect(results).toEqual(["concurrent-resettable", "concurrent-resettable"]);
		expect(slowMockFn).toHaveBeenCalledTimes(1);
	});

	it("should handle errors and allow reset", async () => {
		const error = new Error("Resettable error");
		const errorMockFn = vi.fn().mockRejectedValue(error);
		const errorResettable = onceAsyncResettable(errorMockFn);

		await expect(errorResettable.execute()).rejects.toThrow("Resettable error");
		await expect(errorResettable.execute()).rejects.toThrow("Resettable error");

		expect(errorMockFn).toHaveBeenCalledTimes(1);

		// Reset and try again
		errorResettable.reset();
		errorMockFn.mockResolvedValue("success-after-reset");

		const result = await errorResettable.execute();
		expect(result).toBe("success-after-reset");
		expect(errorMockFn).toHaveBeenCalledTimes(2);
	});

	it("should reset even during pending execution", async () => {
		let resolvePromise1: (value: string) => void;
		let resolvePromise2: (value: string) => void;
		let callCount = 0;

		const pendingMockFn = vi.fn().mockImplementation(() => {
			callCount++;
			return new Promise<string>((resolve) => {
				if (callCount === 1) {
					resolvePromise1 = resolve;
				} else {
					resolvePromise2 = resolve;
				}
			});
		});
		const pendingResettable = onceAsyncResettable(pendingMockFn);

		// Start execution but don't resolve yet
		const promise1 = pendingResettable.execute();

		// Reset while still pending
		pendingResettable.reset();

		// Start new execution
		const promise2 = pendingResettable.execute();

		// These should be different promises now
		expect(promise1).not.toBe(promise2);

		// Resolve both promises
		resolvePromise1!("first-result");
		resolvePromise2!("second-result");

		// Both promises should resolve with their respective values
		const result1 = await promise1;
		const result2 = await promise2;

		expect(result1).toBe("first-result");
		expect(result2).toBe("second-result");
		expect(pendingMockFn).toHaveBeenCalledTimes(2);
	});
});

describe("Real-world usage scenarios", () => {
	it("should work for indexer initialization pattern", async () => {
		let isReady = false;
		const initializeIndexer = onceAsync(async () => {
			// Simulate expensive initialization
			await new Promise((resolve) => setTimeout(resolve, 10));
			isReady = true;
			console.log("Indexer initialized");
		});

		const ensureReady = async () => {
			if (isReady) return;
			await initializeIndexer();
		};

		// Multiple calls should only initialize once
		await Promise.all([ensureReady(), ensureReady(), ensureReady()]);

		expect(isReady).toBe(true);
	});

	it("should work for API client initialization", async () => {
		const mockApiCall = vi.fn().mockResolvedValue({ token: "abc123" });

		const initializeClient = onceAsync(async () => {
			const response = await mockApiCall();
			return response.token;
		});

		// Multiple components trying to initialize
		const [token1, token2, token3] = await Promise.all([
			initializeClient(),
			initializeClient(),
			initializeClient(),
		]);

		expect(mockApiCall).toHaveBeenCalledTimes(1);
		expect(token1).toBe("abc123");
		expect(token2).toBe("abc123");
		expect(token3).toBe("abc123");
	});

	it("should work for user data fetching with keys", async () => {
		interface User {
			id: string;
			name: string;
			email: string;
		}

		const mockFetchUser = vi.fn();
		mockFetchUser.mockImplementation(
			async (userId: string): Promise<User> => ({
				id: userId,
				name: `User ${userId}`,
				email: `user${userId}@example.com`,
			})
		);

		const fetchUserOnce = onceAsyncKeyed(mockFetchUser);

		// Fetch same user multiple times
		const user1a = (await fetchUserOnce("123")) as User;
		const user1b = (await fetchUserOnce("123")) as User;

		// Fetch different user
		const user2 = (await fetchUserOnce("456")) as User;

		expect(mockFetchUser).toHaveBeenCalledTimes(2);
		expect(user1a).toEqual(user1b);
		expect(user1a.id).toBe("123");
		expect(user2.id).toBe("456");
	});
});
