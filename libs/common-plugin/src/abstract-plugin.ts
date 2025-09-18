import { Plugin, type PluginSettingTab, type WorkspaceLeaf } from "obsidian";
import { containsDslSyntax, parseDslContent } from "./dsl-parser";
import type {
	BaseWatchdogSettings,
	ContentRenderCallback,
	DynamicViewCommand,
	ViewSwitchingManager,
	WatchdogView,
	WatchdogViewConfig,
} from "./types";

/**
 * Abstract Watchdog Plugin that provides directory mapping and file watching functionality.
 * Acts like Python's Watchdog pattern for Obsidian plugins.
 *
 * Child classes need to implement:
 * - createView: Factory method for creating the view
 * - getViewConfig: Configuration for the view (type, icon, hotkey, etc.)
 * - getDefaultSettings: Default settings for the plugin
 * - onContentChange: Callback when content changes (optional)
 */
export abstract class WatchdogPlugin<TSettings extends BaseWatchdogSettings> extends Plugin {
	settings!: TSettings;
	private registeredDynamicCommands: string[] = [];
	private lastContentHash: string | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		const config = this.getViewConfig();

		this.registerView(config.viewType, (leaf) => this.createView(leaf, () => this.settings));

		this.addSettingTab(this.createSettingsTab());

		if (this.settings.showRibbonIcon) {
			this.addRibbonIcon(config.ribbonIcon, config.ribbonTooltip, async () => {
				await this.activateView();
			});
		}

		this.addCommand({
			id: config.commandId,
			name: config.commandName,
			checkCallback: (checking) => {
				if (checking) return true;
				this.activateView();
			},
		});

