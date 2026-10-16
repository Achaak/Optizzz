import { describe, expect, it } from "vitest";
import armeeMoveHtml from "./__fixtures__/armee-move.html?raw";
import { markProbesPending, placeProbes, readMoveForm, takeProbesPending } from "./probes";

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
function fakeGame(counts: Counts, { refuse = false } = {}) {
  let token = 0;
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
      if (!refuse && places && body.t === `T${String(token)}` && (places[from] ?? 0) >= n) {
        places[from] = (places[from] ?? 0) - n;
        places[to] = (places[to] ?? 0) + n;
      }
    }
    token++;
    return Promise.resolve(new Response(armeePage(counts, `T${String(token)}`)));
  };
  return { fetchFn, posts, counts };
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

  it("moves one ant of the cheapest unit to each empty place, with the latest token", async () => {
    const game = fakeGame({ unite1: [500, 0, 0], unite10: [0, 0, 40] });
    expect(await placeProbes(origin, ["field", "nest", "lodge"], game.fetchFn)).toEqual({
      placed: ["nest"],
      missing: [],
      failed: false,
    });
    expect(game.posts).toEqual([
      { t: "T1", nbTroupes: "1", ChoixUnite: "unite1", LieuOrigine: "1", LieuDestination: "2", Transferer: "Envoyer" },
    ]);
    expect(game.counts).toEqual({ unite1: [499, 1, 0], unite10: [0, 0, 40] });
  });

  it("fills only the watched places, and says which ones it could not fill", async () => {
    const game = fakeGame({ unite1: [2, 0, 0] });
    expect(await placeProbes(origin, ["field", "nest", "lodge"], game.fetchFn)).toEqual({
      placed: ["nest"],
      missing: ["lodge"],
      failed: false,
    });
    expect(await placeProbes(origin, ["field"], fakeGame({ unite1: [0, 3, 0] }).fetchFn)).toMatchObject({
      placed: ["field"],
    });
  });

  it("stops when the game does not take the move", async () => {
    const game = fakeGame({ unite1: [500, 0, 0] }, { refuse: true });
    expect(await placeProbes(origin, ["field", "nest", "lodge"], game.fetchFn)).toEqual({
      placed: [],
      missing: ["nest", "lodge"],
      failed: true,
    });
    expect(game.posts).toHaveLength(1);
  });

  it("sends nothing when every probe is in place", async () => {
    const game = fakeGame({ unite1: [1, 1, 1] });
    expect(await placeProbes(origin, ["field", "nest", "lodge"], game.fetchFn)).toEqual({
      placed: [],
      missing: [],
      failed: false,
    });
    expect(game.posts).toEqual([]);
  });
});

describe("pending probes", () => {
  it("is taken once", () => {
    markProbesPending(sessionStorage);
    expect(takeProbesPending(sessionStorage)).toBe(true);
    expect(takeProbesPending(sessionStorage)).toBe(false);
  });
});
