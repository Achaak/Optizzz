import { useEffect, useMemo, useState } from "react";
import type { PlayersExport } from "@/data/exports";
import { loadStoredIncome } from "@/data/income";
import { loadLevelsOf } from "@/data/levels";
import { loadSharedStates, valueOf as sharedValueOf, type SharedStates } from "@/data/shared-states";
import type { Scores } from "@/features/history/api";
import { colonyTaxRate } from "@/game/production";
import { formatDecimal, formatNumber } from "@/utils/number-format";
import { allianceProduction, type Balance, type MemberProduction } from "./production";

interface Props {
  origin: string;
  myTag: string;
  loggedInPseudo: string | null;
  /** My workers, read live in the page header: no need for me to share them. */
  myWorkers: number | null;
  /** Read on the members table, by nickname. */
  members: ReadonlyMap<string, Partial<Scores>>;
  playersExport: PlayersExport | null;
}

/** The exact tax rates Optizzz can know: what I pay (Ressources.php), what my colonies pay me (my aphid stable). */
interface MyRates {
  paid: number | null;
  received: number | null;
}

type SortKey = "pseudo" | "field" | "workers" | "ceiling" | "real" | "paid" | "received";

const sortValue = (row: MemberProduction, key: SortKey): number | string => {
  switch (key) {
    case "pseudo":
      return row.pseudo.toLowerCase();
    case "paid":
      return (row.paid?.real ?? row.paid?.ceiling ?? 0) + (row.paidInside?.amount ?? 0);
    case "received":
      return (row.received?.amount ?? 0) + (row.receivedInside?.amount ?? 0);
    default:
      return row[key] ?? -Infinity;
  }
};

/** « 1 234 », « ≥ 1 234 » when only the 20 % floor of the tax is known. */
const amount = (value: number, exact: boolean) => `${exact ? "" : "≥ "}${formatNumber(value)}`;

