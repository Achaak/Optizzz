// Roles in a TDC chain (chasseur → passeurs → greniers). See docs/features/chaine-tdc.md.
import { inRange } from "@optizzz/game/attack";

/**
 * Granaries and passers are numbered from the bottom: Grenier 2 is a rung above Grenier 1 and may flood it, only the
 * highest granaries keep what climbs. `drain` (« À flooder »): the whole field climbs to the granaries, like a hunter keeping nothing. `protected` (« Ne pas
 * toucher »): keeps its field, no flood of the chain on it nor from it; unlike `out`, a choice of the alliance.
 */
export type Role =
  | { kind: "hunter" }
  | { kind: "passer"; rank: number }
  | { kind: "granary"; rank: number }
  | { kind: "drain" }
  | { kind: "protected" }
  | { kind: "out" };

interface Member {
  id: number;
  field: number;
}

/** Kept above the 50 % limit, as the flood planner: other attacks and hunts may move the fields before arrival. */
export const CHAIN_MARGIN = 0.01;

/** Members within this share of the biggest field are proposed as granaries. */
const GRANARY_SHARE = 0.8;

/**
 * Roles deduced from the fields: granaries are the biggest, then each rung holds the members the smallest of the
 * rung above can attack (half its field or more), and the last rung is the hunters.
 */
export function proposeRoles(members: readonly Member[], margin = 0): Map<number, Role> {
  const sorted = [...members].sort((a, b) => b.field - a.field);
  const biggest = sorted[0]?.field ?? 0;
  const rungs: Member[][] = [];
  let rest = sorted;
  const granaries = rest.filter((member) => member.field >= biggest * GRANARY_SHARE);
  rungs.push(granaries.length < sorted.length || sorted.length < 2 ? granaries : sorted.slice(0, 1));
  rest = rest.slice(rungs[0]?.length ?? 0);
  while (rest.length > 0) {
    const smallestAbove = rungs.at(-1)?.at(-1)?.field ?? 0;
    const rung = rest.filter((member) => inRange(smallestAbove, member.field, margin));
    // Out of reach of the rung above: still the next rung, the chain will show the gap.
    const next = rung.length > 0 ? rung : rest.slice(0, 1);
    rungs.push(next);
    rest = rest.slice(next.length);
  }

  const roles = new Map<number, Role>();
  const lowest = rungs.length - 1;
  rungs.forEach((rung, i) => {
    const role: Role =
      i === 0 ? { kind: "granary", rank: 1 } : i === lowest ? { kind: "hunter" } : { kind: "passer", rank: lowest - i };
    for (const member of rung) roles.set(member.id, role);
  });
  return roles;
}

/**
 * The chain's roles, for the chain and the map: those the player set (a member arrived since is out), or until then
 * the ones proposed from the fields. `members` are those who can be in the chain.
 */
export function chainRoles(
  members: readonly Member[],
  stored: Readonly<Record<string, Role>> | null,
): Map<number, Role> {
  if (!stored) return proposeRoles(members, CHAIN_MARGIN);
  return new Map(members.map((member) => [member.id, stored[member.id] ?? { kind: "out" }]));
}

/** Passer ranks always offered, so a chain can be built from the top without filling the rungs one by one. */
const MIN_PASSER_RANKS = 5;
const MIN_GRANARY_RANKS = 2;

/** Highest rank of that kind among the roles; 0 when none. */
export const highestRank = (roles: Iterable<Role>, kind: "granary" | "passer") =>
  Math.max(0, ...[...roles].map((role) => (role.kind === kind ? role.rank : 0)));

/** Ranks to offer, highest first: at least `min`, and always one above the highest used. */
function ranks(roles: Iterable<Role>, kind: "granary" | "passer", min: number): number[] {
  const count = Math.max(min, highestRank(roles, kind) + 1);
  return Array.from({ length: count }, (_, i) => count - i);
}

