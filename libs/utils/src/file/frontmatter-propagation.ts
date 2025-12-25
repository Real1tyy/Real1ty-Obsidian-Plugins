import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { Frontmatter, FrontmatterDiff } from "./frontmatter-diff";

export interface NexusPropertiesSettings {
	excludedPropagatedProps?: string;
	parentProp: string;
	childrenProp: string;
	relatedProp: string;
	zettelIdProp: string;
}

export function parseExcludedProps(settings: NexusPropertiesSettings): Set<string> {
	const excludedPropsStr = settings.excludedPropagatedProps || "";
	const userExcluded = excludedPropsStr
		.split(",")
		.map((prop) => prop.trim())
		.filter((prop) => prop.length > 0);

	const alwaysExcluded = [
		settings.parentProp,
		settings.childrenProp,
		settings.relatedProp,
		settings.zettelIdProp,
	];

	return new Set([...alwaysExcluded, ...userExcluded]);
}

export async function applyFrontmatterChanges(
	app: App,
	targetPath: string,
	sourceFrontmatter: Frontmatter,
	diff: FrontmatterDiff
): Promise<void> {
	try {
		const file = app.vault.getAbstractFileByPath(targetPath);
		if (!(file instanceof TFile)) {
			console.warn(`Target file not found: ${targetPath}`);
			return;
		}

		await app.fileManager.processFrontMatter(file, (fm) => {
			for (const change of diff.added) {
				fm[change.key] = sourceFrontmatter[change.key];
			}

			for (const change of diff.modified) {
				fm[change.key] = sourceFrontmatter[change.key];
			}

			for (const change of diff.deleted) {
				delete fm[change.key];
			}
		});
	} catch (error) {
		console.error(`Error applying frontmatter changes to ${targetPath}:`, error);
	}
}
