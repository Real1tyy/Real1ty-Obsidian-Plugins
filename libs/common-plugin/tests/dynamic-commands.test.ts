import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarManager } from "../src/sidebar-manager";
import type { BaseWatchdogSettings, SidebarRuntimeState } from "../src/types";

// Mock Obsidian modules
vi.mock("obsidian", () => ({
	MarkdownRenderer: {
		render: vi.fn().mockResolvedValue(undefined),
	},
}));

// Helper to create mock DOM element with Obsidian methods
function createMockElement(tag = "div"): HTMLElement {
	const element = originalCreateElement.call(document, tag);
	// Add Obsidian-specific methods
	(element as any).addClass = vi.fn();
	(element as any).removeClass = vi.fn();
	(element as any).empty = vi.fn(() => {
		element.innerHTML = "";
	});
	(element as any).createEl = vi.fn((tag: string, attrs?: any) => {
		const child = createMockElement(tag);
		if (attrs?.text) child.textContent = attrs.text;
		if (attrs?.cls) child.className = attrs.cls;
		element.appendChild(child);
		return child;
	});
	(element as any).createDiv = vi.fn((attrs?: any) => {
		return (element as any).createEl("div", attrs);
	});
	return element;
}

// Store original createElement before mocking
const originalCreateElement = document.createElement;

// Mock document.createElement to return mock elements
beforeEach(() => {
	document.createElement = vi.fn((tag: string) => createMockElement(tag));
});

afterEach(() => {
	document.createElement = originalCreateElement;
});

