import { Notice } from "obsidian";
import type { ParsedDslContent, ViewOption } from "./types";

/**
 * DSL Parser for extracting view options from code fences
 *
 * Expected syntax:
 * ```CommandType Key
 * Any content here - wikilinks, text, markdown, etc.
 *
 * Optionally nested with more CommandType blocks:
 * ```CommandType SubKey
 * Nested content here
 * ```
 * ```
 *
 * Examples:
 * ```CommandType Tasks
 * ![[Projects-Tasks.base]]
 * ```
 *
 * ```CommandType Notes
 * ```CommandType SubNote1
 * ![[Projects-SubNote1.base]]
 * ```
 *
 * ```CommandType SubNote2
 * ![[Projects-SubNote2.base]]
 * ```
 * ```
 */

const COMMAND_TYPE = "CommandType";

/**
 * Custom parser for code blocks that handles nesting properly
 */
function parseCodeBlocks(content: string): Array<{ type: string; key: string; content: string }> {
	const blocks: Array<{ type: string; key: string; content: string }> = [];
	const lines = content.split("\n");
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		const match = line.match(/^```([^\s]+)\s+(.+)$/);

		if (match) {
			const [, type, key] = match;
			const startIndex = i + 1;
			let depth = 1;
			let endIndex = -1;

			// Find the matching closing ``` at the same nesting level
			for (let j = startIndex; j < lines.length; j++) {
				if (lines[j].startsWith("```") && lines[j].length === 3) {
					depth--;
					if (depth === 0) {
						endIndex = j;
						break;
					}
				} else if (lines[j].startsWith("```")) {
					depth++;
				}
			}

			if (endIndex > -1) {
				const blockContent = lines.slice(startIndex, endIndex).join("\n");
				blocks.push({ type, key, content: blockContent });
				i = endIndex + 1;
			} else {
				// Malformed block, skip this line
				i++;
			}
		} else {
			i++;
		}
	}

	return blocks;
}

function generateId(key: string): string {
	return key.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

const INVALID_DSL_RESULT: ParsedDslContent = {
	viewOptions: [],
	hasValidDsl: false,
};

function parseNestedCommandBlocks(content: string): ViewOption[] {
	const blocks = parseCodeBlocks(content);

	return blocks
		.filter((block) => block.type === COMMAND_TYPE)
		.map(
			(block): ViewOption => ({
				id: generateId(block.key),
				label: block.key.trim(),
				content: block.content.trim(),
				// Note: We only support 2 levels of nesting, so nested CommandType blocks don't contain sub-options
			})
		);
}

export function parseDslContent(content: string): ParsedDslContent {
	try {
		const blocks = parseCodeBlocks(content);

		const viewOptions = blocks
			.filter((block) => block.type === COMMAND_TYPE)
			.map((block): ViewOption => {
				const trimmedContent = block.content.trim();

				const subOptions = parseNestedCommandBlocks(trimmedContent);
				const hasNestedDsl = subOptions.length > 0;

				return {
					id: generateId(block.key),
					label: block.key.trim(),
					content: trimmedContent,
					...(hasNestedDsl && {
						subOptions,
						hasNestedDsl: true,
					}),
				};
			});

		if (viewOptions.length === 0) {
			return INVALID_DSL_RESULT;
		}

		return {
			viewOptions,
			hasValidDsl: true,
		};
	} catch (error) {
		new Notice(`DSL parsing error: ${error.message}`);
		return INVALID_DSL_RESULT;
	}
}

export function containsDslSyntax(content: string): boolean {
	const blocks = parseCodeBlocks(content);
	return blocks.some((block) => block.type === COMMAND_TYPE);
}
