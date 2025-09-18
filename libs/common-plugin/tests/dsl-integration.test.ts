import { describe, expect, it } from "vitest";
import { parseDslContent } from "../src/dsl-parser";

describe("DSL Integration", () => {
	it("should extract content correctly from DSL syntax", () => {
		const dslContent = `
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

		const result = parseDslContent(dslContent);

		expect(result.hasValidDsl).toBe(true);
		expect(result.viewOptions).toHaveLength(3);

		// Verify that we extract only the wikilink content, not the code fence
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

	it("should handle complex content inside code fences", () => {
		const dslContent = `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]

## Additional Notes
Some extra content here
\`\`\`
		`.trim();

		const result = parseDslContent(dslContent);

		expect(result.hasValidDsl).toBe(true);
		expect(result.viewOptions).toHaveLength(1);
		expect(result.viewOptions[0].content).toBe(`![[Projects-Tasks.base]]

## Additional Notes
Some extra content here`);
	});
});
