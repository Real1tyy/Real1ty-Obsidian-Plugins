import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "../../src/testing";

// Mock dependencies - mock individual files to avoid circular mocking
vi.mock("../../src/file/file-operations", () => ({
	createFileLink: vi.fn(),
}));

vi.mock("../../src/file/link-parser", () => ({
	extractFilePathFromLink: vi.fn(),
}));

import {
	extractDirectoryPath,
	isRelativeChildReference,
	normalizeChildReference,
	normalizeChildReferences,
	type VaultAdapter,
} from "../../src/file";
import { createFileLink } from "../../src/file/file-operations";
import { extractFilePathFromLink } from "../../src/file/link-parser";

const mockCreateFileLink = vi.mocked(createFileLink);
const mockExtractFilePathFromLink = vi.mocked(extractFilePathFromLink);

// Mock vault adapter
class MockVaultAdapter implements VaultAdapter {
	private validPaths: string[] = [];

	setValidPaths(paths: string[]) {
		this.validPaths = paths;
	}

	getAbstractFileByPath(path: string): TFile | null {
		if (this.validPaths.includes(path)) {
			return new TFile(path);
		}
		return null;
	}
}

describe("Child Reference Utils", () => {
	let mockVault: MockVaultAdapter;

	beforeEach(() => {
		mockVault = new MockVaultAdapter();
		vi.clearAllMocks();
	});

	describe("extractDirectoryPath", () => {
		it("should extract directory from nested file path", () => {
			const result = extractDirectoryPath("Goals/Master Programming.md");
			expect(result).toBe("Goals");
		});

		it("should extract directory from deeply nested file path", () => {
			const result = extractDirectoryPath("Projects/Frontend/React/Component.md");
			expect(result).toBe("Projects/Frontend/React");
		});

		it("should return empty string for root level files", () => {
			const result = extractDirectoryPath("RootFile.md");
			expect(result).toBe("");
		});

		it("should handle file paths without extension", () => {
			const result = extractDirectoryPath("Goals/Master Programming");
			expect(result).toBe("Goals");
		});

		it("should handle paths with trailing slash", () => {
			const result = extractDirectoryPath("Goals/Subfolder/File.md");
			expect(result).toBe("Goals/Subfolder");
		});
	});

	describe("isRelativeChildReference", () => {
		beforeEach(() => {
			mockExtractFilePathFromLink.mockImplementation((link) => {
				const match = link.match(/\[\[([^|\]]+?)(?:\|.*?)?\]\]/);
				if (match) {
					const filePath = match[1].trim();
					return filePath.endsWith(".md") ? filePath : `${filePath}.md`;
				}
				return null;
			});
		});

		it("should identify relative references without path separators", () => {
			const result = isRelativeChildReference("[[Learn Closure|Learn Closure]]");
			expect(result).toBe(true);
		});

		it("should identify absolute references with path separators", () => {
			const result = isRelativeChildReference("[[Goals/Learn Closure|Learn Closure]]");
			expect(result).toBe(false);
		});

		it("should identify simple relative references", () => {
			const result = isRelativeChildReference("[[Simple File]]");
			expect(result).toBe(true);
		});

		it("should identify deeply nested absolute references", () => {
			const result = isRelativeChildReference("[[Projects/Frontend/React/Component|Component]]");
			expect(result).toBe(false);
		});

		it("should handle plain text references without links", () => {
			mockExtractFilePathFromLink.mockReturnValue(null);
			const result = isRelativeChildReference("PlainFile");
			expect(result).toBe(true);
		});

		it("should handle plain text references with path separators", () => {
			mockExtractFilePathFromLink.mockReturnValue(null);
			const result = isRelativeChildReference("Goals/PlainFile");
			expect(result).toBe(false);
		});
	});

	describe("normalizeChildReference", () => {
		beforeEach(() => {
			mockExtractFilePathFromLink.mockImplementation((link) => {
				const match = link.match(/\[\[([^|\]]+?)(?:\|.*?)?\]\]/);
				if (match) {
					const filePath = match[1].trim();
					return filePath.endsWith(".md") ? filePath : `${filePath}.md`;
				}
				return null;
			});

			mockVault.setValidPaths([
				"Goals/Learn Closure.md",
				"Goals/Master Rust.md",
				"Projects/Frontend/React.md",
				"SimpleFile.md",
			]);

			mockCreateFileLink.mockImplementation(
				(file) =>
					`[[${file.path.replace(".md", "")}|${file.path.split("/").pop()?.replace(".md", "")}]]`
			);
		});

		it("should convert relative reference to absolute with directory context", () => {
			const result = normalizeChildReference("[[Learn Closure|Learn Closure]]", mockVault, "Goals");
			expect(result).toBe("[[Goals/Learn Closure|Learn Closure]]");
		});

		it("should leave absolute references unchanged", () => {
			const result = normalizeChildReference(
				"[[Goals/Master Rust|Master Rust]]",
				mockVault,
				"Goals"
			);
			expect(result).toBe("[[Goals/Master Rust|Master Rust]]");
		});

		it("should handle references without display names", () => {
			const result = normalizeChildReference("[[Learn Closure]]", mockVault, "Goals");
			expect(result).toBe("[[Goals/Learn Closure|Learn Closure]]");
		});

		it("should handle relative references without directory context", () => {
			const result = normalizeChildReference("[[Learn Closure|Learn Closure]]", mockVault);
			expect(result).toBe("[[Learn Closure|Learn Closure]]");
		});

		it("should return original reference if file not found", () => {
			const result = normalizeChildReference("[[Missing File|Missing File]]", mockVault, "Goals");
			expect(result).toBe("[[Missing File|Missing File]]");
		});

		it("should handle deeply nested directory context", () => {
			const result = normalizeChildReference("[[React]]", mockVault, "Projects/Frontend");
			expect(result).toBe("[[Projects/Frontend/React|React]]");
		});

		it("should handle plain text references with directory context", () => {
			mockExtractFilePathFromLink.mockReturnValue(null);
			const result = normalizeChildReference("SimpleFile", mockVault, "");
			expect(result).toBe("[[SimpleFile|SimpleFile]]");
		});

		it("should handle plain text references without directory context", () => {
			mockExtractFilePathFromLink.mockReturnValue(null);
			const result = normalizeChildReference("Goals/SimpleFile", mockVault);
			expect(result).toBe("Goals/SimpleFile");
		});
	});

	describe("normalizeChildReferences", () => {
		beforeEach(() => {
			mockExtractFilePathFromLink.mockImplementation((link) => {
				const match = link.match(/\[\[([^|\]]+?)(?:\|.*?)?\]\]/);
				if (match) {
					const filePath = match[1].trim();
					return filePath.endsWith(".md") ? filePath : `${filePath}.md`;
				}
				return null;
			});

			mockVault.setValidPaths(["Goals/Child1.md", "Goals/Child2.md"]);

			mockCreateFileLink.mockImplementation(
				(file) =>
					`[[${file.path.replace(".md", "")}|${file.path.split("/").pop()?.replace(".md", "")}]]`
			);
		});

		it("should normalize multiple relative references", () => {
			const childRefs = ["[[Child1|Child1]]", "[[Child2|Child2]]"];
			const result = normalizeChildReferences(childRefs, mockVault, "Goals");
			expect(result).toEqual(["[[Goals/Child1|Child1]]", "[[Goals/Child2|Child2]]"]);
		});

		it("should handle mixed relative and absolute references", () => {
			const childRefs = ["[[Child1|Child1]]", "[[Goals/Child2|Child2]]"];
			const result = normalizeChildReferences(childRefs, mockVault, "Goals");
			expect(result).toEqual(["[[Goals/Child1|Child1]]", "[[Goals/Child2|Child2]]"]);
		});

		it("should handle empty array", () => {
			const result = normalizeChildReferences([], mockVault, "Goals");
			expect(result).toEqual([]);
		});

		it("should work without directory context", () => {
			const childRefs = ["[[Goals/Child1|Child1]]"];
			const result = normalizeChildReferences(childRefs, mockVault);
			expect(result).toEqual(["[[Goals/Child1|Child1]]"]);
		});
	});
});
