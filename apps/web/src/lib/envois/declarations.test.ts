import { createAllianceKeyring, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import {
  DECLARED_FLOOD_CATEGORY,
  DECLARED_HUNT_CATEGORY,
  DECLARED_TRANSIT_CATEGORY,
} from "@optizzz/game/site-links/declarations";
import { DECLARED_CONVOY_CATEGORY } from "@optizzz/game/site-links/demandes";
import { beforeAll, describe, expect, it } from "vitest";
import type { AllianceConvoy } from "./convoys";
import { mergeDeclarations, myDeclarations, openDeclarations, sealDeclaration } from "./declarations";
import type { AllianceFlood } from "./floods";
import type { AllianceHunt } from "./hunts";

const NOW = new Date("2026-11-04T12:36:00Z");
const MIN = 60_000;
const AT = NOW.getTime() + 300 * MIN;
const members = [
  { playerId: 1, pseudo: "XaTaK" },
  { playerId: 2, pseudo: "Formica" },
];
const me = { server: "s5", playerId: 1 };

describe("the declarations of the page « Déclarer »", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  /** A declaration as the site keeps it: the sealed item, filed under the declarer's Joueur. */
  const row = async (
    category: Parameters<typeof sealDeclaration>[1],
    item: Parameters<typeof sealDeclaration>[2],
    sender = me,
  ) => {
    const { item: sealed } = await sealDeclaration(sender, category, item, keyring, NOW);
    return { server: sender.server, playerId: sender.playerId, category, ...sealed };
  };

  it("seals only ciphertext, kept 90 days after the arrival, each with its own fingerprint", async () => {
    const flood = { target: "Lasius", attacks: 3, at: AT };
    const first = await sealDeclaration(me, DECLARED_FLOOD_CATEGORY, flood, keyring, NOW);
    const second = await sealDeclaration(me, DECLARED_FLOOD_CATEGORY, flood, keyring, NOW);
    expect(first.keyVersion).toBe(1);
    expect(first.item.blob).not.toContain("Lasius");
    expect(first.item.fingerprint).not.toBe(second.item.fingerprint);
    expect(first.item.expiresAt).toBe(AT + 90 * 24 * 60 * MIN);
  });

  it("opens the three kinds and the convoys declared for a Demande, each named after its sender", async () => {
    const flood = await row(DECLARED_FLOOD_CATEGORY, { target: "Lasius", attacks: 2, at: AT });
    const rows = [
      flood,
      await row(DECLARED_TRANSIT_CATEGORY, { to: "Formica", food: 12_348, materials: 0, at: AT }),
      await row(DECLARED_HUNT_CATEGORY, { fieldGain: 1_250, returnsAt: AT }),
      await row(DECLARED_CONVOY_CATEGORY, {
        demande: "5b0f8d4e-6c1a-4f2b-9a3e-1d2c3b4a5f60",
        from: "XaTaK",
        to: "Formica",
        food: 500,
        materials: 600,
        at: AT,
      }),
    ];
    const moved = { ...(await row(DECLARED_HUNT_CATEGORY, { fieldGain: 1, returnsAt: AT })), playerId: 2 };
    const opened = await openDeclarations([...rows, moved, { ...flood, category: "floods" }], keyring, members);
    expect(opened.refused).toBe(1);
    expect(opened.floods).toMatchObject([{ from: "XaTaK", target: "Lasius", attacks: 2, at: AT }]);
    expect(opened.transits).toMatchObject([
      { from: "XaTaK", to: "Formica", food: 12_348, materials: 0, at: AT, demande: null },
      {
        from: "XaTaK",
        to: "Formica",
        food: 500,
        materials: 600,
        at: AT,
        demande: "5b0f8d4e-6c1a-4f2b-9a3e-1d2c3b4a5f60",
      },
    ]);
    expect(opened.hunts).toMatchObject([{ hunter: "XaTaK", fieldGain: 1_250, returnsAt: AT }]);
  });

  it("lists the member's own declarations still to come, soonest first, with a line for each", async () => {
    const rows = [
      await row(DECLARED_HUNT_CATEGORY, { fieldGain: 1_250, returnsAt: AT + 60 * MIN }),
      await row(DECLARED_FLOOD_CATEGORY, { target: "Lasius", attacks: 3, at: AT }),
      await row(DECLARED_FLOOD_CATEGORY, { target: "Messor", attacks: 1, at: NOW.getTime() - MIN }),
      await row(
        DECLARED_TRANSIT_CATEGORY,
        { to: "XaTaK", food: 1, materials: 0, at: AT },
        { server: "s5", playerId: 2 },
      ),
    ];
    const opened = await openDeclarations(rows, keyring, members);
    expect(myDeclarations(opened, 1, NOW).map((d) => [d.category, d.text])).toEqual([
      [DECLARED_FLOOD_CATEGORY, "3 attaques sur Lasius, arrivée aujourd'hui 18 h 36"],
      [DECLARED_HUNT_CATEGORY, "Chasse de 1 250 cm², retour aujourd'hui 19 h 36"],
    ]);
  });

  it("adds them to the alliance's lists marked declared, unless the member's extension covers them", async () => {
    const opened = await openDeclarations(
      [
        await row(DECLARED_FLOOD_CATEGORY, { target: "Lasius", attacks: 2, at: AT }),
        await row(DECLARED_FLOOD_CATEGORY, { target: "Messor", attacks: 1, at: AT }),
        await row(DECLARED_TRANSIT_CATEGORY, { to: "Formica", food: 12_348, materials: 0, at: AT }),
        await row(DECLARED_TRANSIT_CATEGORY, { to: "Formica", food: 99, materials: 0, at: NOW.getTime() - MIN }),
        await row(DECLARED_HUNT_CATEGORY, { fieldGain: 1_250, returnsAt: AT }),
        await row(DECLARED_HUNT_CATEGORY, { fieldGain: 800, returnsAt: AT }),
      ],
      keyring,
      members,
    );
    const sentFlood: AllianceFlood = {
      from: "XaTaK",
      target: "Messor",
      at: AT + MIN,
      take: 10,
      fingerprint: "f",
      observedAt: 1,
      army: null,
    };
    const sentConvoy: AllianceConvoy = {
      kind: "transit",
      from: "XaTaK",
      to: "Formica",
      food: 12_348,
      materials: 0,
      at: AT,
      fingerprint: "c",
      observedAt: 1,
      reporter: "XaTaK",
    };
    const loggedHunt: AllianceHunt = {
      hunter: "XaTaK",
      fieldGain: 800,
      returnsAt: AT,
      ants: null,
      fingerprint: "h",
      observedAt: 1,
    };
    const merged = mergeDeclarations(
      { floods: [sentFlood], convoys: [sentConvoy], hunts: [loggedHunt], states: [] },
      opened,
      NOW,
    );
    // Lasius: two attacks, one row each; Messor is covered by the extension's attack.
    expect(merged.floods.filter((f) => f.declared).map((f) => [f.target, f.take])).toEqual([
      ["Lasius", null],
      ["Lasius", null],
    ]);
    expect(merged.floods).toHaveLength(3);
    // The convoy on its way is covered; the one arrived counts as delivered.
    expect(merged.convoys.filter((c) => c.declared).map((c) => [c.kind, c.food, c.reporter])).toEqual([
      ["delivered", 99, "XaTaK"],
    ]);
    expect(merged.hunts.filter((h) => h.declared).map((h) => h.fieldGain)).toEqual([1_250]);
  });

  it("lets a hunt the member's state shows cover a declared one", async () => {
    const opened = await openDeclarations(
      [await row(DECLARED_HUNT_CATEGORY, { fieldGain: 1_250, returnsAt: AT })],
      keyring,
      members,
    );
    const states = [
      {
        latest: { pseudo: "XaTaK", hunts: [{ returnsAt: new Date(AT + 30_000), fieldGain: 1_250 }] },
        previous: null,
      },
    ] as unknown as Parameters<typeof mergeDeclarations>[0]["states"];
    expect(mergeDeclarations({ floods: [], convoys: [], hunts: [], states }, opened, NOW).hunts).toEqual([]);
  });
});
