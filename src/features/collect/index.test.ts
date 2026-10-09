import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import reineHtml from "../end-times/__fixtures__/reine-laying.html?raw";
import { loadSections } from "@/data/end-times";
import { collect } from "./index";

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
});
