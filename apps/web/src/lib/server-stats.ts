// What the server pages draw from the stored exports: TDC brackets, kinds of Changes. Pure, for the tests.
import type { Change } from "@optizzz/game/changes";
import { formatNumber } from "@optizzz/game/format/number-format";
import { fromParisParts } from "@optizzz/game/format/time-format";

/** A bracket of TDC (cm²): from `min` included to the next bracket's `min`. */
export interface FieldBracket {
  min: number;
  /** « 10–50 k ». */
  label: string;
}

export const FIELD_BRACKETS: readonly FieldBracket[] = [
  { min: 0, label: "< 1 k" },
  { min: 1_000, label: "1–10 k" },
  { min: 10_000, label: "10–50 k" },
  { min: 50_000, label: "50–100 k" },
  { min: 100_000, label: "100–250 k" },
  { min: 250_000, label: "250–500 k" },
  { min: 500_000, label: "500 k +" },
];

/** The field range of bracket `index`, for a count query: `lt` is missing on the last one. */
export function bracketRange(index: number): { gte: number; lt?: number } {
  const next = FIELD_BRACKETS[index + 1];
  return { gte: FIELD_BRACKETS[index]?.min ?? 0, ...(next && { lt: next.min }) };
}

/** The groups the Journal's activity is stacked by. */
export type JournalGroup = "players" | "alliances" | "colonies" | "diplomacy";

export const JOURNAL_GROUPS: readonly { id: JournalGroup; label: string }[] = [
  { id: "players", label: "Joueurs" },
  { id: "alliances", label: "Alliances" },
  { id: "colonies", label: "Colonisations" },
  { id: "diplomacy", label: "Diplomatie" },
];

const GROUP_OF: Record<Change["kind"], JournalGroup> = {
  new: "players",
  gone: "players",
  pseudo: "players",
  holiday: "players",
  banned: "players",
  unbanned: "players",
  alliance: "alliances",
  joined: "alliances",
  left: "alliances",
  colonized: "colonies",
  freed: "colonies",
  war: "diplomacy",
  "war-ended": "diplomacy",
  pact: "diplomacy",
  "pact-ended": "diplomacy",
};

/** The group of a kind of Change; an unknown kind (a newer cron) counts with the players. */
export const journalGroupOf = (kind: string): JournalGroup =>
  kind in GROUP_OF ? GROUP_OF[kind as Change["kind"]] : "players";

/** The kinds of Change of a group, for a query. */
export const kindsOf = (group: JournalGroup): Change["kind"][] =>
  (Object.keys(GROUP_OF) as Change["kind"][]).filter((kind) => GROUP_OF[kind] === group);

/** A group from the query, null for all of them. */
export const journalGroupFrom = (value: string | string[] | undefined): JournalGroup | null =>
  JOURNAL_GROUPS.find((group) => group.id === value)?.id ?? null;

/** The Paris day « 2026-10-26 » (a date field's value) as instants, null when it is not a day. */
export function parisDayRange(text: string): { gte: Date; lt: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    gte: fromParisParts({ year, month, day, hours: 0, minutes: 0 }),
    lt: fromParisParts({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hours: 0,
      minutes: 0,
    }),
  };
}

const TAG_OF: Record<Change["kind"], string> = {
  new: "Arrivée",
  gone: "Départ",
  pseudo: "Pseudo",
  holiday: "Vacances",
  banned: "Banni",
  unbanned: "Débanni",
  alliance: "Alliance",
  joined: "Membre",
  left: "Membre",
  colonized: "Colonie",
  freed: "Libéré",
  war: "Guerre",
  "war-ended": "Paix",
  pact: "Pacte",
  "pact-ended": "Rupture",
};

/** The word before a Journal line: « Guerre », « Pacte »… */
export const journalTag = (change: Change): string => TAG_OF[change.kind];

/** `part` of `whole` in percent, one decimal, 0 for an empty whole. */
export const percentOf = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** « 1ᵉʳ », « 2ᵉ », « 1 204ᵉ »: a rank as French writes it. */
export const ordinal = (rank: number): string => `${formatNumber(rank)}${rank === 1 ? "ᵉʳ" : "ᵉ"}`;

/**
 * How a figure moved from `before` to `now`, upward or downward in words and arrows (never colour alone):
 * « ▲ 41 210 », « ▼ 3 », « = ». A rank moves up as it gets smaller. Nothing when there is no `before`.
 */
export function trendText(before: number | undefined, now: number, rank = false): string | undefined {
  if (before === undefined) return undefined;
  const delta = Math.round(now - before);
  if (delta === 0) return "=";
  const up = rank ? delta < 0 : delta > 0;
  return `${up ? "▲" : "▼"} ${formatNumber(Math.abs(delta))}`;
}
