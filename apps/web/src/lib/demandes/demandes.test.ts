import { createAllianceKeyring, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { sealEnvoi } from "@optizzz/game/site-links/envois";
import { beforeAll, describe, expect, it } from "vitest";
import { envoiCrypto } from "~/lib/envois/convoys";
import { groupDemandes, newDemande, openDemandes, type ServedDemande } from "./demandes";

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
    expect(opened).toEqual({ demandes: [], refused: 1 });
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
});
