/**
 * Handles different link formats and edge cases:
 * [[FileName]] -> FileName.md
 * [[Folder/FileName]] -> Folder/FileName.md
 * [[Folder/FileName|DisplayName]] -> Folder/FileName.md
 * Normalizes paths and handles malformed links gracefully.
 */
export const extractFilePathFromLink = (link: string): string | null => {
	const match = link.match(/\[\[([^|\]]+?)(?:\|.*?)?\]\]/);
	if (!match) return null;

	const filePath = match[1].trim();
	if (!filePath) return null;

	if (filePath.includes("[[") || filePath.includes("]]")) return null;

	return filePath.endsWith(".md") ? filePath : `${filePath}.md`;
};

/**
 * Parses an Obsidian wiki link to extract the file path.
 * Handles formats like:
 * - [[path/to/file]]
 * - [[path/to/file|Display Name]]
 *
 * @param link - The wiki link string
 * @returns The file path without the [[ ]] brackets, or null if invalid
 */
export function parseWikiLink(link: string): string | null {
	if (!link || typeof link !== "string") {
		return null;
	}

	const trimmed = link.trim();

	// Match [[path/to/file]] or [[path/to/file|Display Name]]
	const match = trimmed.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);

	if (!match) {
		return null;
	}

	return match[1].trim();
}

/**
 * Parses a property value that can be a single link or an array of links.
 * Extracts file paths from all valid wiki links.
 *
 * @param value - The property value (string, string[], or undefined)
 * @returns Array of file paths, empty if no valid links found
 */
export function parsePropertyLinks(value: string | string[] | undefined): string[] {
	if (!value) {
		return [];
	}

	const links = Array.isArray(value) ? value : [value];

	return links.map((link) => parseWikiLink(link)).filter((path): path is string => path !== null);
}

/**
 * Formats a file path as an Obsidian wiki link with display name.
 * Example: "Projects/MyProject" -> "[[Projects/MyProject|MyProject]]"
 *
 * @param filePath - The file path to format
 * @returns The formatted wiki link with display name alias
 */
export function formatWikiLink(filePath: string): string {
	if (!filePath || typeof filePath !== "string") {
		return "";
	}

	const trimmed = filePath.trim();

	if (!trimmed) {
		return "";
	}

	// Extract the filename (last segment after the last /)
	const segments = trimmed.split("/");
	const displayName = segments[segments.length - 1];

	// If there's no path separator, just return simple link
	if (segments.length === 1) {
		return `[[${trimmed}]]`;
	}

	return `[[${trimmed}|${displayName}]]`;
}
