import { type App, TFile } from "obsidian";
import type { FileCreationOptions } from "./templater";
import { createFromTemplate, isTemplaterAvailable } from "./templater";

export type { FileCreationOptions };

// ============================================================================
// Templater Service (Class-based wrapper)
// ============================================================================

export class TemplaterService {
	constructor(private app: App) {}

	/**
	 * Checks if Templater plugin is installed and enabled.
	 */
	isAvailable(): boolean {
		return isTemplaterAvailable(this.app);
	}

	/**
	 * Creates a file using Templater or falls back to manual creation.
	 */
	async createFile(options: FileCreationOptions): Promise<TFile> {
		const { title, targetDirectory, filename, content, frontmatter, templatePath, useTemplater } =
			options;

		const finalFilename = filename || title;

		// If content is provided, use manual creation to preserve the content
		if (content) {
			return this.createManually(title, targetDirectory, finalFilename, content, frontmatter);
		}

		// Try to use Templater if requested and available
		if (useTemplater && templatePath && this.shouldUseTemplate(templatePath)) {
			const templateFile = await createFromTemplate(
				this.app,
				templatePath,
				targetDirectory,
				finalFilename
			);

			if (templateFile) {
				// Apply frontmatter if provided
				if (frontmatter && Object.keys(frontmatter).length > 0) {
					await this.app.fileManager.processFrontMatter(templateFile, (fm) => {
						Object.assign(fm, frontmatter);
					});
				}
				return templateFile;
			}
		}

		// Fallback to manual creation
		return this.createManually(title, targetDirectory, finalFilename, content, frontmatter);
	}

	private shouldUseTemplate(templatePath: string): boolean {
		return !!(templatePath && this.isAvailable() && this.app.vault.getFileByPath(templatePath));
	}

	private async createManually(
		title: string,
		targetDirectory: string,
		filename: string,
		customContent?: string,
		frontmatter?: Record<string, unknown>
	): Promise<TFile> {
		const baseName = filename.replace(/\.md$/, "");
		const filePath = `${targetDirectory}/${baseName}.md`;

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);
		if (existingFile instanceof TFile) {
			return existingFile;
		}

		// Use custom content or default
		const content = customContent || `# ${title}\n\n`;

		const file = await this.app.vault.create(filePath, content);

		// Apply frontmatter if provided
		if (frontmatter && Object.keys(frontmatter).length > 0) {
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				Object.assign(fm, frontmatter);
			});
		}

		return file;
	}
}
