// @vitest-environment happy-dom
import { defineLinkFormat } from "@optizzz/game/site-links/link-state";
import { act, useInsertionEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { useToolState } from "./use-tool-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const format = defineLinkFormat<{ n: number }>({ version: 1, schema: z.object({ n: z.number() }) });
const empty = { n: 0 };
const shared = `/tools/flood#p=${format.encode({ n: 7 })}`;

type Shown = { n: number; fromLink: boolean } | null;
let shown: Shown = null;
const show = (seen: Shown) => {
  shown = seen;
};

function Tool({ onRender }: { onRender: (seen: Shown) => void }) {
  const { state, fromLink, ready } = useToolState({ tool: "flood", format, empty });
  onRender(ready ? { n: state.n, fromLink } : null);
  return null;
}

/** Like Next's router on a `Link`: the address changes once the new page is committed. */
function NextLink({ href }: { href: string }) {
  useInsertionEffect(() => {
    window.history.pushState(null, "", href);
  }, [href]);
  return <Tool onRender={show} />;
}

let root: Root;
beforeEach(() => {
  localStorage.clear();
  shown = null;
  root = createRoot(document.createElement("div"));
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
});

describe("useToolState", () => {
  it("reads a link pasted in the tab", () => {
    window.history.replaceState(null, "", shared);
    act(() => {
      root.render(<Tool onRender={show} />);
    });
    expect(shown).toEqual({ n: 7, fromLink: true });
    expect(window.location.hash).toBe(`#p=${format.encode({ n: 7 })}`);
  });

  it("reads a link followed inside the site, once the address has changed", () => {
    window.history.replaceState(null, "", "/guides/tdc-chain");
    act(() => {
      root.render(<NextLink href={shared} />);
    });
    expect(shown).toEqual({ n: 7, fromLink: true });
    expect(window.location.pathname + window.location.hash).toBe(shared);
  });

  it("opens with the browser's last state without a link", () => {
    localStorage.setItem("optizzz:tool:flood", format.encode({ n: 3 }));
    window.history.replaceState(null, "", "/guides/tdc-chain");
    act(() => {
      root.render(<NextLink href="/tools/flood" />);
    });
    expect(shown).toEqual({ n: 3, fromLink: false });
  });
});
