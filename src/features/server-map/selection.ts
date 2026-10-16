// Who the server map shows in colour: chips of players and alliances. See docs/features/carte-serveur.md.
import type { Alliance, Player } from "@/data/exports";
import { sameTag } from "@/game/diplomacy";
import { CHART_COLORS } from "@/theme";
import { formatNumber } from "@/utils/number-format";

export type ChipTarget = { kind: "player"; id: number } | { kind: "alliance"; tag: string };
export type Chip = ChipTarget & { color: string };

export const MY_ALLIANCE_COLOR = CHART_COLORS.member;

export interface Suggestion {
  target: ChipTarget;
  label: string;
  /** Alliance and coordinates of a player, name and size of an alliance. */
  detail: string;
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export const sameTarget = (a: ChipTarget, b: ChipTarget) =>
  a.kind === "player" ? b.kind === "player" && a.id === b.id : b.kind === "alliance" && sameTag(a.tag, b.tag);

/** 0: whole match, 1: starts with the query, 2: contains it, null: no match. */
function rank(texts: readonly string[], query: string): number | null {
  let best: number | null = null;
  for (const text of texts.map(normalize)) {
    const at = text.indexOf(query);
    const score = at < 0 ? null : text === query ? 0 : at === 0 ? 1 : 2;
    if (score !== null && (best === null || score < best)) best = score;
  }
  return best;
}

/** Players and alliances matching the search box, best first, without those already chosen nor the banned. */
export function searchSuggestions(
  query: string,
  players: readonly Player[],
  alliances: readonly Alliance[],
  chips: readonly ChipTarget[],
  limit = 10,
): Suggestion[] {
  const wanted = normalize(query);
  if (!wanted) return [];
  const found: (Suggestion & { score: number })[] = [];
  const chosen = (target: ChipTarget) => chips.some((chip) => sameTarget(chip, target));
  for (const alliance of alliances) {
    const score = rank([alliance.tag, alliance.name], wanted);
    const target = { kind: "alliance", tag: alliance.tag } as const;
    if (score === null || chosen(target)) continue;
    const members = `${formatNumber(alliance.playersCount)} membre${alliance.playersCount > 1 ? "s" : ""}`;
    found.push({ target, label: alliance.tag, detail: `${alliance.name} · ${members}`, score });
  }
  for (const player of players) {
    const score = player.isBanned ? null : rank([player.pseudo], wanted);
    const target = { kind: "player", id: player.id } as const;
    if (score === null || chosen(target)) continue;
    const detail = `${player.alliance ?? "sans alliance"} · ${String(player.x)} ; ${String(player.y)}`;
    found.push({ target, label: player.pseudo, detail, score });
  }
  // Alliances before players at the same rank: stable sort keeps them first.
  found.sort((a, b) => a.score - b.score || a.label.length - b.label.length);
  return found.slice(0, limit).map(({ target, label, detail }) => ({ target, label, detail }));
}

/** Adds a target once, with the first colour of `palette` no chip uses yet (cycling when all are used). */
export function addChip(chips: readonly Chip[], target: ChipTarget, palette: readonly string[] = CHART_COLORS.chips) {
  if (chips.some((chip) => sameTarget(chip, target))) return [...chips];
  const used = new Set(chips.map((chip) => chip.color));
  const color = palette.find((candidate) => !used.has(candidate)) ?? palette[chips.length % palette.length] ?? "#000";
  return [...chips, { ...target, color }];
}

/**
 * Chips at opening: what was chosen last, else my alliance. Opened on a target (« Voir sur la carte »): my alliance
 * and that target only.
 */
export function initialChips(stored: readonly Chip[] | null, myTag: string | null, target: ChipTarget | null): Chip[] {
  const mine: Chip[] = myTag ? [{ kind: "alliance", tag: myTag, color: MY_ALLIANCE_COLOR }] : [];
  if (target) return addChip(mine, target);
  return stored ? [...stored] : mine;
}

/** Players drawn in colour, with their chip: a player's own chip wins over their alliance's. Banned players never. */
export function highlightedPlayers(chips: readonly Chip[], players: readonly Player[]): Map<Player, Chip> {
  const byId = new Map<number, Chip>();
  const byTag = new Map<string, Chip>();
  for (const chip of chips) {
    if (chip.kind === "player") byId.set(chip.id, chip);
    else byTag.set(chip.tag.toLowerCase(), chip);
  }
  const highlighted = new Map<Player, Chip>();
  for (const player of players) {
    if (player.isBanned) continue;
    const chip = byId.get(player.id) ?? (player.alliance ? byTag.get(player.alliance.toLowerCase()) : undefined);
    if (chip) highlighted.set(player, chip);
  }
  return highlighted;
}
