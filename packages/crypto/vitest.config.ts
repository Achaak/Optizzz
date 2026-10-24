import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    // Node, not happy-dom: libsodium only needs WebAssembly and crypto.getRandomValues, which both offer.
    environment: "node",
    // Argon2id at its real cost (64 MiB) runs in a few tests.
    testTimeout: 30_000,
  },
});
