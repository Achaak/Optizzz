import { beforeEach, describe, expect, it, vi } from "vitest";
import membersHtml from "@optizzz/game/pages/__fixtures__/members.html?raw";
import { loadAllianceMembers } from "@/data/alliance-members";
import { loadCurrentPlayer, loadLastGameServer } from "@/data/optizzz-account";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import reineHtml from "../end-times/__fixtures__/reine-laying.html?raw";
import commerceHtml from "../convoy/__fixtures__/commerce.html?raw";
import messagerieHtml from "@optizzz/game/pages/__fixtures__/messagerie-convoys.html?raw";
import { loadConvoys, loadIncomingConvoys } from "@/data/convoys";
import { storeChoices } from "@/data/envois";
import { NO_ENVOIS } from "@optizzz/game/site-links/envois";
import { loadConvoyHistory } from "@/data/convoy-history";
import { loadSections } from "@/data/end-times";
import armeeHtml from "../flood/__fixtures__/armee-attacks-s5.html?raw";
import { loadSentAttacks } from "@/data/sent-attacks";
import { loadStatePages } from "@/data/state-pages";
import coloniesHtml from "@optizzz/game/pages/__fixtures__/colonies.html?raw";
import { collect } from ".";

const ORIGIN = location.origin;
const S5 = "https://s5.fourmizzz.fr";
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

  it("keeps the alliance's members and the header's pseudo for the Optizzz account, without a request", async () => {
    history.replaceState(null, "", "/alliance.php?Membres");
    document.documentElement.innerHTML = new DOMParser().parseFromString(
      membersHtml,
      "text/html",
    ).documentElement.innerHTML;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await collect.run(ctx, { "optizzz-account": false });
    expect(await loadAllianceMembers(ORIGIN)).toBeNull();
    expect(await loadCurrentPlayer(ORIGIN)).toBeNull();

    await collect.run(ctx, {});
    expect(await loadAllianceMembers(ORIGIN)).toEqual({
      tag: null,
      pseudos: ["Alpha", "Me", "Gros"],
      readAt: expect.any(Date) as Date,
    });
    expect(await loadCurrentPlayer(ORIGIN)).toBe("Me");
    expect(await loadLastGameServer()).toBe(ORIGIN);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keeps the convoys both ways when the player sends them, convoy options off, without a request", async () => {
    const happyDOM = (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM;
    happyDOM.setURL("https://s5.fourmizzz.fr/commerce.php");
    document.documentElement.innerHTML = new DOMParser().parseFromString(
      commerceHtml,
      "text/html",
    ).documentElement.innerHTML;
    const options = { "convoy.workers": false, "convoy.history": false };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await collect.run(ctx, options);
    expect(await loadIncomingConvoys(S5)).toBeNull();
    expect(await loadConvoys(S5)).toBeNull();

    await storeChoices("s5", "Formica", { ...NO_ENVOIS, convoys: true });
    await collect.run(ctx, options);
    expect((await loadConvoys(S5))?.convoys).toHaveLength(2);
    expect((await loadIncomingConvoys(S5))?.convoys.map((c) => c.sender)).toEqual(["Polyergus"]);
    // Switched off with « Compte Optizzz »: nothing kept for the Envoi.
    fakeBrowser.reset();
    await storeChoices("s5", "Formica", { ...NO_ENVOIS, convoys: true });
    await collect.run(ctx, { ...options, "optizzz-account": false });
    expect(await loadIncomingConvoys(S5)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    happyDOM.setURL(`${ORIGIN}/Reine.php`);
  });

  it("keeps the attacks on their way with the game's numbers when the player sends their floods, without a request", async () => {
    const happyDOM = (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM;
    happyDOM.setURL("https://s5.fourmizzz.fr/Armee.php");
    document.documentElement.innerHTML = `<body><span id="pseudo">Messor</span>${armeeHtml}</body>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await collect.run(ctx, {});
    expect(await loadSentAttacks(S5)).toBeNull();

    await storeChoices("s5", "Messor", { ...NO_ENVOIS, floods: true });
    await collect.run(ctx, {});
    expect((await loadSentAttacks(S5))?.attacks.map((a) => [a.attackId, a.target])).toEqual([
      [34250, "Cible_1"],
      [34251, "Cible_2"],
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    happyDOM.setURL(`${ORIGIN}/Reine.php`);
  });

  it("keeps the colonies page for a Production sent, without a request", async () => {
    const happyDOM = (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM;
    happyDOM.setURL("https://s5.fourmizzz.fr/colonies.php");
    const header =
      '<span id="pseudo">Messor</span><div id="data"><span id="nb_nourriture">1</span><span id="nb_materiaux">2</span><span id="nb_ouvrieres">3</span><span id="quantite_tdc">4</span></div>';
    document.documentElement.innerHTML = `<body>${header}${coloniesHtml}</body>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await collect.run(ctx, {});
    expect(await loadStatePages(S5)).toEqual({});

    await storeChoices("s5", "Messor", { ...NO_ENVOIS, production: true });
    await collect.run(ctx, {});
    const kept = await loadStatePages(S5);
    expect(kept.stock).toMatchObject({ huntingField: 4, workers: 3 });
    expect(kept.colonies?.colonies.map((c) => c.pseudo)).toEqual(["Colonie_1"]);
    expect(kept.armee).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    happyDOM.setURL(`${ORIGIN}/Reine.php`);
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
