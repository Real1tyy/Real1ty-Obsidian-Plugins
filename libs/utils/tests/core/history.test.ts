import { describe, expect, it } from "vitest";
import { createHistory } from "../../src/core/history";

describe("createHistory", () => {
	describe("basic save and undo", () => {
		it("should save state", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // Save initial state
			state = 10;
			history.save(); // Save new state

			expect(history.canUndo()).toBe(true);
			expect(history.canRedo()).toBe(false);
		});

		it("should undo to previous state", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // Save initial state (0)
			state = 10;
			history.save(); // Save state (10)

			const restored = history.undo();
			expect(restored).toBe(0);
			expect(state).toBe(0);
			expect(history.canUndo()).toBe(false); // Can't undo further, only one state left
			expect(history.canRedo()).toBe(true);
		});

		it("should return null when undo stack is empty", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			const result = history.undo();
			expect(result).toBeNull();
			expect(history.canUndo()).toBe(false);
		});
	});

	describe("redo functionality", () => {
		it("should redo to next state", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // Save 0
			state = 10;
			history.save(); // Save 10
			state = 20;
			history.save(); // Save 20

			history.undo(); // Back to 10
			history.undo(); // Back to 0

			const restored = history.redo();
			expect(restored).toBe(10);
			expect(state).toBe(10);
			expect(history.canRedo()).toBe(true);
			expect(history.canUndo()).toBe(true);
		});

		it("should return null when redo stack is empty", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save();
			const result = history.redo();
			expect(result).toBeNull();
			expect(history.canRedo()).toBe(false);
		});
	});

	describe("clear redo stack on save", () => {
		it("should clear redo stack when saving after undo", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // Save 0
			state = 10;
			history.save(); // Save 10
			history.undo(); // Back to 0, redo stack has 10

			expect(history.canRedo()).toBe(true);

			state = 20;
			history.save(); // Save 20, should clear redo stack

			expect(history.canRedo()).toBe(false);
			expect(history.canUndo()).toBe(true);
		});
	});

	describe("canUndo and canRedo", () => {
		it("should correctly report undo availability", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			expect(history.canUndo()).toBe(false);

			history.save();
			expect(history.canUndo()).toBe(false); // Need at least 2 states to undo

			state = 10;
			history.save();
			expect(history.canUndo()).toBe(true);

			history.undo();
			expect(history.canUndo()).toBe(false);
		});

		it("should correctly report redo availability", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			expect(history.canRedo()).toBe(false);

			history.save();
			state = 10;
			history.save();
			history.undo();

			expect(history.canRedo()).toBe(true);

			history.redo();
			expect(history.canRedo()).toBe(false);
		});
	});

	describe("getOriginalState", () => {
		it("should return the first saved state", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // Save 0
			state = 10;
			history.save(); // Save 10
			state = 20;
			history.save(); // Save 20

			expect(history.getOriginalState()).toBe(0);
		});

		it("should return null when no state has been saved", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			expect(history.getOriginalState()).toBeNull();
		});

		it("should return original state even after multiple undos", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // Save 0
			state = 10;
			history.save(); // Save 10
			state = 20;
			history.save(); // Save 20

			history.undo();
			history.undo();

			expect(history.getOriginalState()).toBe(0);
		});
	});

	describe("complex state objects", () => {
		it("should work with object states", () => {
			let state = { count: 0, name: "initial" };
			const history = createHistory(
				() => ({ ...state }),
				(newState) => {
					state = { ...newState };
				}
			);

			history.save();
			state.count = 10;
			state.name = "updated";
			history.save();

			history.undo();
			expect(state.count).toBe(0);
			expect(state.name).toBe("initial");

			history.redo();
			expect(state.count).toBe(10);
			expect(state.name).toBe("updated");
		});

		it("should work with array states", () => {
			let state: number[] = [1, 2, 3];
			const history = createHistory(
				() => [...state],
				(newState) => {
					state = [...newState];
				}
			);

			history.save();
			state.push(4);
			history.save();

			history.undo();
			expect(state).toEqual([1, 2, 3]);

			history.redo();
			expect(state).toEqual([1, 2, 3, 4]);
		});
	});

	describe("multiple undo/redo cycles", () => {
		it("should handle multiple undo operations", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // 0
			state = 10;
			history.save(); // 10
			state = 20;
			history.save(); // 20
			state = 30;
			history.save(); // 30

			history.undo(); // Back to 20
			expect(state).toBe(20);

			history.undo(); // Back to 10
			expect(state).toBe(10);

			history.undo(); // Back to 0
			expect(state).toBe(0);

			expect(history.canUndo()).toBe(false);
		});

		it("should handle multiple redo operations", () => {
			let state = 0;
			const history = createHistory(
				() => state,
				(newState) => {
					state = newState;
				}
			);

			history.save(); // 0
			state = 10;
			history.save(); // 10
			state = 20;
			history.save(); // 20

			history.undo(); // Back to 10
			history.undo(); // Back to 0

			history.redo(); // Forward to 10
			expect(state).toBe(10);

			history.redo(); // Forward to 20
			expect(state).toBe(20);

			expect(history.canRedo()).toBe(false);
		});
	});
});
