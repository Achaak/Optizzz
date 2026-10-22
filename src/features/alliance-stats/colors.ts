// The colour of each alliance on the charts, the same in the view and over the ranking — see
// docs/features/statistiques-alliance.md.
import { useEffect, useMemo } from "react";
import { sameTag } from "@/game/diplomacy";
import { CHART_COLORS } from "@/theme";
import type { AllianceStatsSettings } from "./settings";

/**
 * A colour for each tag, the one it had before when it still can (still in the palette, not taken): an alliance
 * keeps its colour while others come and go. The new ones take the first colour left, in the palette's order.
 */
export function assignColors(
  tags: readonly string[],
  previous: ReadonlyMap<string, string>,
  palette: readonly string[] = CHART_COLORS.series,
): Map<string, string> {
  const colors = new Map<string, string>();
  const used = new Set<string>();
  const before = (tag: string) => [...previous].find(([other]) => sameTag(other, tag))?.[1];
  for (const tag of tags) {
    const color = before(tag);
    if (color && palette.includes(color) && !used.has(color)) {
      colors.set(tag, color);
      used.add(color);
    }
  }
  for (const tag of tags) {
    if (colors.has(tag)) continue;
    const color = palette.find((candidate) => !used.has(candidate)) ?? palette[colors.size % palette.length];
    if (!color) continue;
    colors.set(tag, color);
    used.add(color);
  }
  return colors;
}

/**
 * Mine in the palette's first colour (red, as on the other charts), each compared alliance in the colour it was
 * given, the newcomers in the first colour left. Mine's colour is never another's, even without an alliance.
 */
export function comparedColors(
  myTag: string | null,
  compared: readonly string[],
  stored: Readonly<Record<string, string>>,
  palette: readonly string[] = CHART_COLORS.series,
): Map<string, string> {
  const [mine, ...others] = palette;
  const colors = new Map<string, string>();
  if (myTag && mine) colors.set(myTag, mine);
  for (const [tag, color] of assignColors(compared, new Map(Object.entries(stored)), others)) colors.set(tag, color);
  return colors;
}

/** What is remembered: the colours of the compared alliances only, by their tag as the list writes it. */
export function colorsToStore(
  compared: readonly string[],
  colors: ReadonlyMap<string, string>,
): Record<string, string> {
  const stored: Record<string, string> = {};
  for (const tag of compared) {
    const color = colors.get(tag);
    if (color) stored[tag] = color;
  }
  return stored;
}

const sameRecord = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([tag, color]) => b[tag] === color);

/**
 * The colours of mine and the compared alliances, remembered with the settings: an alliance keeps its colour from
 * one view to the other and after a reload, while others come and go.
 */
export function useAllianceColors(
  myTag: string | null,
  compared: readonly string[],
  settings: AllianceStatsSettings | null,
  updateSettings: (update: (current: AllianceStatsSettings) => AllianceStatsSettings) => void,
): ReadonlyMap<string, string> {
  const stored = settings?.colors;
  const colors = useMemo(() => comparedColors(myTag, compared, stored ?? {}), [myTag, compared, stored]);
  useEffect(() => {
    if (!stored) return;
    const next = colorsToStore(compared, colors);
    if (!sameRecord(next, stored)) updateSettings((current) => ({ ...current, colors: next }));
  }, [compared, colors, stored, updateSettings]);
  return colors;
}
