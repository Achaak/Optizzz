// What changed for a player or an alliance between two readings of the public exports: the Journal of the
// extension's Suivis (docs/features/suivis.md) and of the site (docs/features/site-public.md).
import { sameTag } from "./diplomacy";
import type { Alliance, Player } from "./exports";

export interface PlayerState {
  pseudo: string;
  alliance: string | null;
  field: number;
  onHoliday: boolean;
  isBanned: boolean;
  x: number;
  y: number;
  /** The colonizer, null when free; absent from a reading stored before it was kept: then unknown. */
  master?: { id: number; pseudo: string } | null;
}

export interface AllianceState {
  tag: string;
  /** Members' pseudos, by id. */
  members: Record<number, string>;
  /** Total field (TDC). */
  field: number;
  /** Tags it declared war on, and those that declared war on it. */
  wars: string[];
  warsOn: string[];
  pacts: { tag: string; name: string }[];
}

export type Change =
  | { kind: "new" }
  | { kind: "gone" }
  | { kind: "pseudo"; from: string }
  | { kind: "alliance"; from: string | null; to: string | null }
  | { kind: "colonized"; by: string }
  | { kind: "freed"; from: string }
  | { kind: "holiday"; on: boolean }
  | { kind: "banned" }
  | { kind: "unbanned" }
  | { kind: "joined"; pseudo: string }
  | { kind: "left"; pseudo: string }
  | { kind: "war"; tag: string; declaredBy: "it" | "them" }
  | { kind: "war-ended"; tag: string }
  | { kind: "pact"; tag: string; name: string }
  | { kind: "pact-ended"; tag: string; name: string };

/** A player as one reading shows it; `byId` holds the reading's players, to name the colonizer. */
export function playerState(player: Player, byId: ReadonlyMap<number, Player>): PlayerState {
  const master = player.masterPlayerId === null ? undefined : byId.get(player.masterPlayerId);
  return {
    pseudo: player.pseudo,
    alliance: player.alliance,
    field: player.field,
    onHoliday: player.onHoliday,
    isBanned: player.isBanned,
    x: player.x,
    y: player.y,
    master: master ? { id: master.id, pseudo: master.pseudo } : null,
  };
}

/**
 * The alliance `tag` as one reading shows it: its members are the players carrying its tag, even when the
 * alliances export is missing (null) or does not list it. Undefined when nobody carries the tag.
 */
export function allianceState(
  tag: string,
  players: readonly Player[],
  alliances: readonly Alliance[] | null,
): AllianceState | undefined {
  const alliance = alliances?.find((candidate) => sameTag(candidate.tag, tag));
  const members = players.filter((player) => player.alliance !== null && sameTag(player.alliance, tag));
  if (!alliance && members.length === 0) return undefined;
  return {
    tag: alliance?.tag ?? tag,
    members: Object.fromEntries(members.map((player) => [player.id, player.pseudo])),
    field: alliance?.totalField ?? members.reduce((total, player) => total + player.field, 0),
    wars: alliance?.diplomacy.wars.filter((war) => !sameTag(war, tag)) ?? [],
    warsOn: (alliances ?? [])
      .filter((other) => !sameTag(other.tag, tag) && other.diplomacy.wars.some((war) => sameTag(war, tag)))
      .map((other) => other.tag),
    pacts: alliance?.diplomacy.pacts.map(({ tag: pactTag, name }) => ({ tag: pactTag, name: name.trim() })) ?? [],
  };
}

const sameAlliance = (a: string | null, b: string | null) => (a === null || b === null ? a === b : sameTag(a, b));
const hasTag = (tags: readonly string[], tag: string) => tags.some((other) => sameTag(other, tag));

/**
 * Every alliance of a reading at once, by lower-case tag: those of the alliances export and those only players
 * carry. The same states as `allianceState`, without scanning the players once per alliance.
 */
export function allianceStates(players: readonly Player[], alliances: readonly Alliance[]): Map<string, AllianceState> {
  const states = new Map<string, AllianceState>();
  const stateOf = (tag: string) => {
    const key = tag.toLowerCase();
    let state = states.get(key);
    if (!state) {
      state = { tag, members: {}, field: 0, wars: [], warsOn: [], pacts: [] };
      states.set(key, state);
    }
    return state;
  };
  const listed = new Set(alliances.map((alliance) => alliance.tag.toLowerCase()));
  for (const alliance of alliances) {
    const state = stateOf(alliance.tag);
    state.tag = alliance.tag;
    state.field = alliance.totalField;
    state.wars = alliance.diplomacy.wars.filter((war) => !sameTag(war, alliance.tag));
    state.pacts = alliance.diplomacy.pacts.map(({ tag, name }) => ({ tag, name: name.trim() }));
  }
  for (const player of players) {
    if (player.alliance === null) continue;
    const state = stateOf(player.alliance);
    state.members[player.id] = player.pseudo;
    if (!listed.has(player.alliance.toLowerCase())) state.field += player.field;
  }
  for (const alliance of alliances)
    for (const war of alliance.diplomacy.wars) {
      const target = states.get(war.toLowerCase());
      if (target && !sameTag(war, alliance.tag) && !hasTag(target.warsOn, alliance.tag))
        target.warsOn.push(alliance.tag);
    }
  return states;
}

