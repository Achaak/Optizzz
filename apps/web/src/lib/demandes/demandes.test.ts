import { createAllianceKeyring, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import { convoyEnvoiItems } from "@optizzz/game/site-links/envoi-convoys";
import { sealEnvoi } from "@optizzz/game/site-links/envois";
import type { Priorite } from "@optizzz/game/site-links/priorite";
import { beforeAll, describe, expect, it } from "vitest";
import { envoiCrypto, openConvoys } from "~/lib/envois/convoys";
import {
  canDecide,
  declaredConvoyEnvoi,
  groupDemandes,
  newDemande,
  openDemandes,
  requesterPriorites,
  resealDemande,
  type ServedDemande,
} from "./demandes";

const NOW = new Date("2026-10-26T12:00:00Z");
const HOUR = 3600_000;
const members = [
  { playerId: 1, pseudo: "Messor" },
  { playerId: 2, pseudo: "Lasius" },
];

describe("the Demandes on a space page", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  const served = async (
    playerId: number,
    status: ServedDemande["status"],
    rank: number,
    content = { key: "mushroom" as const, from: 11, level: 12, cost: { food: 0, materials: 120_000 }, typed: false },
  ): Promise<ServedDemande> => {
    const sealed = await newDemande({ server: "s5", playerId, content }, keyring);
    return {
      id: sealed.id,
      server: "s5",
      playerId,
      status,
      rank,
      blob: sealed.blob,
      createdAt: NOW.getTime(),
      decidedAt: null,
      decidedByPseudo: null,
      endedAt: null,
    };
  };

  it("seals a new Demande with the newest version of the key, and opens it with its requester and progress", async () => {
    const demande = await served(2, "validated", 0);
    const attached = await sealEnvoi(
      {
        server: "s5",
        playerId: 1,
        category: "demande-convoys",
        fingerprint: "fp1",
        observedAt: NOW.getTime(),
        item: {
          demande: demande.id,
          from: "Messor",
          to: "Lasius",
          food: 0,
          materials: 80_000,
          at: NOW.getTime() + HOUR,
        },
      },
      envoiCrypto(keyring),
    );
    const opened = await openDemandes(
      [demande],
      [{ server: "s5", playerId: 1, category: "demande-convoys", fingerprint: "fp1", blob: attached }],
      keyring,
      members,
      NOW,
    );
    expect(opened.refused).toBe(0);
    expect(opened.demandes).toMatchObject([
      {
        id: demande.id,
        requester: "Lasius",
        label: "Champignonnière niveau 12",
        status: "validated",
        progress: { onWay: { food: 0, materials: 80_000 }, remaining: { food: 0, materials: 40_000 } },
      },
    ]);
  });

  it("counts a Demande that does not open, or names another row, and leaves it out", async () => {
    const demande = await served(2, "pending", 0);
    const opened = await openDemandes([{ ...demande, playerId: 1 }], [], keyring, members, NOW);
    expect(opened).toEqual({ demandes: [], refused: 1, convoys: [] });
  });

  it("groups them: to validate, waiting for convoys or covered, then finished, each requester's in their order", async () => {
    const rows = [
      await served(2, "validated", 1),
      await served(2, "pending", 0),
      await served(1, "validated", 0),
      await served(1, "closed", 1),
    ];
    const opened = await openDemandes(rows, [], keyring, members, NOW);
    const groups = groupDemandes(opened.demandes);
    const pseudoAndStatus = (list: typeof opened.demandes) => list.map((d) => `${d.requester} ${d.status}`);
    expect(pseudoAndStatus(groups.pending)).toEqual(["Lasius pending"]);
    expect(pseudoAndStatus(groups.active)).toEqual(["Messor validated", "Lasius validated"]);
    expect(pseudoAndStatus(groups.finished)).toEqual(["Messor closed"]);
  });

  it("ranks the Demandes by their requester's Priorité, the lowest first, each requester's still in their order", async () => {
    const rows = [
      await served(1, "validated", 1),
      await served(1, "validated", 0),
      await served(2, "validated", 0),
      await served(2, "pending", 0),
      await served(3, "validated", 0),
      await served(3, "pending", 0),
    ];
    const opened = await openDemandes(rows, [], keyring, [...members, { playerId: 3, pseudo: "Atta" }], NOW);
    const priorites = new Map<number, Priorite>([
      [1, { kind: "known", solde: 10, production: 1, days: 10, bound: "exact", atLeast: false }],
      [2, { kind: "known", solde: -1, production: 1, days: -1, bound: "exact", atLeast: false }],
    ]);
    const groups = groupDemandes(opened.demandes, priorites);
    const order = (list: typeof opened.demandes) => list.map((d) => `${d.requester} ${String(d.rank)}`);
    // Atta's Priorité is unknown: last, never hidden.
    expect(order(groups.active)).toEqual(["Lasius 0", "Messor 0", "Messor 1", "Atta 0"]);
    expect(order(groups.pending)).toEqual(["Lasius 0", "Atta 0"]);
  });
});

