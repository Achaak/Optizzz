import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// ADR 0007: libsodium loads in the extension's background and pages only, never in the light content script
// (fourmizzz.content.ts) or anything it can import. The root ESLint config forbids it; this checks the rule fires
// where it must and stays out of the way where libsodium is allowed. Lints real files with replaced text.

const root = fileURLToPath(new URL("../../../", import.meta.url));
const eslint = new ESLint({ cwd: root });

const STATIC = `import sodium from "libsodium-wrappers-sumo";\nimport { encryptData } from "@optizzz/crypto/data";\nexport { sodium, encryptData };\n`;
const DYNAMIC = `export const load = () => import("@optizzz/crypto/data");\n`;

async function cryptoErrors(file: string, code: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  // A parse error would make "no error" meaningless.
  expect(result?.fatalErrorCount).toBe(0);
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports" || m.message.includes("ADR 0007"))
    .length;
}

describe("libsodium stays out of the light content script", () => {
  it.each([
    "apps/extension/src/entrypoints/fourmizzz.content.ts",
    "apps/extension/src/features/index.ts",
    "apps/extension/src/utils/alliance-menu.ts",
    "apps/extension/src/entrypoints/alliance-map.content/index.tsx",
    "packages/game/src/attack.ts",
  ])("forbids importing it from %s", async (file) => {
    expect(await cryptoErrors(file, STATIC)).toBe(2);
    expect(await cryptoErrors(file, DYNAMIC)).toBe(1);
  });

  it.each(["apps/extension/src/entrypoints/background.ts", "apps/extension/src/entrypoints/popup/main.ts"])(
    "allows it in %s",
    async (file) => {
      expect(await cryptoErrors(file, STATIC)).toBe(0);
      expect(await cryptoErrors(file, DYNAMIC)).toBe(0);
    },
  );
});
