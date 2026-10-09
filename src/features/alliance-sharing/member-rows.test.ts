import { describe, expect, it } from "vitest";
import type { SharedState, SharedStates } from "@/data/shared-states";
import { memberRows } from "./member-rows";

const at = (iso: string) => new Date(iso);
const now = at("2026-10-09T12:00:00Z");

const bob = (readAt: string, weapons: number, extra: Partial<SharedState> = {}): SharedState => ({
  server: "s5",
  alliance: "ABC",
  pseudo: "Bob",
  readAt: at(readAt),
  research: { weapons },
  ...extra,
});

const states = (latest: SharedState, previous?: SharedState): SharedStates => ({
  members: { Bob: previous ? { latest, previous } : { latest } },
  manual: {},
});

describe("memberRows", () => {
  it("lists every member, those who shared nothing included", () => {
    const [ann, bobRow] = memberRows(["Ann", "Bob"], states(bob("2026-10-09T10:00:00Z", 12)), now);
    expect(ann).toMatchObject({ pseudo: "Ann", readAt: null, stale: false, cells: {} });
    expect(bobRow?.cells["research.weapons"]).toEqual({ value: 12, manual: false, change: null });
  });

  it("marks what went up or down in the last 24 hours", () => {
    const rows = memberRows(["Bob"], states(bob("2026-10-09T10:00:00Z", 12), bob("2026-10-05T10:00:00Z", 11)), now);
    expect(rows[0]?.cells["research.weapons"]?.change).toBe("up");
    const older = memberRows(["Bob"], states(bob("2026-10-08T10:00:00Z", 12), bob("2026-10-05T10:00:00Z", 11)), now);
    expect(older[0]?.cells["research.weapons"]?.change).toBeNull();
  });

  it("greys a state read more than 3 days ago", () => {
    expect(memberRows(["Bob"], states(bob("2026-10-06T11:00:00Z", 12)), now)[0]?.stale).toBe(true);
    expect(memberRows(["Bob"], states(bob("2026-10-06T13:00:00Z", 12)), now)[0]?.stale).toBe(false);
  });

  it("counts a work whose end has passed as done, its level reached", () => {
    const works = [
      { name: "Armes", level: 13, endsAt: at("2026-10-09T11:00:00Z") },
      { name: "Etable a pucerons", level: 5, endsAt: at("2026-10-09T15:00:00Z") },
    ];
    const [row] = memberRows(["Bob"], states(bob("2026-10-09T10:00:00Z", 12, { works })), now);
    expect(row?.cells["research.weapons"]).toEqual({ value: 13, manual: false, change: null });
    expect(row?.works).toEqual([
      { ...works[0], done: true },
      { ...works[1], done: false },
    ]);
  });

  it("shows a value entered by hand", () => {
    const withManual: SharedStates = {
      ...states(bob("2026-10-05T10:00:00Z", 12)),
      manual: { Bob: { "research.weapons": { value: 14, at: at("2026-10-07T10:00:00Z") } } },
    };
    expect(memberRows(["Bob"], withManual, now)[0]?.cells["research.weapons"]).toEqual({
      value: 14,
      manual: true,
      change: null,
    });
  });
});
