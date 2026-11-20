// The probable floods of an alliance, by other alliance: see docs/features/analyse-alliances.md.
import { z } from "zod";
import { sameTag } from "../diplomacy";
import type { FloodSureness } from "./floods";

/** A probable flood as stored, with the alliances of the moment. */
export interface AllianceFloodRow {
  victimAlliance: string | null;
  /** The alliance the attackers, or else the candidates, share; null when none. */
  alliance: string | null;
  amount: number;
  sureness: FloodSureness;
}

export interface OpponentFloods {
  /** A tag, or « sans alliance ». */
  opponent: string;
  kind: "alliance" | "none";
  taken: number;
  lost: number;
  count: number;
}

export interface AllianceFloods {
  /** The costliest first: the lowest balance (taken − lost). */
  rows: OpponentFloods[];
  /** Floods whose other side is not known. */
  unknown: { taken: number; lost: number; count: number };
  /** Between two members: the TDC chain, not a war. */
  inside: { amount: number; count: number };
}

const NO_ALLIANCE = "sans alliance";

export function floodsByAlliance(floods: readonly AllianceFloodRow[], tag: string): AllianceFloods {
  const isTag = (other: string | null) => other !== null && sameTag(other, tag);
  const rows = new Map<string, OpponentFloods>();
  const unknown = { taken: 0, lost: 0, count: 0 };
  const inside = { amount: 0, count: 0 };
  const add = (opponent: string, kind: OpponentFloods["kind"], taken: number, lost: number) => {
    const key = opponent.toLowerCase();
    const row = rows.get(key) ?? { opponent, kind, taken: 0, lost: 0, count: 0 };
    row.taken += taken;
    row.lost += lost;
    row.count++;
    rows.set(key, row);
  };
  for (const flood of floods) {
    const lost = isTag(flood.victimAlliance);
    const took = isTag(flood.alliance);
    if (lost && took) {
      inside.amount += flood.amount;
      inside.count++;
    } else if (lost) {
      const matched = flood.sureness === "sure" || flood.sureness === "combination";
      if (flood.alliance !== null) add(flood.alliance, "alliance", 0, flood.amount);
      else if (matched) add(NO_ALLIANCE, "none", 0, flood.amount);
      else {
        unknown.lost += flood.amount;
        unknown.count++;
      }
    } else if (took) {
      if (flood.victimAlliance !== null) add(flood.victimAlliance, "alliance", flood.amount, 0);
      else add(NO_ALLIANCE, "none", flood.amount, 0);
    }
  }
  return {
    rows: [...rows.values()].sort((a, b) => a.taken - a.lost - (b.taken - b.lost)),
    unknown,
    inside,
  };
}

/** The site's route answer, checked by the extension. */
export const allianceFloodsSchema = z.object({
  rows: z.array(
    z.object({
      opponent: z.string(),
      kind: z.enum(["alliance", "none"]),
      taken: z.number(),
      lost: z.number(),
      count: z.number().int(),
    }),
  ),
  unknown: z.object({ taken: z.number(), lost: z.number(), count: z.number().int() }),
  inside: z.object({ amount: z.number(), count: z.number().int() }),
});
