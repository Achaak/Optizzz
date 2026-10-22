import { storage } from "wxt/utils/storage";
import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys } from "@optizzz/game/army/units";
import armeeMoveHtml from "./__fixtures__/armee-move.html?raw";
import {
  DEFAULT_PROBE_TARGETS,
  loadProbeTargets,
  markProbesPending,
  placeProbes,
  probePlan,
  readMoveForm,
  saveProbeTargets,
  storeArmy,
  takeProbesPending,
} from "./probes";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

type Counts = Record<string, [number, number, number]>;

/** A minimal Armee.php: the garrison counts and the move form as the game writes them (2026-10-16). */
function armeePage(counts: Counts, token: string): string {
  const rows = Object.entries(counts).map(
    ([unit, places]) =>
      `<tr><td>${unit}</td>${places
        .map((count, place) =>
          count > 0
            ? `<td></td><td><span class="cliquable" onClick="remplirFormulaire(${String(count)},'${unit}',${String(place + 1)},3);">${String(count)}</span></td><td></td>`
            : "<td></td><td></td><td></td>",
        )
        .join("")}</tr>`,
  );
  return `<table class="simulateur"><tr><td>Troupes en Garnison</td></tr>
    <tr><td>Unités</td><td>Terrain de Chasse</td><td>Dôme (1)</td><td>Loge (1)</td></tr>${rows.join("")}</table>
    <table class="simulateur"><tr><td><form action="Armee.php" method="post">
    <input type="hidden" name="t" value="${token}"><input name="nbTroupes"><select name="ChoixUnite"></select>
    </td></tr><tr><td><input type="radio" name="LieuOrigine" value="1"><input type="radio" name="LieuDestination" value="1">
    <input type="submit" name="Transferer" value="Envoyer"></form></td></tr></table>`;
}

/** The game: GET shows Armee.php, POST moves troops when the token is the last one given. */
function fakeGame(counts: Counts, { refuse = false, drop = 0 } = {}) {
  let token = 0;
  let dropped = 0;
  const posts: Record<string, string>[] = [];
  const fetchFn = (url: string, init?: RequestInit) => {
    expect(url).toBe("https://s5.fourmizzz.fr/Armee.php");
    if (init?.method === "POST") {
      const body = Object.fromEntries(new URLSearchParams(init.body as string));
      posts.push(body);
      const places = counts[body.ChoixUnite ?? ""];
      const n = Number(body.nbTroupes);
      const from = Number(body.LieuOrigine) - 1;
      const to = Number(body.LieuDestination) - 1;
      const taken = !refuse && dropped++ >= drop;
      if (taken && places && body.t === `T${String(token)}` && (places[from] ?? 0) >= n) {
        places[from] = (places[from] ?? 0) - n;
        places[to] = (places[to] ?? 0) + n;
      }
    }
    token++;
    return Promise.resolve(new Response(armeePage(counts, `T${String(token)}`)));
  };
  const waits: number[] = [];
  const wait = (ms: number) => {
    waits.push(ms);
    return Promise.resolve();
  };
  return { options: { fetchFn, wait }, posts, counts, waits };
}

describe("readMoveForm", () => {
  it("reads the token and the submit button of « Déplacer son armée », though they sit outside the <form>", () => {
    const doc = parse(armeeMoveHtml);
    // The game's markup: the parser closes the form in its first cell.
    expect(doc.querySelector('form input[name="Transferer"]')).toBeNull();
    expect(readMoveForm(doc)).toEqual({
      hiddenFields: { t: "TOKEN" },
      submit: { name: "Transferer", value: "Envoyer" },
    });
  });

  it("reads nothing elsewhere", () => {
    expect(readMoveForm(parse("<form><input type='submit' name='ChoixArmee'></form>"))).toBeNull();
  });
});

