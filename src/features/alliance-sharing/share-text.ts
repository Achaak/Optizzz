// The text a member copies to share their state, and reading back a pasted channel (docs/features/partage-alliance.md).
import { z } from "zod";
import type { SharedArmy, SharedState } from "@/data/shared-states";
import { UNITS, unitLabel } from "@/game/army/units";
import { BUILDINGS, RESEARCH, sameName } from "@/game/levels";
import { formatNumber } from "@/utils/number-format";
import { dayMonth, formatDateTime } from "@/utils/time-format";

// Compact payload of the data line: levels and units as arrays in the order of BUILDINGS, RESEARCH and UNITS, a work
// by its index in BUILDINGS then RESEARCH (its name when unknown), times in minutes since 1970.
const levelsSchema = z.array(z.number().int().nonnegative().nullable());
const payloadSchema = z.object({
  s: z.string(),
  a: z.string(),
  p: z.string(),
  t: z.number().int(),
  f: z.number().int().optional(),
  w: z.number().int().optional(),
  b: levelsSchema.optional(),
  r: levelsSchema.optional(),
  c: z.array(z.tuple([z.union([z.number().int(), z.string()]), z.number().int(), z.number().int()])).optional(),
  m: z
    .object({
      n: z.number().int(),
      u: z.array(z.number().int().nonnegative()).optional(),
      i: z.boolean(),
      r: z.number().int().optional(),
    })
    .optional(),
});
type Payload = z.infer<typeof payloadSchema>;

// Standard base64 without padding: no « _ », « * » or « ~ » that Discord would read as markdown and drop on copy.
const DATA_LINE = /\[optizzz:v1:([A-Za-z0-9+/]+)\]/g;

/** Discord's limit for one message. */
const MAX_LENGTH = 2000;

const LEVELS = [...BUILDINGS, ...RESEARCH];

const MINUTE = 60_000;
const toMinutes = (date: Date) => Math.round(date.getTime() / MINUTE);
const fromMinutes = (minutes: number) => new Date(minutes * MINUTE);

function toBase64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/=+$/, "");
}

function fromBase64(data: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(data), (char) => char.charCodeAt(0)));
}

function toLevelArray<K extends string>(list: readonly { key: K }[], levels: Partial<Record<K, number>>) {
  return list.map(({ key }) => levels[key] ?? null);
}

function fromLevelArray<K extends string>(list: readonly { key: K }[], values: readonly (number | null)[]) {
  const levels: Partial<Record<K, number>> = {};
  list.forEach(({ key }, i) => {
    const value = values[i];
    if (value !== null && value !== undefined) levels[key] = value;
  });
  return levels;
}

function toPayload(state: SharedState): Payload {
  const { army } = state;
  return {
    s: state.server,
    a: state.alliance,
    p: state.pseudo,
    t: toMinutes(state.readAt),
    f: state.huntingField,
    w: state.workers,
    b: state.buildings && toLevelArray(BUILDINGS, state.buildings),
    r: state.research && toLevelArray(RESEARCH, state.research),
    c: state.works?.map((work) => {
      const index = LEVELS.findIndex((level) => sameName(level.name, work.name));
      return [index >= 0 ? index : work.name, work.level, toMinutes(work.endsAt)];
    }),
    m: army && {
      n: army.total,
      u: army.units && UNITS.map((unit) => army.units?.[unit.key] ?? 0),
      i: army.incomplete,
      r: army.returnsAt && toMinutes(army.returnsAt),
    },
  };
}

function fromPayload(payload: Payload): SharedState {
  const state: SharedState = {
    server: payload.s,
    alliance: payload.a,
    pseudo: payload.p,
    readAt: fromMinutes(payload.t),
  };
  if (payload.f !== undefined) state.huntingField = payload.f;
  if (payload.w !== undefined) state.workers = payload.w;
  if (payload.b) state.buildings = fromLevelArray(BUILDINGS, payload.b);
  if (payload.r) state.research = fromLevelArray(RESEARCH, payload.r);
  if (payload.c) {
    state.works = payload.c.map(([work, level, endsAt]) => ({
      name: typeof work === "number" ? (LEVELS[work]?.name ?? "?") : work,
      level,
      endsAt: fromMinutes(endsAt),
    }));
  }
  if (payload.m) {
    const army: SharedArmy = { total: payload.m.n, incomplete: payload.m.i };
    const units = payload.m.u;
    if (units) {
      army.units = Object.fromEntries(
        UNITS.flatMap((unit, i) => ((units[i] ?? 0) > 0 ? [[unit.key, units[i] ?? 0]] : [])),
      );
    }
    if (payload.m.r !== undefined) army.returnsAt = fromMinutes(payload.m.r);
    state.army = army;
  }
  return state;
}

const levelList = <K extends string>(list: readonly { key: K; name: string }[], levels: Partial<Record<K, number>>) =>
  list.flatMap(({ key, name }) => (levels[key] === undefined ? [] : [`${name} ${String(levels[key])}`])).join(", ");

function armyLine(army: SharedArmy): string {
  const detail = army.units
    ? ` (${UNITS.flatMap((unit) => {
        const count = army.units?.[unit.key] ?? 0;
        return count > 0 ? [`${formatNumber(count)} ${unitLabel(unit.key)}`] : [];
      }).join(", ")})`
    : "";
  const away = army.incomplete
    ? `, incomplète : des troupes sont dehors${army.returnsAt ? ` (retour le ${formatDateTime(army.returnsAt)})` : ""}`
    : "";
  return `Armée : ${formatNumber(army.total)}${detail}${away}`;
}

