// Curves, ranks and suggestions drawn from the alliances' history.
import { versionDate } from "@optizzz/game/export-versions";
import type { Alliance } from "@optizzz/game/exports";
import { diplomacyWith, sameTag, type WarSide } from "@optizzz/game/diplomacy";
import { HARVESTS_PER_DAY } from "@optizzz/game/forecast";
import type { Point } from "@/utils/history-chart/chart-option";
import type { AllianceScores } from "@optizzz/game/pages/alliance-ranking";
import type { AllianceSnapshot } from "./api";

/** The export's totals, and the production ceiling drawn from the TDC (TDC × 48 a day). */
export type AllianceMetric = keyof AllianceScores | "production";

/** Scores read in the game now; any may be missing. */
export interface LiveAlliance {
  time: Date;
  scores: Partial<AllianceScores>;
}

/** The alliance's totals in an export, whatever the case of `tag` (the game ignores it too). */
export function findAlliance(alliances: ReadonlyMap<string, AllianceScores>, tag: string): AllianceScores | undefined {
  const exact = alliances.get(tag);
  if (exact) return exact;
  for (const [other, scores] of alliances) if (sameTag(other, tag)) return scores;
  return undefined;
}

/** `metric`, or `metric` per member; the members count is never divided. Undefined when unknown. */
export function valueOf(scores: Partial<AllianceScores>, metric: AllianceMetric, average: boolean): number | undefined {
  const value =
    metric === "production"
      ? scores.field === undefined
        ? undefined
        : scores.field * HARVESTS_PER_DAY
      : scores[metric];
  if (value === undefined || !average || metric === "members") return value;
  return scores.members ? value / scores.members : undefined;
}

/** The alliance's `metric` at each export where it exists, then the live value if known. */
export function allianceSeries(
  history: readonly AllianceSnapshot[],
  tag: string,
  metric: AllianceMetric,
  average: boolean,
  live?: LiveAlliance,
): Point[] {
  const points = history.flatMap(({ version, alliances }) => {
    const scores = findAlliance(alliances, tag);
    const value = scores && valueOf(scores, metric, average);
    return value === undefined ? [] : [{ time: versionDate(version).getTime(), value, live: false }];
  });
  const liveValue = live && valueOf(live.scores, metric, average);
  if (live && liveValue !== undefined) points.push({ time: live.time.getTime(), value: liveValue, live: true });
  return points;
}

/** Rank of the alliance on `metric` among every alliance of the export (1 = best); null when absent. */
export function rankOf(
  alliances: ReadonlyMap<string, AllianceScores>,
  tag: string,
  metric: AllianceMetric,
  average: boolean,
): number | null {
  const scores = findAlliance(alliances, tag);
  const value = scores && valueOf(scores, metric, average);
  if (value === undefined) return null;
  let ahead = 0;
  for (const other of alliances.values()) if ((valueOf(other, metric, average) ?? -Infinity) > value) ahead++;
  return ahead + 1;
}

export type Suggestion = { tag: string } & ({ reason: "pact" | "neighbour" } | { reason: "war"; declaredBy: WarSide });

/** Alliances in the ranking on each side of mine. */
const NEIGHBOURS = 2;

/**
 * Alliances worth comparing with mine: pacts, wars (declared on either side; the export sometimes has an
 * alliance at war with itself), then the neighbours in the ranking on `metric`. Mine is never suggested.
 */
export function suggestions(
  alliances: readonly Alliance[],
  latest: AllianceSnapshot,
  myTag: string,
  metric: AllianceMetric,
): Suggestion[] {
  const found: Suggestion[] = [];
  const mine = alliances.find((alliance) => sameTag(alliance.tag, myTag));
  const add = (tag: string, neighbour = false) => {
    const known = alliances.find((alliance) => sameTag(alliance.tag, tag));
    if (!known || sameTag(known.tag, myTag) || found.some((s) => sameTag(s.tag, known.tag))) return;
    const diplomacy = neighbour ? null : diplomacyWith(mine, known);
    if (diplomacy?.kind === "war") found.push({ tag: known.tag, reason: "war", declaredBy: diplomacy.declaredBy });
    else found.push({ tag: known.tag, reason: neighbour ? "neighbour" : "pact" });
  };

  for (const pact of mine?.diplomacy.pacts ?? []) add(pact.tag);
  for (const war of mine?.diplomacy.wars ?? []) add(war);
  for (const other of alliances) if (other.diplomacy.wars.some((war) => sameTag(war, myTag))) add(other.tag);

  const ranked = [...latest.alliances]
    .sort(([, a], [, b]) => (valueOf(b, metric, false) ?? 0) - (valueOf(a, metric, false) ?? 0))
    .map(([tag]) => tag);
  const at = ranked.findIndex((tag) => sameTag(tag, myTag));
  if (at >= 0) {
    for (const tag of ranked.slice(Math.max(0, at - NEIGHBOURS), at + NEIGHBOURS + 1)) add(tag, true);
  }
  return found;
}

export interface Share {
  pseudo: string;
  value: number;
  /** Percent of the alliance's total; null when the total is zero. */
  share: number | null;
}

/** Each member's value and part of the total, largest first. */
export function shares(values: ReadonlyMap<string, number>): Share[] {
  const total = [...values.values()].reduce((sum, value) => sum + value, 0);
  return [...values]
    .map(([pseudo, value]) => ({ pseudo, value, share: total === 0 ? null : (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

/** Totals of the members table, when the alliance page cannot be read: no trophies there. */
export function membersTotals(
  members: ReadonlyMap<string, Partial<Record<"field" | "building" | "technology", number>>>,
) {
  const totals: Partial<AllianceScores> = { members: members.size };
  for (const metric of ["field", "building", "technology"] as const) {
    const values = [...members.values()].map((scores) => scores[metric]);
    if (values.every((value) => value !== undefined)) totals[metric] = values.reduce((sum, value) => sum + value, 0);
  }
  return totals;
}
