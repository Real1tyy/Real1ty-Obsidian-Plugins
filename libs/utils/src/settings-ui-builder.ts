import { Setting } from "obsidian";
import type { ZodObject, ZodRawShape, z } from "zod";
import type { SettingsStore } from "./settings-store";

interface BaseSettingConfig {
	key: string;
	name: string;
	desc: string;
}

interface TextSettingConfig extends BaseSettingConfig {
	placeholder?: string;
}

interface SliderSettingConfig extends BaseSettingConfig {
	min?: number;
	max?: number;
	step?: number;
}

interface ArraySettingConfig extends BaseSettingConfig {
	placeholder?: string;
	arrayDelimiter?: string;
	multiline?: boolean;
}

interface ArrayManagerConfig extends BaseSettingConfig {
	placeholder?: string;
	addButtonText?: string;
	removeButtonText?: string;
	emptyArrayFallback?: unknown;
	preventEmpty?: boolean;
	itemDescriptionFn?: (item: unknown) => string;
	onBeforeAdd?: (newItem: unknown, currentItems: unknown[]) => unknown[] | Promise<unknown[]>;
	onBeforeRemove?: (
		itemToRemove: unknown,
		currentItems: unknown[]
	) => unknown[] | Promise<unknown[]>;
	quickActions?: Array<{
		name: string;
		desc: string;
		buttonText: string;
		condition?: (currentItems: unknown[]) => boolean;
		action: (currentItems: unknown[]) => unknown[] | Promise<unknown[]>;
	}>;
}

export class SettingsUIBuilder<TSchema extends ZodObject<ZodRawShape>> {
	constructor(private settingsStore: SettingsStore<TSchema>) {}

	private get settings(): z.infer<TSchema> {
		return this.settingsStore.currentSettings;
	}

	private async updateSetting(key: keyof z.infer<TSchema>, value: unknown): Promise<void> {
		await this.settingsStore.updateSettings(
			(s) =>
				({
					...s,
					[key]: value,
				}) as z.infer<TSchema>
		);
	}

