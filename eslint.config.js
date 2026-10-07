// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([".output/", ".wxt/", "node_modules/", ".claude/"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Numbers in template literals are fine for UI text and keys.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // Short arrow event handlers returning a void call are idiomatic in React.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      // Store reviewers (AMO) flag HTML injection: build DOM with src/utils/html.ts or textContent.
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use htmlElement/svgElement (src/utils/html.ts) or textContent." },
        { property: "outerHTML", message: "Use htmlElement/svgElement (src/utils/html.ts) or textContent." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "Use htmlElement/svgElement (src/utils/html.ts).",
        },
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Render React elements instead." },
      ],
    },
  },
  {
    // Tests are not shipped: building fixtures with innerHTML is fine there.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
