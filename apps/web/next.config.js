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
};

export default config;
