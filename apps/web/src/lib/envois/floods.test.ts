import { createAllianceKeyring, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { floodEnvoiItems, type FloodsKept } from "@optizzz/game/site-links/envoi-floods";
import { sealEnvoi } from "@optizzz/game/site-links/envois";
import { beforeAll, describe, expect, it } from "vitest";
import { envoiCrypto } from "./convoys";
import { floodsByTarget, openFloods, type AllianceFlood } from "./floods";

const NOW = new Date("2026-10-26T15:00:00Z");
const ARRIVAL = new Date("2026-10-26T17:12:00Z");

/** What a member's extension sends: its attacks on their way, each sealed with the Clé d'alliance, the army apart. */
async function sent(keyring: AllianceKeyring, playerId: number, me: string, attacks: FloodsKept["attacks"]) {
  const crypto = envoiCrypto(keyring);
  return Promise.all(
    floodEnvoiItems({ server: "s5", me, attacks }).map(async ({ identity, item, detail }, index) => {
      const fingerprint = await crypto.fingerprint(identity);
      const envelope = { server: "s5", playerId, category: "floods" as const, fingerprint, observedAt: 1 };
      return {
        id: `${String(playerId)}-${String(index)}`,
        server: "s5",
        playerId,
        category: "floods",
        fingerprint,
        blob: await sealEnvoi({ ...envelope, item }, crypto),
        detail: detail && (await sealEnvoi({ ...envelope, item: detail }, crypto)),
      };
    }),
  );
}

const flood = (from: string, target: string, at: Date): AllianceFlood => ({
  from,
  target,
  at: at.getTime(),
  take: null,
  army: null,
  fingerprint: `${from}-${target}-${String(at.getTime())}`,
  observedAt: 0,
});

describe("the alliance's floods on the space page", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  it("opens the members' floods, with the army sent when the site handed it (to an Admin)", async () => {
    const rows = await sent(keyring, 1, "Messor", [
      { attackId: 7, target: "Lasius", arrivesAt: ARRIVAL, take: 12_348, army: { JSN: 12_348 } },
      { attackId: 8, target: "Ennemi", arrivesAt: ARRIVAL, take: null, army: null },
    ]);
    const { floods, refused } = await openFloods(rows, keyring);
    expect(refused).toBe(0);
    expect(floods.map(({ from, target, take, army }) => ({ from, target, take, army }))).toEqual([
      { from: "Messor", target: "Lasius", take: 12_348, army: { JSN: 12_348 } },
      { from: "Messor", target: "Ennemi", take: null, army: null },
    ]);
    // A member: the site leaves the army out.
    const member = await openFloods(
      rows.map((r) => ({ ...r, detail: null })),
      keyring,
    );
    expect(member.floods.map((f) => f.army)).toEqual([null, null]);
  });

  it("refuses a flood filed under another member, or an army swapped from another flood", async () => {
    const [lasius] = await sent(keyring, 2, "Lasius", [
      { attackId: 1, target: "Messor", arrivesAt: ARRIVAL, take: 5, army: { JSN: 5 } },
    ]);
    const [other] = await sent(keyring, 2, "Lasius", [
      { attackId: 2, target: "Formica", arrivesAt: ARRIVAL, take: 900, army: { JSN: 900 } },
    ]);
    if (!lasius || !other) throw new Error("no rows");
    const { floods, refused } = await openFloods(
      [
        { ...lasius, playerId: 3 },
        { ...other, detail: lasius.detail },
      ],
      keyring,
    );
    expect(refused).toBe(1);
    // The flood stays; the army that is not its own is left out.
    expect(floods).toEqual([expect.objectContaining({ target: "Formica", army: null })]);
  });

  it("groups the floods by target: on their way soonest first, arrived the latest first", () => {
    const later = new Date(ARRIVAL.getTime() + 3_600_000);
    const past = new Date(NOW.getTime() - 3_600_000);
    const floods = [
      flood("Messor", "Ennemi", later),
      flood("Lasius", "Formica", ARRIVAL),
      flood("Lasius", "Ennemi", ARRIVAL),
      flood("Messor", "Ennemi", past),
    ];
    expect(floodsByTarget(floods, "transit", NOW)).toEqual([
      { target: "Formica", floods: [floods[1]] },
      { target: "Ennemi", floods: [floods[2], floods[0]] },
    ]);
    expect(floodsByTarget(floods, "arrived", NOW)).toEqual([{ target: "Ennemi", floods: [floods[3]] }]);
  });
});
