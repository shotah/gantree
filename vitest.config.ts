import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname),
      "next/link": resolve(import.meta.dirname, "test/next-link.tsx"),
      "next/navigation": resolve(import.meta.dirname, "test/next-navigation.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: [resolve(import.meta.dirname, "test/setup.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage",
      include: ["lib/yard/**/*.ts"],
      exclude: ["lib/yard/door/index.ts"],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
});
