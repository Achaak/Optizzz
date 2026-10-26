import { describe, expect, it } from "vitest";
import {
  FLOOD_ARMY,
  FLOOD_ITEM,
  FLOODS_KEPT_MS,
  aimedAt,
  floodArmyText,
  floodEnvoiItems,
  floodLine,
  floodsOnMembers,
  floodsToward,
  type FloodItem,
} from "./envoi-floods";

const NOW = new Date("2026-10-26T14:00:00+01:00");
const ARRIVAL = new Date("2026-10-26T18:12:20+01:00");
const flood = (from: string, target: string, at: Date, take: number | null = null): FloodItem => ({
  from,
  target,
  at: at.getTime(),
  take,
});

describe("the floods a Joueur sends to the Alliance Space", () => {
  it("lists each attack on its way, with the take and the army of the Plan de flood apart", () => {
    const items = floodEnvoiItems({
      server: "s5",
      me: "Messor",
      attacks: [
        { attackId: 34250, target: "Lasius", arrivesAt: ARRIVAL, take: 12_348, army: { JSN: 12_000, SN: 348 } },
        { attackId: 34251, target: "Cible_2", arrivesAt: ARRIVAL, take: null, army: null },
      ],
    });
    expect(items.map((i) => i.item)).toEqual([
      { from: "Messor", target: "Lasius", at: ARRIVAL.getTime(), take: 12_348 },
      { from: "Messor", target: "Cible_2", at: ARRIVAL.getTime(), take: null },
    ]);
    expect(items.map((i) => i.detail)).toEqual([{ army: { JSN: 12_000, SN: 348 } }, null]);
    expect(items.every((i) => FLOOD_ITEM.safeParse(i.item).success)).toBe(true);
    expect(FLOOD_ARMY.safeParse(items[0]?.detail).success).toBe(true);
    // Kept on the site until 7 days after the arrival.
    expect(items[0]?.expiresAt).toBe(ARRIVAL.getTime() + FLOODS_KEPT_MS);
  });

  it("names an attack by the game's number, the same at each reading whatever the countdown says", () => {
    const read = (arrivesAt: Date) =>
      floodEnvoiItems({
        server: "s5",
        me: "Messor",
        attacks: [{ attackId: 34250, target: "Lasius", arrivesAt, take: null, army: null }],
      })[0]?.identity;
    expect(read(ARRIVAL)).toBe(read(new Date(ARRIVAL.getTime() + 1500)));
    expect(read(ARRIVAL)).not.toBe(
      floodEnvoiItems({
        server: "s2",
        me: "Messor",
        attacks: [{ attackId: 34250, target: "Lasius", arrivesAt: ARRIVAL, take: null, army: null }],
      })[0]?.identity,
    );
  });

  it("leaves the units nobody sent out of the army", () => {
    const [item] = floodEnvoiItems({
      server: "s5",
      me: "Messor",
      attacks: [{ attackId: 1, target: "Lasius", arrivesAt: ARRIVAL, take: 5, army: { JSN: 5, SN: 0 } }],
    });
    expect(item?.detail).toEqual({ army: { JSN: 5 } });
  });
});

describe("the alliance's floods in the game", () => {
  const floods = [
    flood("Lasius", "Messor", new Date(ARRIVAL.getTime() + 60_000), 12_348),
    flood("Polyergus", "messor", ARRIVAL),
    flood("Messor", "Lasius", ARRIVAL, 900),
    flood("Lasius", "Formica", ARRIVAL),
    flood("Polyergus", "Lasius", new Date(NOW.getTime() - 60_000)),
    flood("Polyergus", "Ennemi", ARRIVAL),
  ];

  it("lists those on their way to me, soonest first", () => {
    expect(floodsToward("Messor", NOW, floods).map((f) => f.from)).toEqual(["Polyergus", "Lasius"]);
  });

  it("groups those on their way to the other members by target, the soonest target first", () => {
    expect(floodsOnMembers("Messor", ["Messor", "lasius", "Formica"], NOW, floods)).toEqual([
      { target: "Lasius", floods: [floods[2]] },
      { target: "Formica", floods: [floods[3]] },
    ]);
  });

  it("writes a flood as « Pseudo, arrivée aujourd'hui 18 h 12, prise attendue 12 348 »", () => {
    expect(floodLine(flood("Lasius", "Messor", ARRIVAL, 12_348), NOW)).toBe(
      "Lasius, arrivée aujourd'hui 18 h 12, prise attendue 12 348",
    );
    expect(floodLine(flood("Lasius", "Messor", ARRIVAL), NOW)).toBe("Lasius, arrivée aujourd'hui 18 h 12");
  });

  it("says a target is already aimed at by a member, leaving out my own attacks", () => {
    expect(aimedAt("ennemi", "Messor", NOW, floods)).toBe("déjà visée par Polyergus, arrivée 18 h 12");
    expect(aimedAt("Lasius", "Messor", NOW, floods)).toBeNull();
    expect(aimedAt("Messor", "Formica", NOW, floods)).toBe(
      "déjà visée par Polyergus (arrivée 18 h 12) et Lasius (arrivée 18 h 13)",
    );
    expect(aimedAt("Nobody", "Messor", NOW, floods)).toBeNull();
  });

  it("writes an army as the game abbreviates it", () => {
    expect(floodArmyText({ SN: 485, JSN: 1488, Tu: 2 })).toBe("1 488 JSN, 485 SN, 2 T");
  });
});
