import { describe, expect, it } from "vitest";
import { kindsToRefresh, recapRows } from "./recap";
import type { EndKind, Section } from "./sources";

const now = new Date(2026, 9, 7, 12, 0, 0);
const minutes = (count: number) => new Date(now.getTime() + count * 60_000);

const section = (kind: EndKind, ends: [string, number][], readMinutesAgo = 0): Section => ({
  kind,
  readAt: minutes(-readMinutesAgo),
  items: ends.map(([label, inMinutes]) => ({ label, endsAt: minutes(inMinutes) })),
});

const summary = (rows: ReturnType<typeof recapRows>) =>
  rows.map((row) => `${row.label}${row.done ? " (terminé)" : ""}${row.queued ? ` +${String(row.queued)}` : ""}`);

describe("recapRows", () => {
  it("lists every hunt, and the next laying, building and research with the rest of their queue", () => {
    const rows = recapRows(
      {
        hunt: section("hunt", [
          ["Chasse 183 cm²", 30],
          ["Chasse 1 250 cm²", 90],
        ]),
        laying: section("laying", [
          ["100 ouvrières", 10],
          ["65 JSN", 70],
          ["6 JSN", 80],
        ]),
        construction: section("construction", [["Champignonnière 9", 120]]),
        research: section("research", []),
      },
      now,
    );
    expect(summary(rows)).toEqual(["100 ouvrières +2", "Chasse 183 cm²", "Chasse 1 250 cm²", "Champignonnière 9"]);
  });

  it("keeps what ended for an hour, marked as done, then drops it", () => {
    const rows = recapRows(
      {
        hunt: section(
          "hunt",
          [
            ["Chasse A", -30],
            ["Chasse B", -61],
          ],
          120,
        ),
      },
      now,
    );
    expect(summary(rows)).toEqual(["Chasse A (terminé)"]);
  });

  it("moves to the next item of a queue once the first has ended", () => {
    const rows = recapRows(
      {
        construction: section(
          "construction",
          [
            ["Couveuse 8", -5],
            ["Solarium 6", 40],
          ],
          60,
        ),
      },
      now,
    );
    expect(summary(rows)).toEqual(["Solarium 6"]);
  });

  it("shows the last ended item of a queue that is over", () => {
    const rows = recapRows(
      {
        research: section(
          "research",
          [
            ["Armes 3", -20],
            ["Armes 4", -10],
          ],
          60,
        ),
      },
      now,
    );
    expect(summary(rows)).toEqual(["Armes 4 (terminé)"]);
  });

  it("flags rows read more than a day ago", () => {
    const rows = recapRows(
      { hunt: section("hunt", [["Chasse A", 30]], 25 * 60), laying: section("laying", [["10 JSN", 20]], 10) },
      now,
    );
    expect(rows.map((row) => [row.label, row.stale])).toEqual([
      ["10 JSN", false],
      ["Chasse A", true],
    ]);
  });
});

describe("kindsToRefresh", () => {
  it("reads again what was never read or was read more than 15 minutes ago", () => {
    expect(
      kindsToRefresh(
        { hunt: section("hunt", [], 16), laying: section("laying", [], 14), research: section("research", [], 0) },
        now,
      ),
    ).toEqual(["hunt", "construction", "convoy"]);
  });
});

describe("convoys", () => {
  it("lists every convoy on its way, like hunts", () => {
    const rows = recapRows(
      {
        convoy: section("convoy", [
          ["Convoi → Osirus_jack", 80],
          ["Convoi → Hardware", 20],
        ]),
      },
      now,
    );
    expect(summary(rows)).toEqual(["Convoi → Hardware", "Convoi → Osirus_jack"]);
  });
});
