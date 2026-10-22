import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "happy-dom",
    // Dates in the tests are written in local time, and the game's times are Paris time.
    env: { TZ: "Europe/Paris" },
  },
});
