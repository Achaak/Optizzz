import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys } from "@optizzz/game/army/units";
import { setToggle } from "@/features/toggles";
import { DEFAULT_SETTINGS } from "./settings";
import { SiteLinks } from "./SiteLinks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;

beforeEach(() => {
  fakeBrowser.reset();
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  container.remove();
});

async function render() {
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <SiteLinks
        entries={{
          army: armyFromKeys({ JSN: 1000 }),
          levels: { weapons: 4, shield: 4, huntSpeed: 3, cochineal: 0 },
          launchField: 4496,
          arrivalField: 4496,
          ongoing: 0,
          settings: DEFAULT_SETTINGS,
          huntCount: null,
          huntAmount: null,
          override: null,
        }}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return root;
}

const buttons = () => [...container.querySelectorAll("button")].map((button) => button.textContent);

describe("SiteLinks", () => {
  it("offers optizzz.fr's hunt simulator while « Liens vers optizzz.fr » is on, and nothing once it is off", async () => {
    const root = await render();
    expect(buttons()).toEqual(["Ouvrir sur optizzz.fr", "Copier le lien"]);
    act(() => {
      root.unmount();
    });
    await setToggle("site-links", undefined, false);
    await render();
    expect(buttons()).toEqual([]);
  });
});
