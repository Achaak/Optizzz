// The Plan de passage of the « Chaîne » tab (docs/features/site-chaine.md, « Plan de passage »): its text for the
// alliance's Discord, and the tab's choice kept in the address (`?onglet=chaine&vue=plan&horizon=12&membre=Okapi`).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTimeShort } from "@optizzz/game/format/time-format";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import {
  projectChain,
  type FloodOnWay,
  type HuntReturn,
  type Launch,
  type PlanInput,
  type ProjectedFlood,
} from "@optizzz/game/tdc-chain/passage";
import type { Role } from "@optizzz/game/tdc-chain/roles";
import { CHAIN_MARGIN } from "@optizzz/game/tdc-chain/roles";
import { distance, travelTime } from "@optizzz/game/travel";

export const HORIZONS = [2, 6, 12, 24] as const;
type Horizon = (typeof HORIZONS)[number];

export interface PassageView {
  view: "roles" | "plan";
  /** Hours ahead. */
  horizon: Horizon;
  /** Whose floods to launch are shown: a member's pseudo, null for the reader. */
  member: string | null;
}

const DEFAULT_PASSAGE_VIEW: PassageView = { view: "roles", horizon: 6, member: null };

/** The value of `onglet` that opens the « Chaîne » tab (the extension's « Modifier sur optizzz.fr » leads there). */
export const CHAIN_TAB = "chaine";

export function readPassageView(
  params: { get: (name: string) => string | null },
  members: readonly string[],
): PassageView {
  const wanted = params.get("membre")?.toLowerCase();
  return {
    view: params.get("vue") === "plan" ? "plan" : "roles",
    horizon: HORIZONS.find((hours) => String(hours) === params.get("horizon")) ?? DEFAULT_PASSAGE_VIEW.horizon,
    member: members.find((m) => m.toLowerCase() === wanted) ?? null,
  };
}

export function passageViewSearch(view: PassageView): string {
  const params = new URLSearchParams({ onglet: CHAIN_TAB });
  if (view.view === "plan") params.set("vue", "plan");
  if (view.horizon !== DEFAULT_PASSAGE_VIEW.horizon) params.set("horizon", String(view.horizon));
  if (view.member !== null) params.set("membre", view.member);
  return params.toString();
}

/** « 12 h 05–12 h 20 », one time when the window is closed, « ≈ » before a trip guessed without the Attack Speed. */
function departure(launch: Launch, now: Date): string {
  const from = formatEndTimeShort(new Date(launch.departFrom), now);
  const to = formatEndTimeShort(new Date(launch.departTo), now);
  return `${launch.approx ? "≈ " : ""}${from === to ? from : `${from}–${to}`}`;
}

/**
 * The plan as a message to paste in the alliance's Discord: copied, never sent by Optizzz. One line per flood to launch
 * in landing order, then the floods on their way that will fail or take less than expected.
 */
export function passageDiscord(
  plan: { launches: readonly Launch[]; floods: readonly ProjectedFlood[] },
  context: { tag: string; names: ReadonlyMap<number, string>; now: Date },
): string {
  const name = (id: number) => context.names.get(id) ?? "?";
  const at = (time: number) => formatEndTimeShort(new Date(time), context.now);
  const launches = plan.launches.map(
    (launch) =>
      `${String(launch.n)}. partir ${departure(launch, context.now)} · ${name(launch.attackerId)} → ${name(launch.targetId)} · ${formatNumber(launch.take)} fourmis · arrivée ${at(launch.arrival)}`,
  );
  const alerts = plan.floods.flatMap((flood) => {
    const head = `⚠ ${flood.from} → ${flood.target}, arrivée ${at(flood.at)} : `;
    if (flood.status === "fails") return [`${head}échouera, hors portée à l'arrivée`];
    if (flood.status === "reduced")
      return [
        `${head}${flood.before ?? "un autre flood"} passe devant, prise ${formatNumber(flood.actual)} au lieu de ${formatNumber(flood.expected)}`,
      ];
    return [];
  });
  return [
    `**Plan de passage ${context.tag}** (calculé à ${at(context.now.getTime())})`,
    ...(launches.length === 0 ? ["Aucun flood à lancer."] : launches),
    ...alerts,
  ].join("\n");
}

