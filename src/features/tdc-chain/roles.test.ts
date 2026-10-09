import { describe, expect, it } from "vitest";
import { exportRoles, importRoles, passerRanks, proposeRoles, type Role } from "./roles";

// Live fields of an alliance on S5, 2026-10-08.
const s5 = [
  ["Solenopsis", 11022],
  ["Tetramorium", 10395],
  ["Atta", 9614],
  ["Linepithema", 6948],
  ["Cataglyphis", 6790],
  ["Formica", 6073],
  ["Ectatomma", 5835],
  ["Tapinoma", 5820],
  ["Leptothorax", 5470],
  ["Anoplolepis", 5400],
  ["Monomorium", 4750],
  ["Temnothorax", 3630],
  ["Harpegnathos", 3150],
  ["Odontomachus", 3100],
  ["Pheidole", 3100],
].map(([pseudo, field], i) => ({ id: i + 1, pseudo: String(pseudo), field: Number(field) }));

const byPseudo = (roles: ReadonlyMap<number, unknown>) =>
  Object.fromEntries(s5.map((member) => [member.pseudo, roles.get(member.id)]));

describe("proposeRoles", () => {
  it("makes the biggest the granaries, then one rung per reach of the rung above, the last rung hunters", () => {
    const granary = { kind: "granary" };
    const passer1 = { kind: "passer", rank: 1 };
    const hunter = { kind: "hunter" };
    expect(byPseudo(proposeRoles(s5))).toEqual({
      Solenopsis: granary,
      Tetramorium: granary,
      Atta: granary,
      // 4 807 and more: in reach of Atta, the smallest granary.
      Linepithema: passer1,
      Cataglyphis: passer1,
      Formica: passer1,
      "Ectatomma": passer1,
      Tapinoma: passer1,
      Leptothorax: passer1,
      Anoplolepis: passer1,
      Monomorium: hunter,
      Temnothorax: hunter,
      Harpegnathos: hunter,
      Odontomachus: hunter,
      Pheidole: hunter,
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
    { id: 1, pseudo: "Solenopsis" },
    { id: 2, pseudo: "Atta" },
    { id: 3, pseudo: "Ectatomma" },
    { id: 4, pseudo: "Pheidole" },
  ];

  it("writes one « Pseudo: role » line per member, sorted by nickname", () => {
    const roles = new Map<number, Role>([
      [1, { kind: "granary" } as const],
      [2, { kind: "passer", rank: 2 } as const],
      [3, { kind: "hunter" } as const],
      [4, { kind: "out" } as const],
    ]);
    expect(exportRoles(roles, members)).toBe(
      "Atta: Passeur 2\nEctatomma: Chasseur\nPheidole: Hors chaîne\nSolenopsis: Grenier",
    );
  });

  it("reads them back by nickname, ignoring case and accents, and lists the lines it could not use", () => {
    const result = importRoles(
      "atta : passeur 2\nSolenopsis: GRENIER\n\nEctatomma:chasseur\nPheidole: hors chaine\nInconnu: Grenier\nSolenopsis sans rôle",
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
    expect(result.ignored).toEqual(["Inconnu: Grenier", "Solenopsis sans rôle"]);
    expect(importRoles("ÀTTA: Grenier", members).roles).toEqual(new Map([[2, { kind: "granary" }]]));
  });

  it("reads a passer without a number as the first passer", () => {
    expect(importRoles("Atta: Passeur", members).roles.get(2)).toEqual({ kind: "passer", rank: 1 });
  });
});

describe("passerRanks", () => {
  it("offers five passer ranks, highest first, even when the chain uses fewer", () => {
    expect(passerRanks([{ kind: "granary" }, { kind: "passer", rank: 1 }, { kind: "hunter" }])).toEqual([
      5, 4, 3, 2, 1,
    ]);
  });

  it("offers one rank above the highest used", () => {
    expect(passerRanks([{ kind: "passer", rank: 6 }])).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });
});
