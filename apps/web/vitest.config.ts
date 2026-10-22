import { fileURLToPath } from "node:url";
import { defineProject } from "vitest/config";

export default defineProject({
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    // The game's days are Paris days.
    env: { TZ: "Europe/Paris" },
  },
});
