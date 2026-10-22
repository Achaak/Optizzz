// Checks the environment variables at build time (src/env.js).
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // @optizzz/game is TypeScript source, shared with the extension.
  transpilePackages: ["@optizzz/game"],
};

export default config;
