import { describe, expect, it } from "vitest";
import { generateColors } from "../../src/core/color-utils";

describe("generateColors", () => {
	it("should generate correct number of colors", () => {
		const colors = generateColors(5);
		expect(colors).toHaveLength(5);
	});

	it("should return empty array for count 0", () => {
		const colors = generateColors(0);
		expect(colors).toEqual([]);
	});

	it("should return empty array for negative count", () => {
		const colors = generateColors(-5);
		expect(colors).toEqual([]);
	});

	it("should generate colors with default saturation and lightness", () => {
		const colors = generateColors(3);
		expect(colors[0]).toBe("hsl(0, 70%, 60%)");
		expect(colors[1]).toBe("hsl(120, 70%, 60%)");
		expect(colors[2]).toBe("hsl(240, 70%, 60%)");
	});

	it("should use custom saturation", () => {
		const colors = generateColors(2, 50);
		expect(colors[0]).toBe("hsl(0, 50%, 60%)");
		expect(colors[1]).toBe("hsl(180, 50%, 60%)");
	});

	it("should use custom lightness", () => {
		const colors = generateColors(2, 70, 40);
		expect(colors[0]).toBe("hsl(0, 70%, 40%)");
		expect(colors[1]).toBe("hsl(180, 70%, 40%)");
	});

	it("should evenly distribute hues around color wheel", () => {
		const colors = generateColors(4);
		expect(colors[0]).toBe("hsl(0, 70%, 60%)"); // Red
		expect(colors[1]).toBe("hsl(90, 70%, 60%)"); // Yellow-green
		expect(colors[2]).toBe("hsl(180, 70%, 60%)"); // Cyan
		expect(colors[3]).toBe("hsl(270, 70%, 60%)"); // Purple
	});

	it("should generate single color at hue 0", () => {
		const colors = generateColors(1);
		expect(colors).toHaveLength(1);
		expect(colors[0]).toBe("hsl(0, 70%, 60%)");
	});

	it("should handle large counts", () => {
		const colors = generateColors(100);
		expect(colors).toHaveLength(100);
		expect(colors[0]).toBe("hsl(0, 70%, 60%)");
		expect(colors[50]).toBe("hsl(180, 70%, 60%)");
		expect(colors[99]).toBe("hsl(356.4, 70%, 60%)");
	});

	it("should generate valid HSL format", () => {
		const colors = generateColors(10);
		const hslRegex = /^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/;
		for (const color of colors) {
			expect(color).toMatch(hslRegex);
		}
	});

	it("should generate distinct colors for visualization", () => {
		const colors = generateColors(6);
		// Check that consecutive colors have different hues
		const hues = colors.map((color) => {
			const match = color.match(/hsl\((\d+(?:\.\d+)?),/);
			return match ? Number.parseFloat(match[1]) : 0;
		});

		for (let i = 1; i < hues.length; i++) {
			expect(hues[i]).not.toBe(hues[i - 1]);
		}
	});
});
