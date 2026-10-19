// Who the server map shows in colour: chips of players and alliances. See docs/features/carte-serveur.md.
import type { Alliance, Player } from "@/data/exports";
import { sameTag } from "@/game/diplomacy";
import { CHART_COLORS } from "@/theme";
import { formatAmount } from "@/utils/number-format";
import { passesFilter, type ChipFilter } from "./filter";

/** `unaffiliated`: every player without an alliance. */
export type ChipTarget = { kind: "player"; id: number } | { kind: "alliance"; tag: string } | { kind: "unaffiliated" };
/** `filter`: only the players within it are drawn in colour (alliances and « Sans alliance »). */
export type Chip = ChipTarget & { color: string; filter?: ChipFilter };

export const MY_ALLIANCE_COLOR = CHART_COLORS.member;

export interface Suggestion {
  target: ChipTarget;
  label: string;
  /** Alliance and coordinates of a player, name and size of an alliance. */
  detail: string;
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export const UNAFFILIATED_LABEL = "Sans alliance";

export function sameTarget(a: ChipTarget, b: ChipTarget): boolean {
  if (a.kind === "player") return b.kind === "player" && a.id === b.id;
  if (a.kind === "alliance") return b.kind === "alliance" && sameTag(a.tag, b.tag);
  return b.kind === "unaffiliated";
}

/** Players without an alliance, the banned left out. */
export const countUnaffiliated = (players: readonly Player[]) =>
  players.filter((player) => !player.alliance && !player.isBanned).length;

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
  const unaffiliated = { kind: "unaffiliated" } as const;
  const unaffiliatedScore = rank([UNAFFILIATED_LABEL], wanted);
  if (unaffiliatedScore !== null && !chosen(unaffiliated)) {
    const count = countUnaffiliated(players);
    const detail = `${formatAmount(count)} joueur${count > 1 ? "s" : ""}`;
    found.push({ target: unaffiliated, label: UNAFFILIATED_LABEL, detail, score: unaffiliatedScore });
  }
  for (const alliance of alliances) {
    const score = rank([alliance.tag, alliance.name], wanted);
    const target = { kind: "alliance", tag: alliance.tag } as const;
    if (score === null || chosen(target)) continue;
    const members = `${formatAmount(alliance.playersCount)} membre${alliance.playersCount > 1 ? "s" : ""}`;
    found.push({ target, label: alliance.tag, detail: `${alliance.name} · ${members}`, score });
  }
  for (const player of players) {
    const score = player.isBanned ? null : rank([player.pseudo], wanted);
    const target = { kind: "player", id: player.id } as const;
    if (score === null || chosen(target)) continue;
    const detail = `${player.alliance ?? "sans alliance"} · ${String(player.x)} ; ${String(player.y)}`;
    found.push({ target, label: player.pseudo, detail, score });
  }
  // « Sans alliance », then alliances before players at the same rank: stable sort keeps them first.
  found.sort((a, b) => a.score - b.score || a.label.length - b.label.length);
  return found.slice(0, limit).map(({ target, label, detail }) => ({ target, label, detail }));
}

/** The players an alliance or « Sans alliance » chip stands for, before its filter; the banned left out. */
export function playersOf(target: ChipTarget, players: readonly Player[]): Player[] {
  return players.filter((player) => {
    if (player.isBanned) return false;
    if (target.kind === "player") return player.id === target.id;
    if (target.kind === "alliance") return player.alliance !== null && sameTag(player.alliance, target.tag);
    return !player.alliance;
  });
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

/**
 * Players drawn in colour, with their chip: a player's own chip wins over their alliance's (or « Sans alliance »).
 * Those its filter rules out and the banned stay in grey.
 */
export function highlightedPlayers(chips: readonly Chip[], players: readonly Player[]): Map<Player, Chip> {
  const byId = new Map<number, Chip>();
  const byTag = new Map<string, Chip>();
  let unaffiliated: Chip | undefined;
  for (const chip of chips) {
    if (chip.kind === "player") byId.set(chip.id, chip);
    else if (chip.kind === "alliance") byTag.set(chip.tag.toLowerCase(), chip);
    else unaffiliated = chip;
  }
  const highlighted = new Map<Player, Chip>();
  for (const player of players) {
    if (player.isBanned) continue;
    const chip = byId.get(player.id) ?? (player.alliance ? byTag.get(player.alliance.toLowerCase()) : unaffiliated);
    if (chip && passesFilter(player, chip.filter)) highlighted.set(player, chip);
  }
  return highlighted;
}
