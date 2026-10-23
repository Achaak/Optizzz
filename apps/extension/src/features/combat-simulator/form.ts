// What fills the simulator's form in the extension: the player's remembered army and levels, an army seen in a report.
// The form itself and the engine's input are shared with the site (@optizzz/game/army/battle-form).
import { z } from "zod";
import { PLACES, type Place } from "@optizzz/game/army/battle";
import { armyToCounts, type Counts } from "@optizzz/game/army/army-text";
import { emptyForm, type SimulatorForm } from "@optizzz/game/army/battle-form";
import { armyFromKeys } from "@optizzz/game/army/units";
import { combatLinkFormat } from "@optizzz/game/site-links/combat";
import type { StoredLevels } from "@/data/levels";
import type { Garrison } from "@/data/garrison";
import type { SimulatorSide } from "./open";

/** The player's remembered army and levels on their side; the other side is left as it is. */
export function prefill(
  form: SimulatorForm,
  side: SimulatorSide,
  garrison: Garrison | null,
  levels: Pick<StoredLevels, "weapons" | "shield" | "aphids">,
): SimulatorForm {
  const weapons = levels.weapons ?? 0;
  const shield = levels.shield ?? 0;
  if (side === "attack") {
    const whole = garrison
      ? PLACES.reduce<number[]>(
          (sum, place) => sum.map((count, i) => count + (garrison.armies[place][i] ?? 0)),
          armyFromKeys({}),
        )
      : null;
    return {
      ...form,
      attacker: {
        army: whole ? armyToCounts(whole) : form.attacker.army,
        weapons,
        shield,
        field: garrison?.field ?? form.attacker.field,
        aphids: levels.aphids ?? 0,
      },
    };
  }
  return {
    ...form,
    defender: {
      ...form.defender,
      armies: garrison
        ? {
            field: armyToCounts(garrison.armies.field),
            nest: armyToCounts(garrison.armies.nest),
            lodge: armyToCounts(garrison.armies.lodge),
          }
        : form.defender.armies,
      weapons,
      shield,
      dome: garrison?.dome ?? form.defender.dome,
      lodge: garrison?.lodge ?? form.defender.lodge,
      field: garrison?.field ?? form.defender.field,
      food: garrison?.food ?? form.defender.food,
      materials: garrison?.materials ?? form.defender.materials,
    },
  };
}

/**
 * The form when the player changes side: their old side is emptied only if it still holds what was filled in for
 * them; an army pasted or typed there (the opponent's) stays.
 */
export function leaveSide(form: SimulatorForm, side: SimulatorSide, filled: SimulatorForm | null): SimulatorForm {
  const empty = emptyForm();
  const untouched = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (side === "attack") {
    return filled && untouched(form.attacker, filled.attacker) ? { ...form, attacker: empty.attacker } : form;
  }
  return filled && untouched(form.defender, filled.defender) ? { ...form, defender: empty.defender } : form;
}

/** The army an attack report showed at the place attacked (packages/game/src/pages/combat-reports.ts), to fight it again. */
export interface Opponent {
  place: Place;
  army: Counts;
  /** Deduced from the report's bonus; null when it could not tell. */
  weapons: number | null;
  /** « attaque du 19/10/26 10h36 contre Cible_1 », said above the form. */
  seen?: string;
}

const opponentSchema = z.object({
  place: z.enum(PLACES),
  army: z.record(z.string(), z.number().int().nonnegative()),
  weapons: z.number().int().nonnegative().nullable(),
  seen: z.string().optional(),
});

export const encodeOpponent = (opponent: Opponent): string => JSON.stringify(opponent);

/** The opponent the page's address carries; null when there is none or it cannot be read. */
export function decodeOpponent(text: string | null): Opponent | null {
  if (!text) return null;
  try {
    const parsed = opponentSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The opponent on the defending side, alone at the place attacked, which becomes the target. */
export function withOpponent(form: SimulatorForm, opponent: Opponent): SimulatorForm {
  return {
    ...form,
    defender: {
      ...form.defender,
      armies: { ...emptyForm().defender.armies, [opponent.place]: opponent.army },
      weapons: opponent.weapons ?? form.defender.weapons,
    },
    target: opponent.place,
  };
}

/**
 * The state of optizzz.fr's combat tool for « Ouvrir sur optizzz.fr » and « Copier le lien »: both sides as typed,
 * « Mes niveaux » on the player's side. The site runs the same engine on it (docs/features/site-combat.md).
 */
export const siteState = (form: SimulatorForm, side: SimulatorSide): string =>
  combatLinkFormat.encode({ form, mine: side });
