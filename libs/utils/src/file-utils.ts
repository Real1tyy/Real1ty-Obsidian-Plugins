import type { App } from "obsidian";

export const generateUniqueFilePath = (
	app: App,
	folder: string,
	baseName: string,
	extension: string = "md"
): string => {
	const folderPath = folder ? `${folder}/` : "";
	let filePath = `${folderPath}${baseName}.${extension}`;
	let counter = 1;

	while (app.vault.getAbstractFileByPath(filePath)) {
		filePath = `${folderPath}${baseName} ${counter++}.${extension}`;
	}

	return filePath;
};

export const sanitizeForFilename = (input: string): string => {
	return input
		.replace(/[<>:"/\\|?*]/g, "") // Remove invalid filename characters
		.replace(/\s+/g, "-") // Replace spaces with hyphens
		.replace(/-+/g, "-") // Replace multiple hyphens with single
		.replace(/^-|-$/g, "") // Remove leading/trailing hyphens
		.toLowerCase();
};

export const getFilenameFromPath = (filePath: string): string => {
	return filePath.split("/").pop() || "Unknown";
};

export const isFileInConfiguredDirectory = (filePath: string, directory: string): boolean => {
	const normalizedDir = directory.endsWith("/") ? directory.slice(0, -1) : directory;
	return filePath.startsWith(`${normalizedDir}/`) || filePath === normalizedDir;
};
