// The table of the « État » tab (docs/features/site-envois.md, « État : le tableau des membres »): one row per member,
// the columns the reader chose, each cell dated by the reading of its own part. What a column shows, its date, its
// change in the last 24 hours and how it sorts are here; the view only draws them.
import { BUILDINGS, RESEARCH, type BuildingKey, type ResearchKey } from "@optizzz/game/levels";
import type { MemberStates, StatePart } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { productionPerDay } from "@optizzz/game/site-links/envoi-states";
import type { FloodItem } from "@optizzz/game/site-links/envoi-floods";
import { isSentCategory, type SentCategory } from "@optizzz/game/site-links/envois";
import type { MemberState } from "./states";

export type ColumnKey =
  | "production"
  | "huntingField"
  | "workers"
  | "army"
  | `research.${ResearchKey}`
  | `buildings.${BuildingKey}`
  | "nextWork"
  | "hunts"
  | "convoys"
  | "floods"
  | "sends"
  | "lastEnvoi";

export interface Column {
  key: ColumnKey;
  label: string;
}

/** The columns, in the order of the menu and of the table. */
export const COLUMN_GROUPS: readonly { label: string; columns: readonly Column[] }[] = [
  {
    label: "Résumé",
    columns: [
      { key: "production", label: "Production / jour" },
      { key: "huntingField", label: "TDC" },
      { key: "workers", label: "Ouvrières" },
      { key: "army", label: "Armée" },
    ],
  },
  { label: "Recherches", columns: RESEARCH.map((r) => ({ key: `research.${r.key}` as const, label: r.name })) },
  { label: "Bâtiments", columns: BUILDINGS.map((b) => ({ key: `buildings.${b.key}` as const, label: b.name })) },
  {
    label: "En cours",
    columns: [
      { key: "nextWork", label: "Prochain chantier" },
      { key: "hunts", label: "Chasses" },
      { key: "convoys", label: "Convois en route" },
      { key: "floods", label: "Floods en route" },
    ],
  },
  {
    label: "Envois",
    columns: [
      { key: "sends", label: "Envoie" },
      { key: "lastEnvoi", label: "Dernier Envoi" },
    ],
  },
];

const ORDER: readonly ColumnKey[] = COLUMN_GROUPS.flatMap((group) => group.columns.map((column) => column.key));

export const DEFAULT_COLUMNS: readonly ColumnKey[] = [
  "production",
  "huntingField",
  "workers",
  "army",
  "research.weapons",
  "research.shield",
  "research.attackSpeed",
  "buildings.dome",
  "buildings.lodge",
  "nextWork",
  "sends",
  "lastEnvoi",
];

const isColumn = (value: unknown): value is ColumnKey => (ORDER as readonly unknown[]).includes(value);

/** The columns kept in the browser: the defaults when nothing (or nothing readable) is kept. */
export function parseColumns(stored: string | null): ColumnKey[] {
  if (stored === null) return [...DEFAULT_COLUMNS];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [...DEFAULT_COLUMNS];
    return ORDER.filter((key) => parsed.filter(isColumn).includes(key));
  } catch {
    return [...DEFAULT_COLUMNS];
  }
}

export function toggleColumn(columns: readonly ColumnKey[], key: ColumnKey): ColumnKey[] {
  const on = columns.includes(key);
  return ORDER.filter((k) => (k === key ? !on : columns.includes(k)));
}

