import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type App, Notice, TFile } from "obsidian";
import { generateZettelId } from "../core";
import { generateUniqueFilePath } from "./file";
import { extractFilePathFromLink } from "./link-parser";

export const fromRoot = (relativePath: string): string => {
	return path.resolve(__dirname, `../../../${relativePath}`);
};

export const getActiveFileOrThrow = (app: App): TFile => {
	const activeFile: TFile | null = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice(`⚠️  Open a note first.`);
		throw new Error(`Open a note first.`);
	}
	return activeFile;
};

export const getTemplateContent = async (app: App, templatePath: string): Promise<string> => {
	const templateFile = app.vault.getAbstractFileByPath(templatePath);
	if (!templateFile) {
		new Notice(`❌  Template not found: ${templatePath}`);
		throw new Error(`Template not found: ${templatePath}`);
	}

	return await app.vault.read(templateFile as TFile);
};

export const ensureFolderExists = async (app: App, folderPath: string): Promise<void> => {
	if (!app.vault.getAbstractFileByPath(folderPath)) {
		await app.vault.createFolder(folderPath).catch(() => {});
	}
};

export const openFileInNewLeaf = async (app: App, file: TFile): Promise<void> => {
	await app.workspace.getLeaf(true).openFile(file);
};

export const getNoteFilesFromDir = async (directoryPath: string): Promise<string[]> => {
	const files = await fs.readdir(directoryPath);
	const directoryName = path.basename(directoryPath);

	return files.filter((file) => {
		if (!file.endsWith(".md")) return false;

		const fileNameWithoutExt = path.parse(file).name;
		if (fileNameWithoutExt === directoryName) {
			console.log(`⏭️ Skipping directory-level file: ${file}`);
			return false;
		}

		return true;
	});
};

export const getTargetFileFromLink = (app: App, relationshipLink: string): TFile | null => {
	const targetFilePath = extractFilePathFromLink(relationshipLink);
	if (!targetFilePath) {
		console.warn(`Failed to extract file path from link: ${relationshipLink}`);
		return null;
	}

	const targetFile = app.vault.getAbstractFileByPath(targetFilePath) as TFile;
	if (!targetFile) {
		console.warn(`Target file not found for link: ${relationshipLink}`);
		return null;
	}

	return targetFile;
};

export const createFileLink = (file: TFile): string => {
	const folder = file.parent?.path && file.parent.path !== "/" ? file.parent.path : "";
	return folder ? `[[${folder}/${file.basename}|${file.basename}]]` : `[[${file.basename}]]`;
};

export const normalizeArray = (value: string | string[] | undefined): string[] => {
	if (!value) {
		return [];
	}
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value;
	}
	return [];
};

export const arraysEqual = (a: string[], b: string[]): boolean => {
	return a.length === b.length && a.every((val, index) => val === b[index]);
};

/**
 * Normalizes frontmatter content by converting quoted numeric _ZettelIDs to numbers.
 * This handles edge cases where YAML parsers treat numeric strings inconsistently.
 */
export const normalizeContent = (content: string): string => {
	let normalized = content;
	let hasChanges = false;

	// Normalize _ZettelID: "string" → number (remove quotes)
	const zettelIdMatch = normalized.match(/^_ZettelID:\s*"(\d+)"/m);
	if (zettelIdMatch) {
		const [fullMatch, numericId] = zettelIdMatch;
		const replacement = `_ZettelID: ${numericId}`;
		normalized = normalized.replace(fullMatch, replacement);
		hasChanges = true;
		console.log(`  ✅ _ZettelID: "${numericId}" → ${numericId}`);
	}

	return hasChanges ? normalized : content;
};

/**
 * Safely performs a file operation with error handling and file validation.
 * Reduces boilerplate for common file operations.
 */
export const withFileOperation = async <T>(
	app: App,
	event: any,
	operation: (file: TFile) => Promise<T>,
	errorMessage: string = "Operation failed"
): Promise<T | null> => {
	try {
		const filePath = event.extendedProps.filePath;
		const file = app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find the file");
			return null;
		}

		return await operation(file);
	} catch (error) {
		console.error(`Error in file operation:`, error);
		new Notice(errorMessage);
		return null;
	}
};

/**
 * Safely performs a file operation by file path with error handling and file validation.
 */
export const withFile = async <T>(
	app: App,
	filePath: string,
	operation: (file: TFile) => Promise<T>,
	errorMessage: string = "Operation failed"
): Promise<T | null> => {
	try {
		const file = app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find the file");
			return null;
		}

		return await operation(file);
	} catch (error) {
		console.error(`Error in file operation:`, error);
		new Notice(errorMessage);
		return null;
	}
};

/**
 * Duplicates a file with a new ZettelID, preserving the original content
 * but updating the ZettelID in frontmatter if configured.
 */
export const duplicateFileWithNewZettelId = async (
	app: App,
	file: TFile,
	zettelIdProp?: string
): Promise<TFile> => {
	const content = await app.vault.read(file);

	const parentPath = file.parent?.path || "";
	const baseNameWithoutZettel = file.basename.replace(/-\d{14}$/, "");
	const zettelId = generateZettelId();
	const newBasename = `${baseNameWithoutZettel}-${zettelId}`;
	const newFilePath = generateUniqueFilePath(app, parentPath, newBasename);

	// Create the new file with original content
	const newFile = await app.vault.create(newFilePath, content);

	// Update the ZettelID in frontmatter if configured
	if (zettelIdProp) {
		await app.fileManager.processFrontMatter(newFile, (fm) => {
			fm[zettelIdProp] = zettelId;
		});
	}

	return newFile;
};
