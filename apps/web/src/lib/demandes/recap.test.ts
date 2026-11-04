import type { DemandeStatus } from "@optizzz/game/site-links/demandes";
import { describe, expect, it } from "vitest";
import {
  convoysOf,
  demandesRecap,
  demandesViewSearch,
  filterHistory,
  historySummary,
  readDemandesView,
  sortRecap,
  type RecapRow,
} from "./recap";

const NOW = new Date("2026-11-04T12:00:00Z");
const DAY = 86_400_000;
const members = [
  { playerId: 1, pseudo: "Messor" },
  { playerId: 2, pseudo: "Lasius" },
  { playerId: 3, pseudo: "Atta" },
];

let next = 0;
const demande = (playerId: number, stored: DemandeStatus, createdAt: number, endedAt: number | null = null) => ({
  id: `d${String((next += 1))}`,
  playerId,
  requester: members.find((m) => m.playerId === playerId)?.pseudo ?? "un ancien membre",
  stored,
  createdAt,
  endedAt,
});

describe("the Récapitulatif of the Demandes", () => {
  const demandes = [
    demande(1, "pending", NOW.getTime() - DAY),
    demande(1, "validated", NOW.getTime() - 3 * DAY),
    demande(1, "closed", NOW.getTime() - 20 * DAY, NOW.getTime() - 10 * DAY),
    demande(2, "refused", NOW.getTime() - 5 * DAY, NOW.getTime() - 4 * DAY),
    demande(2, "cancelled", NOW.getTime() - 2 * DAY, NOW.getTime() - DAY),
    demande(9, "closed", NOW.getTime() - 40 * DAY, NOW.getTime() - 30 * DAY),
    demande(8, "cancelled", NOW.getTime() - 30 * DAY, NOW.getTime() - 29 * DAY),
  ];
  const recap = demandesRecap(demandes, members);

  it("counts each member's Demandes by status, with the date of the newest made", () => {
    expect(recap.rows.find((r) => r.pseudo === "Messor")).toMatchObject({
      total: 3,
      pending: 1,
      validated: 1,
      closed: 1,
      cancelled: 0,
      refused: 0,
      last: NOW.getTime() - DAY,
    });
    expect(recap.rows.find((r) => r.pseudo === "Lasius")).toMatchObject({ total: 2, refused: 1, cancelled: 1 });
  });

  it("keeps the members without a Demande, at zero and without a date", () => {
    expect(recap.rows.find((r) => r.pseudo === "Atta")).toMatchObject({ total: 0, last: null });
  });

  it("puts the former members' Demandes on one line, and the alliance's total apart", () => {
    expect(recap.rows.map((r) => r.pseudo)).toEqual(["Messor", "Lasius", "Atta"]);
    expect(recap.former).toMatchObject({ total: 2, closed: 1, cancelled: 1, last: NOW.getTime() - 30 * DAY });
    expect(recap.alliance).toMatchObject({ total: 7, pending: 1, validated: 1, closed: 2, cancelled: 2, refused: 1 });
  });

  it("has no former members' line without their Demandes", () => {
    expect(demandesRecap(demandes.slice(0, 5), members).former).toBeNull();
  });

  it("counts a covered Demande among the validated ones (it is stored validated)", () => {
    expect(demandesRecap([demande(3, "validated", 0)], members).rows.find((r) => r.pseudo === "Atta")).toMatchObject({
      validated: 1,
    });
  });
});

describe("the Récapitulatif's order", () => {
  const row = (pseudo: string, total: number, last: number | null, refused = 0): RecapRow => ({
    playerId: 0,
    pseudo,
    total,
    pending: 0,
    validated: 0,
    closed: 0,
    cancelled: 0,
    refused,
    last,
  });
  const rows = [row("Lasius", 2, 10, 1), row("atta", 0, null), row("Messor", 2, 30), row("Brindille", 5, 20)];
  const names = (sorted: RecapRow[]) => sorted.map((r) => r.pseudo);

  it("puts the most Demandes first, then by pseudo", () => {
    expect(names(sortRecap(rows, { key: "total", descending: true }))).toEqual([
      "Brindille",
      "Lasius",
      "Messor",
      "atta",
    ]);
  });

  it("sorts the other way, and by any column", () => {
    expect(names(sortRecap(rows, { key: "total", descending: false }))).toEqual([
      "atta",
      "Lasius",
      "Messor",
      "Brindille",
    ]);
    expect(names(sortRecap(rows, { key: "refused", descending: true }))[0]).toBe("Lasius");
    expect(names(sortRecap(rows, { key: "pseudo", descending: false }))).toEqual([
      "atta",
      "Brindille",
      "Lasius",
      "Messor",
    ]);
  });

  it("puts a member without a Demande last by date, whichever way", () => {
    expect(names(sortRecap(rows, { key: "last", descending: true }))).toEqual([
      "Messor",
      "Brindille",
      "Lasius",
      "atta",
    ]);
    expect(names(sortRecap(rows, { key: "last", descending: false }))).toEqual([
      "Lasius",
      "Brindille",
      "Messor",
      "atta",
    ]);
  });
});

