import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { containsDslSyntax, parseDslContent } from "../src/dsl-parser";

// Mock Notice specifically for this test
vi.mock("obsidian", async () => {
	const actual = await vi.importActual("obsidian");
	return {
		...actual,
		Notice: vi.fn(),
	};
});

// Notice import removed - no longer needed for validation tests

// Mock Obsidian Notice - already mocked in setup.ts but we can override specific behavior
describe("DSL Parser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset regex state
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parseDslContent", () => {
		it("should parse valid DSL content with single view option", () => {
			const content = `
Some regular content

\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`

More content
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0]).toEqual({
				id: "tasks",
				label: "Tasks",
				content: "![[Projects-Tasks.base]]",
			});
		});

		it("should parse multiple view options", () => {
			const content = `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType ChildTasks
![[Projects-ChildTasks.base]]
\`\`\`

\`\`\`CommandType RelatedTasks
![[Projects-RelatedTasks.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(3);

			expect(result.viewOptions[0]).toEqual({
				id: "tasks",
				label: "Tasks",
				content: "![[Projects-Tasks.base]]",
			});

			expect(result.viewOptions[1]).toEqual({
				id: "childtasks",
				label: "ChildTasks",
				content: "![[Projects-ChildTasks.base]]",
			});

			expect(result.viewOptions[2]).toEqual({
				id: "relatedtasks",
				label: "RelatedTasks",
				content: "![[Projects-RelatedTasks.base]]",
			});
		});

		it("should handle content without DSL syntax", () => {
			const content = `
# Regular Markdown

This is just regular content without any DSL syntax.

- List item 1
- List item 2
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(false);
			expect(result.viewOptions).toHaveLength(0);
		});

		it("should handle empty content", () => {
			const result = parseDslContent("");

			expect(result.hasValidDsl).toBe(false);
			expect(result.viewOptions).toHaveLength(0);
		});

		it("should handle code fences with any content", () => {
			const content = `
\`\`\`CommandType Tasks
Just some regular text without wikilinks
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0]).toEqual({
				id: "tasks",
				label: "Tasks",
				content: "Just some regular text without wikilinks",
			});
		});

		it("should handle code fences with empty labels", () => {
			const content = `
\`\`\`
![[Projects-Tasks.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(false);
			expect(result.viewOptions).toHaveLength(0);
		});

		it("should handle code fences with empty content", () => {
			const content = `
\`\`\`CommandType Tasks
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0]).toEqual({
				id: "tasks",
				label: "Tasks",
				content: "",
			});
		});

		it("should handle multiple code fences with different content types", () => {
			const content = `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType TextContent
Just text without wikilinks
\`\`\`

\`\`\`CommandType AnotherFence
![[Another-File.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(3);
			expect(result.viewOptions[0]).toEqual({
				id: "tasks",
				label: "Tasks",
				content: "![[Projects-Tasks.base]]",
			});
			expect(result.viewOptions[1]).toEqual({
				id: "textcontent",
				label: "TextContent",
				content: "Just text without wikilinks",
			});
			expect(result.viewOptions[2]).toEqual({
				id: "anotherfence",
				label: "AnotherFence",
				content: "![[Another-File.base]]",
			});
		});

		it("should generate unique IDs for labels with special characters", () => {
			const content = `
\`\`\`CommandType My Special Tasks!
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType Child Tasks (Sub)
![[Projects-ChildTasks.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(2);
			expect(result.viewOptions[0].id).toBe("my-special-tasks-");
			expect(result.viewOptions[1].id).toBe("child-tasks--sub-");
		});

		it("should handle wikilinks with paths", () => {
			const content = `
\`\`\`CommandType Tasks
![[folder/Projects-Tasks.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0].content).toBe("![[folder/Projects-Tasks.base]]");
		});

		it("should handle multiple wikilinks in same fence", () => {
			const content = `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
![[Additional-Content.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0].content).toBe(
				"![[Projects-Tasks.base]]\n![[Additional-Content.base]]"
			);
		});

		it("should handle whitespace in fence content", () => {
			const content = `
\`\`\`CommandType Tasks

   ![[Projects-Tasks.base]]

\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0].content).toBe("![[Projects-Tasks.base]]");
		});

		it("should ignore code fences that don't use CommandType", () => {
			const content = `
\`\`\`CustomSelect Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType ValidTasks
![[Valid-Tasks.base]]
\`\`\`

\`\`\`SomeOther InvalidTasks
![[Invalid-Tasks.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(true);
			expect(result.viewOptions).toHaveLength(1);
			expect(result.viewOptions[0]).toEqual({
				id: "validtasks",
				label: "ValidTasks",
				content: "![[Valid-Tasks.base]]",
			});
		});

		it("should return false for content with only non-CommandType fences", () => {
			const content = `
\`\`\`CustomSelect Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`SomeOther Tasks
![[Other-Tasks.base]]
\`\`\`
			`.trim();

			const result = parseDslContent(content);

			expect(result.hasValidDsl).toBe(false);
			expect(result.viewOptions).toHaveLength(0);
		});

		describe("Nested DSL parsing (CommandType -> CommandType)", () => {
			it("should parse nested CommandType blocks within CommandType", () => {
				const content = `
\`\`\`CommandType Tasks
Some regular content

\`\`\`CommandType SubTask1
![[Projects-SubTask1.base]]
\`\`\`

\`\`\`CommandType SubTask2
![[Projects-SubTask2.base]]
\`\`\`
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				expect(result.viewOptions).toHaveLength(1);

				const mainOption = result.viewOptions[0];
				expect(mainOption.id).toBe("tasks");
				expect(mainOption.label).toBe("Tasks");
				expect(mainOption.hasNestedDsl).toBe(true);
				expect(mainOption.subOptions).toHaveLength(2);

				expect(mainOption.subOptions![0]).toEqual({
					id: "subtask1",
					label: "SubTask1",
					content: "![[Projects-SubTask1.base]]",
				});

				expect(mainOption.subOptions![1]).toEqual({
					id: "subtask2",
					label: "SubTask2",
					content: "![[Projects-SubTask2.base]]",
				});
			});

			it("should handle CommandType with nested CommandType and regular content", () => {
				const content = `
\`\`\`CommandType Tasks
# Header content
Some regular content before sub-views

\`\`\`CommandType CurrentTasks
![[Projects-Current.base]]
\`\`\`

\`\`\`CommandType CompletedTasks
![[Projects-Completed.base]]
\`\`\`

Regular content after sub-views
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				expect(result.viewOptions).toHaveLength(1);

				const mainOption = result.viewOptions[0];
				expect(mainOption.hasNestedDsl).toBe(true);
				expect(mainOption.subOptions).toHaveLength(2);
				expect(mainOption.content).toContain("# Header content");
				expect(mainOption.content).toContain("Regular content after sub-views");
			});

			it("should handle multiple CommandType blocks with nested CommandType blocks", () => {
				const content = `
\`\`\`CommandType Tasks
\`\`\`CommandType SubTask1
![[Tasks-Sub1.base]]
\`\`\`
\`\`\`

\`\`\`CommandType Notes
\`\`\`CommandType SubNote1
![[Notes-Sub1.base]]
\`\`\`

\`\`\`CommandType SubNote2
![[Notes-Sub2.base]]
\`\`\`
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				expect(result.viewOptions).toHaveLength(2);

				// First CommandType
				expect(result.viewOptions[0].hasNestedDsl).toBe(true);
				expect(result.viewOptions[0].subOptions).toHaveLength(1);
				expect(result.viewOptions[0].subOptions![0].label).toBe("SubTask1");

				// Second CommandType
				expect(result.viewOptions[1].hasNestedDsl).toBe(true);
				expect(result.viewOptions[1].subOptions).toHaveLength(2);
				expect(result.viewOptions[1].subOptions![0].label).toBe("SubNote1");
				expect(result.viewOptions[1].subOptions![1].label).toBe("SubNote2");
			});

			it("should handle CommandType without nested CommandType blocks", () => {
				const content = `
\`\`\`CommandType SimpleTask
Just regular content without any nested blocks
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				expect(result.viewOptions).toHaveLength(1);

				const mainOption = result.viewOptions[0];
				expect(mainOption.hasNestedDsl).toBeUndefined();
				expect(mainOption.subOptions).toBeUndefined();
				expect(mainOption.content).toBe("Just regular content without any nested blocks");
			});

			it("should ignore non-CommandType blocks", () => {
				const content = `
\`\`\`javascript
console.log("This is just a regular code block");
\`\`\`

\`\`\`CommandType ValidTask
\`\`\`CommandType ValidSubTask
![[Valid-Sub.base]]
\`\`\`
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				expect(result.viewOptions).toHaveLength(1);

				const mainOption = result.viewOptions[0];
				expect(mainOption.label).toBe("ValidTask");
				expect(mainOption.hasNestedDsl).toBe(true);
				expect(mainOption.subOptions).toHaveLength(1);
				expect(mainOption.subOptions![0].label).toBe("ValidSubTask");
			});

			it("should handle empty nested CommandType blocks", () => {
				const content = `
\`\`\`CommandType Tasks
\`\`\`CommandType EmptyTask
\`\`\`

\`\`\`CommandType NonEmptyTask
![[Non-Empty.base]]
\`\`\`
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				expect(result.viewOptions).toHaveLength(1);

				const mainOption = result.viewOptions[0];
				expect(mainOption.hasNestedDsl).toBe(true);
				expect(mainOption.subOptions).toHaveLength(2);
				expect(mainOption.subOptions![0].content).toBe("");
				expect(mainOption.subOptions![1].content).toBe("![[Non-Empty.base]]");
			});

			it("should generate unique IDs for nested CommandType labels with special characters", () => {
				const content = `
\`\`\`CommandType Tasks
\`\`\`CommandType High Priority!
![[High-Priority.base]]
\`\`\`

\`\`\`CommandType Sub-Task (Important)
![[Sub-Important.base]]
\`\`\`
\`\`\`
				`.trim();

				const result = parseDslContent(content);

				expect(result.hasValidDsl).toBe(true);
				const mainOption = result.viewOptions[0];
				expect(mainOption.subOptions![0].id).toBe("high-priority-");
				expect(mainOption.subOptions![1].id).toBe("sub-task--important-");
			});
		});
	});

	describe("containsDslSyntax", () => {
		it("should return true for content with code fences", () => {
			const content = `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`
			`.trim();

			expect(containsDslSyntax(content)).toBe(true);
		});

		it("should return false for content without code fences", () => {
			const content = "Regular markdown content without code fences";

			expect(containsDslSyntax(content)).toBe(false);
		});

		it("should return true for content with multiple code fences", () => {
			const content = `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType ChildTasks
![[Projects-ChildTasks.base]]
\`\`\`
			`.trim();

			expect(containsDslSyntax(content)).toBe(true);
		});

		it("should return false for empty content", () => {
			expect(containsDslSyntax("")).toBe(false);
		});

		it("should return true for content with nested CommandType blocks", () => {
			const content = `
\`\`\`CommandType Tasks
\`\`\`CommandType SubTask
![[Sub-Task.base]]
\`\`\`
\`\`\`
			`.trim();

			expect(containsDslSyntax(content)).toBe(true);
		});

		it("should return false for content with only regular code blocks", () => {
			const content = `
\`\`\`javascript
console.log("hello world");
\`\`\`

\`\`\`python
print("hello world")
\`\`\`
			`.trim();

			expect(containsDslSyntax(content)).toBe(false);
		});
	});
});