describe("changed Demandes and declared convoys on a space page", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });
  const content = {
    key: "mushroom" as const,
    from: 11,
    level: 12,
    cost: { food: 0, materials: 120_000 },
    typed: false,
  };

  it("opens a Demande sealed again with its new content, its day and « autofinancée »", async () => {
    const sealed = await newDemande({ server: "s5", playerId: 2, content }, keyring);
    const changed = { ...content, cost: { food: 0, materials: 60_000 }, wanted: NOW.getTime(), self: true };
    const again = await resealDemande({ id: sealed.id, server: "s5", playerId: 2 }, changed, keyring);
    const row = {
      id: sealed.id,
      server: "s5",
      playerId: 2,
      status: "validated" as const,
      rank: 0,
      blob: again.blob,
      createdAt: NOW.getTime(),
      decidedAt: null,
      decidedByPseudo: null,
      endedAt: null,
    };
    const opened = await openDemandes([row], [], keyring, members, NOW);
    expect(opened.demandes[0]?.content).toEqual(changed);
  });

  it("counts a declared convoy for its Demande, with who declared it", async () => {
    const sealed = await newDemande({ server: "s5", playerId: 2, content }, keyring);
    const convoy = {
      demande: sealed.id,
      from: "Messor",
      to: "Lasius",
      food: 0,
      materials: 50_000,
      at: NOW.getTime() - HOUR,
    };
    const { item } = await declaredConvoyEnvoi({ server: "s5", playerId: 1 }, convoy, keyring, NOW);
    const row = {
      id: sealed.id,
      server: "s5",
      playerId: 2,
      status: "validated" as const,
      rank: 0,
      blob: sealed.blob,
      createdAt: NOW.getTime(),
      decidedAt: null,
      decidedByPseudo: null,
      endedAt: null,
    };
    const opened = await openDemandes(
      [row],
      [{ server: "s5", playerId: 1, category: "declared-convoys", fingerprint: item.fingerprint, blob: item.blob }],
      keyring,
      members,
      NOW,
    );
    expect(opened.demandes[0]?.progress.received).toEqual({ food: 0, materials: 50_000 });
    expect(opened.convoys[0]?.declared).toEqual({ playerId: 1, fingerprint: item.fingerprint });
  });
});

describe("the requesters' Priorité on a space page", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  /** A member's convoys, sealed as their extension sends them. */
  async function sent(playerId: number, me: string, kept: Partial<Parameters<typeof convoyEnvoiItems>[0]>) {
    const crypto = envoiCrypto(keyring);
    const items = convoyEnvoiItems({ server: "s5", me, outgoing: [], incoming: [], history: [], ...kept });
    return Promise.all(
      items.map(async ({ identity, item }) => {
        const fingerprint = await crypto.fingerprint(identity);
        const envelope = { server: "s5", playerId, category: "convoys" as const, fingerprint, observedAt: 0, item };
        return { server: "s5", playerId, category: "convoys", fingerprint, blob: await sealEnvoi(envelope, crypto) };
      }),
    );
  }

  const production = {
    foodWorkers: 2_000,
    materialWorkers: 3_000,
    mushroomPerDay: 10_000,
    taxRate: 0,
    master: null,
    colonies: [],
  };
  const stateOf = (pseudo: string): MemberStates => ({
    latest: { server: "s5", alliance: "TAG", pseudo, readAt: NOW, production },
  });

  it("counts a convoy reported by its sender and its recipient once", async () => {
    const at = new Date(NOW.getTime() - 24 * HOUR);
    const rows = [
      ...(await sent(1, "Messor", {
        history: [{ direction: "sent", player: "Lasius", food: 0, materials: 4_600_000, at }],
      })),
      ...(await sent(2, "Lasius", {
        history: [{ direction: "received", player: "Messor", food: 0, materials: 4_600_000, at }],
      })),
    ];
    const { convoys } = await openConvoys(rows, keyring, members);
    const sends = [
      { playerId: 1, categories: ["convoys"] },
      { playerId: 2, categories: ["production", "convoys"] },
    ];
    const priorites = requesterPriorites(members, { convoys, states: [stateOf("Lasius")], sends }, NOW);
    // 4 600 000 received over 250 000 a day.
    expect(priorites.get(2)).toMatchObject({ kind: "known", solde: 4_600_000, days: 18.4 });
    // Messor sends no Production.
    expect(priorites.get(1)).toMatchObject({ kind: "unknown", solde: -4_600_000, missing: ["production"] });
  });

  it("leaves the Solde untold for a requester who does not send their Convois, and ignores a state they stopped sending", () => {
    const sends = [{ playerId: 2, categories: [] }];
    expect(
      requesterPriorites(members.slice(1), { convoys: [], states: [stateOf("Lasius")], sends }, NOW).get(2),
    ).toMatchObject({ kind: "unknown", missing: ["production", "convoys"] });
  });
});

describe("who decides a Demande à valider", () => {
  it("is an Admin, even for their own, or a Délégué for the others' only", () => {
    expect(canDecide("admin", false)).toBe(true);
    expect(canDecide("admin", true)).toBe(true);
    expect(canDecide("delegate", false)).toBe(true);
    expect(canDecide("delegate", true)).toBe(false);
    expect(canDecide("member", false)).toBe(false);
    expect(canDecide("member", true)).toBe(false);
  });
});
