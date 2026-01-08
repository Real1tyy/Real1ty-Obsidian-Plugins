import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplaterService } from "../../src/file/templater-service";

describe("TemplaterService", () => {
	let mockApp: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockApp = {
			vault: {
				create: vi.fn().mockResolvedValue({ path: "test.md", basename: "test" }),
				getFileByPath: vi.fn().mockReturnValue(null),
				getAbstractFileByPath: vi.fn().mockReturnValue(null),
			},
			fileManager: {
				processFrontMatter: vi.fn().mockResolvedValue(undefined),
			},
		};
	});

	describe("createFile with content", () => {
		it("should apply frontmatter when creating file with content", async () => {
			const service = new TemplaterService(mockApp);

			const frontmatter = {
				"Start Date": "2025-11-20T20:00:00.000Z",
				"End Date": "2025-11-20T20:20:00.000Z",
				RRuleID: "test-123",
				"Recurring Instance Date": "2025-11-20",
			};

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				filename: "Test Event 2025-11-20-12345678901234",
				content: "# Test Event\n\nEvent content here",
				frontmatter,
			});

			// Verify file was created with frontmatter atomically (no separate processFrontMatter call)
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [filePath, fileContent] = mockApp.vault.create.mock.calls[0];

			expect(filePath).toContain("Test Event");
			// File content should include YAML frontmatter
			expect(fileContent).toContain("---");
			expect(fileContent).toContain("Start Date: 2025-11-20T20:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-11-20T20:20:00.000Z");
			expect(fileContent).toContain("RRuleID: test-123");
			expect(fileContent).toContain("Recurring Instance Date: 2025-11-20");
			expect(fileContent).toContain("# Test Event");
			expect(fileContent).toContain("Event content here");

			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("should preserve UTC Z suffix in timestamps", async () => {
			const service = new TemplaterService(mockApp);

			const frontmatter = {
				"Start Date": "2025-09-29T20:00:00.000Z",
				"End Date": "2025-09-29T20:20:00.000Z",
			};

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				content: "Event body",
				frontmatter,
			});

			// Verify file was created with frontmatter atomically
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];

			// Verify Z suffix is preserved (not converted to +01:00 or other local offset)
			expect(fileContent).toContain("Start Date: 2025-09-29T20:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-09-29T20:20:00.000Z");
		});

		it("should not apply frontmatter if not provided", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				content: "Event body",
			});

			// Verify file was created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);

			// Verify frontmatter was NOT applied (no frontmatter provided)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("should not apply frontmatter if empty object", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFile({
				title: "Test Event",
				targetDirectory: "Calendar",
				content: "Event body",
				frontmatter: {},
			});

			// Verify file was created
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);

			// Verify frontmatter was NOT applied (empty frontmatter)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});

		it("should apply all frontmatter properties correctly", async () => {
			const service = new TemplaterService(mockApp);

			const frontmatter = {
				"Start Date": "2025-11-20T19:00:00.000Z",
				"End Date": "2025-11-20T19:20:00.000Z",
				"All Day": false,
				RRuleID: "1730000000000-abc12",
				"Recurring Instance Date": "2025-11-20",
				Source: "[[Recurring Event Source]]",
				Goal: ["[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]"],
				"Backlink Tags": [
					"[[Tags/Obsidian|Obsidian]]",
					"[[Tags/Remarkable|Remarkable]]",
					"[[Tags/Productivity|Productivity]]",
				],
			};

			await service.createFile({
				title: "Physical Event",
				targetDirectory: "Calendar",
				filename: "Physical Event 2025-11-20-12345678901234",
				content: "# Physical Event\n\nBody content",
				frontmatter,
			});

			// Verify file was created with all frontmatter atomically
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];

			// Verify all properties are in the file content
			expect(fileContent).toContain("Start Date: 2025-11-20T19:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-11-20T19:20:00.000Z");
			expect(fileContent).toContain("All Day: false");
			expect(fileContent).toContain("RRuleID: 1730000000000-abc12");
			expect(fileContent).toContain("Recurring Instance Date: 2025-11-20");
			expect(fileContent).toContain('Source: "[[Recurring Event Source]]"');
			expect(fileContent).toContain("[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]");
			expect(fileContent).toContain("[[Tags/Obsidian|Obsidian]]");
			expect(fileContent).toContain("# Physical Event");
			expect(fileContent).toContain("Body content");
		});
	});

	describe("createFile without content", () => {
		it("should create file manually without applying frontmatter when no content", async () => {
			const service = new TemplaterService(mockApp);

			await service.createFile({
				title: "New Event",
				targetDirectory: "Calendar",
			});

			// Verify file was created with empty content
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			expect(mockApp.vault.create).toHaveBeenCalledWith(expect.any(String), "");

			// Verify frontmatter was NOT applied (no content path)
			expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
		});
	});

	describe("integration with recurring events", () => {
		it("should correctly handle frontmatter from recurring event manager", async () => {
			const service = new TemplaterService(mockApp);

			// Simulate the exact frontmatter structure created by RecurringEventManager
			const instanceFrontmatter = {
				RRuleID: "1730000000000-abc12",
				"Recurring Instance Date": "2025-11-20",
				Source: "[[Recurring Source Note]]",
				"Start Date": "2025-11-20T20:00:00.000Z", // Generated by calculateInstanceTimes + toUTC().toISO()
				"End Date": "2025-11-20T20:20:00.000Z",
				"All Day": false,
				Goal: ["[[Goals/Mid Week Sprint Sync|Mid Week Sprint Sync]]"],
			};

			await service.createFile({
				title: "Physical Event Instance 2025-11-20-12345678901234",
				targetDirectory: "Calendar",
				filename: "Physical Event Instance 2025-11-20-12345678901234",
				content: "# Event Instance\n\nInherited content from source",
				frontmatter: instanceFrontmatter,
			});

			// Verify file was created with frontmatter atomically
			expect(mockApp.vault.create).toHaveBeenCalledTimes(1);
			const [, fileContent] = mockApp.vault.create.mock.calls[0];

			// Verify UTC timestamps with Z are preserved exactly as generated
			expect(fileContent).toContain("Start Date: 2025-11-20T20:00:00.000Z");
			expect(fileContent).toContain("End Date: 2025-11-20T20:20:00.000Z");
			expect(fileContent).toContain("All Day: false");
			expect(fileContent).toContain("RRuleID: 1730000000000-abc12");
			expect(fileContent).toContain("# Event Instance");
		});
	});
});