/** « Armes 11 → 12, Armée +120 »: levels and army that moved since `previous`. */
function changes(state: SharedState, previous: SharedState): string[] {
  const moved = <K extends string>(
    list: readonly { key: K; name: string }[],
    now: Partial<Record<K, number>> | undefined,
    before: Partial<Record<K, number>> | undefined,
  ) =>
    list.flatMap(({ key, name }) => {
      const [from, to] = [before?.[key], now?.[key]];
      return from !== undefined && to !== undefined && from !== to ? [`${name} ${String(from)} → ${String(to)}`] : [];
    });
  const armyDelta = state.army && previous.army ? state.army.total - previous.army.total : 0;
  return [
    ...moved(BUILDINGS, state.buildings, previous.buildings),
    ...moved(RESEARCH, state.research, previous.research),
    ...(armyDelta === 0 ? [] : [`Armée ${armyDelta > 0 ? "+" : "−"}${formatNumber(Math.abs(armyDelta))}`]),
  ];
}

function summary(state: SharedState, previous: SharedState | null): string[] {
  const lines = [
    `Optizzz · ${state.pseudo} (${state.alliance}, ${state.server}) · relevé le ${formatDateTime(state.readAt)}`,
  ];
  const colony = [
    state.huntingField !== undefined && `TDC : ${formatNumber(state.huntingField)} cm²`,
    state.workers !== undefined && `Ouvrières : ${formatNumber(state.workers)}`,
  ].filter((part) => part !== false);
  if (colony.length > 0) lines.push(colony.join(" · "));
  if (state.army) lines.push(armyLine(state.army));
  const moved = previous ? changes(state, previous) : [];
  if (previous && moved.length > 0) lines.push(`Depuis le ${dayMonth(previous.readAt)} : ${moved.join(", ")}`);
  if (state.works?.length) {
    const works = state.works.map(
      (work) => `${work.name} ${String(work.level)} (fin le ${formatDateTime(work.endsAt)})`,
    );
    lines.push(`Chantiers : ${works.join(", ")}`);
  }
  if (state.buildings) lines.push(`Bâtiments : ${levelList(BUILDINGS, state.buildings)}`);
  if (state.research) lines.push(`Recherches : ${levelList(RESEARCH, state.research)}`);
  return lines;
}

/** The text to paste in the alliance's channel: a summary to read, then the data line Optizzz reads back. */
export function formatShare(state: SharedState, previous: SharedState | null): string {
  const data = `[optizzz:v1:${toBase64(JSON.stringify(toPayload(state)))}]`;
  const lines = summary(state, previous);
  const text = [...lines, data].join("\n");
  if (text.length < MAX_LENGTH) return text;
  // Too long for one message: the levels stay in the data line only.
  const short = lines.filter((line) => !line.startsWith("Bâtiments :") && !line.startsWith("Recherches :"));
  return [...short, "Bâtiments et recherches : dans la vue Partage d'Optizzz", data].join("\n");
}

export interface ShareContext {
  server: string;
  alliance: string;
  /** Nicknames on the members page. */
  members: readonly string[];
}

export interface ParsedShares {
  states: SharedState[];
  /** Attack Speed levels in the map's former « Pseudo: level » format, by nickname of the members page. */
  attackSpeeds: Map<string, number>;
  /** What was skipped and why, to show the player. */
  ignored: string[];
}

/**
 * The states found in a pasted channel; everything around the data lines is ignored. A text without any data line
 * is read in the map's former « Pseudo: level » format (to drop after one version).
 */
export function parseShares(text: string, context: ShareContext): ParsedShares {
  const members = new Map(context.members.map((pseudo) => [pseudo.toLocaleLowerCase("fr"), pseudo]));
  const states: SharedState[] = [];
  const attackSpeeds = new Map<string, number>();
  const ignored: string[] = [];
  const dataLines = [...text.matchAll(DATA_LINE)];
  if (dataLines.length === 0) {
    for (const line of text.split("\n").map((raw) => raw.trim())) {
      if (!line) continue;
      const [, pseudo = "", level] = /^(.+?)\s*:\s*(\d+)$/.exec(line) ?? [];
      const member = members.get(pseudo.toLocaleLowerCase("fr"));
      if (member && level) attackSpeeds.set(member, Number(level));
      else ignored.push(line);
    }
  }
  for (const [, data = ""] of dataLines) {
    const state = decode(data);
    const member = state && members.get(state.pseudo.toLocaleLowerCase("fr"));
    if (!state) ignored.push("Ligne Optizzz illisible");
    else if (state.server !== context.server) ignored.push(`${state.pseudo} : autre serveur (${state.server})`);
    else if (state.alliance !== context.alliance) ignored.push(`${state.pseudo} : autre alliance (${state.alliance})`);
    else if (!member) ignored.push(`${state.pseudo} : pas dans l'alliance`);
    else states.push({ ...state, pseudo: member });
  }
  return { states, attackSpeeds, ignored };
}

function decode(data: string): SharedState | null {
  try {
    const payload = payloadSchema.safeParse(JSON.parse(fromBase64(data)));
    return payload.success ? fromPayload(payload.data) : null;
  } catch {
    return null;
  }
}
