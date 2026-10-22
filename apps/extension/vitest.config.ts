import { defineProject } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineProject({
  plugins: [WxtVitest({ root: import.meta.dirname })],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    // Dates in the tests are written in local time, and the game's times are Paris time.
    env: { TZ: "Europe/Paris" },
  },
});