		// Listen to active leaf changes but let SidebarManager handle the filtering
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.updateActiveViews();
				// Delay command update to ensure view is fully loaded
				setTimeout(() => this.updateDynamicCommands(), 100);
			})
		);

		// Listen to layout changes (when views are opened/closed)
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				setTimeout(() => this.updateDynamicCommands(), 200);
			})
		);

		// Initial command registration after plugin loads
		setTimeout(() => {
			this.updateDynamicCommands();
		}, 500);

		await this.onPluginLoad();
	}

	async onunload(): Promise<void> {
		const config = this.getViewConfig();
		this.app.workspace.getLeavesOfType(config.viewType).forEach((leaf) => {
			leaf.detach();
		});

		await this.onPluginUnload();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, this.getDefaultSettings(), await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Update commands when settings change (directory mappings might have changed)
		setTimeout(() => this.updateDynamicCommands(), 100);
	}

	public getContentForCurrentContext(): { content: string; filePath: string } {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			this.onContentChange?.("", "");
			return { content: "", filePath: "" };
		}

		const filePath = activeFile.path;
		const mappings = this.settings.directoryMappings;

		const matchedMapping =
			mappings.find((mapping) => filePath.startsWith(mapping.directoryPath)) ||
			mappings.find((mapping) => mapping.directoryPath === "*");

		const content = matchedMapping?.content || "";
		this.onContentChange?.(content, filePath);
		return { content, filePath };
	}

	public parseContentIfNeeded(content: string): {
		content: string;
		hasValidDsl: boolean;
		viewOptions?: any[];
	} {
		if (containsDslSyntax(content)) {
			const parsed = parseDslContent(content);
			return {
				content,
				hasValidDsl: parsed.hasValidDsl,
				viewOptions: parsed.viewOptions,
			};
		}

		return { content, hasValidDsl: false };
	}

	private async activateView(): Promise<void> {
		const config = this.getViewConfig();

		// Check if view is already open
		const existingLeaves = this.app.workspace.getLeavesOfType(config.viewType);

		if (existingLeaves.length > 0) {
			// If already open, just reveal and focus it
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// Open in the appropriate sidebar
		const leaf =
			config.sidebarSide === "left"
				? this.app.workspace.getLeftLeaf(false)
				: this.app.workspace.getRightLeaf(false);

		if (leaf) {
			await leaf.setViewState({ type: config.viewType, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	private updateActiveViews(): void {
		const config = this.getViewConfig();
		const leaves = this.app.workspace.getLeavesOfType(config.viewType);

		leaves.forEach((leaf) => {
			const view = leaf.view;
			if (view && "updateContent" in view && typeof view.updateContent === "function") {
				view.updateContent();
			}
		});
	}

	protected abstract createView(leaf: WorkspaceLeaf, getSettings: () => TSettings): WatchdogView;
	protected abstract getViewConfig(): WatchdogViewConfig;
	protected abstract getDefaultSettings(): TSettings;
	protected abstract createSettingsTab(): PluginSettingTab;

	protected async onPluginLoad(): Promise<void> {}

	protected async onPluginUnload(): Promise<void> {}

	protected onContentChange?: ContentRenderCallback;

	/**
	 * Update dynamic commands based on current DSL content
	 */
	private updateDynamicCommands(): void {
		const { content } = this.getContentForCurrentContext();

		// Get the view switching manager from the active view
		const viewSwitchingManager = this.getViewSwitchingManager();
		if (!viewSwitchingManager) {
			// Clear commands if no view manager available
			this.clearDynamicCommands();
			this.lastContentHash = null;
			return;
		}

		// Create a hash that includes both content and current view state
		const currentViewOptions = viewSwitchingManager.getCurrentViewOptions();
		const viewStateHash = this.createViewStateHash(currentViewOptions, viewSwitchingManager);
		const contentHash = content ? this.simpleHash(content) : null;
		const combinedHash = `${contentHash}|${viewStateHash}`;

		// Only update if content or view state has actually changed
		if (combinedHash === this.lastContentHash) {
			return;
		}

		this.lastContentHash = combinedHash;

		// Clear existing dynamic commands
		this.clearDynamicCommands();

		if (!content || !containsDslSyntax(content)) {
			return;
		}

		// Set up callback for command updates when main view selection changes
		if ("onCommandsNeedUpdate" in viewSwitchingManager) {
			(viewSwitchingManager as any).onCommandsNeedUpdate = () => {
				// Force update commands when main view selection changes
				setTimeout(() => {
					this.lastContentHash = null; // Reset to force update
					this.updateDynamicCommands();
				}, 50);
			};
		}

		// Register new dynamic commands
		const availableCommands = viewSwitchingManager.getAvailableCommands();
		this.registerDynamicCommands(availableCommands, viewSwitchingManager);
	}

	/**
	 * Get the view switching manager from the active view
	 */
	private getViewSwitchingManager(): ViewSwitchingManager | null {
		const config = this.getViewConfig();
		const leaves = this.app.workspace.getLeavesOfType(config.viewType);

		if (leaves.length === 0) {
			return null;
		}

		const view = leaves[0].view;
		if (
			view &&
			"getViewSwitchingManager" in view &&
			typeof view.getViewSwitchingManager === "function"
		) {
			return view.getViewSwitchingManager();
		}

		return null;
	}

	/**
	 * Register dynamic commands for view switching
	 */
	private registerDynamicCommands(
		commands: DynamicViewCommand[],
		_manager: ViewSwitchingManager
	): void {
		const config = this.getViewConfig();

		for (const command of commands) {
			const commandId = `${config.commandId}-${command.id}`;

			this.addCommand({
				id: commandId,
				name: command.name,
				checkCallback: (checking) => {
					if (checking) {
						// Only show command if we have DSL content and the view is available
						return this.getViewSwitchingManager() !== null;
					}

					// Execute the command - get current view state dynamically
					const currentManager = this.getViewSwitchingManager();
					if (!currentManager) {
						return false;
					}

					// Get the current available commands to find the right target
					const currentCommands = currentManager.getAvailableCommands();
					const matchingCommand = currentCommands.find((cmd) => cmd.id === command.id);

					if (matchingCommand) {
						currentManager.switchToView(matchingCommand.viewId, matchingCommand.subViewId);
					}
					return true;
				},
			});

			this.registeredDynamicCommands.push(commandId);
		}
	}

	/**
	 * Clear all registered dynamic commands
	 */
	private clearDynamicCommands(): void {
		// Note: Obsidian doesn't provide a direct way to unregister commands,
		// but we track them for potential future cleanup if the API is extended
		this.registeredDynamicCommands = [];
	}

	/**
	 * Simple hash function for content change detection
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash.toString();
	}

	/**
	 * Create a hash that represents the current view state for command generation
	 */
	private createViewStateHash(
		_viewOptions: any[],
		viewSwitchingManager: ViewSwitchingManager
	): string {
		// Get current commands to include selected view state in hash
		const currentCommands = viewSwitchingManager.getAvailableCommands();
		const commandsString = currentCommands
			.map((cmd) => `${cmd.id}:${cmd.viewId}:${cmd.subViewId || ""}`)
			.join("|");
		return this.simpleHash(commandsString);
	}

	/**
	 * Force update dynamic commands (useful for debugging)
	 */
	public forceUpdateDynamicCommands(): void {
		this.lastContentHash = null; // Reset hash to force update
		this.updateDynamicCommands();
	}
}