export interface TableRow extends MemberState {
  sends: SentCategory[];
  /** The newest of the member's Envois, once opened: their states, and the convoys and floods they read. */
  lastEnvoi: Date | null;
  /** Convoys on their way, sent by the member and coming to them; what comes and when the first arrives. */
  convoys: { sent: number; received: number; food: number; materials: number; nextArrival: Date | null };
  /** Floods on their way, launched by the member and aimed at them by members; when the first arrives. */
  floods: { launched: number; aimed: number; nextArrival: Date | null };
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const soonest = (times: readonly number[]) => (times.length > 0 ? new Date(Math.min(...times)) : null);

export function tableRows(input: {
  members: readonly { playerId: number; pseudo: string }[];
  /** Each member's states, Envois and pasted ones merged (memberStates). */
  merged: readonly MemberState[];
  /** The states of the Envois only. */
  envois: readonly MemberStates[];
  convoys: readonly (ConvoyItem & { observedAt: number; reporter: string })[];
  floods: readonly (FloodItem & { observedAt: number })[];
  sends: readonly { playerId: number; categories: readonly string[] }[];
  now: Date;
}): TableRow[] {
  const now = input.now.getTime();
  const onTheWay = input.convoys.filter((c) => c.kind === "transit" && c.at > now);
  const inFlight = input.floods.filter((f) => f.at > now);
  return input.merged.map((member) => {
    const pseudo = member.pseudo;
    const playerId = input.members.find((m) => same(m.pseudo, pseudo))?.playerId;
    const sent = onTheWay.filter((c) => same(c.from, pseudo));
    const received = onTheWay.filter((c) => same(c.to, pseudo));
    const launched = inFlight.filter((f) => same(f.from, pseudo));
    const aimed = inFlight.filter((f) => same(f.target, pseudo));
    const envoiTimes = [
      ...input.envois.filter((s) => same(s.latest.pseudo, pseudo)).map((s) => s.latest.readAt.getTime()),
      ...input.convoys.filter((c) => same(c.reporter, pseudo)).map((c) => c.observedAt),
      ...launched.map((f) => f.observedAt),
      ...input.floods.filter((f) => f.at <= now && same(f.from, pseudo)).map((f) => f.observedAt),
    ];
    return {
      ...member,
      sends: (input.sends.find((s) => s.playerId === playerId)?.categories ?? []).filter(isSentCategory),
      lastEnvoi: envoiTimes.length > 0 ? new Date(Math.max(...envoiTimes)) : null,
      convoys: {
        sent: sent.length,
        received: received.length,
        food: received.reduce((sum, c) => sum + c.food, 0),
        materials: received.reduce((sum, c) => sum + c.materials, 0),
        nextArrival: soonest(received.map((c) => c.at)),
      },
      floods: {
        launched: launched.length,
        aimed: aimed.length,
        nextArrival: soonest([...launched, ...aimed].map((f) => f.at)),
      },
    };
  });
}

/** The part of a state a column shows; none for what is not a reading. */
function partOf(key: ColumnKey): StatePart | undefined {
  if (key.startsWith("research.")) return "research";
  if (key.startsWith("buildings.")) return "buildings";
  switch (key) {
    case "production":
    case "huntingField":
    case "workers":
    case "army":
    case "hunts":
      return key;
    case "nextWork":
      return "works";
    default:
      return undefined;
  }
}

/** When the reading a cell shows was made. */
export function cellReadAt(row: MemberState, key: ColumnKey): Date | undefined {
  const part = partOf(key);
  if (!part || row.states?.latest[part] === undefined) return undefined;
  return row.states.partsReadAt?.[part] ?? row.states.latest.readAt;
}

const OLD_MS = 48 * 3600_000;
const CHANGE_MS = 24 * 3600_000;

/** Past 48 hours, a reading is shown greyed. */
export const isOld = (readAt: Date, now: Date) => now.getTime() - readAt.getTime() > OLD_MS;

/** A level or count of the state, as a number. */
function levelOf(state: MemberStates["latest"] | undefined, key: ColumnKey): number | undefined {
  if (!state) return undefined;
  if (key === "huntingField") return state.huntingField;
  if (key === "workers") return state.workers;
  if (key === "army") return state.army?.total;
  const [group, level] = key.split(".") as [string, string | undefined];
  if (level === undefined || (group !== "research" && group !== "buildings")) return undefined;
  return (state[group] as Partial<Record<string, number>> | undefined)?.[level];
}

/** « up » or « down » when the value moved in a reading of the last 24 hours. */
export function cellChange(row: MemberState, key: ColumnKey, now: Date): "up" | "down" | undefined {
  const readAt = cellReadAt(row, key);
  if (!readAt || now.getTime() - readAt.getTime() >= CHANGE_MS) return undefined;
  const value = levelOf(row.states?.latest, key);
  const before = levelOf(row.states?.previous, key);
  if (value === undefined || before === undefined || value === before) return undefined;
  return value > before ? "up" : "down";
}

/** The number a column sorts by; undefined for an empty cell. */
export function sortValue(row: TableRow, key: ColumnKey, now: Date): number | undefined {
  const latest = row.states?.latest;
  switch (key) {
    case "production":
      return latest?.production && productionPerDay(latest.production, now).total;
    case "nextWork":
      return nextWork(row, now)?.endsAt.getTime();
    case "hunts": {
      const out = huntsOut(row, now);
      return out?.length;
    }
    case "convoys":
      return row.convoys.sent + row.convoys.received > 0 ? row.convoys.received : undefined;
    case "floods":
      return row.floods.launched + row.floods.aimed > 0 ? row.floods.launched : undefined;
    case "sends":
      return row.sends.length;
    case "lastEnvoi":
      return row.lastEnvoi?.getTime();
    default:
      return levelOf(latest, key);
  }
}

/** The work of the member that ends first, still running. */
export function nextWork(row: MemberState, now: Date) {
  return (row.states?.latest.works ?? [])
    .filter((w) => w.endsAt > now)
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())[0];
}

/** The hunts still out; undefined when the member does not send them. */
export function huntsOut(row: MemberState, now: Date) {
  return row.states?.latest.hunts?.filter((h) => h.returnsAt > now);
}

export interface Sort {
  key: ColumnKey;
  direction: "descending" | "ascending";
}

/** A click on a header: down, then up, then the space's order. */
export function nextSort(current: Sort | null, key: ColumnKey): Sort | null {
  if (current?.key !== key) return { key, direction: "descending" };
  return current.direction === "descending" ? { key, direction: "ascending" } : null;
}

/** The rows sorted, an empty cell always at the bottom; the space's order without a sort, or between equals. */
export function sortRows(rows: readonly TableRow[], sort: Sort | null, now: Date): TableRow[] {
  if (!sort) return [...rows];
  const sign = sort.direction === "descending" ? -1 : 1;
  const values = new Map(rows.map((row) => [row, sortValue(row, sort.key, now)]));
  return [...rows].sort((a, b) => {
    const va = values.get(a);
    const vb = values.get(b);
    if (va === undefined || vb === undefined) return va === vb ? 0 : va === undefined ? 1 : -1;
    return sign * (va - vb);
  });
}
