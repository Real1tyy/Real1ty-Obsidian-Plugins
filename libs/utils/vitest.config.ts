import * as path from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		environment: "jsdom",
	},
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "./src/testing/mocks/obsidian.ts"),
		},
	},
});
