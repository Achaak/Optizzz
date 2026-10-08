import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { featureCatalog } from "./catalog";
import { features } from "./index";

/** Features with no switch: the settings menu itself, and what other features read (levels, page data). */
const ALWAYS_ON = ["settings-menu", "game-levels", "collect"];

/** Heavy content scripts read their switch themselves (`isFeatureEnabled` / `isEnabled`). */
const HEAVY_SCRIPTS: Record<string, string> = {
  "hunt-launcher": "../entrypoints/hunt-launcher.content/index.tsx",
  "alliance-map": "../entrypoints/alliance-map.content/index.tsx",
  "tdc-chain": "../entrypoints/tdc-chain.content/index.tsx",
  history: "../entrypoints/history.content/index.tsx",
};

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("feature catalog", () => {
  it("has a reader for every entry: a lightweight feature's toggle or a heavy script's check", () => {
    const toggled = new Set(features.flatMap((feature) => (feature.toggle ? [feature.toggle] : [])));
    for (const { id } of featureCatalog) {
      const heavy = HEAVY_SCRIPTS[id];
      const readByHeavy = heavy !== undefined && source(heavy).includes(`"${id}"`);
      expect(toggled.has(id) || readByHeavy, `nothing reads the switch « ${id} »`).toBe(true);
    }
  });

  it("gives a switch to every visible lightweight feature", () => {
    for (const feature of features) {
      if (ALWAYS_ON.includes(feature.id)) continue;
      expect(feature.toggle, `« ${feature.id} » cannot be switched off`).toBeDefined();
    }
  });

  it("has every option read somewhere in the code", () => {
    for (const { id, options } of featureCatalog) {
      for (const option of options) {
        const pattern = new RegExp(`isEnabled\\([^)]*"${id}",\\s*"${option.id}"`);
        const files = [
          ...Object.values(HEAVY_SCRIPTS),
          `./${id}/index.ts`,
          `./${id}/menu.ts`,
          "./alerts/background.ts",
          "./settings/notifications-section.ts",
        ].flatMap((path) => {
          try {
            return [source(path)];
          } catch {
            return [];
          }
        });
        expect(
          files.some((file) => pattern.test(file)),
          `nothing reads the option « ${id}.${option.id} »`,
        ).toBe(true);
      }
    }
  });
});
