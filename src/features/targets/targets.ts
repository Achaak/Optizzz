// Players one can attack, read from ennemie.php and the public exports. See docs/features/cibles.md.
import { inRange } from "@/game/flood";
import { distance, travelTime } from "@/game/travel";
import type { Alliance, Player } from "../alliance-map/api";

/** State of an anthill, as the « Etat » column of ennemie.php writes it. */
export type AnthillState = "free" | "colonized" | "holiday" | "banned" | "protected";

/** A row of the game's own table: its hunting field is live, the export's dates from the last hour. */
export interface EnemyRow {
  pseudo: string;
  /** Hunting field (« TDC »), cm². */
  field: number;
  state: AnthillState | null;
  /** Who colonized it. */
  master: string | null;
}

function readState(text: string): Pick<EnemyRow, "state" | "master"> {
  const colonized = /^Soumis à (.+)$/.exec(text);
  if (colonized) return { state: "colonized", master: colonized[1] ?? null };
  const states: Record<string, AnthillState> = {
    "Fourmilière Libre": "free",
    "En vacances": "holiday",
    Bannie: "banned",
    Nouveau: "protected",
  };
  return { state: states[text] ?? null, master: null };
}

/** Rows of `#tabEnnemie` (see docs/research/fourmizzz-pages.md, « ennemie.php »). */
export function readEnemyTable(doc: Document): EnemyRow[] {
  const rows = [...doc.querySelectorAll<HTMLTableRowElement>("#tabEnnemie tr")].filter(
    (row) => row.querySelectorAll(":scope > td").length >= 7,
  );
  return rows.flatMap((row) => {
    const pseudo = row.cells[1]?.textContent.trim();
    if (!pseudo) return [];
    return [
      {
        pseudo,
        field: Number((row.cells[3]?.textContent ?? "").replace(/\D/g, "")),
        ...readState(row.cells[6]?.textContent.trim() ?? ""),
      },
    ];
  });
}

/** On the hunting field, a win takes 20 % of the defender's field, 1 cm² per ant at most (tutorial « Attaque »). */
export const takeMax = (defenderField: number) => Math.floor(defenderField * 0.2);

export type Diplomacy = { kind: "pact"; name: string; description: string } | { kind: "war" };

export interface Target {
  id: number;
  pseudo: string;
  alliance: string | null;
  /** Live when the game's table shows the player, else from the export. */
  field: number;
  /** Its field over mine. */
  ratio: number;
  takeMax: number;
  /** In squares. */
  distance: number;
  travelSeconds: number;
  /** If the attack leaves now. */
  arrival: Date;
  state: AnthillState | null;
  master: string | null;
  diplomacy: Diplomacy | null;
  attackableNow: boolean;
  /** Whether it may attack me back. */
  canAttackMe: boolean;
}

export interface TargetsInput {
  /** My live field (`#quantite_tdc`). */
  me: { pseudo: string; field: number };
  attackSpeed: number;
  players: Player[];
  alliances: Alliance[];
  /** Rows of the game's table, live. */
  live: EnemyRow[];
}

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function diplomacyWith(mine: Alliance | undefined, theirs: Alliance | undefined): Diplomacy | null {
  if (!mine || !theirs || sameTag(mine.tag, theirs.tag)) return null;
  const pact = mine.diplomacy.pacts.find((p) => sameTag(p.tag, theirs.tag));
  if (pact) return { kind: "pact", name: pact.name.trim(), description: pact.description.trim() };
  const declares = (from: Alliance, to: Alliance) => from.diplomacy.wars.some((tag) => sameTag(tag, to.tag));
  return declares(mine, theirs) || declares(theirs, mine) ? { kind: "war" } : null;
}

function exportState(player: Player, byId: Map<number, Player>): Pick<EnemyRow, "state" | "master"> {
  if (player.isBanned) return { state: "banned", master: null };
  if (player.onHoliday) return { state: "holiday", master: null };
  if (player.masterPlayerId !== null) {
    return { state: "colonized", master: byId.get(player.masterPlayerId)?.pseudo ?? null };
  }
  return { state: "free", master: null };
}

/** Players I may attack, nearest first; me, my alliance and the banned left out. */
export function listTargets(input: TargetsInput, now: Date): Target[] {
  const byId = new Map(input.players.map((player) => [player.id, player]));
  const alliances = new Map(input.alliances.map((alliance) => [alliance.tag.toLowerCase(), alliance]));
  const live = new Map(input.live.map((row) => [row.pseudo.toLowerCase(), row]));
  const allianceOf = (tag: string | null) => (tag ? alliances.get(tag.toLowerCase()) : undefined);

  const myPlayer = input.players.find((player) => sameTag(player.pseudo, input.me.pseudo));
  if (!myPlayer) return [];
  const myAlliance = allianceOf(myPlayer.alliance);
  const myField = input.me.field;

  return input.players
    .flatMap((player): Target[] => {
      if (player.id === myPlayer.id) return [];
      if (myPlayer.alliance && player.alliance && sameTag(player.alliance, myPlayer.alliance)) return [];
      const row = live.get(player.pseudo.toLowerCase());
      const field = row?.field ?? player.field;
      const { state, master } = row ?? exportState(player, byId);
      if (state === "banned" || !inRange(myField, field)) return [];

      const diplomacy = diplomacyWith(myAlliance, allianceOf(player.alliance));
      const squares = distance(myPlayer, player);
      const travelSeconds = travelTime(squares, input.attackSpeed);
      return [
        {
          id: player.id,
          pseudo: player.pseudo,
          alliance: player.alliance,
          field,
          ratio: field / myField,
          takeMax: takeMax(field),
          distance: squares,
          travelSeconds,
          arrival: new Date(now.getTime() + travelSeconds * 1000),
          state,
          master,
          diplomacy,
          attackableNow: (state === "free" || state === "colonized") && diplomacy?.kind !== "pact",
          canAttackMe: inRange(field, myField),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance);
}
