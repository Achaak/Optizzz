// The toolbar badge: time left before the first problem (famine, full warehouse) of the worst server.
// Computed from stored data only, never from the game. See docs/features/alertes.md.
import { formatDuration, formatEndTimeShort } from "@/utils/time-format";
import { DANGER_UNDER, WARNING_UNDER } from "@/utils/urgency";
import { outlook } from "@/game/forecast";
import type { Capacities, Income } from "@/game/pages/resources";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Hours and minutes below this, whole hours above: the badge has room for four characters. */
const MINUTES_SHOWN_UNDER = 2 * HOUR;
const DAY = 24 * HOUR;
/** Older data says « ? »: the player's situation may have changed. */
export const STALE_AFTER = DAY;
/** Older still, the server is forgotten: the player no longer plays there. */
const FORGOTTEN_AFTER = 7 * DAY;
/** Further away, a forecast means nothing: the player's situation will have changed. */
const HORIZON = 30 * DAY;

/** What the extension last read for one server. */
export interface ServerData {
  host: string;
  stock: { food: number; materials: number; workers: number; readAt: Date };
  income: (Income & { readAt: Date }) | null;
  capacities: Capacities | null;
}

export interface Badge {
  text: string;
  color: "red" | "orange" | "gray" | null;
  title: string;
}

export type ProblemKind = "famine" | "foodFull" | "materialsFull";

export const PROBLEM_LABELS: Record<ProblemKind, string> = {
  famine: "famine",
  foodFull: "entrepôt de nourriture plein",
  materialsFull: "entrepôt de matériaux plein",
};

/** « s5.fourmizzz.fr » → « S5 ». */
export const serverName = (host: string) => (host.split(".")[0] ?? host).toUpperCase();

/** Famine and full warehouses of a server, those that will come. */
export function problems({ stock, capacities }: ServerData, income: Income): { kind: ProblemKind; at: Date }[] {
  // From when the stock was read: the forecast starts there.
  const result = outlook({ ...stock, ...income, capacities }, stock.readAt);
  const all: [ProblemKind, Date | null][] = [
    ["famine", result.famineAt],
    ["foodFull", result.foodFullAt],
    ["materialsFull", result.materialsFullAt],
  ];
  return all.flatMap(([kind, at]) => (at ? [{ kind, at }] : []));
}

function firstProblem(data: ServerData, income: Income) {
  return problems(data, income).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
}

/** « famine dans 52 min (17 h 32) », or « famine depuis 16 h 20 » once it has come. */
export function describeProblem(kind: ProblemKind, at: Date, now: Date): string {
  const left = at.getTime() - now.getTime();
  const when =
    left <= 0
      ? `depuis ${formatEndTimeShort(at, now)}`
      : `dans ${formatDuration(left)} (${formatEndTimeShort(at, now)})`;
  return `${PROBLEM_LABELS[kind]} ${when}`;
}

function badgeText(left: number): string {
  if (left <= 0) return "!";
  const minutes = Math.floor(left / MINUTE);
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (left < MINUTES_SHOWN_UNDER) return `${String(hours)}h${String(minutes % 60).padStart(2, "0")}`;
  return `${String(hours)}h`;
}

/** One server's line in the hover, and how urgent it is. */
type Status =
  { kind: "problem"; left: number; line: string } | { kind: "stale"; line: string } | { kind: "none"; line: string };

function status(data: ServerData, now: Date): Status | null {
  const age = (date: Date) => now.getTime() - date.getTime();
  if (age(data.stock.readAt) > FORGOTTEN_AFTER) return null;
  const name = serverName(data.host);
  if (!data.income) return { kind: "stale", line: `${name} : ouvrez la page Ressources` };
  const oldest = Math.max(age(data.stock.readAt), age(data.income.readAt));
  if (oldest > STALE_AFTER) {
    return { kind: "stale", line: `${name} : données d'il y a ${formatDuration(oldest)}, ouvrez le jeu` };
  }
  const problem = firstProblem(data, data.income);
  if (!problem || problem.at.getTime() - now.getTime() > HORIZON)
    return { kind: "none", line: `${name} : rien de prévu` };
  const left = problem.at.getTime() - now.getTime();
  return { kind: "problem", left, line: `${name} : ${describeProblem(problem.kind, problem.at, now)}` };
}

/** Hover order: problems under 24 h, soonest first, then stale servers, later problems, nothing coming. */
function urgency(s: Status): [rank: number, left: number] {
  if (s.kind === "problem") return [s.left < WARNING_UNDER ? 0 : 2, s.left];
  return [s.kind === "stale" ? 1 : 3, 0];
}

export function badge(servers: ServerData[], now: Date): Badge {
  const statuses = servers
    .map((data) => status(data, now))
    .filter((s) => s !== null)
    .sort((a, b) => {
      const [rankA, leftA] = urgency(a);
      const [rankB, leftB] = urgency(b);
      return rankA - rankB || leftA - leftB;
    });
  const title = ["Optizzz", ...statuses.map((s) => s.line)].join("\n");
  let worst: number | null = null;
  for (const s of statuses) {
    if (s.kind === "problem" && s.left < WARNING_UNDER && (worst === null || s.left < worst)) worst = s.left;
  }
  if (worst === null) {
    const stale = statuses.some((s) => s.kind === "stale");
    return stale ? { text: "?", color: "gray", title } : { text: "", color: null, title };
  }
  return { text: badgeText(worst), color: worst < DANGER_UNDER ? "red" : "orange", title };
}
