import { describe, expect, it } from "vitest";
import { exportRoles, importRoles, proposeRoles, type Role } from "./roles";

// Live fields of an alliance on S5, 2026-10-08.
const s5 = [
  ["Peanut", 11022],
  ["Hardware", 10395],
  ["Delta", 9614],
  ["Ajar", 6948],
  ["Solostar357", 6790],
  ["Achak", 6073],
  ["Vik.Bat", 5835],
  ["SSovietsky", 5820],
  ["Nythrakar", 5470],
  ["Khan", 5400],
  ["Psycho62", 4750],
  ["Darkgirl62", 3630],
  ["AlKyy", 3150],
  ["Justixon", 3100],
  ["Morel", 3100],
].map(([pseudo, field], i) => ({ id: i + 1, pseudo: String(pseudo), field: Number(field) }));

const byPseudo = (roles: ReadonlyMap<number, unknown>) =>
  Object.fromEntries(s5.map((member) => [member.pseudo, roles.get(member.id)]));

describe("proposeRoles", () => {
  it("makes the biggest the granaries, then one rung per reach of the rung above, the last rung hunters", () => {
    const granary = { kind: "granary" };
    const passer1 = { kind: "passer", rank: 1 };
    const hunter = { kind: "hunter" };
    expect(byPseudo(proposeRoles(s5))).toEqual({
      Peanut: granary,
      Hardware: granary,
      Delta: granary,
      // 4 807 and more: in reach of Delta, the smallest granary.
      Ajar: passer1,
      Solostar357: passer1,
      Achak: passer1,
      "Vik.Bat": passer1,
      SSovietsky: passer1,
      Nythrakar: passer1,
      Khan: passer1,
      Psycho62: hunter,
      Darkgirl62: hunter,
      AlKyy: hunter,
      Justixon: hunter,
      Morel: hunter,
    });
  });
});

describe("proposeRoles with close fields", () => {
  it("keeps the biggest alone as granary, the others hunters", () => {
    const roles = proposeRoles([
      { id: 1, field: 1000 },
      { id: 2, field: 950 },
      { id: 3, field: 900 },
    ]);
    expect([...roles.entries()]).toEqual([
      [1, { kind: "granary" }],
      [2, { kind: "hunter" }],
      [3, { kind: "hunter" }],
    ]);
  });
});

describe("sharing roles", () => {
  const members = [
    { id: 1, pseudo: "Peanut" },
    { id: 2, pseudo: "Delta" },
    { id: 3, pseudo: "Vik.Bat" },
    { id: 4, pseudo: "Morel" },
  ];

  it("writes one « Pseudo: role » line per member, sorted by nickname", () => {
    const roles = new Map<number, Role>([
      [1, { kind: "granary" } as const],
      [2, { kind: "passer", rank: 2 } as const],
      [3, { kind: "hunter" } as const],
      [4, { kind: "out" } as const],
    ]);
    expect(exportRoles(roles, members)).toBe(
      "Delta: Passeur 2\nMorel: Hors chaîne\nPeanut: Grenier\nVik.Bat: Chasseur",
    );
  });

  it("reads them back by nickname, ignoring case and accents, and lists the lines it could not use", () => {
    const result = importRoles(
      "delta : passeur 2\nPeanut: GRENIER\n\nVik.Bat:chasseur\nMorel: hors chaine\nInconnu: Grenier\nPeanut sans rôle",
      members,
    );
    expect(result.roles).toEqual(
      new Map([
        [2, { kind: "passer", rank: 2 }],
        [1, { kind: "granary" }],
        [3, { kind: "hunter" }],
        [4, { kind: "out" }],
      ]),
    );
    expect(result.ignored).toEqual(["Inconnu: Grenier", "Peanut sans rôle"]);
    expect(importRoles("DÉLTA: Grenier", members).roles).toEqual(new Map([[2, { kind: "granary" }]]));
  });

  it("reads a passer without a number as the first passer", () => {
    expect(importRoles("Delta: Passeur", members).roles.get(2)).toEqual({ kind: "passer", rank: 1 });
  });
});
