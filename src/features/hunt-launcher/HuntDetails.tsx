import type { FieldRow } from "./engine/extras";
import type { Plan } from "./engine/planner";
import type { Extras } from "./engine/requests";
import { LossCurve } from "./LossCurve";
import { formatChance } from "./view";
import { unitLabel, UNITS } from "@/game/army/units";
import { formatAmount, formatDecimal, formatNumber } from "@/utils/number-format";
import { Amount } from "@/utils/Amount";
import { formatDuration } from "@/utils/time-format";

const round1 = (value: number) => (value < 10 ? formatDecimal(value) : formatAmount(value));

/** « Pertes selon le TdC à l'arrivée »: the same hunts if the field has changed by the time they fight. */
export function FieldTable({ rows, field }: { rows: FieldRow[]; field: number }) {
  return (
    <div className="optizzz-scroll">
      <table className="optizzz-table optizzz-table--dense by-field">
        <thead>
          <tr>
            <th>TdC à l'arrivée</th>
            <th>Difficulté</th>
            <th>Ratio</th>
            <th>Pertes moy.</th>
            <th>9 fois sur 10</th>
            <th>Pire tirage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.field} className={row.field === field ? "current" : undefined}>
              <th scope="row">
                <Amount value={row.field} /> cm²
                {row.field === field && <span className="optizzz-muted"> (prévu)</span>}
              </th>
              <td>
                <Amount value={row.difficulty} />
              </td>
              <td>{formatDecimal(row.ratio, 2)}</td>
              <td>{round1(row.lostUnits.mean)}</td>
              <td>
                <Amount value={row.lostUnits.p90} />
              </td>
              <td>
                <Amount value={row.lostUnits.max} />
                {row.winChance < 1 && (
                  <span className="optizzz-text-danger"> · échec {formatChance(1 - row.winChance)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DetailsProps {
  plan: Plan;
  /** The advised plan, which the what-ifs are about. */
  advised: Plan | null;
  extras: Extras | null;
  /** The plan is the player's own (surface or units changed). */
  custom: boolean;
  frozen: boolean;
  waitSeconds: number | null;
  onPickAmount: (amount: number) => void;
}

/** « Détails »: Calystene's estimate, promotions, the surface ↔ losses curve, laying more, waiting. */
export function HuntDetails({ plan, advised, extras, custom, frozen, waitSeconds, onPickAmount }: DetailsProps) {
  return (
    <div className="details">
      <div className="optizzz-scroll">
        <table className="optizzz-table optizzz-table--dense">
          <thead>
            <tr>
              <th>N°</th>
              <th title="Pertes selon les tables du simulateur de Calystene, en JSN">Pertes selon Calystene</th>
              <th title="Pertes de notre simulation : moyenne · 9 fois sur 10 · pire tirage">Pertes simulées</th>
              <th title="Promotions attendues (moyenne)">Promues</th>
            </tr>
          </thead>
          <tbody>
            {plan.hunts.map((hunt, i) => {
              const promoted = UNITS.filter((unit) => (hunt.outcome.promoted[unit.key] ?? 0) >= 0.5)
                .map(
                  (unit) =>
                    `${formatAmount(hunt.outcome.promoted[unit.key] ?? 0)} ${unitLabel(unit.key)}→${unitLabel(unit.promotesTo ?? "")}`,
                )
                .join(", ");
              const { calystene } = hunt;
              return (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td>
                    {Number.isNaN(calystene.average)
                      ? "—"
                      : `${round1(calystene.min)} · ${round1(calystene.average)} · ${round1(calystene.max)} JSN`}
                  </td>
                  <td>
                    {round1(hunt.outcome.lostUnits.mean)} · <Amount value={hunt.outcome.lostUnits.p90} /> ·{" "}
                    <Amount value={hunt.outcome.lostUnits.max} />
                  </td>
                  <td>{promoted || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {extras && extras.curve.length > 1 && !frozen && (
        <LossCurve curve={extras.curve} amount={plan.hunts[0]?.amount ?? 0} onPick={onPickAmount} />
      )}
      {custom && extras && (
        <p className="optizzz-note">La courbe et les conseils ci-dessous portent sur le plan conseillé.</p>
      )}

      {advised && extras && extras.laying.length > 0 && (
        <ul className="advice">
          {extras.laying.map((step) => (
            <li key={step.extra}>
              Avec +<Amount value={step.extra} /> {step.unit} : {huntsText(step.plan)} (
              {signed(step.plan.totalAmount - advised.totalAmount)} cm²)
            </li>
          ))}
        </ul>
      )}

      {advised && extras?.waiting && waitSeconds !== null && (
        <p className="optizzz-note">
          En attendant le retour des chasses en cours ({formatDuration(waitSeconds * 1000)}) :{" "}
          {huntsText(extras.waiting.plan)}, soit <Amount value={extras.waiting.fieldPerHour} /> cm²/h attente comprise,
          contre <Amount value={advised.fieldPerHour} /> cm²/h en lançant maintenant.
        </p>
      )}

      <p className="optizzz-note">
        Pertes simulées sur 10 000 tirages de proies. Pertes selon Calystene : min · moyenne · max des tables de son
        simulateur de chasse, qui ignorent la composition de l'armée.
      </p>
    </div>
  );
}

const signed = (value: number) => `${value >= 0 ? "+" : "−"}${formatAmount(Math.abs(value))}`;

export function huntsText(plan: Plan): string {
  if (plan.hunts.length === 0) return "aucune chasse";
  const amounts = [...new Set(plan.hunts.map((hunt) => hunt.amount))];
  const size =
    amounts.length === 1 ? `${formatNumber(amounts[0] ?? 0)} cm²` : `${formatNumber(plan.totalAmount)} cm² en tout`;
  return `${String(plan.hunts.length)} chasse${plan.hunts.length > 1 ? "s" : ""} de ${size}`;
}
