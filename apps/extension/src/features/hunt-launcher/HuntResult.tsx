import type { Spread } from "./engine/evaluate";
import type { Plan } from "./engine/planner";
import { formatChance, formatShare, splitText, stepNotice } from "./view";
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { Amount } from "@/utils/Amount";
import { formatDuration, formatEndTime } from "@optizzz/game/format/time-format";

interface Props {
  plan: Plan;
  /** Field the first hunt fights at. */
  field: number;
  /** Factor of the queen's laying times, null when unknown. */
  layingSpeed: number | null;
  /** The player chose « Par vagues ». */
  wavesAsked: boolean;
  now: Date;
}

const SPREADS: { key: keyof Spread; label: string }[] = [
  { key: "min", label: "Min" },
  { key: "mean", label: "Moyenne" },
  { key: "p90", label: "9 fois sur 10" },
  { key: "max", label: "Pire tirage" },
];

const total = (plan: Plan, pick: (hunt: Plan["hunts"][number]) => Spread): Spread =>
  plan.hunts.reduce(
    (sum, hunt) => {
      const spread = pick(hunt);
      return {
        min: sum.min + spread.min,
        mean: sum.mean + spread.mean,
        p90: sum.p90 + spread.p90,
        max: sum.max + spread.max,
      };
    },
    { min: 0, mean: 0, p90: 0, max: 0 },
  );

const round1 = (value: number) => (value < 10 ? formatDecimal(value) : formatAmount(value));

/** « Informations sur la chasse »: what the hunts conquer, when they are back and what they cost. */
export function HuntResult({ plan, field, layingSpeed, wavesAsked, now }: Props) {
  const difficulty = plan.hunts.reduce((sum, hunt) => sum + hunt.difficulty, 0);
  const attack = plan.hunts.reduce((sum, hunt) => sum + hunt.attack, 0);
  const references = [...new Set(plan.hunts.map((hunt) => hunt.calystene.referenceRatio))];
  const lost = total(plan, (hunt) => hunt.outcome.lostUnits);
  const laying = total(plan, (hunt) => hunt.outcome.lossLayingSeconds);
  const winChance = Math.min(...plan.hunts.map((hunt) => hunt.outcome.winChance));
  const back = new Date(now.getTime() + plan.durationSeconds * 1000);
  return (
    <div className="result">
      <dl className="facts">
        <div>
          <dt>TdC total chassé</dt>
          <dd>
            <Amount value={plan.totalAmount} /> cm²
          </dd>
        </div>
        <div>
          <dt>Durée de la chasse</dt>
          <dd>{formatDuration(plan.durationSeconds * 1000)}</dd>
        </div>
        <div>
          <dt>Division des chasses</dt>
          <dd>{splitText(plan.hunts.map((hunt) => hunt.amount))}</dd>
        </div>
        <div>
          <dt>Retour de chasse</dt>
          <dd>{formatEndTime(back, now)}</dd>
        </div>
        <div>
          <dt>Rentabilité</dt>
          <dd>
            <Amount value={plan.fieldPerHour * 24} /> cm² / jour
          </dd>
        </div>
        <div>
          <dt>Nourriture récoltée</dt>
          <dd>
            <Amount value={plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.food, 0)} />
          </dd>
        </div>
        <div>
          <dt>Ratio de votre chasse</dt>
          <dd>{difficulty > 0 ? formatDecimal(attack / difficulty, 2) : "—"}</dd>
        </div>
        <div>
          <dt>Difficulté de la chasse</dt>
          <dd>
            <Amount value={difficulty} />
          </dd>
        </div>
        <div>
          <dt>Répartition</dt>
          <dd>{plan.waves === "applied" ? "par vagues" : "mêlée"}</dd>
        </div>
        <div>
          <dt title="Ratio des tables de Calystene : le plus grand de sa liste sous le vôtre">Ratio de référence</dt>
          <dd>
            {references.map((reference) => (reference === null ? "sous 1" : formatDecimal(reference))).join(", ")}
          </dd>
        </div>
      </dl>

      {wavesAsked && plan.waves === "worse" && (
        <p className="optizzz-callout optizzz-callout--warning">
          Unités mêlées malgré la répartition par vagues : par vagues, ces chasses perdraient plus de troupes (hors JSN)
          ou en promouvraient moins. À un ratio plus haut, les vagues protègent mieux les troupes qui montent.
        </p>
      )}
      {wavesAsked && plan.waves === undefined && (
        <p className="optizzz-note">
          {plan.hunts.length === 1
            ? "Une seule chasse : la répartition par vagues ne change rien."
            : "Aucune unité à faire monter à part les JSN : la répartition par vagues ne change rien."}
        </p>
      )}
      {winChance < 1 && (
        <p className="optizzz-callout optizzz-callout--danger">
          Chasse perdue dans {formatChance(1 - winChance)} des tirages : l'armée ne suffit pas.
        </p>
      )}

      <div className="optizzz-scroll">
        <table className="optizzz-table optizzz-table--dense losses">
          <caption>Estimation des pertes{plan.hunts.length > 1 ? ", toutes chasses additionnées" : ""}</caption>
          <thead>
            <tr>
              <th />
              {SPREADS.map(({ key, label }) => (
                <th key={key} className={key === "mean" ? "main" : undefined}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Unités perdues</th>
              {SPREADS.map(({ key }) => (
                <td key={key} className={key === "mean" ? "main" : undefined}>
                  {round1(lost[key])}
                </td>
              ))}
            </tr>
            {layingSpeed !== null && (
              <>
                <tr>
                  <th scope="row" title="Temps de ponte pour remplacer les unités perdues, vos bonus compris">
                    Temps de ponte
                  </th>
                  {SPREADS.map(({ key }) => (
                    <td key={key} className={key === "mean" ? "main" : undefined}>
                      {formatDuration(laying[key] * layingSpeed * 1000)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Part de la durée de chasse</th>
                  {SPREADS.map(({ key }) => (
                    <td key={key} className={key === "mean" ? "main" : undefined}>
                      {plan.durationSeconds > 0 ? formatShare((laying[key] * layingSpeed) / plan.durationSeconds) : "—"}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="optizzz-note">
        Une unité blessée à plus de la moitié de sa vie compte comme perdue. {stepNotice(field, plan.totalAmount)}
      </p>
    </div>
  );
}