/** What changed for a player present in both readings. The field is not a change. */
export function playerChanges(before: PlayerState, after: PlayerState): Change[] {
  const changes: Change[] = [];
  if (before.pseudo !== after.pseudo) changes.push({ kind: "pseudo", from: before.pseudo });
  if (!sameAlliance(before.alliance, after.alliance))
    changes.push({ kind: "alliance", from: before.alliance, to: after.alliance });
  if (before.master !== undefined && after.master !== undefined && before.master?.id !== after.master?.id) {
    if (after.master) changes.push({ kind: "colonized", by: after.master.pseudo });
    else if (before.master) changes.push({ kind: "freed", from: before.master.pseudo });
  }
  if (before.onHoliday !== after.onHoliday) changes.push({ kind: "holiday", on: after.onHoliday });
  if (before.isBanned !== after.isBanned) changes.push({ kind: after.isBanned ? "banned" : "unbanned" });
  return changes;
}

/** What changed for an alliance present in both readings. The field is not a change. */
export function allianceChanges(before: AllianceState, after: AllianceState): Change[] {
  const changes: Change[] = [];
  for (const [id, pseudo] of Object.entries(after.members))
    if (!(id in before.members)) changes.push({ kind: "joined", pseudo });
  for (const [id, pseudo] of Object.entries(before.members))
    if (!(id in after.members)) changes.push({ kind: "left", pseudo });
  const warsBefore = [...before.wars, ...before.warsOn];
  const warsAfter = [...after.wars, ...after.warsOn];
  for (const tag of after.wars) if (!hasTag(warsBefore, tag)) changes.push({ kind: "war", tag, declaredBy: "it" });
  for (const tag of after.warsOn)
    if (!hasTag(warsBefore, tag) && !hasTag(after.wars, tag)) changes.push({ kind: "war", tag, declaredBy: "them" });
  for (const tag of warsBefore)
    if (!hasTag(warsAfter, tag) && !changes.some((c) => c.kind === "war-ended" && sameTag(c.tag, tag)))
      changes.push({ kind: "war-ended", tag });
  for (const pact of after.pacts)
    if (!before.pacts.some((other) => sameTag(other.tag, pact.tag))) changes.push({ kind: "pact", ...pact });
  for (const pact of before.pacts)
    if (!after.pacts.some((other) => sameTag(other.tag, pact.tag))) changes.push({ kind: "pact-ended", ...pact });
  return changes;
}

/** « de Rival », « d'Arrivant »: French elides « de » before a vowel or a mute h. */
const of = (name: string) => (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`);

/** « a quitté ABC pour XYZ », « XYZ lui a déclaré la guerre »: what follows the player's or alliance's name. */
export function describeChange(change: Change): string {
  switch (change.kind) {
    case "new":
      return "arrivée sur le serveur";
    case "gone":
      return "n'existe plus";
    case "pseudo":
      return `ancien pseudo : ${change.from}`;
    case "alliance":
      if (change.from === null) return `a rejoint ${change.to ?? ""}`;
      if (change.to === null) return `a quitté ${change.from}`;
      return `a quitté ${change.from} pour ${change.to}`;
    case "colonized":
      return `colonisé par ${change.by}`;
    case "freed":
      return `libéré ${of(change.from)}`;
    case "holiday":
      return change.on ? "en vacances" : "de retour de vacances";
    case "banned":
      return "compte banni";
    case "unbanned":
      return "compte débanni";
    case "joined":
      return `arrivée ${of(change.pseudo)}`;
    case "left":
      return `départ ${of(change.pseudo)}`;
    case "war":
      return change.declaredBy === "it"
        ? `a déclaré la guerre à ${change.tag}`
        : `${change.tag} lui a déclaré la guerre`;
    case "war-ended":
      return `plus en guerre avec ${change.tag}`;
    case "pact":
      return `nouveau pacte (${change.name}) avec ${change.tag}`;
    case "pact-ended":
      return `pacte (${change.name}) rompu avec ${change.tag}`;
  }
}
