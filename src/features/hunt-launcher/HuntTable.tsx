import type { Plan } from "./engine/planner";
import { UNITS } from "@/game/army/units";
import type { LaunchStatus } from "./launch";
import { formatChance } from "./view";
import { formatNumber } from "@/utils/number-format";
import { formatEndTime } from "@/utils/time-format";

interface Props {
  plan: Plan;
  /** Unit keys the player has, the columns of the editable army. */
  unitKeys: string[];
  statuses: LaunchStatus[];
  busy: boolean;
  now: Date;
  onEdit: (hunt: number, change: { amount?: number; unit?: string; count?: number }) => void;
  onLaunch: (hunt: number) => void;
}

const STATUS_TEXT: Record<LaunchStatus, string> = {
  pending: "",
  launching: "Lancement…",
  launched: "✓ Lancée",
  failed: "✗ Refusée",
};

const round1 = (value: number) =>
  value < 10 ? (Math.round(value * 10) / 10).toLocaleString("fr-FR") : formatNumber(value);

/** One row per hunt; surface and units can be changed, the hunt is then simulated again. */
export function HuntTable({ plan, unitKeys, statuses, busy, now, onEdit, onLaunch }: Props) {
  const units = UNITS.filter((unit) => unitKeys.includes(unit.key));
  return (
    <div className="table-wrap">
      <table className="hunts">
        <thead>
          <tr>
            <th>#</th>
            <th />
            <th>Surface</th>
            {units.map((unit) => (
              <th key={unit.key} title={unit.name}>
                {unit.key}
              </th>
            ))}
            <th title="TDC au moment du combat">TDC au combat</th>
            <th title="Attaque (bonus Armes compris) / difficulté">Ratio</th>
            <th title="Unités qui ne rentrent pas (mortes ou blessées à plus de la moitié de leur vie) : moyenne · 9 fois sur 10 · pire tirage">
              Pertes
            </th>
            <th title="Pertes moyennes selon les tables du simulateur de Calystene, en JSN">Calystene</th>
            <th title="Promotions attendues (moyenne)">XP</th>
            <th>Retour</th>
          </tr>
        </thead>
        <tbody>
          {plan.hunts.map((hunt, i) => {
            const status = statuses[i] ?? "pending";
            const previousLaunched = statuses.slice(0, i).every((s) => s === "launched");
            const promoted = UNITS.filter((unit) => (hunt.outcome.promoted[unit.key] ?? 0) >= 0.5)
              .map(
                (unit) => `${formatNumber(hunt.outcome.promoted[unit.key] ?? 0)} ${unit.key}→${unit.promotesTo ?? ""}`,
              )
              .join(", ");
            const locked = busy || status === "launched" || status === "launching";
            return (
              <tr key={i} className={status}>
                <td>{i + 1}</td>
                <td>
                  {status === "pending" || status === "failed" ? (
                    <>
                      {status === "failed" && <span className="status failed">{STATUS_TEXT.failed} </span>}
                      <button
                        type="button"
                        disabled={busy || !previousLaunched}
                        title={previousLaunched ? "Lancer cette chasse seule" : "Lance d'abord les chasses précédentes"}
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
                <td>
                  <input
                    type="number"
                    min={1}
                    value={hunt.amount}
                    disabled={locked}
                    onChange={(event) => {
                      onEdit(i, { amount: Math.max(1, Number(event.target.value) || 1) });
                    }}
                  />
                </td>
                {units.map((unit) => {
                  const index = UNITS.indexOf(unit);
                  return (
                    <td key={unit.key}>
                      <input
                        type="number"
                        min={0}
                        className="units"
                        value={hunt.army[index] ?? 0}
                        disabled={locked}
                        onChange={(event) => {
                          onEdit(i, { unit: unit.key, count: Math.max(0, Number(event.target.value) || 0) });
                        }}
                      />
                    </td>
                  );
                })}
                <td>{formatNumber(hunt.field)}</td>
                <td>{(hunt.attack / hunt.difficulty).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</td>
                <td>
                  {round1(hunt.outcome.lostUnits.mean)} · {formatNumber(hunt.outcome.lostUnits.p90)} ·{" "}
                  {formatNumber(hunt.outcome.lostUnits.max)}
                  {hunt.outcome.winChance < 1 && (
                    <span className="danger"> · échec {formatChance(1 - hunt.outcome.winChance)}</span>
                  )}
                </td>
                <td className="muted">
                  {Number.isNaN(hunt.calystene.average) ? "—" : `≈ ${round1(hunt.calystene.average)}`}
                </td>
                <td className="xp">{promoted || "—"}</td>
                <td>{formatEndTime(new Date(now.getTime() + hunt.durationSeconds * 1000), now)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
