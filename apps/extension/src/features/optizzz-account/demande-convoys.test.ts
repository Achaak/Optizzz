import { describe, expect, it } from "vitest";
import type { DemandeConvoys } from "@/data/demandes";
import { attachLaunched, demandeConvoyItems } from "./demande-convoys";

const DEMANDE = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const NOW = new Date("2026-10-26T12:00:00Z").getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const intent = (extra: Partial<DemandeConvoys["intents"][number]> = {}) => ({
  demande: DEMANDE,
  recipient: "Lasius",
  openedAt: NOW - 5 * MINUTE,
  before: [{ food: 0, materials: 1_000, at: NOW + 2 * HOUR }],
  ...extra,
});

const ids = () => {
  let n = 0;
  return () => `local-${String(++n)}`;
};

describe("a convoy launched from « Envoyer un convoi »", () => {
  it("is attached to the Demande: the new convoy to its requester after the page was opened", () => {
    const kept = attachLaunched(
      { intents: [intent()], convoys: [] },
      {
        readAt: NOW,
        convoys: [
          { recipient: "lasius", food: 0, materials: 1_000, at: NOW + 2 * HOUR + 30_000 },
          { recipient: "Formica", food: 9, materials: 9, at: NOW + HOUR },
          { recipient: "lasius", food: 5_000, materials: 20_000, at: NOW + 3 * HOUR },
        ],
      },
      NOW,
      ids(),
    );
    expect(kept).toEqual({
      intents: [],
      convoys: [
        {
          id: "local-1",
          demande: DEMANDE,
          to: "Lasius",
          food: 5_000,
          materials: 20_000,
          at: NOW + 3 * HOUR,
          attachedAt: NOW,
        },
      ],
    });
  });

  it("waits while no new convoy left, and gives up after 30 minutes", () => {
    const outgoing = { readAt: NOW, convoys: [{ recipient: "Lasius", food: 0, materials: 1_000, at: NOW + 2 * HOUR }] };
    expect(attachLaunched({ intents: [intent()], convoys: [] }, outgoing, NOW, ids()).intents).toHaveLength(1);
    expect(
      attachLaunched({ intents: [intent({ openedAt: NOW - 31 * MINUTE })], convoys: [] }, outgoing, NOW, ids()),
    ).toEqual({ intents: [], convoys: [] });
  });

  it("is not attached twice, nor read from a list older than the page opened", () => {
    const attached = {
      id: "local-0",
      demande: DEMANDE,
      to: "Lasius",
      food: 5_000,
      materials: 20_000,
      at: NOW + 3 * HOUR,
      attachedAt: NOW - MINUTE,
    };
    const outgoing = {
      readAt: NOW,
      convoys: [{ recipient: "Lasius", food: 5_000, materials: 20_000, at: NOW + 3 * HOUR }],
    };
    expect(attachLaunched({ intents: [intent()], convoys: [attached] }, outgoing, NOW, ids()).convoys).toEqual([
      attached,
    ]);
    const old = { ...outgoing, readAt: NOW - 10 * MINUTE };
    expect(attachLaunched({ intents: [intent()], convoys: [] }, old, NOW, ids()).convoys).toEqual([]);
  });

  it("is dropped when it leaves the list before its arrival (cancelled), kept after it, and forgotten 90 days later", () => {
    const convoy = (at: number) => ({
      id: `c${String(at)}`,
      demande: DEMANDE,
      to: "Lasius",
      food: 0,
      materials: 10,
      at,
      attachedAt: NOW - HOUR,
    });
    const kept = attachLaunched(
      { intents: [], convoys: [convoy(NOW + HOUR), convoy(NOW - MINUTE), convoy(NOW - 91 * DAY)] },
      { readAt: NOW, convoys: [] },
      NOW,
      ids(),
    );
    expect(kept.convoys.map((c) => c.at)).toEqual([NOW - MINUTE]);
  });

  it("leaves as an Envoi item: who sent what to whom for which Demande, under its own identity", () => {
    expect(
      demandeConvoyItems("s5", "Messor", {
        intents: [],
        convoys: [
          { id: "local-1", demande: DEMANDE, to: "Lasius", food: 1, materials: 2, at: NOW, attachedAt: NOW - HOUR },
        ],
      }),
    ).toEqual([
      {
        identity: "demande-convoy|s5|local-1",
        item: { demande: DEMANDE, from: "Messor", to: "Lasius", food: 1, materials: 2, at: NOW },
        expiresAt: NOW + 90 * DAY,
      },
    ]);
  });
});
