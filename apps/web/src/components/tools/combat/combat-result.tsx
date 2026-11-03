// The result of the combat simulator, recomputed at each change: verdict and loot, then each place fought.
// The same engine as the extension's simulator (@optizzz/game/army/battle-form). See docs/features/site-combat.md.
import { placeHpBonus, requiredAttack, type Place, type Stage } from "@optizzz/game/army/battle";
import { simulate, type SimulatorForm } from "@optizzz/game/army/battle-form";
import { unitLabel, UNITS } from "@optizzz/game/army/units";
import { Fragment, type ReactNode } from "react";
import { inRange } from "@optizzz/game/attack";
import { formatNumber } from "@optizzz/game/format/number-format";
import { Verdict } from "../tool-page";

export const PLACE_LABELS: Record<Place, string> = {
  field: "Terrain de chasse",
  nest: "Fourmilière",
  lodge: "Loge Impériale",
};

/** « sur le Terrain de chasse », « dans la Fourmilière »: where a fight takes place. */
const PLACE_AT: Record<Place, string> = {
  field: "sur le Terrain de chasse",
  nest: "dans la Fourmilière",
  lodge: "dans la Loge Impériale",
};

const replyLabel = (reply: number) => `${formatNumber(reply * 100)} %`;

interface StageRow {
  unit: (typeof UNITS)[number];
  sent: number;
  attackerLost: number;
  present: number;
  defenderLost: number;
}

const stageRows = (stage: Stage): StageRow[] =>
  UNITS.map((unit, i) => ({
    unit,
    sent: stage.attackerBefore[i] ?? 0,
    attackerLost: stage.attackerLost[i] ?? 0,
    present: stage.defenderBefore[i] ?? 0,
    defenderLost: stage.defenderLost[i] ?? 0,
  })).filter((row) => row.sent > 0 || row.present > 0);

const HATCH = "bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(0_0_0/0.25)_4px_6px)]";

/** « 24 150 Soldates Naines », « aucune » for a side's losses, read out for the chart. */
const lostSentence = (rows: StageRow[], lost: (row: StageRow) => number, had: (row: StageRow) => number) => {
  const parts = rows
    .filter((row) => had(row) > 0)
    .map(
      (row) => `${formatNumber(lost(row))} ${unitLabel(row.unit.key)} (${row.unit.name}) sur ${formatNumber(had(row))}`,
    );
  return parts.length > 0 ? parts.join(", ") : "aucune unité";
};

/**
 * Each unit's losses, the attacker's bars to the left in amber, the defender's to the right in hatched blue (told
 * apart by side, pattern and label, never by colour alone: ADR 0003); 0 when a side had the unit and lost none.
 */
