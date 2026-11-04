import { describe, expect, it } from "vitest";
import { HUNT_ITEM, HUNTS_LOG_KEPT_MS, huntEnvoiItems, huntIdOf } from "./envoi-hunts";
import { isSent, NO_ENVOIS } from "./envois";

const RETURN = new Date("2026-11-04T13:36:20+01:00");

describe("the hunts a Joueur sends to the Alliance Space", () => {
  it("lists each hunt seen out, with its return, its gain and its ants", () => {
    const items = huntEnvoiItems({
      server: "s5",
      me: "Messor",
      hunts: [
        { huntId: 139778, returnsAt: RETURN, fieldGain: 12_400, ants: 24_800 },
        { huntId: 139779, returnsAt: RETURN, fieldGain: 9_600, ants: null },
      ],
    });
    expect(items.map((i) => i.item)).toEqual([
      { hunter: "Messor", returnsAt: RETURN.getTime(), fieldGain: 12_400, ants: 24_800 },
      { hunter: "Messor", returnsAt: RETURN.getTime(), fieldGain: 9_600, ants: null },
    ]);
    expect(items.every((i) => HUNT_ITEM.safeParse(i.item).success)).toBe(true);
    // Kept on the site until 90 days after the return.
    expect(items[0]?.expiresAt).toBe(RETURN.getTime() + HUNTS_LOG_KEPT_MS);
  });

  it("names a hunt by the game's number, the same at each reading whatever the countdown says", () => {
    const read = (server: string, returnsAt: Date) =>
      huntEnvoiItems({ server, me: "Messor", hunts: [{ huntId: 139778, returnsAt, fieldGain: 1, ants: null }] })[0]
        ?.identity;
    expect(read("s5", RETURN)).toBe(read("s5", new Date(RETURN.getTime() + 1500)));
    expect(read("s5", RETURN)).not.toBe(read("s2", RETURN));
  });

  it("reads the game's number in the countdown's id", () => {
    expect(huntIdOf("chasse_139778")).toBe(139778);
    expect(huntIdOf("temps_chasse")).toBeNull();
  });

  it("leaves with « Chasses »: no other choice to make", () => {
    expect(isSent(NO_ENVOIS, "hunts-log")).toBe(false);
    expect(isSent({ ...NO_ENVOIS, hunts: true }, "hunts-log")).toBe(true);
  });
});