/** Passer ranks to offer, highest first: at least {@link MIN_PASSER_RANKS}, and always one above the highest used. */
export const passerRanks = (roles: Iterable<Role>): number[] => ranks(roles, "passer", MIN_PASSER_RANKS);

/** Granary ranks to offer, highest first: at least {@link MIN_GRANARY_RANKS}, and always one above the highest used. */
export const granaryRanks = (roles: Iterable<Role>): number[] => ranks(roles, "granary", MIN_GRANARY_RANKS);

/** The roles a member may be given, from the top of the chain down. */
export const roleOptions = (roles: Iterable<Role>): Role[] => [
  ...granaryRanks(roles).map((rank): Role => ({ kind: "granary", rank })),
  ...passerRanks(roles).map((rank): Role => ({ kind: "passer", rank })),
  { kind: "hunter" },
  { kind: "drain" },
  { kind: "protected" },
  { kind: "out" },
];

/** Where a role sorts, from the granaries down to the members out of the chain (passer ranks stay under 1 000). */
export function roleOrder(role: Role): number {
  switch (role.kind) {
    case "granary":
      return 1000 + role.rank;
    case "passer":
      return role.rank;
    case "hunter":
      return 0;
    case "drain":
      return -1;
    case "protected":
      return -2;
    case "out":
      return -3;
  }
}

/**
 * A role as a string, for a `<select>` value or a stored key: « granary », « granary:2 », « passer:2 »… Grenier 1
 * stays « granary », as before the granaries had ranks: map colours already chosen, and the site's roles read by an
 * older extension.
 */
export function roleKey(role: Role): string {
  if (role.kind === "passer") return `passer:${String(role.rank)}`;
  if (role.kind === "granary" && role.rank > 1) return `granary:${String(role.rank)}`;
  return role.kind;
}

/** {@link roleKey} back to a role (« granary:1 » too); null for anything else. */
export function roleFromKey(key: string): Role | null {
  if (key === "granary") return { kind: "granary", rank: 1 };
  if (key === "hunter" || key === "drain" || key === "protected" || key === "out") return { kind: key };
  const ranked = /^(granary|passer):([1-9]\d{0,2})$/.exec(key);
  if (ranked?.[1] === "granary" || ranked?.[1] === "passer") return { kind: ranked[1], rank: Number(ranked[2]) };
  return null;
}

/** The role as the players write it: « Chasseur », « Passeur 2 », « Grenier 1 », « Hors chaîne ». */
export function roleLabel(role: Role): string {
  switch (role.kind) {
    case "hunter":
      return "Chasseur";
    case "passer":
      return `Passeur ${role.rank}`;
    case "granary":
      return `Grenier ${String(role.rank)}`;
    case "drain":
      return "À flooder";
    case "protected":
      return "Ne pas toucher";
    case "out":
      return "Hors chaîne";
  }
}

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function parseRole(text: string): Role | null {
  const label = plain(text);
  if (label === "chasseur") return { kind: "hunter" };
  if (label === "hors chaine") return { kind: "out" };
  if (label === "a flooder") return { kind: "drain" };
  if (label === "ne pas toucher") return { kind: "protected" };
  // « Passeur » and « Grenier » alone are the first rung, as written before the ranks.
  const ranked = /^(passeur|grenier)\s*(\d*)$/.exec(label);
  if (!ranked) return null;
  const rank = ranked[2] ? Math.max(1, Number(ranked[2])) : 1;
  return { kind: ranked[1] === "grenier" ? "granary" : "passer", rank };
}

interface Named {
  id: number;
  pseudo: string;
}

/** One « Pseudo: role » line per member with a role, sorted by nickname. */
export function exportRoles(roles: ReadonlyMap<number, Role>, members: readonly Named[]): string {
  return members
    .flatMap((member) => {
      const role = roles.get(member.id);
      return role ? [`${member.pseudo}: ${roleLabel(role)}`] : [];
    })
    .sort((a, b) => a.localeCompare(b, "fr"))
    .join("\n");
}