/** An alliance member as the export shows them, with where their nest is. */
export interface PassageRosterMember {
  id: number;
  pseudo: string;
  field: number;
  x: number;
  y: number;
  onHoliday: boolean;
  isBanned: boolean;
}

/** The middle one of the known levels; 0 when none is known. */
function median(levels: readonly number[]): number {
  const sorted = [...levels].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * What the plan starts from (docs/features/site-chaine.md, « Plan de passage »): each member's newest field, the one
 * sent with « Production » or the export's (`approx`), their hunts coming back, their army and Attack Speed when they
 * send them. An unknown Attack Speed is the members' median known level, and the trips it gives are estimated.
 */
export function passageInput(args: {
  roster: readonly PassageRosterMember[];
  /** When the export was taken; null before the cron's first pass. */
  exportAt: number | null;
  states: readonly MemberStates[] | null;
  floods: readonly FloodOnWay[];
  roles: ReadonlyMap<number, Role>;
  keep: ReadonlyMap<number, number>;
  now: number;
  horizonHours: number;
}): { input: PlanInput; sources: Map<number, { at: number; approx: boolean }> } {
  const stateOf = (pseudo: string) =>
    args.states?.find((s) => s.latest.pseudo.toLowerCase() === pseudo.toLowerCase())?.latest;
  const sources = new Map<number, { at: number; approx: boolean }>();
  const hunts: HuntReturn[] = [];
  const slots = new Map<number, number>();
  const ants = new Map<number, number>();
  const speeds = new Map<number, number>();
  const exportAt = args.exportAt ?? 0;

  const members = args.roster.map((m) => {
    const state = stateOf(m.pseudo);
    const readAt = state?.readAt.getTime() ?? -Infinity;
    const shared = state?.huntingField !== undefined && readAt > exportAt ? state.huntingField : null;
    const own = shared !== null;
    const fieldAt = own ? readAt : exportAt;
    sources.set(m.id, { at: fieldAt, approx: !own });
    for (const hunt of state?.hunts ?? [])
      hunts.push({ memberId: m.id, at: hunt.returnsAt.getTime(), gain: hunt.fieldGain });
    if (state?.army) ants.set(m.id, state.army.total);
    const speed = state?.research?.attackSpeed;
    if (speed !== undefined) speeds.set(m.id, speed);
    return { id: m.id, pseudo: m.pseudo, field: shared ?? m.field, fieldAt };
  });

  const fallback = median([...speeds.values()]);
  for (const m of args.roster) slots.set(m.id, (speeds.get(m.id) ?? fallback) + 1);
  const nests = new Map(args.roster.map((m) => [m.id, m]));
  const travel = (attackerId: number, targetId: number) => {
    const from = nests.get(attackerId);
    const to = nests.get(targetId);
    const level = speeds.get(attackerId);
    return {
      seconds: from && to ? travelTime(distance(from, to), level ?? fallback) : 0,
      approx: level === undefined,
    };
  };

  return {
    input: {
      members,
      roles: args.roles,
      keep: args.keep,
      floods: args.floods,
      hunts,
      slots,
      ants,
      now: args.now,
      horizon: args.horizonHours * 3600_000,
      travel,
      margin: CHAIN_MARGIN,
    },
    sources,
  };
}

/** The floods still to land that will fail or take less than their sender expected: the « Chaîne » tab's count. */
export function passageAlerts(args: {
  roster: readonly PassageRosterMember[];
  exportAt: number | null;
  states: readonly MemberStates[] | null;
  floods: readonly FloodOnWay[];
  now: number;
}): number {
  const { input } = passageInput({ ...args, roles: new Map(), keep: new Map(), horizonHours: 0 });
  return projectChain(input).floods.filter((f) => f.at > args.now && f.status !== "holds").length;
}
