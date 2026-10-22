import { defineConfig } from "vitest/config";

// `pnpm test` runs every app's and package's tests together; each has its own vitest.config.ts.
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    // `pnpm test:coverage` → coverage/index.html
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/__fixtures__/**", "apps/extension/src/entrypoints/**"],
      reporter: ["text-summary", "html"],
    },
  },
});