function LossBars({ rows }: { rows: StageRow[] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.attackerLost, row.defenderLost]));
  /** Room left beside the figure (« 24 150 »), so a figure never wraps. */
  const width = (count: number) => `calc(${String(count / max)} * (100% - 3.75rem))`;
  return (
    <>
      <div
        aria-hidden
        className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] gap-1 font-mono text-[0.6875rem]"
      >
        <span className="text-right text-primary">◀ ATTAQUANT</span>
        <span />
        <span className="text-info">DÉFENSEUR ▶</span>
      </div>
      <div
        role="img"
        aria-label={`Pertes. Attaquant : ${lostSentence(
          rows,
          (row) => row.attackerLost,
          (row) => row.sent,
        )}. Défenseur : ${lostSentence(
          rows,
          (row) => row.defenderLost,
          (row) => row.present,
        )}.`}
        className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-center gap-x-1 gap-y-1.5 font-mono text-xs"
      >
        {rows.map((row) => (
          <Fragment key={row.unit.key}>
            <div className="flex min-w-0 items-center justify-end gap-1.5">
              {row.sent > 0 &&
                (row.attackerLost > 0 ? (
                  <>
                    <span className="shrink-0 whitespace-nowrap">{formatNumber(row.attackerLost)}</span>
                    <div className="h-3.5 bg-primary" style={{ width: width(row.attackerLost) }} />
                  </>
                ) : (
                  <span className="text-muted-foreground">0</span>
                ))}
            </div>
            <span title={row.unit.name} className="text-center font-semibold">
              {unitLabel(row.unit.key)}
            </span>
            <div className="flex min-w-0 items-center gap-1.5">
              {row.present > 0 &&
                (row.defenderLost > 0 ? (
                  <>
                    <div className={`h-3.5 bg-info ${HATCH}`} style={{ width: width(row.defenderLost) }} />
                    <span className="shrink-0 whitespace-nowrap">{formatNumber(row.defenderLost)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">0</span>
                ))}
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}

/** A figure kept on one line (« 2 772 000 » never broken at its spaces). */
const Whole = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

/** A row of the report's figures: a label on the left, the figure in mono on the right. */
function Figure({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono">{children}</dd>
    </>
  );
}

/** A place fought: the losses per unit, then the damage and the reply. `single` when it is the only place. */
function StageResult({ stage, form, single }: { stage: Stage; form: SimulatorForm; single: boolean }) {
  const rows = stageRows(stage);
  const fought = rows.some((row) => row.present > 0);
  const needed = requiredAttack(
    UNITS.map((_, i) => stage.defenderBefore[i] ?? 0),
    form.defender.shield,
    placeHpBonus(stage.place, form.defender),
  );
  return (
    <section className="-mx-4 border-b">
      <figure className="space-y-2 px-4 py-3.5">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 font-heading text-lg font-semibold uppercase">
          <span>{single ? "Pertes par unité" : PLACE_LABELS[stage.place]}</span>
          {!single && (
            <span className="font-sans text-sm font-semibold normal-case">
              {stage.won ? "Victoire" : "Défaite"} de l&apos;attaquant
            </span>
          )}
        </figcaption>
        {fought ? (
          <LossBars rows={rows} />
        ) : (
          <p className="font-sans text-sm text-muted-foreground normal-case">
            Personne {PLACE_AT[stage.place]} : l&apos;attaque passe sans combat.
          </p>
        )}
      </figure>
      {fought && (
        <div className="space-y-2 px-4 pb-3.5">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
            <Figure label="Dégâts infligés (1er tour)">{formatNumber(stage.damageDealt)}</Figure>
            <Figure label="Dégâts reçus">{formatNumber(stage.damageTaken)}</Figure>
            <Figure label="Riposte du défenseur">{replyLabel(stage.reply)}</Figure>
          </dl>
          <p className="text-xs text-muted-foreground">
            Dégâts au 1er tour pour une riposte à 50 % : plus de <Whole>{formatNumber(needed.half)}</Whole> ; à 30 % :
            plus de <Whole>{formatNumber(needed.thirty)}</Whole> ; à 10 % : plus de{" "}
            <Whole>{formatNumber(needed.ten)}</Whole>.
          </p>
        </div>
      )}
    </section>
  );
}

const sum = (counts: readonly number[]) => counts.reduce((total, count) => total + count, 0);

const hasUnits = (form: SimulatorForm) => Object.values(form.attacker.army).some((count) => (count ?? 0) > 0);

/** The line under the verdict: where the attack stops, or what it takes. */
function verdictDetail(form: SimulatorForm, { fought, loot }: ReturnType<typeof simulate>) {
  const last = fought.stages[fought.stages.length - 1];
  if (!fought.won) return `L'attaque s'arrête ${PLACE_AT[last?.place ?? "field"]}.`;
  if (loot.colony) return "La fourmilière devient votre colonie.";
  return (
    `Gain : ${formatNumber(loot.field)} cm²` +
    (form.target === "nest"
      ? `, ${formatNumber(loot.food)} de nourriture et ${formatNumber(loot.materials)} de matériaux`
      : "") +
    "."
  );
}

/** « 15 850 SN · 15 000 AE », the attacker's army after the fight. */
const survivorsLabel = (survivors: readonly number[]) => {
  const parts = UNITS.flatMap((unit, i) => {
    const count = survivors[i] ?? 0;
    return count > 0 ? [`${formatNumber(count)} ${unitLabel(unit.key)}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : "aucun";
};

export function CombatResult({ form }: { form: SimulatorForm }) {
  const { attacker, defender } = form;
  const outOfRange = attacker.field > 0 && defender.field > 0 && !inRange(attacker.field, defender.field);
  if (!hasUnits(form)) {
    return (
      <>
        <OutOfRange shown={outOfRange} />
        <p className="text-sm text-muted-foreground">Ajoutez des unités à l&apos;attaquant.</p>
      </>
    );
  }
  const simulated = simulate(form);
  const { fought } = simulated;
  const sent = sum(fought.stages[0]?.attackerBefore ?? []);
  const attackerLost = sum(fought.stages.flatMap((stage) => stage.attackerLost));
  const present = sum(fought.stages.flatMap((stage) => stage.defenderBefore));
  const defenderLost = sum(fought.stages.flatMap((stage) => stage.defenderLost));
  return (
    <>
      <Verdict title={fought.won ? "Victoire de l'attaquant" : "Victoire du défenseur"}>
        {verdictDetail(form, simulated)}
      </Verdict>
      <OutOfRange shown={outOfRange} />
      <div className="-mx-4 grid grid-cols-2 border-b">
        <div className="border-r px-4 py-3">
          <div className="text-xs text-primary font-medium">Pertes attaquant</div>
          <div className="font-mono text-2xl">{formatNumber(attackerLost)}</div>
          <div className="text-xs text-muted-foreground">
            {attackerLost === sent ? "toute l'armée" : `sur ${formatNumber(sent)} unités`}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-info font-medium">Pertes défenseur</div>
          <div className="font-mono text-2xl">{formatNumber(defenderLost)}</div>
          <div className="text-xs text-muted-foreground">
            {present === 0
              ? "aucune unité"
              : defenderLost === present
                ? "toute l'armée"
                : `sur ${formatNumber(present)} unités`}
          </div>
        </div>
      </div>
      {fought.stages.map((stage) => (
        <StageResult key={stage.place} stage={stage} form={form} single={fought.stages.length === 1} />
      ))}
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
        <Figure label="Survivants">{survivorsLabel(fought.survivors)}</Figure>
      </dl>
    </>
  );
}

function OutOfRange({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <p role="alert" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm rounded-[0.625rem]">
      Le TDC du défenseur doit être entre 50 % et 300 % de celui de l&apos;attaquant : cette attaque est impossible.
    </p>
  );
}
