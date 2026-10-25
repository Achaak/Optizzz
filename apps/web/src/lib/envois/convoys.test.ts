import { createAllianceKeyring, rotateAllianceKey, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { dataFingerprint } from "@optizzz/crypto/data-fingerprint";
import { convoyEnvoiItems } from "@optizzz/game/site-links/envoi-convoys";
import { sealEnvoi } from "@optizzz/game/site-links/envois";
import { beforeAll, describe, expect, it } from "vitest";
import { envoiCrypto, filterConvoys, openConvoys, type AllianceConvoy } from "./convoys";

const NOW = new Date("2026-10-25T15:00:00Z");
const members = [
  { playerId: 1, pseudo: "Messor" },
  { playerId: 2, pseudo: "Lasius" },
];

/** What a member's extension sends: its convoys, sealed with the Clé d'alliance (as the background does). */
async function sent(
  keyring: AllianceKeyring,
  playerId: number,
  me: string,
  kept: Partial<Parameters<typeof convoyEnvoiItems>[0]>,
  observedAt = NOW.getTime(),
) {
  const crypto = envoiCrypto(keyring);
  const items = convoyEnvoiItems({ server: "s5", me, outgoing: [], incoming: [], history: [], ...kept });
  return Promise.all(
    items.map(async ({ identity, item }, index) => {
      const fingerprint = await crypto.fingerprint(identity);
      const envelope = { server: "s5", playerId, category: "convoys" as const, fingerprint, observedAt, item };
      return {
        id: `${String(playerId)}-${String(index)}`,
        server: "s5",
        playerId,
        category: "convoys",
        fingerprint,
        blob: await sealEnvoi(envelope, crypto),
      };
    }),
  );
}

describe("the alliance's convoys on the space page", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  it("opens the members' Envois and counts a convoy seen by both sides once", async () => {
    const arrival = new Date("2026-10-25T16:12:00Z");
    const rows = [
      ...(await sent(keyring, 1, "Messor", {
        outgoing: [{ recipient: "Lasius", food: 0, materials: 350_000, arrivesAt: arrival }],
      })),
      ...(await sent(
        keyring,
        2,
        "Lasius",
        {
          incoming: [
            { sender: "Messor", food: 0, materials: 350_000, arrivesAt: new Date(arrival.getTime() + 30_000) },
          ],
        },
        NOW.getTime() + 1000,
      )),
    ];
    const { convoys, refused } = await openConvoys(rows, keyring, members);
    expect(refused).toBe(0);
    expect(convoys).toEqual([
      expect.objectContaining({
        kind: "transit",
        from: "Messor",
        to: "Lasius",
        materials: 350_000,
        reporter: "Lasius",
      }),
    ]);
  });

  it("refuses an Envoi filed under another member, and one it cannot open", async () => {
    const [mine] = await sent(keyring, 1, "Messor", {
      history: [{ direction: "sent", player: "Lasius", food: 1, materials: 2, at: NOW }],
    });
    if (!mine) throw new Error("no row");
    const moved = { ...mine, playerId: 2 };
    const other = await sent(await createAllianceKeyring(), 2, "Lasius", {
      history: [{ direction: "sent", player: "Messor", food: 1, materials: 2, at: NOW }],
    });
    const { convoys, refused } = await openConvoys([moved, ...other], keyring, members);
    expect(convoys).toEqual([]);
    expect(refused).toBe(2);
  });

  it("reads the convoys sent before a new version of the Clé d'alliance", async () => {
    const before = await sent(keyring, 1, "Messor", {
      history: [{ direction: "sent", player: "Lasius", food: 1, materials: 2, at: NOW }],
    });
    const { convoys } = await openConvoys(before, await rotateAllianceKey(keyring), members);
    expect(convoys).toHaveLength(1);
    expect(await dataFingerprint("x", keyring)).not.toBe(await dataFingerprint("x", await rotateAllianceKey(keyring)));
  });
});

describe("the filters of the « Convois » tab", () => {
  const convoy = (over: Partial<AllianceConvoy>): AllianceConvoy => ({
    kind: "delivered",
    from: "Messor",
    to: "Lasius",
    food: 1,
    materials: 1,
    at: NOW.getTime() - 3600_000,
    fingerprint: Math.random().toString(),
    observedAt: 0,
    reporter: "Messor",
    ...over,
  });
  const onWay = convoy({ kind: "transit", at: NOW.getTime() + 3600_000 });
  const arrived = convoy({ kind: "transit", at: NOW.getTime() - 60_000 });
  const delivered = convoy({});
  const others = convoy({ from: "Lasius", to: "Polyergus" });

  it("shows those on their way, those delivered, or both, newest first; an arrived one waits for its delivery", () => {
    const all = [delivered, onWay, arrived, others];
    expect(filterConvoys(all, { state: "transit", member: null }, NOW)).toEqual([onWay]);
    expect(filterConvoys(all, { state: "delivered", member: null }, NOW)).toEqual([delivered, others]);
    expect(filterConvoys(all, { state: "all", member: null }, NOW)).toEqual([onWay, delivered, others]);
  });

  it("keeps a member's convoys, sent or received", () => {
    expect(filterConvoys([delivered, others], { state: "all", member: "Polyergus" }, NOW)).toEqual([others]);
    expect(filterConvoys([delivered, others], { state: "all", member: "lasius" }, NOW)).toEqual([delivered, others]);
  });
});
