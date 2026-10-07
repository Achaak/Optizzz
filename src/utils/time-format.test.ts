import { describe, expect, it } from "vitest";
import { formatDuration, formatEndTime, formatEndTimeShort } from "./time-format";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatDuration", () => {
  it("shows minutes under an hour, rounded up", () => {
    expect(formatDuration(12 * MINUTE)).toBe("12 min");
    expect(formatDuration(11 * MINUTE + 1 * SECOND)).toBe("12 min");
  });

  it("shows hours and two-digit minutes under a day", () => {
    expect(formatDuration(3 * HOUR + 12 * MINUTE)).toBe("3 h 12");
    expect(formatDuration(1 * HOUR + 5 * MINUTE)).toBe("1 h 05");
    expect(formatDuration(1 * HOUR)).toBe("1 h 00");
  });

  it("shows days and hours, rounded up to the hour, from a day on", () => {
    expect(formatDuration(2 * DAY + 4 * HOUR)).toBe("2 j 4 h");
    expect(formatDuration(2 * DAY + 3 * HOUR + 10 * MINUTE)).toBe("2 j 4 h");
    expect(formatDuration(23 * HOUR + 59 * MINUTE + 30 * SECOND)).toBe("1 j 0 h");
  });

  it("caps at thirty days", () => {
    expect(formatDuration(30 * DAY)).toBe("30 j 0 h");
    expect(formatDuration(30 * DAY + 1 * HOUR)).toBe("plus de 30 j");
    expect(formatDuration(400 * DAY)).toBe("plus de 30 j");
  });
});

describe("formatEndTime", () => {
  // Wednesday 7 October 2026, local time.
  const now = new Date(2026, 9, 7, 13, 0);

  it("says « aujourd'hui » for today", () => {
    expect(formatEndTime(new Date(2026, 9, 7, 14, 23), now)).toBe("aujourd'hui 14 h 23");
    expect(formatEndTime(new Date(2026, 9, 7, 13, 5), now)).toBe("aujourd'hui 13 h 05");
  });

  it("says « demain » for tomorrow, even across a month", () => {
    expect(formatEndTime(new Date(2026, 9, 8, 2, 10), now)).toBe("demain 2 h 10");
    expect(formatEndTime(new Date(2026, 10, 1, 9, 0), new Date(2026, 9, 31, 23, 0))).toBe("demain 9 h 00");
  });

  it("names the weekday within the week, then the date", () => {
    expect(formatEndTime(new Date(2026, 9, 9, 9, 5), now)).toBe("ven. 9 h 05");
    expect(formatEndTime(new Date(2026, 9, 13, 18, 40), now)).toBe("mar. 18 h 40");
    expect(formatEndTime(new Date(2026, 9, 14, 18, 40), now)).toBe("14/10 18 h 40");
  });
});

describe("formatEndTimeShort", () => {
  const now = new Date(2026, 9, 7, 13, 0);

  it("drops « aujourd'hui » only", () => {
    expect(formatEndTimeShort(new Date(2026, 9, 7, 14, 23), now)).toBe("14 h 23");
    expect(formatEndTimeShort(new Date(2026, 9, 8, 2, 10), now)).toBe("demain 2 h 10");
  });
});
