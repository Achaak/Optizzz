import { describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { isOpenSiteToolMessage, openSiteTool, siteToolMessageUrl } from "./site-tool";

describe("opening a tool of optizzz.fr", () => {
  it("asks the background script for a tab at the tool's address, the state in the fragment", async () => {
    const sent: unknown[] = [];
    fakeBrowser.runtime.onMessage.addListener((message: unknown) => {
      sent.push(message);
    });
    await openSiteTool("combat", "1.eyJhIjoxfQ");
    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(isOpenSiteToolMessage(message)).toBe(true);
    if (isOpenSiteToolMessage(message))
      expect(siteToolMessageUrl(message)).toBe("https://optizzz.fr/tools/combat#p=1.eyJhIjoxfQ");
  });

  it("takes no other message for one, nor an unknown tool or a state that is not one", () => {
    expect(isOpenSiteToolMessage({ type: "open-site-tool", tool: "hunt", state: "1.abc" })).toBe(true);
    expect(isOpenSiteToolMessage({ type: "open-site-tool", tool: "map", state: "1.abc" })).toBe(false);
    expect(isOpenSiteToolMessage({ type: "open-site-tool", tool: "hunt", state: "1.a#b" })).toBe(false);
    expect(isOpenSiteToolMessage({ type: "open-site-tool", tool: "hunt" })).toBe(false);
    expect(isOpenSiteToolMessage({ type: "open-watchlist", origin: "x" })).toBe(false);
    expect(isOpenSiteToolMessage(null)).toBe(false);
  });
});
