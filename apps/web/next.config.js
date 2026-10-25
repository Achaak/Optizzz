// Checks the environment variables at build time (src/env.js).
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // @optizzz/game and @optizzz/crypto are TypeScript source, shared with the extension.
  transpilePackages: ["@optizzz/game", "@optizzz/crypto"],
};

export default config;
