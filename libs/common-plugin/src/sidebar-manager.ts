import { type App, type Component, MarkdownRenderer } from "obsidian";
import { parseDslContent } from "./dsl-parser";
import type {
	BaseWatchdogSettings,
	DynamicViewCommand,
	ParsedDslContent,
	SidebarRuntimeState,
	ViewCacheManager,
	ViewOption,
	ViewSelectionCache,
	ViewSwitchingManager,
} from "./types";
import { createViewCache } from "./view-cache";

export interface SidebarConfig {
	side: "left" | "right";
	defaultWidth: number;
	minWidth: number;
}

export class SidebarManager implements ViewSwitchingManager {
	private sidebarEl: HTMLElement | null = null;
	private contentEl: HTMLElement | null = null;
	private resizeHandle: HTMLElement | null = null;
	private viewSelectorEl: HTMLElement | null = null;
	private isResizing = false;
	private startX = 0;
	private startWidth = 0;
	private currentParsedContent: ParsedDslContent | null = null;
	private selectedViewId: string | null = null;
	private selectedSubViewId: string | null = null; // Track nested sub-view selection
	private isUpdating = false;
	private containerEl: HTMLElement | null = null; // For embedded mode
	private lastContentHash: string | null = null; // Track content changes
	private lastFilePath: string | null = null; // Track file path changes
	private config: SidebarConfig; // Configuration for the sidebar
	private subViewSelectorEl: HTMLElement | null = null; // Second dropdown for sub-views
	private viewCache: ViewCacheManager; // In-memory cache for view selections
	public onCommandsNeedUpdate?: () => void; // Callback when commands need to be updated

	constructor(
		private app: App,
		private runtimeState: SidebarRuntimeState,
		private component: Component,
		private getSettings: () => BaseWatchdogSettings,
		config?: Partial<SidebarConfig>, // Make config optional and partial
		containerEl?: HTMLElement // Optional container for embedded mode
	) {
		this.config = {
			side: config?.side || "left",
			defaultWidth: config?.defaultWidth || 300,
			minWidth: config?.minWidth || 200,
		};
		this.containerEl = containerEl || null;
		this.viewCache = createViewCache();
	}

	show(): void {
		if (this.sidebarEl) {
			return;
		}

		if (this.containerEl) {
			// Embedded mode - use provided container
			this.createEmbeddedSidebar();
		} else {
			// Standalone mode - create full sidebar
			this.createSidebarContainer();
			this.createResizeHandle();
			this.createViewSelector();
			this.createSubViewSelector();
			this.createContentArea();
			this.setupResizeHandlers();
			document.body.appendChild(this.sidebarEl!);
			document.body.addClass("custom-sidebar-visible");
		}

		this.updateContent();
	}

	private createEmbeddedSidebar(): void {
		if (!this.containerEl) return;

		// Use the provided container as the sidebar element
		this.sidebarEl = this.containerEl;
		this.sidebarEl.addClass("custom-sidebar-embedded");

		// Create view selector and content area within the container
		this.createViewSelector();
		this.createSubViewSelector();
		this.createContentArea();
	}

	hide(): void {
		if (this.sidebarEl) {
			if (this.containerEl) {
				// Embedded mode - just clear the container
				this.sidebarEl.empty();
			} else {
				// Standalone mode - remove from body
				this.sidebarEl.remove();
				document.body.removeClass("custom-sidebar-visible");
			}
			this.sidebarEl = null;
			this.contentEl = null;
			this.resizeHandle = null;
			this.viewSelectorEl = null;
			this.subViewSelectorEl = null;
		}
		this.isUpdating = false; // Reset update flag
		// Preserve state across hide/show cycles to maintain user selections
		// Note: We keep the cache intact across hide/show cycles
		// this.currentParsedContent = null;
		// this.selectedViewId = null;
		// this.selectedSubViewId = null;
		// this.lastContentHash = null;
		// this.lastFilePath = null;
	}

	/**
	 * Clear the view selection cache (useful for testing or cleanup)
	 */
	public clearCache(): void {
		this.viewCache.clearCache();
	}

	/**
	 * Get cached selection for a specific file path (useful for debugging)
	 */
	public getCachedSelection(filePath: string): ViewSelectionCache | null {
		return this.viewCache.getViewSelection(filePath);
	}