	addToggle(containerEl: HTMLElement, config: BaseSettingConfig): void {
		const { key, name, desc } = config;
		const value = this.settings[key as keyof z.infer<TSchema>];

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(Boolean(value)).onChange(async (newValue) => {
					await this.updateSetting(key as keyof z.infer<TSchema>, newValue);
				})
			);
	}

	addSlider(containerEl: HTMLElement, config: SliderSettingConfig): void {
		const { key, name, desc, min = 0, max = 100, step = 1 } = config;
		const value = this.settings[key as keyof z.infer<TSchema>];

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) => {
				slider
					.setLimits(min, max, step)
					.setValue(Number(value))
					.setDynamicTooltip()
					.onChange(async (newValue) => {
						await this.updateSetting(key as keyof z.infer<TSchema>, newValue);
					});

				return slider;
			});
	}

	addText(containerEl: HTMLElement, config: TextSettingConfig): void {
		const { key, name, desc, placeholder = "" } = config;
		const value = this.settings[key as keyof z.infer<TSchema>];

		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(String(value ?? ""))
					.onChange(async (newValue) => {
						await this.updateSetting(key as keyof z.infer<TSchema>, newValue);
					})
			);
	}

	addTextArray(containerEl: HTMLElement, config: ArraySettingConfig): void {
		const { key, name, desc, placeholder = "", arrayDelimiter = ", ", multiline = false } = config;
		const value = this.settings[key as keyof z.infer<TSchema>] as string[];

		const setting = new Setting(containerEl).setName(name).setDesc(desc);

		if (multiline) {
			setting.addTextArea((text) => {
				text.setPlaceholder(placeholder);
				text.setValue(Array.isArray(value) ? value.join("\n") : "");

				const commit = async (inputValue: string) => {
					const items = inputValue
						.split("\n")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					await this.updateSetting(key as keyof z.infer<TSchema>, items);
				};

				text.inputEl.addEventListener("blur", () => void commit(text.inputEl.value));
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						void commit(text.inputEl.value);
					}
				});

				text.inputEl.rows = 5;
				text.inputEl.classList.add("settings-ui-builder-textarea");
			});
		} else {
			setting.addText((text) => {
				text.setPlaceholder(placeholder);
				text.setValue(Array.isArray(value) ? value.join(arrayDelimiter) : "");
				text.onChange(async (inputValue) => {
					const items = inputValue
						.split(",")
						.map((s) => s.trim())
						.filter((s) => s.length > 0);
					await this.updateSetting(key as keyof z.infer<TSchema>, items);
				});
			});
		}
	}

	/**
	 * Advanced array manager with add/remove buttons for each item
	 * Similar to the directory settings pattern
	 */
	addArrayManager(containerEl: HTMLElement, config: ArrayManagerConfig): void {
		const {
			key,
			name,
			desc,
			placeholder = "",
			addButtonText = "Add",
			removeButtonText = "Remove",
			emptyArrayFallback = [],
			preventEmpty = false,
			itemDescriptionFn,
			onBeforeAdd,
			onBeforeRemove,
			quickActions = [],
		} = config;

		// Section heading
		new Setting(containerEl).setName(name).setHeading();

		// Description
		if (desc) {
			const descEl = containerEl.createDiv("setting-item-description");
			descEl.setText(desc);
		}

		// Container for list items
		const listContainer = containerEl.createDiv("settings-array-manager-list");

		const render = () => {
			listContainer.empty();

			const currentItems = (this.settings[key as keyof z.infer<TSchema>] as unknown[]) ?? [];

			for (const item of currentItems) {
				const itemSetting = new Setting(listContainer).setName(String(item)).addButton((button) =>
					button
						.setButtonText(removeButtonText)
						.setWarning()
						.onClick(async () => {
							let newItems = currentItems.filter((i) => i !== item);

							// Apply custom logic before removal
							if (onBeforeRemove) {
								newItems = await onBeforeRemove(item, currentItems);
							}

							// Prevent empty array if configured
							if (preventEmpty && newItems.length === 0) {
								newItems = Array.isArray(emptyArrayFallback)
									? emptyArrayFallback
									: [emptyArrayFallback];
							}

							await this.updateSetting(key as keyof z.infer<TSchema>, newItems);
							render();
						})
				);

				// Add custom description for each item if provided
				if (itemDescriptionFn) {
					itemSetting.setDesc(itemDescriptionFn(item));
				}
			}
		};

		render();

		// Add new item section
		const inputId = `settings-array-manager-input-${key}`;
		new Setting(containerEl)
			.setName(`Add ${name.toLowerCase()}`)
			.setDesc(`Enter a new value`)
			.addText((text) => {
				text.setPlaceholder(placeholder);
				text.inputEl.id = inputId;
			})
			.addButton((button) =>
				button
					.setButtonText(addButtonText)
					.setCta()
					.onClick(async () => {
						const input = containerEl.querySelector(`#${inputId}`) as HTMLInputElement;
						const newItem = input.value.trim();

						if (!newItem) {
							return;
						}

						const currentItems = (this.settings[key as keyof z.infer<TSchema>] as unknown[]) ?? [];
						let newItems = [...currentItems];

						// Apply custom logic before adding
						if (onBeforeAdd) {
							newItems = await onBeforeAdd(newItem, currentItems);
						} else {
							// Default behavior: add if not exists
							if (!newItems.includes(newItem)) {
								newItems.push(newItem);
							}
						}

						await this.updateSetting(key as keyof z.infer<TSchema>, newItems);
						input.value = "";
						render();
					})
			);

		// Quick actions
		for (const quickAction of quickActions) {
			const currentItems = (this.settings[key as keyof z.infer<TSchema>] as unknown[]) ?? [];

			// Check condition if provided
			if (quickAction.condition && !quickAction.condition(currentItems)) {
				continue;
			}

			new Setting(containerEl)
				.setName(quickAction.name)
				.setDesc(quickAction.desc)
				.addButton((button) =>
					button.setButtonText(quickAction.buttonText).onClick(async () => {
						const currentItems = (this.settings[key as keyof z.infer<TSchema>] as unknown[]) ?? [];
						const newItems = await quickAction.action(currentItems);
						await this.updateSetting(key as keyof z.infer<TSchema>, newItems);
						render();
					})
				);
		}
	}

	/**
	 * Automatically detect the type from current value and create appropriate control
	 */
	auto(
		containerEl: HTMLElement,
		config: TextSettingConfig & SliderSettingConfig & ArraySettingConfig
	): void {
		const value = this.settings[config.key as keyof z.infer<TSchema>];

		// Detect type from current value
		if (typeof value === "boolean") {
			this.addToggle(containerEl, config);
		} else if (typeof value === "number") {
			this.addSlider(containerEl, config);
		} else if (typeof value === "string") {
			this.addText(containerEl, config);
		} else if (Array.isArray(value)) {
			this.addTextArray(containerEl, config);
		} else {
			console.warn(`Unsupported value type for key ${config.key}: ${typeof value}`);
		}
	}
}
