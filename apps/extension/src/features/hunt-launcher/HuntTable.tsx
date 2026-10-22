import type { Plan } from "./engine/planner";
import { unitLabel, UNITS } from "@optizzz/game/army/units";
import type { LaunchStatus } from "./launch";
import type { ColumnKey } from "./settings";
import { formatAmount, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { Amount } from "@/utils/Amount";
import { NumberField } from "@/utils/NumberField";
import { formatEndTimeShort } from "@optizzz/game/format/time-format";

interface Props {
  plan: Plan;
  /** Unit keys the player has. */
  unitKeys: string[];
  columns: Record<ColumnKey, boolean>;
  /** The column choices are shown (advanced view). */
  options: boolean;
  onColumn: (column: ColumnKey, shown: boolean) => void;
  statuses: LaunchStatus[];
  busy: boolean;
  /** Some hunts left: the plan can no longer be changed. */
  frozen: boolean;
  /** A change is being simulated: launching now would send the previous plan. */
  launchBlocked: boolean;
  now: Date;
  onEdit: (hunt: number, change: { amount?: number; unit?: string; count?: number }) => void;
  onLaunch: (hunt: number) => void;
}

/** « Paramétrage affichage » of Calystene's simulator: what the table shows besides number, units and status. */
const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "emptyUnits", label: "Unités sans effectif" },
  { key: "difficulty", label: "Difficulté" },
  { key: "ratio", label: "Ratio réel" },
  { key: "meanLosses", label: "Pertes moyennes" },
  { key: "maxLosses", label: "Pertes au pire tirage" },
  { key: "returns", label: "Heure de retour" },
  { key: "edit", label: "Modifier les chasses" },
];

const STATUS_TEXT: Record<LaunchStatus, string> = {
  pending: "",
  launching: "Lancement…",
  launched: "✓ Lancée",
  failed: "✗ Refusée",
};

const round1 = (value: number) => (value < 10 ? formatDecimal(value) : formatAmount(value));

/** One row per hunt with its launch button, then the totals; surface and units can be changed, the hunt is simulated again. */
export function HuntTable(props: Props) {
  const { plan, unitKeys, columns, statuses, busy, frozen, launchBlocked, now, onEdit, onLaunch } = props;
  const sent = UNITS.map((_, i) => plan.hunts.reduce((sum, hunt) => sum + (hunt.army[i] ?? 0), 0));
  const units = UNITS.filter(
    (unit, i) => unitKeys.includes(unit.key) && (columns.emptyUnits || (sent[i] ?? 0) > 0 || columns.edit),
  );
  const sum = (pick: (hunt: Plan["hunts"][number]) => number) => plan.hunts.reduce((s, hunt) => s + pick(hunt), 0);
  return (
    <div className="launch">
      {props.options && (
        <fieldset className="columns">
          <legend>Afficher aussi</legend>
          {COLUMN_OPTIONS.map(({ key, label }) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={columns[key]}
                onChange={(e) => {
                  props.onColumn(key, e.target.checked);
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      <div className="optizzz-scroll">
        <table className="optizzz-table optizzz-table--dense hunts">
          <thead>
            <tr>
              <th>N°</th>
              <th>Surface</th>
              {units.map((unit) => (
                <th key={unit.key} title={unit.name}>
                  {unitLabel(unit.key)}
                </th>
              ))}
              {columns.difficulty && <th>Difficulté</th>}
              {columns.ratio && <th title="Attaque (bonus Armes compris) / difficulté">Ratio</th>}
              {columns.meanLosses && <th title="Unités perdues en moyenne">Pertes moy.</th>}
              {columns.maxLosses && <th title="Unités perdues au pire des tirages">Pertes max</th>}
              {columns.returns && <th>Retour</th>}
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {plan.hunts.map((hunt, i) => {
              const status = statuses[i] ?? "pending";
              const previousLaunched = statuses.slice(0, i).every((s) => s === "launched");
              const locked = busy || frozen || status === "launched" || status === "launching";
              const editable = columns.edit && !locked;
              return (
                <tr key={i} className={status}>
                  <th scope="row">{i + 1}</th>
                  <td>
                    {editable ? (
                      <NumberField
                        min={1}
                        integer
                        amount
                        className="wide"
                        aria-label={`Surface de la chasse ${String(i + 1)}`}
                        value={hunt.amount}
                        onCommit={(amount) => {
                          if (amount !== null) onEdit(i, { amount });
                        }}
                      />
                    ) : (
                      `${formatNumber(hunt.amount)} cm²`
                    )}
                  </td>
                  {units.map((unit) => {
                    const index = UNITS.indexOf(unit);
                    return (
                      <td key={unit.key}>
                        {editable ? (
                          <NumberField
                            min={0}
                            integer
                            amount
                            className="units"
                            aria-label={`${unit.name}, chasse ${String(i + 1)}`}
                            value={hunt.army[index] ?? 0}
                            onCommit={(count) => {
                              onEdit(i, { unit: unit.key, count: count ?? 0 });
                            }}
                          />
                        ) : (
                          <Amount value={hunt.army[index] ?? 0} />
                        )}
                      </td>
                    );
                  })}
                  {columns.difficulty && (
                    <td>
                      <Amount value={hunt.difficulty} />
                    </td>
                  )}
                  {columns.ratio && <td>{formatDecimal(hunt.attack / hunt.difficulty, 2)}</td>}
                  {columns.meanLosses && <td>{round1(hunt.outcome.lostUnits.mean)}</td>}
                  {columns.maxLosses && (
                    <td>
                      <Amount value={hunt.outcome.lostUnits.max} />
                    </td>
                  )}
                  {columns.returns && (
                    <td>{formatEndTimeShort(new Date(now.getTime() + hunt.durationSeconds * 1000), now)}</td>
                  )}
                  <td className="status-cell">
                    {status === "pending" || status === "failed" ? (
                      <>
                        {status === "failed" && <span className="status failed">{STATUS_TEXT.failed} </span>}
                        <button
                          type="button"
                          className="optizzz-button-link"
                          disabled={busy || launchBlocked || !previousLaunched}
                          title={
                            previousLaunched ? "Lancer cette chasse seule" : "Lancez d'abord les chasses précédentes"
                          }
                          onClick={() => {
                            onLaunch(i);
                          }}
                        >
                          {status === "failed" ? "Réessayer" : "Lancer"}
                        </button>
                      </>
                    ) : (
                      <span className={`status ${status}`}>{STATUS_TEXT[status]}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {plan.hunts.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row" title="Total">
                  T
                </th>
                <td>
                  <Amount value={plan.totalAmount} /> cm²
                </td>
                {units.map((unit) => (
                  <td key={unit.key}>
                    <Amount value={sent[UNITS.indexOf(unit)] ?? 0} />
                  </td>
                ))}
                {columns.difficulty && (
                  <td>
                    <Amount value={sum((hunt) => hunt.difficulty)} />
                  </td>
                )}
                {columns.ratio && (
                  <td>{formatDecimal(sum((hunt) => hunt.attack) / sum((hunt) => hunt.difficulty), 2)}</td>
                )}
                {columns.meanLosses && <td>{round1(sum((hunt) => hunt.outcome.lostUnits.mean))}</td>}
                {columns.maxLosses && (
                  <td>
                    <Amount value={sum((hunt) => hunt.outcome.lostUnits.max)} />
                  </td>
                )}
                {columns.returns && (
                  <td>{formatEndTimeShort(new Date(now.getTime() + plan.durationSeconds * 1000), now)}</td>
                )}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