	async updateContent(): Promise<void> {
		if (!this.contentEl || this.isUpdating) {
			return;
		}

		this.isUpdating = true;

		try {
			const activeFile = this.app.workspace.getActiveFile();
			const currentFilePath = activeFile?.path || "";

			// First check: Has the file actually changed?
			if (currentFilePath === this.lastFilePath && this.currentParsedContent) {
				return;
			}

			const rawContent = this.getContentForCurrentFile();

			// Only include selected view context in hash, not file path (since we check file path separately)
			const selectedViewContext = `|selectedView:${this.selectedViewId}|selectedSubView:${this.selectedSubViewId}`;
			const contentWithContext = `${rawContent}${selectedViewContext}`;

			// Create a simple hash of the content + view context to detect changes
			const contentHash = rawContent ? this.simpleHash(contentWithContext) : null;

			// Skip update if content and view context haven't changed (but file did change)
			if (contentHash === this.lastContentHash && this.currentParsedContent) {
				// Update file path tracking but don't re-render
				this.lastFilePath = currentFilePath;
				return;
			}

			// Clear content thoroughly only if content changed
			this.contentEl.empty();
			this.lastContentHash = contentHash;
			this.lastFilePath = currentFilePath;

			if (!rawContent) {
				this.contentEl.createEl("div", {
					text: "No content configured for this directory",
					cls: "custom-sidebar-no-content",
				});
				this.hideViewSelectors();
				return;
			}

			this.currentParsedContent = parseDslContent(rawContent);

			if (this.currentParsedContent.hasValidDsl) {
				// Try to restore cached view selections for this file
				this.restoreCachedSelections(currentFilePath);
				this.updateViewSelector(this.currentParsedContent.viewOptions);

				// Save initial selection to cache if we don't have one yet
				if (!this.viewCache.hasCache(currentFilePath) && this.selectedViewId) {
					this.saveCachedSelections(currentFilePath);
				}

				await this.renderSelectedView();
			} else {
				this.hideViewSelectors();
				await this.renderContent(rawContent, this.contentEl);
			}
		} catch (error) {
			console.error("Failed to update sidebar content:", error);
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				text: "Error loading sidebar content",
				cls: "custom-sidebar-error",
			});
			this.hideViewSelectors();
		} finally {
			this.isUpdating = false;
		}
	}

	private getContentForCurrentFile(): string | null {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return null;

		const settings = this.getSettings();
		const filePath = activeFile.path;

		let wildcardMapping: string | null = null;

		for (const mapping of settings.directoryMappings) {
			if (mapping.directoryPath === "*") {
				wildcardMapping = mapping.content;
				continue;
			}

			if (this.doesPathMatch(filePath, mapping.directoryPath)) {
				return mapping.content || null;
			}
		}

		return wildcardMapping;
	}

	private doesPathMatch(filePath: string, directoryPath: string): boolean {
		if (!directoryPath) return false;

		const normalizedDirPath = directoryPath.endsWith("/") ? directoryPath : `${directoryPath}/`;

		return filePath.startsWith(normalizedDirPath);
	}

	private createSidebarContainer(): void {
		this.sidebarEl = document.createElement("div");
		this.sidebarEl.addClass("custom-sidebar-container");

		const sideStyle = this.config.side === "left" ? { left: "0" } : { right: "0" };

		Object.assign(this.sidebarEl.style, {
			width: `${this.runtimeState.currentWidth}px`,
			backgroundColor: "var(--background-primary)",
			position: "fixed",
			top: "0",
			bottom: "0",
			zIndex: "50",
			overflow: "hidden",
			boxShadow:
				this.config.side === "left"
					? "2px 0 8px rgba(0, 0, 0, 0.1)"
					: "-2px 0 8px rgba(0, 0, 0, 0.1)",
			pointerEvents: "auto",
			...sideStyle,
		});

		// Add border on the appropriate side
		if (this.config.side === "left") {
			this.sidebarEl.style.borderRight = "1px solid var(--background-modifier-border)";
		} else {
			this.sidebarEl.style.borderLeft = "1px solid var(--background-modifier-border)";
		}
	}

	private createResizeHandle(): void {
		this.resizeHandle = document.createElement("div");
		this.resizeHandle.addClass("custom-sidebar-resize-handle");

		const handlePosition = this.config.side === "left" ? { right: "0" } : { left: "0" };

		Object.assign(this.resizeHandle.style, {
			position: "absolute",
			top: "0",
			bottom: "0",
			width: "6px",
			backgroundColor: "var(--background-modifier-border)",
			cursor: "ew-resize",
			zIndex: "60", // Just above sidebar container (50) for interaction
			transition: "background-color 0.2s ease",
			...handlePosition,
		});

		this.resizeHandle.addEventListener("mouseenter", () => {
			this.resizeHandle!.style.backgroundColor = "var(--interactive-accent)";
		});

		this.resizeHandle.addEventListener("mouseleave", () => {
			if (!this.isResizing) {
				this.resizeHandle!.style.backgroundColor = "var(--background-modifier-border)";
			}
		});

		this.sidebarEl!.appendChild(this.resizeHandle);
	}

	private createViewSelector(): void {
		this.viewSelectorEl = document.createElement("div");
		this.viewSelectorEl.addClass("custom-sidebar-view-selector");

		const marginSide = this.config.side === "left" ? "marginRight" : "marginLeft";

		Object.assign(this.viewSelectorEl.style, {
			padding: "8px 12px",
			borderBottom: "1px solid var(--background-modifier-border)",
			backgroundColor: "var(--background-secondary)",
			[marginSide]: "6px",
			display: "none", // Hidden by default
		});

		this.sidebarEl!.appendChild(this.viewSelectorEl);
	}

	private createSubViewSelector(): void {
		this.subViewSelectorEl = document.createElement("div");
		this.subViewSelectorEl.addClass("custom-sidebar-subview-selector");

		const marginSide = this.config.side === "left" ? "marginRight" : "marginLeft";

		Object.assign(this.subViewSelectorEl.style, {
			padding: "8px 12px",
			borderBottom: "1px solid var(--background-modifier-border)",
			backgroundColor: "var(--background-secondary)",
			[marginSide]: "6px",
			display: "none", // Hidden by default
		});

		this.sidebarEl!.appendChild(this.subViewSelectorEl);
	}

	private createContentArea(): void {
		this.contentEl = document.createElement("div");
		this.contentEl.addClass("custom-sidebar-content");

		if (this.containerEl) {
			// Embedded mode - simpler styling
			Object.assign(this.contentEl.style, {
				padding: "12px",
				height: "calc(100% - 0px)", // Will be adjusted when view selectors are shown
				overflow: "auto",
				position: "relative",
			});
		} else {
			// Standalone mode - full styling
			const marginSide = this.config.side === "left" ? "marginRight" : "marginLeft";
			Object.assign(this.contentEl.style, {
				padding: "12px",
				width: `${this.runtimeState.currentWidth - 6}px`,
				height: "calc(100% - 0px)", // Will be adjusted when view selectors are shown
				overflow: "auto",
				[marginSide]: "6px",
				pointerEvents: "auto",
				position: "relative",
			});
		}

		this.sidebarEl!.appendChild(this.contentEl);
	}

	private setupResizeHandlers(): void {
		if (!this.resizeHandle) return;

		const onMouseDown = (e: MouseEvent) => {
			e.preventDefault();
			this.isResizing = true;
			this.startX = e.clientX;
			this.startWidth = this.runtimeState.currentWidth;

			document.body.style.cursor = "ew-resize";
			document.body.style.userSelect = "none";
			this.resizeHandle!.style.backgroundColor = "var(--interactive-accent)";
		};

		const onMouseMove = (e: MouseEvent) => {
			if (!this.isResizing) return;

			e.preventDefault();
			const deltaX =
				this.config.side === "left" ? e.clientX - this.startX : this.startX - e.clientX;
			const newWidth = Math.max(this.config.minWidth, this.startWidth + deltaX);

			this.runtimeState.currentWidth = newWidth;
			if (this.sidebarEl && this.contentEl) {
				this.sidebarEl.style.width = `${newWidth}px`;
				this.contentEl.style.width = `${newWidth - 6}px`;
			}
		};

		const onMouseUp = () => {
			if (!this.isResizing) return;

			this.isResizing = false;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			this.resizeHandle!.style.backgroundColor = "var(--background-modifier-border)";
		};

		this.resizeHandle.addEventListener("mousedown", onMouseDown);
		this.component.registerDomEvent(document, "mousemove", onMouseMove);
		this.component.registerDomEvent(document, "mouseup", onMouseUp);
	}

	private async renderContent(content: string, container: HTMLElement): Promise<void> {
		const tempEl = document.createElement("div");
		const activeFile = this.app.workspace.getActiveFile();
		const sourcePath = activeFile?.path || "";

		await MarkdownRenderer.render(this.app, content, tempEl, sourcePath, this.component);

		while (tempEl.firstChild) {
			container.appendChild(tempEl.firstChild);
		}
	}

	private updateViewSelector(viewOptions: ViewOption[]): void {
		if (!this.viewSelectorEl) {
			return;
		}

		// Clear existing content
		this.viewSelectorEl.empty();

		// Create select element
		const selectEl = document.createElement("select");
		selectEl.addClass("custom-sidebar-view-select");

		Object.assign(selectEl.style, {
			width: "100%",
			padding: "4px 8px",
			backgroundColor: "var(--background-primary)",
			border: "1px solid var(--background-modifier-border)",
			borderRadius: "4px",
			color: "var(--text-normal)",
		});

		// Add options
		for (const option of viewOptions) {
			const optionEl = document.createElement("option");
			optionEl.value = option.id;
			optionEl.textContent = option.label;
			selectEl.appendChild(optionEl);
		}

		// Set selection - preserve previous selection if it exists in new options
		let selectedId = this.selectedViewId;
		if (!selectedId || !viewOptions.find((opt) => opt.id === selectedId)) {
			// If no previous selection or previous selection not available, use first option
			selectedId = viewOptions.length > 0 ? viewOptions[0].id : null;
		}

		if (selectedId) {
			this.selectedViewId = selectedId;
			selectEl.value = selectedId;
		}

		// Add change handler - make it async to properly handle rendering
		selectEl.addEventListener("change", async (e) => {
			const target = e.target as HTMLSelectElement;
			this.selectedViewId = target.value || null;

			// Reset sub-view selection when main view changes
			this.selectedSubViewId = null;

			// Save the new selection to cache
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				this.saveCachedSelections(activeFile.path);
			}

			// Update sub-view selector based on new selection
			this.updateSubViewSelector();

			// Update content height in case sub-view selector visibility changed
			this.updateContentHeight();

			// Notify that commands need to be updated (nested commands depend on selected main view)
			this.onCommandsNeedUpdate?.();

			await this.renderSelectedView();
		});

		this.viewSelectorEl.appendChild(selectEl);
		this.updateViewSelectors();
	}

	private updateViewSelectors(): void {
		if (!this.viewSelectorEl || !this.contentEl) {
			return;
		}

		// Always show main view selector when we have DSL content
		this.viewSelectorEl.style.display = "block";

		// Update sub-view selector based on current selection
		this.updateSubViewSelector();

		// Calculate height based on visible selectors
		this.updateContentHeight();
	}

	private updateSubViewSelector(): void {
		if (!this.subViewSelectorEl || !this.currentParsedContent || !this.selectedViewId) {
			this.hideSubViewSelector();
			return;
		}

		const selectedOption = this.currentParsedContent.viewOptions.find(
			(option: ViewOption) => option.id === this.selectedViewId
		);

		if (!selectedOption || !selectedOption.hasNestedDsl || !selectedOption.subOptions) {
			this.hideSubViewSelector();
			return;
		}

		// Clear existing content
		this.subViewSelectorEl.empty();

		// Create sub-select element
		const selectEl = document.createElement("select");
		selectEl.addClass("custom-sidebar-subview-select");

		Object.assign(selectEl.style, {
			width: "100%",
			padding: "4px 8px",
			backgroundColor: "var(--background-primary)",
			border: "1px solid var(--background-modifier-border)",
			borderRadius: "4px",
			color: "var(--text-normal)",
		});

		// Add options
		for (const option of selectedOption.subOptions) {
			const optionEl = document.createElement("option");
			optionEl.value = option.id;
			optionEl.textContent = option.label;
			selectEl.appendChild(optionEl);
		}

		// Set selection - preserve previous selection if it exists in new options
		let selectedSubId = this.selectedSubViewId;
		if (!selectedSubId || !selectedOption.subOptions.find((opt) => opt.id === selectedSubId)) {
			// If no previous selection or previous selection not available, use first option
			selectedSubId = selectedOption.subOptions.length > 0 ? selectedOption.subOptions[0].id : null;
		}

		if (selectedSubId) {
			this.selectedSubViewId = selectedSubId;
			selectEl.value = selectedSubId;
		}

		// Add change handler
		selectEl.addEventListener("change", async (e) => {
			const target = e.target as HTMLSelectElement;
			this.selectedSubViewId = target.value || null;

			// Save the new selection to cache
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				this.saveCachedSelections(activeFile.path);
			}

			await this.renderSelectedView();
		});

		this.subViewSelectorEl.appendChild(selectEl);
		this.showSubViewSelector();
	}

	private showSubViewSelector(): void {
		if (!this.subViewSelectorEl) return;
		this.subViewSelectorEl.style.display = "block";
	}

	private hideSubViewSelector(): void {
		if (!this.subViewSelectorEl) return;
		this.subViewSelectorEl.style.display = "none";
	}

	private updateContentHeight(): void {
		if (!this.contentEl) return;

		let heightOffset = 0;

		// Account for main view selector
		if (this.viewSelectorEl && this.viewSelectorEl.style.display === "block") {
			heightOffset += 45; // Approximate height of selector
		}

		// Account for sub-view selector
		if (this.subViewSelectorEl && this.subViewSelectorEl.style.display === "block") {
			heightOffset += 45; // Approximate height of selector
		}

		this.contentEl.style.height = `calc(100% - ${heightOffset}px)`;
	}

	private hideViewSelectors(): void {
		if (!this.viewSelectorEl || !this.contentEl) return;

		this.viewSelectorEl.style.display = "none";
		this.hideSubViewSelector();
		// Reset content area height
		this.contentEl.style.height = "calc(100% - 0px)";
	}

	private async renderSelectedView(): Promise<void> {
		if (!this.contentEl || !this.currentParsedContent || !this.selectedViewId) return;

		const selectedOption = this.currentParsedContent.viewOptions.find(
			(option: ViewOption) => option.id === this.selectedViewId
		);

		if (!selectedOption) {
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				text: "Selected view not found",
				cls: "custom-sidebar-error",
			});
			return;
		}

		// Clear content thoroughly
		this.contentEl.empty();

		try {
			// Determine what content to render
			let contentToRender: string;

			if (selectedOption.hasNestedDsl && selectedOption.subOptions && this.selectedSubViewId) {
				// If we have nested DSL and a sub-view is selected, render the sub-view content
				const selectedSubOption = selectedOption.subOptions.find(
					(subOption: ViewOption) => subOption.id === this.selectedSubViewId
				);

				if (selectedSubOption) {
					contentToRender = selectedSubOption.content;
				} else {
					// Sub-view not found, render main view content
					contentToRender = selectedOption.content;
				}
			} else {
				// No nested DSL or no sub-view selected, render main view content
				contentToRender = selectedOption.content;
			}

			await this.renderContent(contentToRender, this.contentEl);
		} catch (error) {
			console.error("Error rendering selected view:", error);
			this.contentEl.empty();
			this.contentEl.createEl("div", {
				text: "Error rendering view content",
				cls: "custom-sidebar-error",
			});
		}
	}

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
	 * Restore cached view selections for the given file path, or set defaults if no cache exists
	 */
	private restoreCachedSelections(filePath: string): void {
		if (!filePath || !this.currentParsedContent?.hasValidDsl) {
			return;
		}

		const cachedSelection = this.viewCache.getViewSelection(filePath);

		if (!cachedSelection) {
			// No cache exists - reset to defaults (first view, first sub-view if available)
			this.selectedViewId =
				this.currentParsedContent.viewOptions.length > 0
					? this.currentParsedContent.viewOptions[0].id
					: null;
			this.selectedSubViewId = null; // Will be set by updateSubViewSelector if needed
			return;
		}

		// Validate that the cached selections are still valid for the current content
		const validMainView = this.currentParsedContent.viewOptions.find(
			(option) => option.id === cachedSelection.selectedViewId
		);

		if (validMainView) {
			this.selectedViewId = cachedSelection.selectedViewId;

			// Check if sub-view selection is also valid
			if (cachedSelection.selectedSubViewId && validMainView.subOptions) {
				const validSubView = validMainView.subOptions.find(
					(subOption) => subOption.id === cachedSelection.selectedSubViewId
				);
				if (validSubView) {
					this.selectedSubViewId = cachedSelection.selectedSubViewId;
				} else {
					// Sub-view no longer exists, reset to first sub-view if available
					this.selectedSubViewId =
						validMainView.subOptions.length > 0 ? validMainView.subOptions[0].id : null;
				}
			} else {
				this.selectedSubViewId = null;
			}
		} else {
			// Main view no longer exists, reset to defaults
			this.selectedViewId =
				this.currentParsedContent.viewOptions.length > 0
					? this.currentParsedContent.viewOptions[0].id
					: null;
			this.selectedSubViewId = null;
		}
	}

	/**
	 * Save current view selections to cache for the given file path
	 */
	private saveCachedSelections(filePath: string): void {
		if (!filePath || !this.currentParsedContent?.hasValidDsl) {
			return;
		}

		// Only cache when we have valid DSL content and at least a main view selection
		if (this.selectedViewId) {
			this.viewCache.setViewSelection(filePath, {
				selectedViewId: this.selectedViewId,
				selectedSubViewId: this.selectedSubViewId,
			});
		}
	}

	// ViewSwitchingManager implementation

	/**
	 * Programmatically switch to a specific view
	 * @param viewId - The main view ID to switch to
	 * @param subViewId - Optional sub-view ID to switch to
	 */
	async switchToView(viewId: string, subViewId?: string): Promise<void> {
		if (!this.currentParsedContent?.hasValidDsl) {
			console.warn("Cannot switch view: No DSL content available");
			return;
		}

		// Validate that the view exists
		const targetView = this.currentParsedContent.viewOptions.find((option) => option.id === viewId);
		if (!targetView) {
			console.warn(`Cannot switch to view: View '${viewId}' not found`);
			return;
		}

		// Validate sub-view if provided
		if (subViewId && targetView.subOptions) {
			const targetSubView = targetView.subOptions.find((subOption) => subOption.id === subViewId);
			if (!targetSubView) {
				console.warn(
					`Cannot switch to sub-view: Sub-view '${subViewId}' not found in view '${viewId}'`
				);
				return;
			}
		}

		// Update selections
		this.selectedViewId = viewId;
		this.selectedSubViewId = subViewId || null;

		// Save to cache
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			this.saveCachedSelections(activeFile.path);
		}

		// Update UI selectors to reflect the new selection
		this.updateViewSelectorValue(viewId);
		this.updateSubViewSelector();
		if (subViewId) {
			this.updateSubViewSelectorValue(subViewId);
		}

		// Update content height in case sub-view selector visibility changed
		this.updateContentHeight();

		// Render the selected view
		await this.renderSelectedView();
	}

	/**
	 * Get current view options available for command generation
	 */
	getCurrentViewOptions(): ViewOption[] {
		return this.currentParsedContent?.viewOptions || [];
	}

	/**
	 * Generate available commands for the current DSL content
	 */
	getAvailableCommands(): DynamicViewCommand[] {
		const commands: DynamicViewCommand[] = [];

		if (!this.currentParsedContent?.hasValidDsl) {
			return commands;
		}

		let commandIndex = 1; // Start from 1 for user-friendly numbering

		// Add commands for main views
		for (let i = 0; i < this.currentParsedContent.viewOptions.length; i++) {
			const viewOption = this.currentParsedContent.viewOptions[i];
			const mainViewIndex = i + 1; // 1-based indexing

			const mainCommand = {
				id: `switch-to-main-${mainViewIndex}`,
				name: `Switch to Main ${mainViewIndex}`,
				viewId: viewOption.id,
				index: commandIndex++,
			};
			commands.push(mainCommand);
		}

		// Add commands for nested views (based on currently selected main view)
		const currentMainView = this.getCurrentMainView();
		if (currentMainView?.hasNestedDsl && currentMainView.subOptions) {
			for (let j = 0; j < currentMainView.subOptions.length; j++) {
				const subOption = currentMainView.subOptions[j];
				const nestedViewIndex = j + 1; // 1-based indexing

				const nestedCommand = {
					id: `switch-to-nested-${nestedViewIndex}`,
					name: `Switch to Nested ${nestedViewIndex}`,
					viewId: currentMainView.id,
					subViewId: subOption.id,
					index: commandIndex++,
				};
				commands.push(nestedCommand);
			}
		}
		return commands;
	}

	/**
	 * Get the currently selected main view option
	 */
	private getCurrentMainView(): ViewOption | null {
		if (!this.currentParsedContent?.hasValidDsl || !this.selectedViewId) {
			return null;
		}

		return (
			this.currentParsedContent.viewOptions.find((option) => option.id === this.selectedViewId) ||
			null
		);
	}

	/**
	 * Update the main view selector to show the specified value
	 */
	private updateViewSelectorValue(viewId: string): void {
		if (!this.viewSelectorEl) return;

		const selectEl = this.viewSelectorEl.querySelector("select");
		if (selectEl) {
			selectEl.value = viewId;
		}
	}

	/**
	 * Update the sub-view selector to show the specified value
	 */
	private updateSubViewSelectorValue(subViewId: string): void {
		if (!this.subViewSelectorEl) return;

		const selectEl = this.subViewSelectorEl.querySelector("select");
		if (selectEl) {
			selectEl.value = subViewId;
		}
	}
}
