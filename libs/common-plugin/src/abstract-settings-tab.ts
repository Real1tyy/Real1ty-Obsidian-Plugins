import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { WatchdogPlugin } from "./abstract-plugin";
import type { BaseWatchdogSettings, DirectoryMapping } from "./types";

export abstract class WatchdogSettingsTab<
	TPlugin extends WatchdogPlugin<BaseWatchdogSettings>,
	_TSettings extends BaseWatchdogSettings,
> extends PluginSettingTab {
	plugin: TPlugin;

	constructor(app: App, plugin: TPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: this.getTitle() });

		containerEl.createEl("h3", { text: "General Settings" });
		this.displayGeneralSettings(containerEl);

		containerEl.createEl("h3", { text: "Directory Mappings" });
		this.displayDirectoryMappings(containerEl);

		containerEl.createEl("h3", { text: "DSL Syntax" });

		const dslUsageEl = containerEl.createEl("div", { cls: "setting-item-description" });
		dslUsageEl.innerHTML = `
			<p><strong>DSL Syntax Examples:</strong></p>

			<p><em>Basic Syntax:</em></p>
			<pre><code>\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType ChildTasks
![[Projects-ChildTasks.base]]
\`\`\`</code></pre>

			<p><em>Nested Syntax (Two-Level Dropdowns):</em></p>
			<pre><code>\`\`\`CommandType Projects
# Project Overview

\`\`\`CommandType CurrentProjects
![[Projects-Current.base]]
\`\`\`

\`\`\`CommandType CompletedProjects
![[Projects-Completed.base]]
\`\`\`

\`\`\`CommandType OnHoldProjects
![[Projects-OnHold.base]]
\`\`\`
\`\`\`</code></pre>

			<p>The <strong>CommandType</strong> creates the main dropdown selector. When nested <strong>CommandType</strong> blocks are within another CommandType, a second dropdown will appear for sub-views.</p>
			<p><strong>Note:</strong> You can mix regular content with nested CommandType blocks within CommandType sections.</p>
		`;

		containerEl.createEl("h3", { text: "Dynamic Commands" });

		const commandsEl = containerEl.createEl("div", { cls: "setting-item-description" });
		commandsEl.innerHTML = `
			<p><strong>Dynamic View Switching Commands:</strong></p>
			<p>When DSL content is detected, the plugin automatically registers commands for each view option:</p>
			<ul>
				<li><strong>Main Views:</strong> "Switch to [ViewName]" - Switch to top-level views</li>
				<li><strong>Sub-Views:</strong> "Switch to [ViewName] → [SubViewName]" - Switch to nested views</li>
			</ul>
			<p>These commands are dynamically created based on your DSL content and can be assigned hotkeys in Obsidian's hotkey settings.</p>
			<p><strong>Command Naming:</strong> Commands use consistent IDs based on your view names, so hotkey assignments persist across content changes.</p>
		`;

		containerEl.createEl("h3", { text: "Usage" });

		const usageEl = containerEl.createEl("div", { cls: "setting-item-description" });
		usageEl.innerHTML = this.getUsageText();
	}

	private displayGeneralSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Show Ribbon Icon")
			.setDesc("Display the ribbon icon in the sidebar for quick access to the view")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showRibbonIcon).onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();

					new Notice(
						"Ribbon icon setting changed. Please reload the plugin or restart Obsidian to see the changes."
					);
				})
			);
	}

	private displayDirectoryMappings(containerEl: HTMLElement): void {
		const descEl = containerEl.createEl("div", { cls: "setting-item-description" });
		descEl.innerHTML = `
			<p><strong>Directory Mappings:</strong> Configure what content to display for different directory paths in the ${this.getSidebarName()}.</p>
			<p>Use "*" as the directory path for a default fallback. More specific paths take priority.</p>
		`;

		const mappings = this.plugin.settings.directoryMappings;

		for (const mapping of mappings) {
			this.createMappingRow(containerEl, mapping);
		}

		new Setting(containerEl)
			.setName("Add Directory Mapping")
			.setDesc(`Add a new directory to content mapping for the ${this.getSidebarName()}`)
			.addButton((button) =>
				button
					.setButtonText("Add Mapping")
					.setCta()
					.onClick(async () => {
						const newMapping: DirectoryMapping = {
							id: Date.now().toString(),
							directoryPath: "",
							content: "",
						};

						this.plugin.settings.directoryMappings.push(newMapping);

						await this.plugin.saveSettings();
						this.display();
					})
			);
	}

	private createMappingRow(containerEl: HTMLElement, mapping: DirectoryMapping): void {
		const mappingDiv = containerEl.createEl("div", { cls: "directory-mapping-row" });

		new Setting(mappingDiv)
			.setName("Directory Path")
			.setDesc("Path to match (e.g., 'Goals', 'Projects', or '*' for default)")
			.addText((text) =>
				text
					.setPlaceholder("Goals")
					.setValue(mapping.directoryPath)
					.onChange(async (value) => {
						mapping.directoryPath = value.trim();
						await this.plugin.saveSettings();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Remove this mapping")
					.onClick(async () => {
						const mappings = this.plugin.settings.directoryMappings;

						const index = mappings.indexOf(mapping);
						if (index > -1) {
							mappings.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						}
					})
			);

		new Setting(mappingDiv)
			.setName("Content to Render")
			.setDesc("Markdown content to display for this directory (supports embeds, links, etc.)")
			.addTextArea((textarea) => {
				textarea
					.setPlaceholder("![[Templates/Links]]")
					.setValue(mapping.content)
					.onChange(async (value) => {
						mapping.content = value;
						await this.plugin.saveSettings();
					});

				textarea.inputEl.style.width = "100%";
				textarea.inputEl.style.minWidth = "400px";
				textarea.inputEl.style.height = "120px";
				textarea.inputEl.style.resize = "vertical";
				textarea.inputEl.style.fontFamily = "var(--font-monospace)";
			});

		mappingDiv.createEl("hr", { cls: "directory-mapping-separator" });
	}

	protected abstract getTitle(): string;
	protected abstract getSidebarName(): string;
	protected abstract getUsageText(): string;
}
