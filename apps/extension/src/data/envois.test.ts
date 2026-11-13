import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { loadReleve, loadSent, storeReleve, updateSent } from "./envois";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("what the Envois keep", () => {
  const item = { digest: "d", blob: "b", keyVersion: 1, at: 1, expiresAt: 2 };

  it("keeps what two categories write at the same time", async () => {
    await Promise.all([
      updateSent("s5|Messor", (state) => ({ ...state, lists: { ...state.lists, convoys: { a: item } } })),
      updateSent("s5|Messor", (state) => ({ ...state, lists: { ...state.lists, floods: { b: item } } })),
    ]);
    expect(Object.keys((await loadSent("s5|Messor")).lists).sort()).toEqual(["convoys", "floods"]);
  });

  it("keeps each Joueur's record apart", async () => {
    await Promise.all([
      updateSent("s5|Messor", (state) => ({ ...state, lists: { convoys: { a: item } } })),
      updateSent("s2|Lasius", (state) => ({ ...state, lists: { floods: { b: item } } })),
    ]);
    expect(Object.keys((await loadSent("s5|Messor")).lists)).toEqual(["convoys"]);
    expect(Object.keys((await loadSent("s2|Lasius")).lists)).toEqual(["floods"]);
  });

  it("keeps the relève of two spaces written at the same time", async () => {
    await Promise.all([
      storeReleve("space-a", { cursor: 1, rows: {} }),
      storeReleve("space-b", { cursor: 1, rows: {} }),
    ]);
    expect(await loadReleve("space-a")).toEqual({ cursor: 1, rows: {} });
    expect(await loadReleve("space-b")).toEqual({ cursor: 1, rows: {} });
  });
});
