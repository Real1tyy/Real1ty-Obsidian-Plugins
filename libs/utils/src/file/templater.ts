import { type App, Notice, normalizePath, type TFile } from "obsidian";

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
