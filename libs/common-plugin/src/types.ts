import type { View, WorkspaceLeaf } from "obsidian";

export interface DirectoryMapping {
	id: string;
	directoryPath: string;
	content: string;
}

export interface ViewOption {
	id: string;
	label: string;
	content: string;
	subOptions?: ViewOption[]; // Support for nested sub-options
	hasNestedDsl?: boolean; // Indicates if this option contains nested DSL
}

export interface ParsedDslContent {
	viewOptions: ViewOption[];
	hasValidDsl: boolean;
}

export interface BaseWatchdogSettings {
	directoryMappings: DirectoryMapping[];
	showRibbonIcon: boolean;
}

export interface SidebarRuntimeState {
	isVisible: boolean;
	currentWidth: number;
}

export interface WatchdogViewConfig {
	viewType: string;
	displayName: string;
	ribbonIcon: string;
	ribbonTooltip: string;
	commandId: string;
	commandName: string;
	sidebarSide: "left" | "right";
}

export type ContentRenderCallback = (content: string, filePath: string) => void;

export interface WatchdogView extends View {
	updateContent(): Promise<void>;
	getViewSwitchingManager?(): ViewSwitchingManager | null;
}

export type ViewFactory<T extends WatchdogView> = (
	leaf: WorkspaceLeaf,
	getSettings: () => BaseWatchdogSettings
) => T;

export interface ViewSelectionCache {
	selectedViewId: string | null;
	selectedSubViewId: string | null;
}

export interface ViewCacheManager {
	getViewSelection(filePath: string): ViewSelectionCache | null;
	setViewSelection(filePath: string, selection: ViewSelectionCache): void;
	clearCache(): void;
	hasCache(filePath: string): boolean;
}

export interface DynamicViewCommand {
	id: string;
	name: string;
	viewId: string;
	subViewId?: string;
	index: number;
}

export interface ViewSwitchingManager {
	switchToView(viewId: string, subViewId?: string): Promise<void>;
	getCurrentViewOptions(): ViewOption[];
	getAvailableCommands(): DynamicViewCommand[];
}
