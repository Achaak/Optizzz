import { describe, expect, it } from "vitest";
import {
  chainRoles,
  exportRoles,
  importRoles,
  granaryRanks,
  passerRanks,
  roleFromKey,
  roleKey,
  roleLabel,
  rungs,
  proposeRoles,
  roleOptions,
  rungPlaces,
  type Role,
} from "./roles";

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
    const granary = { kind: "granary", rank: 1 };
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
      Ectatomma: passer1,
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
      [1, { kind: "granary", rank: 1 }],
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
      [1, { kind: "granary", rank: 1 } as const],
      [2, { kind: "passer", rank: 2 } as const],
      [3, { kind: "hunter" } as const],
      [4, { kind: "out" } as const],
    ]);
    expect(exportRoles(roles, members)).toBe(
      "Atta: Passeur 2\nEctatomma: Chasseur\nPheidole: Hors chaîne\nSolenopsis: Grenier 1",
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
        [1, { kind: "granary", rank: 1 }],
        [3, { kind: "hunter" }],
        [4, { kind: "out" }],
      ]),
    );
    expect(result.ignored).toEqual(["Inconnu: Grenier", "Solenopsis sans rôle"]);
    expect(importRoles("ÀTTA: Grenier", members).roles).toEqual(new Map([[2, { kind: "granary", rank: 1 }]]));
  });

  it("reads a passer without a number as the first passer", () => {
    expect(importRoles("Atta: Passeur", members).roles.get(2)).toEqual({ kind: "passer", rank: 1 });
  });

  it("reads a granary's rank, a granary without one as the first", () => {
    const { roles } = importRoles("Atta: Grenier 2\nSolenopsis: grenier1", members);
    expect(roles.get(2)).toEqual({ kind: "granary", rank: 2 });
    expect(roles.get(1)).toEqual({ kind: "granary", rank: 1 });
    expect(roleLabel({ kind: "granary", rank: 2 })).toBe("Grenier 2");
  });
});

describe("passerRanks", () => {
  it("offers five passer ranks, highest first, even when the chain uses fewer", () => {
    expect(passerRanks([{ kind: "granary", rank: 1 }, { kind: "passer", rank: 1 }, { kind: "hunter" }])).toEqual([
      5, 4, 3, 2, 1,
    ]);
  });

  it("offers one rank above the highest used", () => {
    expect(passerRanks([{ kind: "passer", rank: 6 }])).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });
});

describe("granaryRanks", () => {
  it("offers two granary ranks, and one above the highest used", () => {
    expect(granaryRanks([{ kind: "granary", rank: 1 }])).toEqual([2, 1]);
    expect(granaryRanks([{ kind: "granary", rank: 3 }])).toEqual([4, 3, 2, 1]);
  });
});

describe("roleKey", () => {
  it("keeps « granary » for the first granary, as stored before the ranks, and reads every key back", () => {
    expect(roleKey({ kind: "granary", rank: 1 })).toBe("granary");
    expect(roleKey({ kind: "granary", rank: 2 })).toBe("granary:2");
    expect(roleFromKey("granary:1")).toEqual({ kind: "granary", rank: 1 });
    for (const role of roleOptions([])) expect(roleFromKey(roleKey(role))).toEqual(role);
    expect(roleFromKey("granary:0")).toBeNull();
  });
});

describe("rungs", () => {
  it("puts granary N N rungs above the highest passer", () => {
    const heights = rungs(
      new Map<number, Role>([
        [1, { kind: "granary", rank: 2 }],
        [2, { kind: "granary", rank: 1 }],
        [3, { kind: "passer", rank: 2 }],
        [4, { kind: "hunter" }],
      ]),
    );
    expect([...heights]).toEqual([
      [1, 4],
      [2, 3],
      [3, 2],
      [4, 0],
    ]);
  });
});

describe("chainRoles", () => {
  const members = [
    { id: 1, field: 1000 },
    { id: 2, field: 600 },
  ];

  it("proposes roles from the fields until the player sets them", () => {
    expect(chainRoles(members, null)).toEqual(proposeRoles(members, 0.01));
  });

  it("keeps the roles set, a member without one out of the chain", () => {
    expect(chainRoles(members, { 1: { kind: "granary", rank: 1 } })).toEqual(
      new Map([
        [1, { kind: "granary", rank: 1 }],
        [2, { kind: "out" }],
      ]),
    );
  });
});

describe("roleOptions", () => {
  it("offers the roles from the top of the chain down, the members to drain and not to touch before those out", () => {
    expect(roleOptions([{ kind: "passer", rank: 1 }]).map((role) => role.kind)).toEqual([
      "granary",
      "granary",
      "passer",
      "passer",
      "passer",
      "passer",
      "passer",
      "hunter",
      "drain",
      "protected",
      "out",
    ]);
  });
});

describe("rungPlaces", () => {
  const roles = new Map<number, Role>([
    [1, { kind: "granary", rank: 1 }],
    [2, { kind: "passer", rank: 1 }],
    [3, { kind: "passer", rank: 1 }],
    [4, { kind: "hunter" }],
    [5, { kind: "drain" }],
    [6, { kind: "out" }],
  ]);

  it("says who is bigger than a member of the rung above, or smaller than one of the rung below", () => {
    const fields = new Map([
      [1, 10_000],
      [2, 5000],
      [3, 3000],
      [4, 3500],
      [5, 9000],
      [6, 50],
    ]);
    expect(Object.fromEntries(rungPlaces(roles, fields))).toEqual({
      1: { kind: "ok" },
      2: { kind: "ok" },
      3: { kind: "down", than: 4 },
      4: { kind: "up", than: 3 },
    });
  });

  it("leaves out the members to drain and those out of the chain, whatever their field", () => {
    const places = rungPlaces(
      roles,
      new Map([
        [5, 1],
        [6, 1],
      ]),
    );
    expect(places.size).toBe(0);
  });
});

describe("importRoles with the new roles", () => {
  it("reads « À flooder » and « Ne pas toucher », accents and case aside", () => {
    const members = [
      { id: 1, pseudo: "Atta" },
      { id: 2, pseudo: "Formica" },
    ];
    const { roles, ignored } = importRoles("Atta: a flooder\nFormica: Ne pas toucher", members);
    expect(ignored).toEqual([]);
    expect(exportRoles(roles, members)).toBe("Atta: À flooder\nFormica: Ne pas toucher");
  });
});
