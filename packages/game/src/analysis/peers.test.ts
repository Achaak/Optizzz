import { describe, expect, it } from "vitest";
import { relativeRank } from "./peers";

/** Players 2 to n+1, all at 1 000 at the start, gaining 0 %, 1 %, 2 %… */
function peers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 2, start: 1000, end: 1000 + i * 10 }));
}

function snapshots(players: readonly { id: number; start: number; end: number }[]) {
  return {
    start: new Map(players.map((player) => [player.id, player.start])),
    end: new Map(players.map((player) => [player.id, player.end])),
  };
}

describe("relativeRank", () => {
  it("counts the players of its size, half to twice its field at the start, it grew faster than", () => {
    const { start, end } = snapshots([
      // +10 %.
      { id: 1, start: 1000, end: 1100 },
      // 0 % to 11 %: it beats the ten from 0 % to 9 %.
      ...peers(12),
      // Not its size: under half, over twice.
      { id: 100, start: 499, end: 400 },
      { id: 101, start: 2001, end: 1000 },
      // Its size, but left out by the caller (inactive, on holiday, banned).
      { id: 102, start: 1000, end: 900 },
      // Gone by the end.
      { id: 103, start: 1000, end: Number.NaN },
    ]);
    end.delete(103);
    expect(relativeRank(1, start, end, new Set([102]))).toEqual({ faster: 10, peers: 12 });
  });

  it("says nothing with fewer than 10 players of its size", () => {
    const { start, end } = snapshots([{ id: 1, start: 1000, end: 1100 }, ...peers(9)]);
    expect(relativeRank(1, start, end, new Set())).toBeNull();
  });

  it("says nothing for a player missing at either end", () => {
    const { start, end } = snapshots(peers(12));
    expect(relativeRank(1, start, end, new Set())).toBeNull();
  });
});
