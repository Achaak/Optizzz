// The hunt engine's worker as a module, bundled from this URL by Next (the site) or Vite. Not for a content script:
// its worker file would be looked for on the game's origin.
export const spawnModuleWorker = () =>
  new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name: "hunt-engine" });
