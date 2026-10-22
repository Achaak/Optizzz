import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import reineHtml from "../end-times/__fixtures__/reine-laying.html?raw";
import commerceHtml from "../convoy/__fixtures__/commerce.html?raw";
import messagerieHtml from "@optizzz/game/pages/__fixtures__/messagerie-convoys.html?raw";
import { loadConvoys } from "@/data/convoys";
import { loadConvoyHistory } from "@/data/convoy-history";
import { loadSections } from "@/data/end-times";
import { collect } from ".";

const ORIGIN = location.origin;
const ctx = {} as ContentScriptContext;

beforeEach(() => {
  fakeBrowser.reset();
  history.replaceState(null, "", "/Reine.php");
  document.documentElement.innerHTML = new DOMParser().parseFromString(
    reineHtml,
    "text/html",
  ).documentElement.innerHTML;
});

describe("collect", () => {
  it("keeps the end times for the notifications, « Heures de fin » switched off", async () => {
    await collect.run(ctx, { "end-times": false });
    expect((await loadSections(ORIGIN)).laying?.items).toHaveLength(3);
  });

  it("keeps nothing when no feature needs it", async () => {
    await collect.run(ctx, { "end-times": false, "alerts.notifications": false });
    expect(await loadSections(ORIGIN)).toEqual({});
  });

  it("keeps the convoys on their way for the header's workers, only when that option is on", async () => {
    history.replaceState(null, "", "/commerce.php");
    document.documentElement.innerHTML = new DOMParser().parseFromString(
      commerceHtml,
      "text/html",
    ).documentElement.innerHTML;
    await collect.run(ctx, { "convoy.workers": false });
    expect(await loadConvoys(ORIGIN)).toBeNull();
    await collect.run(ctx, {});
    const kept = await loadConvoys(ORIGIN);
    expect(kept?.convoys.map((convoy) => convoy.recipient)).toEqual(["Messor", "Tetramorium"]);
    expect(kept?.workers).toBe(4_995);
  });

  it("keeps the convoys delivered and received listed by the inbox, only when that option is on", async () => {
    history.replaceState(null, "", "/messagerie.php");
    document.body.innerHTML = new DOMParser().parseFromString(messagerieHtml, "text/html").body.innerHTML;
    await collect.run(ctx, { "convoy.history": false });
    expect(await loadConvoyHistory(ORIGIN)).toBeNull();
    await collect.run(ctx, {});
    expect((await loadConvoyHistory(ORIGIN))?.messages).toHaveLength(5);
  });
});
