// The alliance's harvest a day — see docs/features/statistiques-alliance.md, « Production ».
import type { Player } from "@/data/exports";
import { HARVESTS_PER_DAY } from "@/game/forecast";
import { BASE_COLONY_TAX } from "@/game/production";

export interface MemberInput {
  id: number;
  pseudo: string;
  /** Live TDC, cm². */
  field: number;
  /** From the shared states; null when unknown. */
  workers: number | null;
  /** From the last export. */
  masterId: number | null;
}

export interface ProductionInput {
  members: readonly MemberInput[];
  /** The last export's players: masters and colonies outside the alliance. */
  players: readonly Pick<Player, "id" | "pseudo" | "alliance" | "field" | "masterPlayerId">[];
  /** Exact rate a member pays their master, by member id (mine, from Ressources.php). */
  paidRates: ReadonlyMap<number, number>;
  /** Exact rate a member's colonies pay them, by member id (mine, from my Étable à pucerons). */
  receivedRates: ReadonlyMap<number, number>;
}

export interface MemberProduction {
  pseudo: string;
  field: number;
  workers: number | null;
  /** TDC × 48: every cm² worked. */
  ceiling: number;
  /** min(TDC, workers) × 48; null when the workers are unknown. */
  real: number | null;
  /** Tax paid to a master outside the alliance. */
  paid: { ceiling: number; real: number | null; exact: boolean; master: string } | null;
  /** Tax taken from colonies outside the alliance, on their ceiling. */
  received: TaxIncome | null;
  /** Tax paid to another member, on the real harvest when known: it stays in the alliance. */
  paidInside: { amount: number; exact: boolean; master: string } | null;
  /** Tax taken from colonies in the alliance: it stays in the alliance. */
  receivedInside: TaxIncome | null;
}

export interface TaxIncome {
  amount: number;
  exact: boolean;
  colonies: number;
}

export interface Balance {
  gross: number;
  paid: number;
  received: number;
  net: number;
}

export interface AllianceProduction {
  members: MemberProduction[];
  ceiling: Balance;
  /** Over the members whose workers are known. */
  real: Balance & {
    known: number;
    total: number;
    /** The ceiling of the known members alone, to compare with their real harvest. */
    ceiling: number;
  };
  /** False when a tax rate is only the 20 % floor. */
  exact: boolean;
}

/** Rounded down, as Ressources.php does. */
const taxOn = (harvest: number, rate: number) => Math.floor(harvest * rate);

const balance = (rows: readonly { gross: number; paid: number; received: number }[]): Balance => {
  const sum = (key: "gross" | "paid" | "received") => rows.reduce((total, row) => total + row[key], 0);
  const [gross, paid, received] = [sum("gross"), sum("paid"), sum("received")];
  return { gross, paid, received, net: gross - paid + received };
};

/**
 * What the alliance harvests a day: its ceiling and the real harvest of the members whose workers are known, with
 * the taxes paid to or taken from players outside the alliance. A tax between two members stays in the alliance.
 */
export function allianceProduction({
  members,
  players,
  paidRates,
  receivedRates,
}: ProductionInput): AllianceProduction {
  const memberIds = new Set(members.map((member) => member.id));
  const byId = new Map(players.map((player) => [player.id, player]));

  // What a colony pays: the colony's own rate (Ressources.php) or its master's aphid stable, else the 20 % floor.
  const rateFor = (colonyId: number, masterId: number) => {
    const exactRate = paidRates.get(colonyId) ?? receivedRates.get(masterId);
    return { rate: exactRate ?? BASE_COLONY_TAX, exact: exactRate !== undefined };
  };

  const base = members.map((member) => {
    const ceiling = member.field * HARVESTS_PER_DAY;
    const real = member.workers === null ? null : Math.min(member.field, member.workers) * HARVESTS_PER_DAY;
    const master = member.masterId === null ? null : (byId.get(member.masterId)?.pseudo ?? "?");

    let paid: MemberProduction["paid"] = null;
    let paidInside: MemberProduction["paidInside"] = null;
    if (member.masterId !== null && master !== null) {
      const { rate, exact } = rateFor(member.id, member.masterId);
      if (memberIds.has(member.masterId)) {
        paidInside = { amount: taxOn(real ?? ceiling, rate), exact, master };
      } else {
        paid = { ceiling: taxOn(ceiling, rate), real: real === null ? null : taxOn(real, rate), exact, master };
      }
    }
    return { member, ceiling, real, paid, paidInside };
  });

  const rows = base.map(({ member, ceiling, real, paid, paidInside }): MemberProduction => {
    const fromMembers = base.filter((other) => other.member.masterId === member.id && other.paidInside !== null);
    const receivedInside: TaxIncome | null =
      fromMembers.length === 0
        ? null
        : {
            amount: fromMembers.reduce((total, other) => total + (other.paidInside?.amount ?? 0), 0),
            exact: fromMembers.every((other) => other.paidInside?.exact),
            colonies: fromMembers.length,
          };

    const colonies = players.filter((player) => player.masterPlayerId === member.id && !memberIds.has(player.id));
    let received: MemberProduction["received"] = null;
    if (colonies.length > 0) {
      const rates = colonies.map((colony) => rateFor(colony.id, member.id));
      received = {
        amount: colonies.reduce(
          (total, colony, i) => total + taxOn(colony.field * HARVESTS_PER_DAY, rates[i]?.rate ?? BASE_COLONY_TAX),
          0,
        ),
        exact: rates.every((rate) => rate.exact),
        colonies: colonies.length,
      };
    }
    return {
      pseudo: member.pseudo,
      field: member.field,
      workers: member.workers,
      ceiling,
      real,
      paid,
      received,
      paidInside,
      receivedInside,
    };
  });

  const known = rows.filter((row) => row.real !== null);
  return {
    members: rows,
    ceiling: balance(
      rows.map((row) => ({ gross: row.ceiling, paid: row.paid?.ceiling ?? 0, received: row.received?.amount ?? 0 })),
    ),
    real: {
      ...balance(
        known.map((row) => ({
          gross: row.real ?? 0,
          paid: row.paid?.real ?? 0,
          received: row.received?.amount ?? 0,
        })),
      ),
      known: known.length,
      total: rows.length,
      ceiling: known.reduce((total, row) => total + row.ceiling, 0),
    },
    exact: rows.every((row) => (row.paid?.exact ?? true) && (row.received?.exact ?? true)),
  };
}
