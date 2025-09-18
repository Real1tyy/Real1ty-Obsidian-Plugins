import { ItemView, MarkdownRenderer, type WorkspaceLeaf } from "obsidian";
import { SidebarManager } from "./sidebar-manager";
import type {
	BaseWatchdogSettings,
	SidebarRuntimeState,
	ViewSwitchingManager,
	WatchdogView,
} from "./types";

interface BaseSidebarViewState extends Record<string, unknown> {
	currentPath?: string;
}

export abstract class BaseSidebarView extends ItemView implements WatchdogView {
	protected container: HTMLDivElement;
	protected sidebarContentEl: HTMLDivElement;
	protected isUpdating = false;
	protected sidebarManager: SidebarManager | null = null;
	protected runtimeState: SidebarRuntimeState;

	constructor(
		leaf: WorkspaceLeaf,
		protected getSettings: () => BaseWatchdogSettings,
		protected sidebarType: "left" | "right",
		protected pluginId: string
	) {
		super(leaf);
		this.runtimeState = {
			isVisible: true,
			currentWidth: 300,
		};
	}

	protected getPlugin(): any {
		// Get the plugin instance through the app's plugin system
		// Cast app to any to access plugins property
		return (this.app as any).plugins?.getPlugin(this.pluginId);
	}

	abstract getViewType(): string;
	abstract getDisplayText(): string;
	abstract getIcon(): string;

	async onOpen(): Promise<void> {
		const root = this.containerEl;
		root.empty();

		// Main container
		this.container = root.createDiv({ cls: "custom-sidebar-root" });
		this.sidebarContentEl = this.container.createDiv({ cls: "custom-sidebar-content" });

		// Initialize the sidebar manager with DSL parsing capabilities in embedded mode
		this.sidebarManager = new SidebarManager(
			this.app,
			this.runtimeState,
			this, // Use this view as the component
			this.getSettings,
			{ side: this.sidebarType }, // Only specify the side, other defaults will be inferred
			this.sidebarContentEl // Pass the container for embedded mode
		);

		// Show the sidebar manager once during initialization
		this.sidebarManager.show();
	}

	async onClose(): Promise<void> {
		// Cleanup sidebar manager
		if (this.sidebarManager) {
			this.sidebarManager.hide();
			this.sidebarManager = null;
		}
		this.isUpdating = false;
	}

	// State persistence for pane restore
	getState(): BaseSidebarViewState {
		const activeFile = this.app.workspace.getActiveFile();
		return {
			currentPath: activeFile?.path,
		};
	}

	async setState(state: BaseSidebarViewState, result: any): Promise<void> {
		await super.setState(state, result);
		// Content will be updated when the active file changes
		await this.updateContent();
	}

	async updateContent(): Promise<void> {
		if (!this.sidebarManager || this.isUpdating) {
			return;
		}

		this.isUpdating = true;

		try {
			// Just trigger the sidebar manager to update its content
			await this.sidebarManager.updateContent();
		} catch (error) {
			console.error("Failed to update sidebar content:", error);
			if (this.sidebarContentEl) {
				this.sidebarContentEl.empty();
				this.sidebarContentEl.createEl("div", {
					text: "Error loading sidebar content",
					cls: "custom-sidebar-error",
				});
			}
		} finally {
			this.isUpdating = false;
		}
	}

	protected async renderContent(content: string, container: HTMLElement): Promise<void> {
		const tempEl = document.createElement("div");
		const activeFile = this.app.workspace.getActiveFile();
		const sourcePath = activeFile?.path || "";

		await MarkdownRenderer.render(this.app, content, tempEl, sourcePath, this);

		while (tempEl.firstChild) {
			container.appendChild(tempEl.firstChild);
		}
	}

	/**
	 * Get the view switching manager for dynamic command registration
	 */
	getViewSwitchingManager(): ViewSwitchingManager | null {
		return this.sidebarManager;
	}
}
