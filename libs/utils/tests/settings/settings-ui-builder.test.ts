/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { SettingsStore } from "../../src/settings/settings-store";
import { SettingsUIBuilder } from "../../src/settings/settings-ui-builder";

// Mock Obsidian
vi.mock("obsidian", () => {
	class MockSetting {
		nameEl: HTMLElement | null = null;
		descEl: HTMLElement | null = null;

		constructor(public containerEl: HTMLElement) {
			this.containerEl = containerEl;
		}

		setName(name: string): this {
			this.nameEl = document.createElement("div");
			this.nameEl.textContent = name;
			this.nameEl.className = "setting-item-name";
			this.containerEl.appendChild(this.nameEl);
			return this;
		}

		setDesc(desc: string): this {
			this.descEl = document.createElement("div");
			this.descEl.textContent = desc;
			this.descEl.className = "setting-item-description";
			this.containerEl.appendChild(this.descEl);
			return this;
		}

		setHeading(): this {
			this.containerEl.classList.add("setting-item-heading");
			return this;
		}

		addToggle(callback: (toggle: any) => void): this {
			const toggle = {
				toggleEl: document.createElement("input"),
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			toggle.toggleEl.type = "checkbox";
			toggle.toggleEl.className = "checkbox-toggle";
			this.containerEl.appendChild(toggle.toggleEl);

			// Wire up onChange to actually update the checkbox
			toggle.onChange.mockImplementation((handler: (value: boolean) => void) => {
				toggle.toggleEl.addEventListener("change", () => {
					const value = (toggle.toggleEl as HTMLInputElement).checked;
					handler(value);
				});
				return toggle;
			});

			callback(toggle);
			return this;
		}

		addSlider(callback: (slider: any) => void): this {
			const slider = {
				sliderEl: document.createElement("input"),
				setLimits: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
				setDynamicTooltip: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			slider.sliderEl.type = "range";
			slider.sliderEl.className = "slider";
			this.containerEl.appendChild(slider.sliderEl);

			// Wire up setLimits to actually set attributes
			slider.setLimits.mockImplementation((min: number, max: number, step: number) => {
				slider.sliderEl.min = String(min);
				slider.sliderEl.max = String(max);
				slider.sliderEl.step = String(step);
				return slider;
			});

			// Wire up setValue to actually set value
			slider.setValue.mockImplementation((value: number) => {
				slider.sliderEl.value = String(value);
				return slider;
			});

			// Wire up onChange to actually trigger on input
			slider.onChange.mockImplementation((handler: (value: number) => void) => {
				slider.sliderEl.addEventListener("input", () => {
					const value = Number((slider.sliderEl as HTMLInputElement).value);
					handler(value);
				});
				return slider;
			});

			callback(slider);
			return this;
		}

		addText(callback: (text: any) => void): this {
			const text = {
				inputEl: document.createElement("input"),
				setPlaceholder: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis(),
			};
			text.inputEl.type = "text";
			text.inputEl.className = "text-input";
			this.containerEl.appendChild(text.inputEl);

			// Wire up setPlaceholder
			text.setPlaceholder.mockImplementation((placeholder: string) => {
				text.inputEl.placeholder = placeholder;
				return text;
			});

			// Wire up setValue
			text.setValue.mockImplementation((value: string) => {
				text.inputEl.value = value;
				return text;
			});

			// Wire up onChange to actually trigger on input
			text.onChange.mockImplementation((handler: (value: string) => void) => {
				text.inputEl.addEventListener("input", () => {
					handler(text.inputEl.value);
				});
				return text;
			});

			callback(text);
			return this;
		}

		addTextArea(callback: (text: any) => void): this {
			const text = {
				inputEl: document.createElement("textarea"),
				setPlaceholder: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
			};
			text.inputEl.className = "textarea-input";
			this.containerEl.appendChild(text.inputEl);

			// Wire up setPlaceholder
			text.setPlaceholder.mockImplementation((placeholder: string) => {
				text.inputEl.placeholder = placeholder;
				return text;
			});

			// Wire up setValue
			text.setValue.mockImplementation((value: string) => {
				text.inputEl.value = value;
				return text;
			});

			callback(text);
			return this;
		}

		addButton(callback: (button: any) => void): this {
			const button = {
				buttonEl: document.createElement("button"),
				setButtonText: vi.fn().mockReturnThis(),
				setCta: vi.fn().mockReturnThis(),
				setWarning: vi.fn().mockReturnThis(),
				onClick: vi.fn().mockReturnThis(),
				setDisabled: vi.fn().mockReturnThis(),
			};
			button.buttonEl.className = "button";
			this.containerEl.appendChild(button.buttonEl);

			// Wire up setButtonText
			button.setButtonText.mockImplementation((text: string) => {
				button.buttonEl.textContent = text;
				return button;
			});

			// Wire up onClick
			button.onClick.mockImplementation((handler: () => void) => {
				button.buttonEl.addEventListener("click", handler);
				return button;
			});

			// Wire up setDisabled
			button.setDisabled.mockImplementation((disabled: boolean) => {
				button.buttonEl.disabled = disabled;
				return button;
			});

			callback(button);
			return this;
		}
	}

	return {
		Setting: MockSetting,
		Plugin: vi.fn(),
	};
});

// Test schema
const TestSchema = z.object({
	enabled: z.boolean().default(false),
	maxItems: z.number().default(10),
	username: z.string().default(""),
	tags: z.array(z.string()).default([]),
	directories: z.array(z.string()).default(["*"]),
});

describe("SettingsUIBuilder", () => {
	let container: HTMLElement;
	let settingsStore: SettingsStore<typeof TestSchema>;
	let uiBuilder: SettingsUIBuilder<typeof TestSchema>;

	beforeEach(() => {
		// Setup DOM environment
		document.body.innerHTML = "";
		container = document.createElement("div");

		// Helper to add Obsidian-specific methods to HTMLElements
		const addObsidianMethods = (el: HTMLElement) => {
			(el as any).createDiv = function (cls?: string) {
				const div = document.createElement("div");
				if (cls) div.className = cls;
				addObsidianMethods(div);
				this.appendChild(div);
				return div;
			};
			(el as any).createEl = function (tag: string, options?: any) {
				const element = document.createElement(tag);
				if (options?.text) element.textContent = options.text;
				if (options?.cls) element.className = options.cls;
				addObsidianMethods(element);
				this.appendChild(element);
				return element;
			};
			(el as any).empty = function () {
				this.innerHTML = "";
			};
			(el as any).setText = function (text: string) {
				this.textContent = text;
			};
		};

		addObsidianMethods(container);
		document.body.appendChild(container);

		// Create mock plugin
		const mockPlugin = {
			loadData: vi.fn().mockResolvedValue({}),
			saveData: vi.fn().mockResolvedValue(undefined),
		} as any;

		// Create settings store with test schema
		settingsStore = new SettingsStore(mockPlugin, TestSchema);

		// Create UI builder
		uiBuilder = new SettingsUIBuilder(settingsStore);
	});

	describe("addToggle", () => {
		it("should create a toggle with correct initial value", () => {
			uiBuilder.addToggle(container, {
				key: "enabled",
				name: "Enable Feature",
				desc: "Turn this feature on or off",
			});

			const toggle = container.querySelector(".checkbox-toggle") as HTMLInputElement;
			expect(toggle).toBeDefined();
			expect(toggle.checked).toBe(false);
		});

		it("should update settings when toggle changes", async () => {
			uiBuilder.addToggle(container, {
				key: "enabled",
				name: "Enable Feature",
				desc: "Turn this feature on or off",
			});

			const toggle = container.querySelector(".checkbox-toggle") as HTMLInputElement;
			toggle.checked = true;
			toggle.dispatchEvent(new Event("change"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.enabled).toBe(true);
		});
	});

	describe("addSlider", () => {
		it("should create a slider with correct initial value and limits", () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			expect(slider).toBeDefined();
			expect(slider.value).toBe("10");
			expect(slider.min).toBe("0");
			expect(slider.max).toBe("100");
			expect(slider.step).toBe("5");
		});

		it("should update settings when slider changes (commit on blur by default)", async () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			slider.value = "50";
			slider.dispatchEvent(new Event("mouseup"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(50);
		});

		it("should update settings on every change when commitOnChange is true", async () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
				min: 0,
				max: 100,
				step: 5,
				commitOnChange: true,
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			slider.value = "50";
			slider.dispatchEvent(new Event("input"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.maxItems).toBe(50);
		});

		it("should use default limits if not specified", () => {
			uiBuilder.addSlider(container, {
				key: "maxItems",
				name: "Max Items",
				desc: "Maximum number of items",
			});

			const slider = container.querySelector(".slider") as HTMLInputElement;
			expect(slider.min).toBe("0");
			expect(slider.max).toBe("100");
			expect(slider.step).toBe("1");
		});
	});

	describe("addText", () => {
		it("should create a text input with correct initial value", () => {
			// Set initial value
			settingsStore.updateSettings((s) => ({ ...s, username: "testuser" }));

			uiBuilder.addText(container, {
				key: "username",
				name: "Username",
				desc: "Your username",
				placeholder: "Enter username",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			expect(input).toBeDefined();
			expect(input.value).toBe("testuser");
			expect(input.placeholder).toBe("Enter username");
		});

		it("should update settings when text changes (commit on blur by default)", async () => {
			uiBuilder.addText(container, {
				key: "username",
				name: "Username",
				desc: "Your username",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "newuser";
			input.dispatchEvent(new Event("blur"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.username).toBe("newuser");
		});

		it("should update settings on every change when commitOnChange is true", async () => {
			uiBuilder.addText(container, {
				key: "username",
				name: "Username",
				desc: "Your username",
				commitOnChange: true,
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "newuser";
			input.dispatchEvent(new Event("input"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.username).toBe("newuser");
		});
	});

	describe("addTextArray", () => {
		it("should create a text input for simple array", () => {
			settingsStore.updateSettings((s) => ({ ...s, tags: ["tag1", "tag2"] }));

			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				arrayDelimiter: ", ",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			expect(input).toBeDefined();
			expect(input.value).toBe("tag1, tag2");
		});

		it("should create a textarea for multiline array", () => {
			settingsStore.updateSettings((s) => ({ ...s, tags: ["tag1", "tag2", "tag3"] }));

			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				multiline: true,
			});

			const textarea = container.querySelector(".textarea-input") as HTMLTextAreaElement;
			expect(textarea).toBeDefined();
			expect(textarea.value).toBe("tag1\ntag2\ntag3");
		});

		it("should update settings when array text changes (commit on blur by default)", async () => {
			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "new1, new2, new3";
			input.dispatchEvent(new Event("blur"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.tags).toEqual(["new1", "new2", "new3"]);
		});

		it("should update settings on every change when commitOnChange is true", async () => {
			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				commitOnChange: true,
			});

			const input = container.querySelector(".text-input") as HTMLInputElement;
			input.value = "new1, new2, new3";
			input.dispatchEvent(new Event("input"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.tags).toEqual(["new1", "new2", "new3"]);
		});

		it("should handle multiline array updates on blur", async () => {
			uiBuilder.addTextArray(container, {
				key: "tags",
				name: "Tags",
				desc: "List of tags",
				multiline: true,
			});

			const textarea = container.querySelector(".textarea-input") as HTMLTextAreaElement;
			textarea.value = "line1\nline2\nline3";
			textarea.dispatchEvent(new Event("blur"));

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.tags).toEqual(["line1", "line2", "line3"]);
		});
	});

	describe("addArrayManager", () => {
		it("should render existing array items with remove buttons", () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1", "dir2"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
			});

			const items = container.querySelectorAll(".settings-array-manager-list .setting-item-name");
			expect(items.length).toBe(2);
			expect(items[0].textContent).toBe("dir1");
			expect(items[1].textContent).toBe("dir2");

			const removeButtons = container.querySelectorAll(".settings-array-manager-list .button");
			expect(removeButtons.length).toBe(2);
		});

		it("should add new items when add button is clicked", async () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
			});

			const input = container.querySelector("input[type='text']") as HTMLInputElement;
			const addButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Add"
			) as HTMLButtonElement;

			input.value = "dir2";
			addButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["dir1", "dir2"]);
		});

		it("should remove items when remove button is clicked", async () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1", "dir2"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
			});

			const removeButtons = container.querySelectorAll(".settings-array-manager-list .button");
			const firstRemoveButton = removeButtons[0] as HTMLButtonElement;

			firstRemoveButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["dir2"]);
		});

		it("should prevent empty array when preventEmpty is true", async () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				preventEmpty: true,
				emptyArrayFallback: ["*"],
			});

			const removeButton = container.querySelector(
				".settings-array-manager-list .button"
			) as HTMLButtonElement;
			removeButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["*"]);
		});

		it("should apply onBeforeAdd callback", async () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				onBeforeAdd: (newItem, currentItems) => {
					// Remove "*" when adding specific directory
					return [...currentItems.filter((i) => i !== "*"), newItem];
				},
			});

			// First set directories to include "*"
			await settingsStore.updateSettings((s) => ({ ...s, directories: ["*"] }));

			const input = container.querySelector("input[type='text']") as HTMLInputElement;
			const addButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Add"
			) as HTMLButtonElement;

			input.value = "specific-dir";
			addButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["specific-dir"]);
		});

		it("should render quick actions", () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				quickActions: [
					{
						name: "Reset to default",
						desc: "Reset to scan all",
						buttonText: "Reset",
						action: () => ["*"],
					},
				],
			});

			const resetButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Reset"
			) as HTMLButtonElement;

			expect(resetButton).toBeDefined();
		});

		it("should execute quick actions", async () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["dir1", "dir2"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				quickActions: [
					{
						name: "Reset to default",
						desc: "Reset to scan all",
						buttonText: "Reset",
						action: () => ["*"],
					},
				],
			});

			const resetButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Reset"
			) as HTMLButtonElement;

			resetButton.click();

			// Wait for async update
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(settingsStore.currentSettings.directories).toEqual(["*"]);
		});

		it("should respect quick action conditions", () => {
			settingsStore.updateSettings((s) => ({ ...s, directories: ["*"] }));

			uiBuilder.addArrayManager(container, {
				key: "directories",
				name: "Directories",
				desc: "Manage directories",
				quickActions: [
					{
						name: "Reset to default",
						desc: "Reset to scan all",
						buttonText: "Reset",
						condition: (items) => !items.includes("*"),
						action: () => ["*"],
					},
				],
			});

			const resetButton = Array.from(container.querySelectorAll(".button")).find(
				(btn) => btn.textContent === "Reset"
			) as HTMLButtonElement;

			// Should not render because condition is false (already has "*")
			expect(resetButton).toBeUndefined();
		});
	});
});
