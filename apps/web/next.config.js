// Checks the environment variables at build time (src/env.js).
import "./src/env.js";
import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
  // @optizzz/game and @optizzz/crypto are TypeScript source, shared with the extension.
  transpilePackages: ["@optizzz/game", "@optizzz/crypto"],
  // The VPS image (apps/web/Dockerfile) runs .next/standalone alone: the files it needs, traced from the monorepo root.
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  // Each page rebuilt at a visit (a player, an alliance, on each server) was written to .next/server, never removed:
  // 8.8 GB inside the web container filled the VPS's 17 GB disk and stopped Postgres (2026-11-18). Kept in memory
  // only, in Next's LRU (cacheMaxMemorySize), and rebuilt after a restart.
  experimental: { isrFlushToDisk: false },
};

export default config;
