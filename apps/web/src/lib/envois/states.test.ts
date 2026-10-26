import { createAllianceKeyring, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import type { SharedState } from "@optizzz/game/sharing/shared-state";
import { nextStateItem, stateIdentity, type StateCategory } from "@optizzz/game/site-links/envoi-states";
import { sealEnvoi } from "@optizzz/game/site-links/envois";
import { beforeAll, describe, expect, it } from "vitest";
import { envoiCrypto } from "./convoys";
import { memberStates, openStates } from "./states";

const NOW = new Date("2026-10-26T15:00:00Z");
const context = {
  server: "s5",
  alliance: "ABC",
  members: [
    { playerId: 1, pseudo: "Messor" },
    { playerId: 2, pseudo: "Lasius" },
  ],
};

/** A state as a member's extension sends it, sealed with the Clé d'alliance, the units apart. */
async function sent(
  keyring: AllianceKeyring,
  playerId: number,
  category: StateCategory,
  reading: unknown,
  units: Record<string, number> | null = null,
) {
  const crypto = envoiCrypto(keyring);
  const fingerprint = await crypto.fingerprint(`${stateIdentity("s5", category)}|${String(playerId)}`);
  const { observedAt, item } = nextStateItem("whoever", reading as never, NOW.getTime(), null);
  const envelope = { server: "s5", playerId, category, fingerprint, observedAt };
  return {
    server: "s5",
    playerId,
    category,
    fingerprint,
    blob: await sealEnvoi({ ...envelope, item }, crypto),
    detail: units && (await sealEnvoi({ ...envelope, item: { units } }, crypto)),
  };
}

describe("the members' states", () => {
  let keyring: AllianceKeyring;
  beforeAll(async () => {
    keyring = await createAllianceKeyring();
  });

  it("opens each state under the name of the member who sent it, the units when the site handed them", async () => {
    const army = await sent(keyring, 2, "army", { total: 50, incomplete: false, returnsAt: null }, { SN: 50 });
    const hunts = await sent(keyring, 1, "hunts", { hunts: [{ returnsAt: NOW.getTime(), fieldGain: 3 }] });
    const { states, refused } = await openStates([army, hunts], keyring, context);
    expect(refused).toBe(0);
    expect(states.map((s) => s.latest.pseudo)).toEqual(["Lasius", "Messor"]);
    expect(states[0]?.latest.army).toEqual({ total: 50, incomplete: false, units: { SN: 50 } });
    const member = await openStates([{ ...army, detail: null }], keyring, context);
    expect(member.states[0]?.latest.army?.units).toBeUndefined();
  });

  it("refuses a state filed under another row, and leaves the lists aside", async () => {
    const army = await sent(keyring, 2, "army", { total: 50, incomplete: false, returnsAt: null });
    const { states, refused } = await openStates(
      [
        { ...army, playerId: 1 },
        { ...army, category: "convoys" },
      ],
      keyring,
      context,
    );
    expect(states).toEqual([]);
    expect(refused).toBe(1);
  });

  it("merges the Envois and the pasted states of each member, the newest part winning", () => {
    const at = (iso: string) => new Date(iso);
    const base = { server: "s5", alliance: "ABC" };
    const pasted: SharedState[] = [
      { ...base, pseudo: "messor", readAt: at("2026-10-25T10:00:00Z"), workers: 10, research: { weapons: 4 } },
      { ...base, pseudo: "Outsider", readAt: at("2026-10-25T10:00:00Z"), workers: 1 },
    ];
    const envois = [{ latest: { ...base, pseudo: "Messor", readAt: at("2026-10-26T10:00:00Z"), workers: 12 } }];
    const rows = memberStates(["Messor", "Lasius"], envois, pasted);
    expect(rows.map((r) => r.pseudo)).toEqual(["Messor", "Lasius"]);
    expect(rows[0]?.states?.latest).toMatchObject({ pseudo: "Messor", workers: 12, research: { weapons: 4 } });
    expect(rows[0]?.states?.previous?.workers).toBe(10);
    expect(rows[1]?.states).toBeNull();
  });
});
