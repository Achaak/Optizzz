import { createAllianceKeyring, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { huntEnvoiItems, type HuntsKept } from "@optizzz/game/site-links/envoi-hunts";
import { sealEnvoi } from "@optizzz/game/site-links/envois";
import { beforeAll, describe, expect, it } from "vitest";
import { envoiCrypto } from "./convoys";
import { openHunts } from "./hunts";

const RETURN = new Date("2026-11-04T12:36:00Z");

/** What a member's extension sends: each hunt seen out, sealed with the Clé d'alliance. */
async function sent(keyring: AllianceKeyring, playerId: number, me: string, hunts: HuntsKept["hunts"]) {
  const crypto = envoiCrypto(keyring);
  return Promise.all(
    huntEnvoiItems({ server: "s5", me, hunts }).map(async ({ identity, item }, index) => {
      const fingerprint = await crypto.fingerprint(identity);
      const envelope = { server: "s5", playerId, category: "hunts-log" as const, fingerprint, observedAt: 1 };
      return {
        id: `${String(playerId)}-${String(index)}`,
        server: "s5",
        playerId,
        category: "hunts-log",
        fingerprint,
        blob: await sealEnvoi({ ...envelope, item }, crypto),
      };
    }),
  );
}

describe("the alliance's hunts on the space page", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  it("opens the members' hunts log, and throws away a hunt filed under another member", async () => {
    const rows = await sent(keyring, 1, "Messor", [
      { huntId: 7, returnsAt: RETURN, fieldGain: 12_400, ants: 24_800 },
      { huntId: 8, returnsAt: RETURN, fieldGain: 9_600, ants: null },
    ]);
    const moved = {
      ...(await sent(keyring, 1, "Messor", [{ huntId: 9, returnsAt: RETURN, fieldGain: 1, ants: null }]))[0],
      playerId: 2,
    };
    const { hunts, refused } = await openHunts([...rows, moved as (typeof rows)[number]], keyring);
    expect(refused).toBe(1);
    expect(hunts.map(({ hunter, fieldGain, ants }) => ({ hunter, fieldGain, ants }))).toEqual([
      { hunter: "Messor", fieldGain: 12_400, ants: 24_800 },
      { hunter: "Messor", fieldGain: 9_600, ants: null },
    ]);
  });

  it("leaves the other categories alone", async () => {
    const rows = await sent(keyring, 1, "Messor", [{ huntId: 7, returnsAt: RETURN, fieldGain: 1, ants: null }]);
    const { hunts } = await openHunts(
      rows.map((r) => ({ ...r, category: "floods" })),
      keyring,
    );
    expect(hunts).toEqual([]);
  });
});
