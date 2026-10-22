import { describe, expect, it } from "vitest";
import { labelRect, placeLabels, type LabelItem } from "./labels";

const item = (id: number, x: number, y: number, width = 50): LabelItem => ({ id, x, y, width, height: 14 });
const area = { left: 0, top: 0, right: 1000, bottom: 1000 };

const overlaps = (a: ReturnType<typeof labelRect>, b: ReturnType<typeof labelRect>) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe("placeLabels", () => {
  it("writes a lone name to the right of its point", () => {
    expect(placeLabels([item(1, 100, 100)], { area, everyName: false }).get(1)).toEqual({
      position: "right",
      offset: [0, 0],
    });
  });

  it("moves a name aside rather than over its neighbour's", () => {
    const items = [item(1, 100, 100), item(2, 130, 100), item(3, 100, 112)];
    const spots = placeLabels(items, { area, everyName: true });
    const rects = items.map((it) => {
      const spot = spots.get(it.id);
      if (!spot) throw new Error("no spot");
      return labelRect(it, spot);
    });
    for (const [i, a] of rects.entries()) for (const b of rects.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
  });

  it("keeps names off the other points", () => {
    const first = item(1, 100, 100);
    const spot = placeLabels([first, item(2, 140, 100)], { area, everyName: true }).get(1);
    if (!spot) throw new Error("no spot");
    const rect = labelRect(first, spot);
    expect(rect.left < 145 && rect.right > 135 && rect.top < 105 && rect.bottom > 95).toBe(false);
  });

  it("keeps names inside the plot when it can", () => {
    const spot = placeLabels([item(1, 990, 500)], { area, everyName: false }).get(1);
    expect(spot?.position).toBe("left");
  });

  it("with no free spot, hides the name, or writes it anyway when every name is asked", () => {
    const crowd = Array.from({ length: 30 }, (_, i) => item(i, 100 + (i % 6) * 6, 100 + Math.floor(i / 6) * 6));
    const hidden = placeLabels(crowd, { area, everyName: false });
    expect([...hidden.values()].some((spot) => spot === null)).toBe(true);
    const all = placeLabels(crowd, { area, everyName: true });
    expect([...all.values()].every((spot) => spot !== null)).toBe(true);
  });

  it("places first the names given first", () => {
    const spots = placeLabels([item(1, 100, 100), item(2, 100, 100)], { area, everyName: false });
    expect(spots.get(1)).toEqual({ position: "right", offset: [0, 0] });
    expect(spots.get(2)).not.toEqual({ position: "right", offset: [0, 0] });
  });
});
