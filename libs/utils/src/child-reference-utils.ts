import { TFile } from "obsidian";
import { createFileLink } from "./file-operations";
import { extractFilePathFromLink } from "./link-parser";

export interface VaultAdapter {
	getAbstractFileByPath(path: string): TFile | null;
}

export function extractDirectoryPath(filePath: string): string {
	const lastSlashIndex = filePath.lastIndexOf("/");
	if (lastSlashIndex === -1) {
		return "";
	}
	return filePath.substring(0, lastSlashIndex);
}

export function isRelativeChildReference(childRef: string): boolean {
	const filePath = extractFilePathFromLink(childRef);
	if (!filePath) {
		return !childRef.includes("/");
	}
	return !filePath.includes("/");
}

export function normalizeChildReference(
	childRef: string,
	vault: VaultAdapter,
	currentFileDirectory?: string
): string {
	const filePath = extractFilePathFromLink(childRef);

	// Handle plain text references (not wrapped in [[]])
	if (!filePath) {
		// If it's not a link format, check if it should be converted to a link
		if (!childRef.includes("/") && currentFileDirectory !== undefined) {
			// This is a plain text reference that might need to be converted to a link
			const potentialPath = currentFileDirectory
				? `${currentFileDirectory}/${childRef.endsWith(".md") ? childRef : `${childRef}.md`}`
				: childRef.endsWith(".md")
					? childRef
					: `${childRef}.md`;
			const file = vault.getAbstractFileByPath(potentialPath);
			if (file instanceof TFile) {
				return createFileLink(file);
			}
		}
		return childRef;
	}

	// Handle relative references by making them absolute
	if (isRelativeChildReference(childRef) && currentFileDirectory) {
		const absolutePath = `${currentFileDirectory}/${filePath}`;
		const file = vault.getAbstractFileByPath(absolutePath);
		if (file instanceof TFile) {
			return createFileLink(file);
		}
	}

	// For absolute references or when no directory context, try to find the file as-is
	const file = vault.getAbstractFileByPath(filePath);
	if (file instanceof TFile) {
		return createFileLink(file);
	}

	return childRef;
}

export function normalizeChildReferences(
	childRefs: string[],
	vault: VaultAdapter,
	currentFileDirectory?: string
): string[] {
	return childRefs.map((childRef) => {
		return normalizeChildReference(childRef, vault, currentFileDirectory);
	});
}