describe("the Historique", () => {
  const finished = [
    demande(1, "closed", 0, NOW.getTime() - DAY),
    demande(2, "refused", 0, NOW.getTime() - 10 * DAY),
    demande(2, "cancelled", 0, NOW.getTime() - 40 * DAY),
    demande(9, "closed", 0, NOW.getTime() - 60 * DAY),
  ];
  const all = { state: "all", requester: null, days: 90 } as const;

  it("shows the ended Demandes of the period, the most recently ended first", () => {
    expect(filterHistory([...finished].reverse(), all, NOW).map((d) => d.endedAt)).toEqual(
      finished.map((d) => d.endedAt),
    );
    expect(filterHistory(finished, { ...all, days: 30 }, NOW)).toHaveLength(2);
    expect(filterHistory(finished, { ...all, days: 7 }, NOW)).toHaveLength(1);
  });

  it("keeps only the open ones out", () => {
    expect(filterHistory([demande(1, "pending", 0), demande(1, "validated", 0)], all, NOW)).toEqual([]);
  });

  it("filters by state and by requester, a former member too", () => {
    expect(filterHistory(finished, { ...all, state: "refused" }, NOW).map((d) => d.stored)).toEqual(["refused"]);
    expect(filterHistory(finished, { ...all, requester: "lasius" }, NOW)).toHaveLength(2);
    expect(filterHistory(finished, { ...all, requester: "un ancien membre" }, NOW)).toHaveLength(1);
  });

  it("counts what it shows by state", () => {
    expect(historySummary(finished)).toEqual({ total: 4, closed: 2, cancelled: 1, refused: 1 });
  });

  it("lists a Demande's convoys toward its requester, the earliest arrival first", () => {
    const convoy = (id: string, to: string, at: number) => ({
      demande: id,
      from: "Atta",
      to,
      food: 0,
      materials: 1,
      at,
    });
    const d = { id: "d1", requester: "Messor" };
    expect(
      convoysOf(d, [
        convoy("d1", "Messor", 20),
        convoy("d2", "Messor", 5),
        convoy("d1", "messor", 10),
        convoy("d1", "Lasius", 1),
      ]).map((c) => c.at),
    ).toEqual([10, 20]);
  });
});

describe("the Demandes tab's view in the address", () => {
  const requesters = ["Messor", "Lasius", "un ancien membre"];
  const read = (search: string) => readDemandesView(new URLSearchParams(search), requesters);
  const DEFAULT = { view: "demandes", state: "all", requester: null, days: 90 };

  it("opens on the Demandes, the whole Historique of 90 days", () => {
    expect(read("")).toEqual(DEFAULT);
  });

  it("reads the view, the state, the requester as the space writes them, and the period", () => {
    expect(read("vue=recapitulatif")).toEqual({ ...DEFAULT, view: "recap" });
    expect(read("vue=historique&etat=refusees&membre=lasius&periode=30")).toEqual({
      view: "history",
      state: "refused",
      requester: "Lasius",
      days: 30,
    });
  });

  it("ignores what it does not know", () => {
    expect(read("vue=graphe&etat=perdues&membre=Gargantua&periode=12")).toEqual(DEFAULT);
  });

  it("writes only what differs from the default, the tab with it", () => {
    expect(demandesViewSearch(DEFAULT as never)).toBe("onglet=demandes");
    expect(demandesViewSearch({ view: "history", state: "closed", requester: "un ancien membre", days: 7 })).toBe(
      "onglet=demandes&vue=historique&etat=closes&membre=un+ancien+membre&periode=7",
    );
  });

  it("writes the Historique's filters only on the Historique", () => {
    expect(demandesViewSearch({ view: "recap", state: "closed", requester: "Messor", days: 7 })).toBe(
      "onglet=demandes&vue=recapitulatif",
    );
  });
});
