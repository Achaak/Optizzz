import { describe, expect, it } from "vitest";
import type { SharedState } from "@/data/shared-states";
import { UNITS } from "@/game/army/units";
import { BUILDINGS, RESEARCH } from "@/game/levels";
import { formatShare, parseShares } from "./share-text";

const at = (iso: string) => new Date(iso);

const state: SharedState = {
  server: "s5",
  alliance: "ABC",
  pseudo: "Éloïse",
  readAt: at("2026-10-09T11:36:00Z"),
  huntingField: 8335,
  workers: 12_000,
  buildings: { mushroom: 8, dome: 14, lodge: 10 },
  research: { weapons: 12, shield: 11, attackSpeed: 8 },
  works: [{ name: "Armes", level: 13, endsAt: at("2026-10-09T16:20:00Z") }],
  army: { total: 3784, units: { JSN: 3405, SN: 364, NE: 15 }, incomplete: false },
};

const context = { server: "s5", alliance: "ABC", members: ["Éloïse", "Bob"] };

describe("formatShare", () => {
  const summary = (text: string) => text.split("\n").slice(0, -1);

  it("starts with a summary to read in Discord, times in Paris time, then the data line", () => {
    const text = formatShare(state, null);
    expect(summary(text)).toEqual([
      "Optizzz · Éloïse (ABC, s5) · relevé le 09/10 à 13 h 36",
      "TDC : 8 335 cm² · Ouvrières : 12 000",
      "Armée : 3 784 (3 405 JSN, 364 SN, 15 NE)",
      "Chantiers : Armes 13 (fin le 09/10 à 18 h 20)",
      "Bâtiments : Champignonnière 8, Dôme 14, Loge Impériale 10",
      "Recherches : Bouclier Thoracique 11, Armes 12, Vitesse d’attaque 8",
    ]);
    expect(text.split("\n").at(-1)).toMatch(/^\[optizzz:v1:[\w+/]+\]$/);
  });

  it("says when the army is incomplete, and when the troops away come back", () => {
    const away = { ...state, army: { total: 3784, incomplete: true, returnsAt: at("2026-10-09T10:46:00Z") } };
    expect(summary(formatShare(away, null))).toContain(
      "Armée : 3 784, incomplète : des troupes sont dehors (retour le 09/10 à 12 h 46)",
    );
  });

  it("lists what changed since the previous share", () => {
    const previous: SharedState = {
      ...state,
      readAt: at("2026-10-05T08:00:00Z"),
      research: { weapons: 11, shield: 11, attackSpeed: 8 },
      army: { total: 3664, incomplete: false },
    };
    expect(summary(formatShare(state, previous))).toContain("Depuis le 05/10 : Armes 11 → 12, Armée +120");
  });

  it("only writes what is shared", () => {
    const levelsOnly: SharedState = { server: "s5", alliance: "ABC", pseudo: "Bob", readAt: state.readAt };
    expect(summary(formatShare({ ...levelsOnly, research: { weapons: 3 } }, null))).toEqual([
      "Optizzz · Bob (ABC, s5) · relevé le 09/10 à 13 h 36",
      "Recherches : Armes 3",
    ]);
  });

  it("fits in one Discord message (2 000 characters) with everything shared", () => {
    const everything: SharedState = {
      ...state,
      pseudo: "Un pseudo bien plus long que la moyenne",
      buildings: Object.fromEntries(BUILDINGS.map((b) => [b.key, 45])),
      research: Object.fromEntries(RESEARCH.map((r) => [r.key, 45])),
      works: [...BUILDINGS, ...RESEARCH].slice(0, 6).map((w) => ({ name: w.name, level: 46, endsAt: state.readAt })),
      army: {
        total: 14 * 123_456_789,
        units: Object.fromEntries(UNITS.map((u) => [u.key, 123_456_789])),
        incomplete: true,
        returnsAt: state.readAt,
      },
    };
    const text = formatShare(everything, state);
    expect(text.length).toBeLessThan(2000);
    expect(parseShares(text, { ...context, members: [everything.pseudo] }).states).toEqual([everything]);
  });

  it("writes a data line Discord keeps as it is when copied (no markdown character)", () => {
    const line =
      formatShare({ ...state, pseudo: "~~_ü_**" }, null)
        .split("\n")
        .at(-1) ?? "";
    expect(line.slice("[optizzz:v1:".length, -1)).toMatch(/^[A-Za-z0-9+/]+$/);
  });
});

describe("formatShare and parseShares", () => {
  it("reads back what was copied", () => {
    const { states, ignored } = parseShares(formatShare(state, null), context);
    expect(states).toEqual([state]);
    expect(ignored).toEqual([]);
  });

  it("finds every state in a pasted Discord channel, whatever is around", () => {
    const bob = { ...state, pseudo: "Bob", army: undefined };
    const channel = [
      "Éloïse — Aujourd'hui à 13:40",
      formatShare(state, null),
      "",
      "Bob — Aujourd'hui à 14:02",
      "voilà le mien",
      formatShare(bob, null),
      "👍 2",
    ].join("\n");
    expect(parseShares(channel, context).states.map((s) => s.pseudo)).toEqual(["Éloïse", "Bob"]);
  });

  it("skips and names the states of another server, another alliance or a nickname not in the alliance", () => {
    const channel = [
      formatShare({ ...state, server: "s2" }, null),
      formatShare({ ...state, alliance: "XYZ" }, null),
      formatShare({ ...state, pseudo: "Mallory" }, null),
    ].join("\n");
    expect(parseShares(channel, context)).toEqual({
      states: [],
      attackSpeeds: new Map(),
      ignored: ["Éloïse : autre serveur (s2)", "Éloïse : autre alliance (XYZ)", "Mallory : pas dans l'alliance"],
    });
  });

  it("matches the nickname of the members page whatever its case", () => {
    const { states } = parseShares(formatShare({ ...state, pseudo: "ÉLOÏSE" }, null), context);
    expect(states[0]?.pseudo).toBe("Éloïse");
  });

  it("reports a damaged data line", () => {
    expect(parseShares("[optizzz:v1:abc]", context)).toMatchObject({
      states: [],
      ignored: ["Ligne Optizzz illisible"],
    });
  });

  it("still reads the map's former « Pseudo: level » Attack Speed lines, naming the lines it skips", () => {
    expect(parseShares("bob : 7\n\nMallory: 3\nn'importe quoi", context)).toEqual({
      states: [],
      attackSpeeds: new Map([["Bob", 7]]),
      ignored: ["Mallory: 3", "n'importe quoi"],
    });
  });

  it("does not read « Pseudo: level » lines next to data lines: they are the summaries around them", () => {
    const channel = `Bob: 7\n${formatShare(state, null)}`;
    expect(parseShares(channel, context).attackSpeeds).toEqual(new Map());
  });
});
