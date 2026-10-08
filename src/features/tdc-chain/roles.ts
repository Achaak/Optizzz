// Roles in a TDC chain (chasseur → passeurs → grenier). See docs/features/chaine-tdc.md.

export type Role = { kind: "hunter" } | { kind: "passer"; rank: number } | { kind: "granary" } | { kind: "out" };

interface Member {
  id: number;
  field: number;
}

/** Members within this share of the biggest field are proposed as granaries. */
const GRANARY_SHARE = 0.8;

/**
 * Roles deduced from the fields: granaries are the biggest, then each rung holds the members the smallest of the
 * rung above can attack (half its field or more), and the last rung is the hunters.
 */
export function proposeRoles(members: readonly Member[]): Map<number, Role> {
  const sorted = [...members].sort((a, b) => b.field - a.field);
  const biggest = sorted[0]?.field ?? 0;
  const rungs: Member[][] = [];
  let rest = sorted;
  const granaries = rest.filter((member) => member.field >= biggest * GRANARY_SHARE);
  rungs.push(granaries.length < sorted.length || sorted.length < 2 ? granaries : sorted.slice(0, 1));
  rest = rest.slice(rungs[0]?.length ?? 0);
  while (rest.length > 0) {
    const smallestAbove = rungs.at(-1)?.at(-1)?.field ?? 0;
    const rung = rest.filter((member) => member.field * 2 >= smallestAbove);
    // Out of reach of the rung above: still the next rung, the chain will show the gap.
    const next = rung.length > 0 ? rung : rest.slice(0, 1);
    rungs.push(next);
    rest = rest.slice(next.length);
  }

  const roles = new Map<number, Role>();
  const lowest = rungs.length - 1;
  rungs.forEach((rung, i) => {
    const role: Role =
      i === 0 ? { kind: "granary" } : i === lowest ? { kind: "hunter" } : { kind: "passer", rank: lowest - i };
    for (const member of rung) roles.set(member.id, role);
  });
  return roles;
}

/** The role as the players write it: « Chasseur », « Passeur 2 », « Grenier », « Hors chaîne ». */
export function roleLabel(role: Role): string {
  switch (role.kind) {
    case "hunter":
      return "Chasseur";
    case "passer":
      return `Passeur ${role.rank}`;
    case "granary":
      return "Grenier";
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
  if (label === "grenier") return { kind: "granary" };
  if (label === "hors chaine") return { kind: "out" };
  const passer = /^passeur\s*(\d*)$/.exec(label);
  if (passer) return { kind: "passer", rank: passer[1] ? Math.max(1, Number(passer[1])) : 1 };
  return null;
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
  const idByPseudo = new Map(members.map((member) => [member.pseudo.toLowerCase(), member.id]));
  const roles = new Map<number, Role>();
  const ignored: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [, pseudo, label] = /^(.+?)\s*:\s*(.+)$/.exec(line) ?? [];
    const id = pseudo === undefined ? undefined : idByPseudo.get(pseudo.toLowerCase());
    const role = label === undefined ? null : parseRole(label);
    if (id !== undefined && role) roles.set(id, role);
    else ignored.push(line);
  }
  return { roles, ignored };
}

/** Height of each member in the chain: hunters 0, passer N at N, granaries above the highest passer; out: absent. */
export function rungs(roles: ReadonlyMap<number, Role>): Map<number, number> {
  const highestPasser = Math.max(0, ...[...roles.values()].map((role) => (role.kind === "passer" ? role.rank : 0)));
  const heights = new Map<number, number>();
  for (const [id, role] of roles) {
    if (role.kind === "hunter") heights.set(id, 0);
    else if (role.kind === "passer") heights.set(id, role.rank);
    else if (role.kind === "granary") heights.set(id, highestPasser + 1);
  }
  return heights;
}