describe("Dynamic Commands", () => {
	let sidebarManager: SidebarManager;
	let mockApp: any;
	let mockComponent: any;
	let mockGetSettings: () => BaseWatchdogSettings;
	let mockRuntimeState: SidebarRuntimeState;

	beforeEach(() => {
		mockApp = {
			workspace: {
				getActiveFile: vi.fn().mockReturnValue({
					path: "Goals/test.md",
				}),
			},
		};

		mockComponent = {
			registerDomEvent: vi.fn(),
		};

		mockGetSettings = vi.fn().mockReturnValue({
			directoryMappings: [
				{
					id: "1",
					directoryPath: "Goals",
					content: `
\`\`\`CommandType Tasks
![[Projects-Tasks.base]]
\`\`\`

\`\`\`CommandType Notes
\`\`\`CommandType SubNote1
![[Projects-SubNote1.base]]
\`\`\`

\`\`\`CommandType SubNote2
![[Projects-SubNote2.base]]
\`\`\`
\`\`\`
					`.trim(),
				},
			],
		});

		mockRuntimeState = {
			isVisible: true,
			currentWidth: 300,
		};

		sidebarManager = new SidebarManager(mockApp, mockRuntimeState, mockComponent, mockGetSettings, {
			side: "left",
		});
	});

	describe("getAvailableCommands", () => {
		it("should return empty array when no DSL content", () => {
			const commands = sidebarManager.getAvailableCommands();
			expect(commands).toEqual([]);
		});

		it("should generate commands for main views and nested views", async () => {
			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			const initialCommands = testSidebarManager.getAvailableCommands();

			// Initially should have 2 main commands (no nested commands since "tasks" has no sub-views)
			expect(initialCommands).toHaveLength(2);

			// Check main view commands
			expect(initialCommands[0]).toEqual({
				id: "switch-to-main-1",
				name: "Switch to Main 1",
				viewId: "tasks",
				index: 1,
			});

			expect(initialCommands[1]).toEqual({
				id: "switch-to-main-2",
				name: "Switch to Main 2",
				viewId: "notes",
				index: 2,
			});

			// Switch to "notes" which has nested views
			await testSidebarManager.switchToView("notes");

			const commandsAfterSwitch = testSidebarManager.getAvailableCommands();
			expect(commandsAfterSwitch).toHaveLength(4); // 2 main + 2 nested

			// Check that we still have the main commands
			const mainCommands = commandsAfterSwitch.filter((cmd) => cmd.id.startsWith("switch-to-main"));
			expect(mainCommands).toHaveLength(2);

			// Find the nested commands
			const nestedCommands = commandsAfterSwitch.filter((cmd) =>
				cmd.id.startsWith("switch-to-nested")
			);
			expect(nestedCommands).toHaveLength(2);

			expect(nestedCommands[0]).toEqual({
				id: "switch-to-nested-1",
				name: "Switch to Nested 1",
				viewId: "notes",
				subViewId: "subnote1",
				index: 3,
			});

			expect(nestedCommands[1]).toEqual({
				id: "switch-to-nested-2",
				name: "Switch to Nested 2",
				viewId: "notes",
				subViewId: "subnote2",
				index: 4,
			});
		});

		it("should generate separate main and nested command sets", async () => {
			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			// Switch to notes view to get nested commands
			await testSidebarManager.switchToView("notes");

			const commands = testSidebarManager.getAvailableCommands();

			// Should have main commands with consistent naming
			const mainCommands = commands.filter((cmd) => cmd.id.startsWith("switch-to-main"));
			expect(mainCommands.every((cmd) => cmd.name.startsWith("Switch to Main"))).toBe(true);

			// Should have nested commands with consistent naming
			const nestedCommands = commands.filter((cmd) => cmd.id.startsWith("switch-to-nested"));
			expect(nestedCommands.every((cmd) => cmd.name.startsWith("Switch to Nested"))).toBe(true);

			// Nested commands should all reference the same main view
			expect(nestedCommands.every((cmd) => cmd.viewId === "notes")).toBe(true);

			// Each nested command should have different subViewIds
			const subViewIds = nestedCommands.map((cmd) => cmd.subViewId);
			expect(new Set(subViewIds).size).toBe(subViewIds.length); // All unique
		});
	});

	describe("switchToView", () => {
		it("should switch to main view successfully", async () => {
			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			// Switch to Tasks view
			await testSidebarManager.switchToView("tasks");

			const currentOptions = testSidebarManager.getCurrentViewOptions();
			expect(currentOptions).toHaveLength(2);
			expect(currentOptions[0].id).toBe("tasks");
		});

		it("should switch to sub-view successfully", async () => {
			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			// Switch to Notes -> SubNote1
			await testSidebarManager.switchToView("notes", "subnote1");

			const currentOptions = testSidebarManager.getCurrentViewOptions();
			expect(currentOptions).toHaveLength(2);
			expect(currentOptions[1].id).toBe("notes");
		});

		it("should warn when switching to non-existent view", async () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			// Try to switch to non-existent view
			await testSidebarManager.switchToView("nonexistent");

			expect(consoleSpy).toHaveBeenCalledWith(
				"Cannot switch to view: View 'nonexistent' not found"
			);

			consoleSpy.mockRestore();
		});

		it("should warn when switching to non-existent sub-view", async () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			// Try to switch to non-existent sub-view
			await testSidebarManager.switchToView("notes", "nonexistent");

			expect(consoleSpy).toHaveBeenCalledWith(
				"Cannot switch to sub-view: Sub-view 'nonexistent' not found in view 'notes'"
			);

			consoleSpy.mockRestore();
		});

		it("should warn when no DSL content available", async () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Try to switch view without DSL content
			await sidebarManager.switchToView("tasks");

			expect(consoleSpy).toHaveBeenCalledWith("Cannot switch view: No DSL content available");

			consoleSpy.mockRestore();
		});
	});

	describe("getCurrentViewOptions", () => {
		it("should return empty array when no DSL content", () => {
			const options = sidebarManager.getCurrentViewOptions();
			expect(options).toEqual([]);
		});

		it("should return parsed view options when DSL content exists", async () => {
			// Create a container element for embedded mode with Obsidian methods
			const containerEl = createMockElement();

			// Create a new sidebar manager with the container
			const testSidebarManager = new SidebarManager(
				mockApp,
				mockRuntimeState,
				mockComponent,
				mockGetSettings,
				{ side: "left" },
				containerEl
			);

			// Show the sidebar to initialize elements
			testSidebarManager.show();

			// Trigger content update to parse DSL
			await testSidebarManager.updateContent();

			const options = testSidebarManager.getCurrentViewOptions();
			expect(options).toHaveLength(2);
			expect(options[0].id).toBe("tasks");
			expect(options[1].id).toBe("notes");
			expect(options[1].hasNestedDsl).toBe(true);
			expect(options[1].subOptions).toHaveLength(2);
		});
	});
});