function BalanceLine({ label, balance, exact }: { label: string; balance: Balance; exact: boolean }) {
  return (
    <p>
      {label} :{" "}
      <b>
        {exact ? "" : "≈ "}
        {formatNumber(balance.net)}
      </b>{" "}
      par jour
      {(balance.paid > 0 || balance.received > 0) && (
        <span className="note">
          {" "}
          ({formatNumber(balance.gross)} récoltés
          {balance.paid > 0 && <>, −{amount(balance.paid, exact)} de taxes payées hors de l'alliance</>}
          {balance.received > 0 && <>, +{amount(balance.received, exact)} touchées hors de l'alliance</>})
        </span>
      )}
    </p>
  );
}

/** « Production » of my alliance, now: ceiling, real harvest of the members whose workers are known, taxes. */
export function ProductionSection({ origin, myTag, loggedInPseudo, myWorkers, members, playersExport }: Props) {
  const [states, setStates] = useState<SharedStates | null>(null);
  const [rates, setRates] = useState<MyRates>({ paid: null, received: null });
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "ceiling", descending: true });

  useEffect(() => {
    loadSharedStates(origin, myTag).then(setStates, (e: unknown) => {
      console.warn("[Optizzz] alliance stats: shared states unavailable", e);
    });
  }, [origin, myTag]);

  const me = playersExport?.players.find((player) => player.pseudo === loggedInPseudo) ?? null;
  const colonized = me?.masterPlayerId != null;
  const isMaster = me !== null && (playersExport?.players.some((player) => player.masterPlayerId === me.id) ?? false);
  useEffect(() => {
    void (async () => {
      const paid = colonized ? ((await loadStoredIncome(origin))?.taxRate ?? null) : null;
      const aphids = isMaster ? await loadLevelsOf(origin, ["aphids"]).catch(() => null) : null;
      // A rate of 0 is the page of a free colony read before: not the rate paid now.
      setRates({
        paid: paid !== null && paid > 0 ? paid : null,
        received: aphids ? colonyTaxRate(aphids.aphids) : null,
      });
    })();
  }, [origin, colonized, isMaster]);

  const production = useMemo(() => {
    if (!playersExport) return null;
    const byPseudo = new Map(playersExport.players.map((player) => [player.pseudo, player]));
    const inputs = [...members].flatMap(([pseudo, scores]) => {
      if (scores.field === undefined) return [];
      const player = byPseudo.get(pseudo);
      const workers =
        pseudo === loggedInPseudo && myWorkers !== null
          ? { value: myWorkers }
          : states && sharedValueOf(states, pseudo, "workers");
      return [
        {
          // A member not exported yet has no id: nothing to match with masters or colonies.
          id: player?.id ?? -1,
          pseudo,
          field: scores.field,
          workers: workers?.value ?? null,
          masterId: player?.masterPlayerId ?? null,
        },
      ];
    });
    return allianceProduction({
      members: inputs,
      players: playersExport.players,
      paidRates: new Map(me && rates.paid !== null ? [[me.id, rates.paid]] : []),
      receivedRates: new Map(me && rates.received !== null ? [[me.id, rates.received]] : []),
    });
  }, [playersExport, members, states, me, rates, loggedInPseudo, myWorkers]);

  const rows = useMemo(() => {
    const direction = sort.descending ? -1 : 1;
    return [...(production?.members ?? [])].sort((a, b) => {
      const [x, y] = [sortValue(a, sort.key), sortValue(b, sort.key)];
      return x < y ? -direction : x > y ? direction : 0;
    });
  }, [production, sort]);

  if (members.size === 0) return null;
  if (!production) return <p className="meta">Calcul de la production…</p>;

  const sortBy = (key: SortKey) =>
    setSort((current) => ({ key, descending: current.key === key ? !current.descending : key !== "pseudo" }));
  const sortHeader = (key: SortKey, label: string, numeric = true) => (
    <th
      className={numeric ? "num" : undefined}
      aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : undefined}
    >
      <button type="button" className="sort" onClick={() => sortBy(key)}>
        {label}
        {sort.key === key ? (sort.descending ? " ▼" : " ▲") : ""}
      </button>
    </th>
  );

  const { ceiling, real, exact } = production;
  const taxes = rows.some((row) => row.paid ?? row.received ?? row.paidInside ?? row.receivedInside);
  return (
    <>
      <h3>
        Production
        <span
          className="help"
          tabIndex={0}
          title={
            "Une ouvrière au travail par cm² de TDC, 48 ressources par jour chacune, nourriture et matériaux ensemble, " +
            "sans la champignonnière. Taxe de colonie d'au moins 20 % quand le niveau d'Étable à pucerons du maître " +
            "est inconnu ; une taxe entre deux membres reste dans l'alliance et ne compte pas dans son total. " +
            "Colonies d'après le dernier export."
          }
        >
          ?
        </span>
      </h3>
      <div className="production">
        <BalanceLine label="Plafond (tout le TDC au travail)" balance={ceiling} exact={exact} />
        {real.known > 0 ? (
          <p>
            Réel des membres aux ouvrières connues ({real.known} / {real.total}) :{" "}
            <b>
              {exact ? "" : "≈ "}
              {formatNumber(real.net)}
            </b>{" "}
            par jour, pour un plafond de {formatNumber(real.ceiling)} chez eux
            {real.ceiling > 0 && <> ({formatDecimal((real.gross / real.ceiling) * 100)} %)</>}
          </p>
        ) : (
          <p className="note">
            Réel inconnu : aucun membre n'a partagé ses ouvrières (Partage d'alliance, ou saisie à la main).
          </p>
        )}
        {real.known > 0 && real.known < real.total && (
          <p className="note">Les autres membres : ouvrières à partager dans « Partage », ou à saisir à la main.</p>
        )}
      </div>
      <details className="detail">
        <summary>Détail par membre</summary>
        <div className="scroll">
          <table className="progress">
            <thead>
              <tr>
                {sortHeader("pseudo", "Membre", false)}
                {sortHeader("field", "TDC")}
                {sortHeader("workers", "Ouvrières")}
                {sortHeader("ceiling", "Plafond")}
                {sortHeader("real", "Réel")}
                {taxes && sortHeader("paid", "Taxe payée")}
                {taxes && sortHeader("received", "Taxes touchées")}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.pseudo} className={row.pseudo === loggedInPseudo ? "me" : ""}>
                  <td>
                    <a href={`Membre.php?Pseudo=${encodeURIComponent(row.pseudo)}`}>{row.pseudo}</a>
                  </td>
                  <td className="num">{formatNumber(row.field)}</td>
                  <td className="num">{row.workers === null ? "—" : formatNumber(row.workers)}</td>
                  <td className="num">{formatNumber(row.ceiling)}</td>
                  <td className={`num ${row.real !== null && row.real < row.ceiling ? "down" : ""}`}>
                    {row.real === null ? "—" : formatNumber(row.real)}
                  </td>
                  {taxes && (
                    <td className="num">
                      {row.paid && (
                        <div title={`Colonisé par ${row.paid.master}, hors de l'alliance`}>
                          {amount(row.paid.real ?? row.paid.ceiling, row.paid.exact)}
                        </div>
                      )}
                      {row.paidInside && (
                        <div className="inside" title={`Colonisé par ${row.paidInside.master} : reste dans l'alliance`}>
                          {amount(row.paidInside.amount, row.paidInside.exact)} dans l'alliance
                        </div>
                      )}
                    </td>
                  )}
                  {taxes && (
                    <td className="num">
                      {row.received && (
                        <div title={`${String(row.received.colonies)} colonie(s) hors de l'alliance`}>
                          {amount(row.received.amount, row.received.exact)}
                        </div>
                      )}
                      {row.receivedInside && (
                        <div
                          className="inside"
                          title={`${String(row.receivedInside.colonies)} colonie(s) dans l'alliance : reste dans l'alliance`}
                        >
                          {amount(row.receivedInside.amount, row.receivedInside.exact)} dans l'alliance
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
