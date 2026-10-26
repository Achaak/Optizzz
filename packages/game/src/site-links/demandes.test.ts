import { describe, expect, it } from "vitest";
import type { EnvoiCrypto } from "./envois";
import {
  convoyFill,
  demandeConvoyLink,
  demandeIdOfHash,
  demandeLabel,
  demandeProgress,
  DemandeRefused,
  openDemande,
  reachedDemandes,
  sealDemande,
  shownStatus,
  STATUS_LABEL,
  tableCost,
  type DemandeContent,
} from "./demandes";

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const OTHER = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const NOW = new Date("2026-10-26T12:00:00Z");
const HOUR = 3600_000;

/** A reversible stand-in for libsodium (tested in @optizzz/crypto). */
const crypto: EnvoiCrypto = {
  encrypt: (text) => Promise.resolve(btoa(encodeURIComponent(text))),
  decrypt: (blob) => Promise.resolve(decodeURIComponent(atob(blob))),
  fingerprint: (text) => Promise.resolve(text),
};

const content: DemandeContent = {
  key: "mushroom",
  from: 11,
  level: 12,
  cost: { food: 0, materials: 120_000 },
  typed: false,
};

describe("a Demande's content", () => {
  it("opens for the row it was sealed for", async () => {
    const blob = await sealDemande({ id: ID, server: "s5", playerId: 7, content }, crypto);
    await expect(openDemande({ id: ID, server: "s5", playerId: 7, blob }, crypto)).resolves.toEqual(content);
  });

  it("is refused under another Demande, Joueur or server: the site cannot move it", async () => {
    const blob = await sealDemande({ id: ID, server: "s5", playerId: 7, content }, crypto);
    for (const row of [
      { id: OTHER, server: "s5", playerId: 7 },
      { id: ID, server: "s2", playerId: 7 },
      { id: ID, server: "s5", playerId: 8 },
    ])
      await expect(openDemande({ ...row, blob }, crypto)).rejects.toThrow(DemandeRefused);
  });

  it("is refused when it does not open or says nonsense", async () => {
    const nonsense = await crypto.encrypt(JSON.stringify({ v: 1, id: ID, server: "s5", playerId: 7, content: {} }));
    await expect(openDemande({ id: ID, server: "s5", playerId: 7, blob: nonsense }, crypto)).rejects.toThrow(
      DemandeRefused,
    );
  });

  it("is named as the game names its building or research", () => {
    expect(demandeLabel(content)).toBe("Champignonnière niveau 12");
    expect(demandeLabel({ ...content, key: "attackSpeed", from: 4, level: 6 })).toBe("Vitesse d’attaque niveaux 5 à 6");
  });
});

describe("the cost from the table", () => {
  it("adds up the levels after the one held, food and materials", () => {
    // Champignonnière 1 and 2: 90 then 166 materials (× 1.85, floored).
    expect(tableCost("mushroom", 0, 2)).toEqual({ food: 0, materials: 256 });
    // Technique de ponte 1: 120 food and 120 materials.
    expect(tableCost("laying", 0, 1)).toEqual({ food: 120, materials: 120 });
  });

  it("is nothing when the level aimed is not above the one held", () => {
    expect(tableCost("mushroom", 5, 5)).toEqual({ food: 0, materials: 0 });
  });
});

describe("what the convoys attached to a Demande cover", () => {
  const demande = { id: ID, requester: "Lasius", cost: { food: 10_000, materials: 100_000 } };
  const convoy = (
    food: number,
    materials: number,
    at: number,
    extra: Partial<{ demande: string; to: string }> = {},
  ) => ({
    demande: ID,
    from: "Messor",
    to: "lasius",
    food,
    materials,
    at,
    ...extra,
  });

  it("counts convoys received and on their way, and what remains to send", () => {
    const progress = demandeProgress(
      demande,
      [convoy(0, 30_000, NOW.getTime() - HOUR), convoy(5_000, 20_000, NOW.getTime() + HOUR)],
      NOW,
    );
    expect(progress).toEqual({
      received: { food: 0, materials: 30_000 },
      onWay: { food: 5_000, materials: 20_000 },
      remaining: { food: 5_000, materials: 50_000 },
      covered: false,
    });
  });

  it("is covered once received and on their way reach the cost, a resource sent beyond it not counting for the other", () => {
    const progress = demandeProgress(
      demande,
      [convoy(50_000, 60_000, NOW.getTime() - HOUR), convoy(0, 40_000, NOW.getTime() + HOUR)],
      NOW,
    );
    expect(progress.remaining).toEqual({ food: 0, materials: 0 });
    expect(progress.covered).toBe(true);
  });

  it("leaves out a convoy attached to another Demande, or sent to someone else", () => {
    const progress = demandeProgress(
      demande,
      [convoy(0, 30_000, 0, { demande: OTHER }), convoy(0, 30_000, 0, { to: "Formica" })],
      NOW,
    );
    expect(progress.remaining).toEqual(demande.cost);
  });
});

describe("the status shown", () => {
  it("says « couverte » for a validated Demande covered, the stored status otherwise", () => {
    expect(shownStatus("validated", true)).toBe("covered");
    expect(shownStatus("validated", false)).toBe("validated");
    expect(shownStatus("pending", true)).toBe("pending");
    expect(Object.values(STATUS_LABEL)).toEqual(["à valider", "validée", "couverte", "refusée", "close", "annulée"]);
  });
});

describe("Demandes reached in the game", () => {
  const open = [
    { id: "a", content: { ...content, key: "mushroom" as const, level: 12 } },
    { id: "b", content: { ...content, key: "laying" as const, level: 8 } },
    { id: "c", content: { ...content, key: "dome" as const, level: 3 } },
  ];

  it("closes the Demandes whose level is reached, or whose work is under way", () => {
    expect(
      reachedDemandes(open, {
        levels: { mushroom: 12, dome: 1 },
        works: [{ name: "Technique de ponte", level: 8 }],
      }),
    ).toEqual(["a", "b"]);
  });

  it("closes nothing from a level below, or from a page that does not show it", () => {
    expect(reachedDemandes(open, { levels: { mushroom: 11 }, works: [{ name: "Dôme", level: 2 }] })).toEqual([]);
  });
});

describe("the link to the game's Convoi page", () => {
  it("carries the Demande's id in the fragment only: nothing of it reaches the game", () => {
    const link = demandeConvoyLink("https://s5.fourmizzz.fr", ID);
    expect(link).toBe(`https://s5.fourmizzz.fr/commerce.php#optizzz-demande=${ID}`);
    expect(demandeIdOfHash(new URL(link).hash)).toBe(ID);
    expect(demandeIdOfHash("#optizzz-demande=nope")).toBeNull();
    expect(demandeIdOfHash("")).toBeNull();
  });
});

describe("what the form is filled with", () => {
  it("the remainder, within what the player holds", () => {
    expect(convoyFill({ food: 5_000, materials: 50_000 }, { food: 100_000, materials: 20_000 })).toEqual({
      food: 5_000,
      materials: 20_000,
      short: true,
    });
    expect(convoyFill({ food: 5_000, materials: 50_000 }, null)).toEqual({
      food: 5_000,
      materials: 50_000,
      short: false,
    });
  });
});
