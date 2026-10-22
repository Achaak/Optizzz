import { describe, expect, it } from "vitest";
import { buildHistoryOption } from "./chart-option";

describe("history chart tooltip", () => {
  const option = buildHistoryOption([{ name: "<b>x</b>", points: [{ time: 0, value: 1, live: false }] }], false);
  const formatter = (option.tooltip as { formatter: (param: unknown) => string }).formatter;
  const html = formatter({
    seriesName: "<b>x</b>",
    marker: "<span></span>",
    data: { value: [0, 1234], live: false },
  });

  it("escapes the curve's name", () => {
    expect(html).toContain("&#60;b&#62;x&#60;/b&#62;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("keeps ECharts' marker as HTML", () => {
    expect(html).toContain("<span></span>");
  });

  it("formats the value like the game", () => {
    expect(html).toContain("<b>1 234</b>");
  });
});

describe("history chart colours", () => {
  it("keeps a curve's own colour", () => {
    const option = buildHistoryOption(
      [
        { name: "A", points: [], color: "#123456" },
        { name: "B", points: [] },
      ],
      false,
    );
    const series = option.series as { color?: string }[];
    expect(series[0]?.color).toBe("#123456");
    expect(series[1]?.color).toBeUndefined();
  });

  it("drops ECharts' legend when asked", () => {
    expect(buildHistoryOption([], false, false).legend).toBeUndefined();
    expect(buildHistoryOption([], false).legend).toBeDefined();
  });
});
