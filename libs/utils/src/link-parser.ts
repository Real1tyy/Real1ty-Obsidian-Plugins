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
