import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    // Dates in the tests are written in local time, and the game's times are Paris time.
    env: { TZ: "Europe/Paris" },
    // `pnpm test:coverage` → coverage/index.html
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/__fixtures__/**", "src/entrypoints/**"],
      reporter: ["text-summary", "html"],
    },
  },
});
