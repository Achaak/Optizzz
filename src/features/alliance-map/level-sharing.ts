// Sharing Attack Speed levels by copy-paste (forum, Discord…).

interface Member {
  id: number;
  pseudo: string;
}

/** One "Pseudo: level" line per member with a known level, sorted by nickname. */
export function exportLevels(levels: ReadonlyMap<number, number>, members: readonly Member[]): string {
  return members
    .filter((member) => levels.has(member.id))
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"))
    .map((member) => `${member.pseudo}: ${levels.get(member.id)}`)
    .join("\n");
}

export interface ImportResult {
  levels: Map<number, number>;
  /** Lines not imported: unreadable format or nickname not in the alliance. */
  ignored: string[];
}

export function importLevels(text: string, members: readonly Member[]): ImportResult {
  const idByPseudo = new Map(members.map((member) => [member.pseudo.toLowerCase(), member.id]));
  const levels = new Map<number, number>();
  const ignored: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [, pseudo, level] = /^(.+?)\s*:\s*(\d+)$/.exec(line) ?? [];
    const id = pseudo === undefined ? undefined : idByPseudo.get(pseudo.toLowerCase());
    if (id !== undefined) levels.set(id, Number(level));
    else ignored.push(line);
  }
  return { levels, ignored };
}
