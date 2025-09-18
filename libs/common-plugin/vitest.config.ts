import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
	},
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "../utils/src/testing/mocks/obsidian.ts"),
		},
	},
});
