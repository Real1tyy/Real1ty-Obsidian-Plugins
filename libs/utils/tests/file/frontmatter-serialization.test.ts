import { describe, expect, it } from "vitest";
import { createFileContentWithFrontmatter } from "../../src/file/frontmatter-serialization";

describe("Frontmatter Serialization", () => {
	describe("createFileContentWithFrontmatter", () => {
		it("should create file content with simple frontmatter", () => {
			const frontmatter = {
				title: "Test Event",
				date: "2025-02-15",
			};

			const result = createFileContentWithFrontmatter(frontmatter, "# Test Content");

			expect(result).toContain("---");
			expect(result).toContain("title: Test Event");
			expect(result).toContain("date: 2025-02-15");
			expect(result).toContain("# Test Content");
		});

		it("should handle empty frontmatter", () => {
			const result = createFileContentWithFrontmatter({}, "# Test Content");

			expect(result).toBe("# Test Content");
			expect(result).not.toContain("---");
		});

		it("should handle frontmatter with arrays", () => {
			const frontmatter = {
				tags: ["work", "project"],
				categories: ["meeting"],
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("tags:");
			expect(result).toContain("- work");
			expect(result).toContain("- project");
		});

		it("should handle frontmatter with nested objects", () => {
			const frontmatter = {
				metadata: {
					author: "John Doe",
					version: 1,
				},
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("metadata:");
			expect(result).toContain("author:");
			expect(result).toContain("John Doe");
		});

		it("should handle frontmatter with special characters", () => {
			const frontmatter = {
				title: "Meeting: Q&A Session",
				description: 'Discussion about "new features"',
				link: "[[Project A]]",
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("---");
			expect(result).toContain("Meeting: Q&A Session");
			expect(result).toContain("[[Project A]]");
		});

		it("should handle frontmatter with boolean values", () => {
			const frontmatter = {
				"All Day": true,
				completed: false,
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("All Day: true");
			expect(result).toContain("completed: false");
		});

		it("should handle frontmatter with number values", () => {
			const frontmatter = {
				duration: 60,
				priority: 1,
				percentage: 85.5,
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("duration: 60");
			expect(result).toContain("priority: 1");
			expect(result).toContain("percentage: 85.5");
		});

		it("should handle frontmatter with empty strings", () => {
			const frontmatter = {
				title: "Meeting",
				Date: "",
				Start: "2025-02-15T10:00:00",
				End: "",
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("title: Meeting");
			expect(result).toContain("Start: 2025-02-15T10:00:00");
			// Empty strings are represented as "" in YAML
			expect(result).toContain('Date: ""');
			expect(result).toContain('End: ""');
		});

		it("should handle frontmatter with null values", () => {
			const frontmatter = {
				title: "Meeting",
				categories: null,
			};

			const result = createFileContentWithFrontmatter(frontmatter);

			expect(result).toContain("title: Meeting");
			// null should be represented as empty
			expect(result).toMatch(/categories:\s*$/m);
		});

		it("should handle content with no extra newlines", () => {
			const frontmatter = {
				title: "Test",
			};

			const result = createFileContentWithFrontmatter(frontmatter, "# Content");

			// Should have exactly 2 newlines between frontmatter and content
			expect(result).toMatch(/---\n\n# Content$/);
		});

		it("should trim extra newlines from content start", () => {
			const frontmatter = {
				title: "Test",
			};

			const result = createFileContentWithFrontmatter(frontmatter, "\n\n\n# Content");

			// Should normalize to 2 newlines
			expect(result).toMatch(/---\n\n# Content$/);
		});

		it("should handle complex real-world event frontmatter", () => {
			const frontmatter = {
				Title: "Team Meeting",
				"Start Date": "2025-02-15T10:00:00",
				"End Date": "2025-02-15T11:00:00",
				Date: "2025-02-15T10:00:00",
				"All Day": false,
				categories: ["work", "meetings"],
				Status: "In Progress",
				"Break Minutes": 5,
				Goal: "[[Projects/Q1 Planning]]",
				_ZettelID: "20250203140530",
			};

			const content = "# Team Meeting\n\n## Agenda\n- Review Q1 goals";

			const result = createFileContentWithFrontmatter(frontmatter, content);

			expect(result).toContain("---");
			expect(result).toContain("Title: Team Meeting");
			expect(result).toContain("Start Date: 2025-02-15T10:00:00");
			expect(result).toContain("All Day: false");
			expect(result).toContain("categories:");
			expect(result).toContain("- work");
			expect(result).toContain("[[Projects/Q1 Planning]]");
			expect(result).toContain("# Team Meeting");
			expect(result).toContain("## Agenda");
		});

		it("should handle undefined or null content", () => {
			const frontmatter = {
				title: "Test",
			};

			const result1 = createFileContentWithFrontmatter(frontmatter, undefined as unknown as string);
			const result2 = createFileContentWithFrontmatter(frontmatter, "");

			expect(result1).toMatch(/^---\n.*\n---\n$/);
			expect(result2).toMatch(/^---\n.*\n---\n$/);
		});
	});
});
