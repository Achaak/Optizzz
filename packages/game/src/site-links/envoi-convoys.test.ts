import { describe, expect, it } from "vitest";
import { CONVOYS_KEPT_MS, convoyEnvoiItems, convoysToward, type ConvoyItem } from "./envoi-convoys";

const at = (text: string) => new Date(text);
const ARRIVAL = at("2026-10-25T18:12:20+02:00");
const DELIVERED = at("2026-10-24T21:03:00+02:00");
const NONE = { outgoing: [], incoming: [], history: [] };

describe("the convoys a Joueur sends to the Alliance Space", () => {
  it("lists those on their way both ways and the history, from the Joueur's side", () => {
    const items = convoyEnvoiItems({
      server: "s5",
      me: "Messor",
      outgoing: [{ recipient: "Polyergus", food: 0, materials: 350_000, arrivesAt: ARRIVAL }],
      incoming: [{ sender: "Lasius", food: 12_348, materials: 0, arrivesAt: ARRIVAL }],
      history: [
        { direction: "sent", player: "Polyergus", food: 1, materials: 2, at: DELIVERED },
        { direction: "received", player: "Lasius", food: 3, materials: 4, at: DELIVERED },
      ],
    });
    expect(items.map((i) => i.item)).toEqual([
      { kind: "transit", from: "Messor", to: "Polyergus", food: 0, materials: 350_000, at: ARRIVAL.getTime() },
      { kind: "transit", from: "Lasius", to: "Messor", food: 12_348, materials: 0, at: ARRIVAL.getTime() },
      { kind: "delivered", from: "Messor", to: "Polyergus", food: 1, materials: 2, at: DELIVERED.getTime() },
      { kind: "delivered", from: "Lasius", to: "Messor", food: 3, materials: 4, at: DELIVERED.getTime() },
    ] satisfies ConvoyItem[]);
  });

  it("gives the same identity to a convoy seen by its sender and by its recipient, whatever their clocks", () => {
    const [sent] = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Messor",
      outgoing: [{ recipient: "Polyergus", food: 0, materials: 350_000, arrivesAt: ARRIVAL }],
    });
    // The recipient's clock is 40 s ahead, and the game writes pseudos as each side typed them.
    const [received] = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "polyergus",
      incoming: [{ sender: "messor", food: 0, materials: 350_000, arrivesAt: new Date(ARRIVAL.getTime() + 40_000) }],
    });
    expect(sent?.identity).toBe(received?.identity);
  });

  it("tells apart identical convoys sent one after the other, in the order they arrive", () => {
    const load = { recipient: "Polyergus", food: 0, materials: 100 };
    const later = new Date(ARRIVAL.getTime() + 60_000);
    const sender = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Messor",
      outgoing: [
        { ...load, arrivesAt: later },
        { ...load, arrivesAt: ARRIVAL },
      ],
    });
    expect(new Set(sender.map((i) => i.identity)).size).toBe(2);
    const recipient = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Polyergus",
      incoming: [
        { sender: "Messor", food: 0, materials: 100, arrivesAt: ARRIVAL },
        { sender: "Messor", food: 0, materials: 100, arrivesAt: later },
      ],
    });
    const byArrival = (items: typeof sender) => [...items].sort((a, b) => a.item.at - b.item.at).map((i) => i.identity);
    expect(byArrival(recipient)).toEqual(byArrival(sender));
  });

  it("matches a delivery in the sender's « Convoi livré » and the recipient's « Convoi reçu »", () => {
    const [sent] = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Messor",
      history: [{ direction: "sent", player: "Polyergus", food: 1, materials: 2, at: DELIVERED }],
    });
    const [received] = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Polyergus",
      history: [{ direction: "received", player: "Messor", food: 1, materials: 2, at: DELIVERED }],
    });
    expect(sent?.identity).toBe(received?.identity);
    // On their way and delivered are two items, even with the same load.
    const [transit] = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Messor",
      outgoing: [{ recipient: "Polyergus", food: 1, materials: 2, arrivesAt: DELIVERED }],
    });
    expect(transit?.identity).not.toBe(sent?.identity);
  });

  it("is kept 90 days after its arrival", () => {
    const [item] = convoyEnvoiItems({
      ...NONE,
      server: "s5",
      me: "Messor",
      history: [{ direction: "sent", player: "Polyergus", food: 1, materials: 2, at: DELIVERED }],
    });
    expect(item?.expiresAt).toBe(DELIVERED.getTime() + CONVOYS_KEPT_MS);
    expect(CONVOYS_KEPT_MS).toBe(90 * 24 * 3600_000);
  });
});

describe("the alliance's convoys on their way to a Joueur", () => {
  const now = at("2026-10-25T17:00:00+02:00");
  const convoy = (from: string, to: string, when: Date, kind: ConvoyItem["kind"] = "transit"): ConvoyItem => ({
    kind,
    from,
    to,
    food: 0,
    materials: 1,
    at: when.getTime(),
  });

  it("are those still on their way to them, soonest first, from others", () => {
    const soon = at("2026-10-25T17:30:00+02:00");
    const towards = convoysToward("messor", now, [
      convoy("Lasius", "Messor", ARRIVAL),
      convoy("Polyergus", "Messor", soon),
      convoy("Lasius", "Messor", at("2026-10-25T16:00:00+02:00")),
      convoy("Lasius", "Messor", ARRIVAL, "delivered"),
      convoy("Messor", "Lasius", ARRIVAL),
      convoy("Lasius", "Polyergus", ARRIVAL),
    ]);
    expect(towards.map((c) => [c.from, c.at])).toEqual([
      ["Polyergus", soon.getTime()],
      ["Lasius", ARRIVAL.getTime()],
    ]);
  });
});