describe("placeProbes", () => {
  const origin = "https://s5.fourmizzz.fr";
  const jsn = (count: number) => armyFromKeys({ JSN: count });
  const everywhere = { field: jsn(1), nest: jsn(1), lodge: jsn(1) };

  it("moves the ants wanted, as many at once as needed, each from a fresh page and a second apart", async () => {
    const game = fakeGame({ unite1: [500, 0, 0], unite10: [0, 0, 40] });
    expect(await placeProbes(origin, { nest: jsn(1), lodge: jsn(25) }, game.options)).toEqual({
      placed: ["nest", "lodge"],
      missing: [],
      failed: false,
    });
    expect(game.posts).toEqual([
      { t: "T1", nbTroupes: "1", ChoixUnite: "unite1", LieuOrigine: "1", LieuDestination: "2", Transferer: "Envoyer" },
      { t: "T3", nbTroupes: "25", ChoixUnite: "unite1", LieuOrigine: "1", LieuDestination: "3", Transferer: "Envoyer" },
    ]);
    expect(game.counts).toEqual({ unite1: [474, 1, 25], unite10: [0, 0, 40] });
    expect(game.waits).toEqual([1000, 1000]);
  });

  it("sends a move the game dropped once more", async () => {
    const game = fakeGame({ unite1: [500, 0, 0] }, { drop: 1 });
    expect(await placeProbes(origin, { nest: jsn(1), lodge: jsn(1) }, game.options)).toEqual({
      placed: ["nest", "lodge"],
      missing: [],
      failed: false,
    });
    expect(game.posts.map((post) => post.LieuDestination)).toEqual(["2", "2", "3"]);
    expect(game.counts).toEqual({ unite1: [498, 1, 1] });
  });

  it("fills only the watched places, and says which ones it could not fill", async () => {
    const game = fakeGame({ unite1: [2, 0, 0] });
    expect(await placeProbes(origin, everywhere, game.options)).toEqual({
      placed: ["nest"],
      missing: ["lodge"],
      failed: false,
    });
    expect(await placeProbes(origin, { field: jsn(1) }, fakeGame({ unite1: [0, 3, 0] }).options)).toMatchObject({
      placed: ["field"],
    });
  });

  it("stops when the game does not take the move twice", async () => {
    const game = fakeGame({ unite1: [500, 0, 0] }, { refuse: true });
    expect(await placeProbes(origin, everywhere, game.options)).toEqual({
      placed: [],
      missing: ["nest", "lodge"],
      failed: true,
    });
    expect(game.posts).toHaveLength(2);
  });

  it("sends nothing when every probe is in place", async () => {
    const game = fakeGame({ unite1: [1, 1, 1] });
    expect(await placeProbes(origin, everywhere, game.options)).toEqual({
      placed: [],
      missing: [],
      failed: false,
    });
    expect(game.posts).toEqual([]);
  });
});

describe("storeArmy", () => {
  it("puts every ant in the Loge but the probes of the other places", async () => {
    const game = fakeGame({ unite1: [500, 0, 0], unite10: [40, 0, 0] });
    expect(await storeArmy("https://s5.fourmizzz.fr", { nest: armyFromKeys({ JSN: 1 }) }, game.options)).toEqual({
      placed: ["nest", "lodge"],
      missing: [],
      failed: false,
    });
    expect(game.counts).toEqual({ unite1: [0, 1, 499], unite10: [0, 0, 40] });
  });
});

describe("probe targets", () => {
  beforeEach(() => fakeBrowser.reset());

  it("keeps one JSN on the Dôme and the Loge until the player sets them, per server", async () => {
    expect(await loadProbeTargets("s5.fourmizzz.fr", {})).toEqual(DEFAULT_PROBE_TARGETS);
    const targets = { field: { JSN: 1 }, nest: { JSN: 10 }, lodge: {} };
    await saveProbeTargets("s5.fourmizzz.fr", targets);
    expect(await loadProbeTargets("s5.fourmizzz.fr", { "probes.lodge": false })).toEqual(targets);
    expect(await loadProbeTargets("s2.fourmizzz.fr", {})).toEqual(DEFAULT_PROBE_TARGETS);
  });

  it("takes over the places chosen in « Fonctionnalités » and the numbers set before 2026-10-22", async () => {
    await storage.setItem("local:probes:s5.fourmizzz.fr:targets", { field: { JSN: 1 }, nest: {}, lodge: { SN: 2 } });
    expect(await loadProbeTargets("s5.fourmizzz.fr", { "probes.lodge": false })).toEqual({
      field: {},
      nest: {},
      lodge: {},
    });
    expect(await loadProbeTargets("s5.fourmizzz.fr", { "probes.field": true })).toEqual({
      field: { JSN: 1 },
      nest: {},
      lodge: { SN: 2 },
    });
    expect(await loadProbeTargets("s2.fourmizzz.fr", { "probes.field": true, "probes.nest": false })).toEqual({
      field: { JSN: 1 },
      nest: {},
      lodge: { JSN: 1 },
    });
  });

  it("plans the places that keep at least one ant", () => {
    const targets = { field: {}, nest: { JSN: 0 }, lodge: { JSN: 5, SN: 2 } };
    expect(probePlan(targets)).toEqual({ lodge: armyFromKeys({ JSN: 5, SN: 2 }) });
  });
});

describe("pending probes", () => {
  it("is taken once", () => {
    markProbesPending(sessionStorage);
    expect(takeProbesPending(sessionStorage)).toBe(true);
    expect(takeProbesPending(sessionStorage)).toBe(false);
  });
});