export interface RolesImport {
  roles: Map<number, Role>;
  /** Lines not imported: unreadable, or nickname not in the alliance. */
  ignored: string[];
}

export function importRoles(text: string, members: readonly Named[]): RolesImport {
  // Accents and case are ignored, in the nickname as in the role: « Cèdre » matches « cedre ».
  const idByPseudo = new Map(members.map((member) => [plain(member.pseudo), member.id]));
  const roles = new Map<number, Role>();
  const ignored: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [, pseudo, label] = /^(.+?)\s*:\s*(.+)$/.exec(line) ?? [];
    const id = pseudo === undefined ? undefined : idByPseudo.get(plain(pseudo));
    const role = label === undefined ? null : parseRole(label);
    if (id !== undefined && role) roles.set(id, role);
    else ignored.push(line);
  }
  return { roles, ignored };
}

/**
 * Height of each member in the chain: hunters and members to drain 0, passer N at N, granary N N rungs above the
 * highest passer; out and protected: absent.
 */
export function rungs(roles: ReadonlyMap<number, Role>): Map<number, number> {
  const highestPasser = highestRank(roles.values(), "passer");
  const heights = new Map<number, number>();
  for (const [id, role] of roles) {
    if (role.kind === "hunter" || role.kind === "drain") heights.set(id, 0);
    else if (role.kind === "passer") heights.set(id, role.rank);
    else if (role.kind === "granary") heights.set(id, highestPasser + role.rank);
  }
  return heights;
}

/**
 * A member against the rungs next to its own, from the fields: `up` when it is bigger than a member of the rung
 * above (`than`, the smallest), `down` when it is smaller than one of the rung below (the biggest), else `ok`. Only
 * granaries, passers and hunters; a member to drain gives everything whatever its field.
 */
export type RungPlace = { kind: "ok" } | { kind: "up" | "down"; than: number };

export function rungPlaces(
  roles: ReadonlyMap<number, Role>,
  fields: ReadonlyMap<number, number>,
): Map<number, RungPlace> {
  const ranked = [...roles].filter(
    ([id, role]) => fields.has(id) && (role.kind === "granary" || role.kind === "passer" || role.kind === "hunter"),
  );
  const heights = rungs(new Map(ranked));
  const levels = [...new Set(heights.values())].sort((a, b) => a - b);
  const at = (level: number | undefined) => [...heights].filter(([, height]) => height === level).map(([id]) => id);
  const field = (id: number) => fields.get(id) ?? 0;
  const places = new Map<number, RungPlace>();
  for (const [id, height] of heights) {
    const index = levels.indexOf(height);
    const above = at(levels[index + 1]).sort((a, b) => field(a) - field(b))[0];
    const below = at(levels[index - 1]).sort((a, b) => field(b) - field(a))[0];
    if (above !== undefined && field(id) > field(above)) places.set(id, { kind: "up", than: above });
    else if (below !== undefined && field(id) < field(below)) places.set(id, { kind: "down", than: below });
    else places.set(id, { kind: "ok" });
  }
  return places;
}

/**
 * Where the member's field must go: ↓ for one too big for its rung (to be flooded), ↑ for one too small (to flood).
 */
export const rungPlaceArrow = (kind: "up" | "down"): string => (kind === "up" ? "↓" : "↑");

/**
 * The place in words, for a tooltip. Too big for its rung, the member is to be flooded; too small, it is to flood:
 * the chain brings it back to its rung, its role stays.
 */
export const rungPlaceText = (kind: "up" | "down", than: string): string =>
  kind === "up"
    ? `Plus gros que ${than}, de l'échelon du dessus : à flooder pour revenir à son échelon.`
    : `Plus petit que ${than}, de l'échelon du dessous : doit flooder pour revenir à son échelon.`;
