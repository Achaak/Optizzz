import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  forgetFormerMembers,
  importStates,
  loadMyLastShare,
  loadSharedStates,
  rememberMyShare,
  setManualValue,
  valueOf,
  type SharedState,
} from "./shared-states";

const ORIGIN = "https://s5.fourmizzz.fr";
const at = (iso: string) => new Date(iso);

const bob = (readAt: string, weapons: number): SharedState => ({
  server: "s5",
  alliance: "ABC",
  pseudo: "Bob",
  readAt: at(readAt),
  research: { weapons },
});

beforeEach(() => {
  fakeBrowser.reset();
});

describe("importStates", () => {
  it("keeps each member's latest state and the one before, and says who was updated", async () => {
    expect(await importStates(ORIGIN, "ABC", [bob("2026-10-05T10:00:00Z", 11)])).toEqual({
      updated: ["Bob"],
      unchanged: [],
    });
    expect(await importStates(ORIGIN, "ABC", [bob("2026-10-09T10:00:00Z", 12)])).toEqual({
      updated: ["Bob"],
      unchanged: [],
    });
    const { members } = await loadSharedStates(ORIGIN, "ABC");
    expect(members.Bob?.latest).toEqual(bob("2026-10-09T10:00:00Z", 12));
    expect(members.Bob?.previous).toEqual(bob("2026-10-05T10:00:00Z", 11));
  });

  it("leaves a member unchanged when the pasted state is the same or older, an older one becoming the one before", async () => {
    await importStates(ORIGIN, "ABC", [bob("2026-10-09T10:00:00Z", 12)]);
    expect(
      await importStates(ORIGIN, "ABC", [bob("2026-10-09T10:00:00Z", 12), bob("2026-10-05T10:00:00Z", 11)]),
    ).toEqual({ updated: [], unchanged: ["Bob"] });
    const { members } = await loadSharedStates(ORIGIN, "ABC");
    expect(members.Bob?.latest.research?.weapons).toBe(12);
    expect(members.Bob?.previous?.research?.weapons).toBe(11);
  });

  it("keeps the latest of several states of one member pasted together", async () => {
    await importStates(ORIGIN, "ABC", [bob("2026-10-09T10:00:00Z", 12), bob("2026-10-05T10:00:00Z", 11)]);
    const { members } = await loadSharedStates(ORIGIN, "ABC");
    expect(members.Bob?.latest.research?.weapons).toBe(12);
    expect(members.Bob?.previous?.research?.weapons).toBe(11);
  });
});

describe("manual values", () => {
  it("win over an older shared state, and lose to a newer one", async () => {
    await importStates(ORIGIN, "ABC", [bob("2026-10-05T10:00:00Z", 11)]);
    await setManualValue(ORIGIN, "ABC", "Bob", "research.weapons", 13, at("2026-10-07T10:00:00Z"));
    expect(valueOf(await loadSharedStates(ORIGIN, "ABC"), "Bob", "research.weapons")).toEqual({
      value: 13,
      manual: true,
      at: at("2026-10-07T10:00:00Z"),
    });

    await importStates(ORIGIN, "ABC", [bob("2026-10-09T10:00:00Z", 14)]);
    expect(valueOf(await loadSharedStates(ORIGIN, "ABC"), "Bob", "research.weapons")).toEqual({
      value: 14,
      manual: false,
      at: at("2026-10-09T10:00:00Z"),
    });
  });

  it("can be entered for a member who shared nothing, and removed to go back to the shared value", async () => {
    await setManualValue(ORIGIN, "ABC", "Ann", "research.attackSpeed", 5, at("2026-10-07T10:00:00Z"));
    expect(valueOf(await loadSharedStates(ORIGIN, "ABC"), "Ann", "research.attackSpeed")?.value).toBe(5);
    await setManualValue(ORIGIN, "ABC", "Ann", "research.attackSpeed", null, at("2026-10-08T10:00:00Z"));
    expect(valueOf(await loadSharedStates(ORIGIN, "ABC"), "Ann", "research.attackSpeed")).toBeNull();
  });

  it("covers the army and the colony too", async () => {
    await importStates(ORIGIN, "ABC", [
      { ...bob("2026-10-05T10:00:00Z", 11), huntingField: 900, army: { total: 50, incomplete: false } },
    ]);
    const states = await loadSharedStates(ORIGIN, "ABC");
    expect(valueOf(states, "Bob", "huntingField")?.value).toBe(900);
    expect(valueOf(states, "Bob", "army")?.value).toBe(50);
    expect(valueOf(states, "Bob", "workers")).toBeNull();
  });
});

describe("forgetting", () => {
  it("forgets the members who left the alliance", async () => {
    await importStates(ORIGIN, "ABC", [bob("2026-10-05T10:00:00Z", 11)]);
    await setManualValue(ORIGIN, "ABC", "Ann", "research.weapons", 5, at("2026-10-07T10:00:00Z"));
    await forgetFormerMembers(ORIGIN, "ABC", ["Carl"]);
    const states = await loadSharedStates(ORIGIN, "ABC");
    expect(states.members).toEqual({});
    expect(valueOf(states, "Ann", "research.weapons")).toBeNull();
  });

  it("forgets everything once the player is in another alliance", async () => {
    await importStates(ORIGIN, "ABC", [bob("2026-10-05T10:00:00Z", 11)]);
    await rememberMyShare(ORIGIN, { ...bob("2026-10-05T10:00:00Z", 11), pseudo: "Me" });
    await forgetFormerMembers(ORIGIN, "XYZ", ["Bob"]);
    expect((await loadSharedStates(ORIGIN, "XYZ")).members).toEqual({});
    expect((await loadSharedStates(ORIGIN, "ABC")).members).toEqual({});
    expect(await loadMyLastShare(ORIGIN, "ABC")).toBeNull();
  });
});

describe("my last share", () => {
  it("is remembered to show what changed in the next one", async () => {
    const mine = { ...bob("2026-10-05T10:00:00Z", 11), pseudo: "Me" };
    await rememberMyShare(ORIGIN, mine);
    expect(await loadMyLastShare(ORIGIN, "ABC")).toEqual(mine);
    expect(await loadMyLastShare(ORIGIN, "XYZ")).toBeNull();
  });
});
