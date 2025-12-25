import { type App, Notice, normalizePath, TFile } from "obsidian";

const TEMPLATER_ID = "templater-obsidian";

type CreateFn = (
	templateFile: TFile,
	folder?: string,
	filename?: string,
	openNewNote?: boolean
) => Promise<TFile | undefined>;

interface TemplaterLike {
	create_new_note_from_template: CreateFn;
}

export interface FileCreationOptions {
	title: string;
	targetDirectory: string;
	filename?: string;
	content?: string;
	frontmatter?: Record<string, unknown>;
	templatePath?: string;
	useTemplater?: boolean;
}

async function waitForTemplater(app: App, timeoutMs = 8000): Promise<TemplaterLike | null> {
	await new Promise<void>((resolve) => app.workspace.onLayoutReady(resolve));

	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const plug: any = (app as any).plugins?.getPlugin?.(TEMPLATER_ID);
		const api = plug?.templater ?? null;

		const createFn: CreateFn | undefined = api?.create_new_note_from_template?.bind(api);
		if (typeof createFn === "function") {
			return { create_new_note_from_template: createFn };
		}
		await new Promise((r) => setTimeout(r, 150));
	}
	return null;
}

export function isTemplaterAvailable(app: App): boolean {
	const instance = (app as any).plugins?.getPlugin?.(TEMPLATER_ID);
	return !!instance;
}

export async function createFromTemplate(
	app: App,
	templatePath: string,
	targetFolder?: string,
	filename?: string,
	openNewNote = false
): Promise<TFile | null> {
	const templater = await waitForTemplater(app);
	if (!templater) {
		console.warn("Templater isn't ready yet (or not installed/enabled).");
		new Notice(
			"Templater plugin is not available or enabled. Please ensure it is installed and enabled."
		);
		return null;
	}

	const templateFile = app.vault.getFileByPath(normalizePath(templatePath));
	if (!templateFile) {
		console.error(`Template not found: ${templatePath}`);
		new Notice(`Template file not found: ${templatePath}. Please ensure the template file exists.`);
		return null;
	}

	try {
		const newFile = await templater.create_new_note_from_template(
			templateFile,
			targetFolder,
			filename,
			openNewNote
		);

		return newFile ?? null;
	} catch (error) {
		console.error("Error creating file from template:", error);
		new Notice("Error creating file from template. Please ensure the template file is valid.");
		return null;
	}
}

export async function createFileWithTemplate(
	app: App,
	options: FileCreationOptions
): Promise<TFile> {
	const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } =
		options;

	const finalFilename = filename || title;
	const baseName = finalFilename.replace(/\.md$/, "");
	const filePath = normalizePath(`${targetDirectory}/${baseName}.md`);

	const existingFile = app.vault.getAbstractFileByPath(filePath);
	if (existingFile instanceof TFile) {
		return existingFile;
	}

	if (useTemplater && templatePath && templatePath.trim() !== "" && isTemplaterAvailable(app)) {
		const templateFile = await createFromTemplate(
			app,
			templatePath,
			targetDirectory,
			finalFilename
		);

		if (templateFile) {
			if (frontmatter && Object.keys(frontmatter).length > 0) {
				await app.fileManager.processFrontMatter(templateFile, (fm) => {
					Object.assign(fm, frontmatter);
				});
			}
			return templateFile;
		}
	}

	const fileContent = content || "";
	const file = await app.vault.create(filePath, fileContent);

	if (frontmatter && Object.keys(frontmatter).length > 0) {
		await app.fileManager.processFrontMatter(file, (fm) => {
			Object.assign(fm, frontmatter);
		});
	}

	return file;
}
