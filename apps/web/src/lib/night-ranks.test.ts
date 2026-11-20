import { describe, expect, it } from "vitest";
import { nightRanks, nightTable, type NightRow } from "./night-ranks";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const NIGHTS = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map(day);

const row = (playerId: number, field: number, from: string, until: string | null = null): NightRow => ({
  playerId,
  field,
  day: day(from),
  until: until === null ? null : day(until),
});

/** What the SQL used to count: 1 + the rows true on that night with a larger field. */
function bruteForce(nights: readonly Date[], rows: readonly NightRow[], ids: readonly number[], since: Date | null) {
  const valid = (r: NightRow, night: Date) =>
    r.day.getTime() <= night.getTime() && (r.until === null || r.until.getTime() > night.getTime());
  return nights
    .filter((night) => since === null || night.getTime() >= since.getTime())
    .flatMap((night) =>
      rows
        .filter((r) => ids.includes(r.playerId) && valid(r, night))
        .map((own) => ({
          id: own.playerId,
          day: night,
          rank: 1 + rows.filter((r) => valid(r, night) && r.field > own.field).length,
        })),
    );
}

const sorted = <T extends { id: number; day: Date }>(rows: T[]) =>
  [...rows].sort((a, b) => a.day.getTime() - b.day.getTime() || a.id - b.id);

describe("nightRanks", () => {
  const rows = [
    row(1, 10, "2026-11-01", "2026-11-03"),
    row(1, 50, "2026-11-03"),
    row(2, 20, "2026-11-01"),
    row(3, 30, "2026-11-01", "2026-11-02"),
    row(3, 5, "2026-11-02"),
    row(4, 40, "2026-11-02", "2026-11-04"),
    row(5, 20, "2026-11-01"),
  ];
  const table = nightTable(NIGHTS, rows);

  it("ranks a player by TDC on each night it was there", () => {
    expect(nightRanks(table, [1], null)).toEqual([
      { id: 1, day: NIGHTS[0], rank: 4 },
      { id: 1, day: NIGHTS[1], rank: 4 },
      { id: 1, day: NIGHTS[2], rank: 1 },
      { id: 1, day: NIGHTS[3], rank: 1 },
    ]);
  });

  it("gives tied players the same rank", () => {
    expect(nightRanks(table, [2, 5], null).filter((r) => r.day === NIGHTS[0])).toEqual([
      { id: 2, day: NIGHTS[0], rank: 2 },
      { id: 5, day: NIGHTS[0], rank: 2 },
    ]);
  });

  it("starts at `since`, and leaves out the nights a player was gone", () => {
    expect(nightRanks(table, [4], day("2026-11-03"))).toEqual([{ id: 4, day: NIGHTS[2], rank: 2 }]);
  });

  it("knows nothing of an unknown player", () => {
    expect(nightRanks(table, [99], null)).toEqual([]);
  });

  it("counts as the database did, on many players and nights", () => {
    let seed = 7;
    const random = () => (seed = (seed * 48_271) % 2_147_483_647) / 2_147_483_647;
    const nights = Array.from({ length: 12 }, (_, i) => day(`2026-10-${String(10 + i)}`));
    const many: NightRow[] = [];
    for (let id = 1; id <= 300; id++) {
      let at = Math.floor(random() * 4);
      while (at < nights.length) {
        const next = at + 1 + Math.floor(random() * 5);
        const gone = random() < 0.1;
        many.push({
          playerId: id,
          field: Math.floor(random() * 50) * 1000,
          day: nights[at] ?? day("2026-10-10"),
          until: next < nights.length ? (nights[next] ?? null) : null,
        });
        at = gone ? next + 2 : next;
      }
    }
    const ids = [1, 17, 150, 299];
    const since = nights[3] ?? null;
    const expected = bruteForce(nights, many, ids, since);
    expect(expected.length).toBeGreaterThan(20);
    expect(sorted(nightRanks(nightTable(nights, many), ids, since))).toEqual(sorted(expected));
  });
});
