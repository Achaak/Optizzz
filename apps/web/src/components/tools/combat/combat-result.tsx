// The result of the combat simulator, recomputed at each change: verdict and loot, then each place fought.
// The same engine as the extension's simulator (@optizzz/game/army/battle-form). See docs/features/site-combat.md.
import { placeHpBonus, requiredAttack, type Place, type Stage } from "@optizzz/game/army/battle";
import { simulate, type SimulatorForm } from "@optizzz/game/army/battle-form";
import { armyAttack, unitLabel, UNITS } from "@optizzz/game/army/units";
import { inRange } from "@optizzz/game/attack";
import { formatNumber } from "@optizzz/game/format/number-format";
import { Badge } from "~/components/ui/badge";

export const PLACE_LABELS: Record<Place, string> = {
  field: "Terrain de chasse",
  nest: "Fourmilière",
  lodge: "Loge Impériale",
};

const replyLabel = (reply: number) => `${formatNumber(reply * 100)} %`;

/** Victory or defeat said in words; the badge's look only follows (never green against red). */
function Outcome({ won }: { won: boolean }) {
  return <Badge variant={won ? "default" : "outline"}>{won ? "Victoire" : "Défaite"}</Badge>;
}

/**
 * Each unit's losses, the attacker's bars to the left in amber, the defender's to the right in hatched blue (told
 * apart by side, pattern and label, never by colour alone: ADR 0003). A pale track shows how many there were.
 */
function MirrorBars({ rows }: { rows: StageRow[] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.sent, row.present]));
  const width = (count: number) => `${String((count / max) * 100)}%`;
  return (
    <div className="space-y-1.5">
      <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] font-mono text-[0.6875rem]">
        <span className="text-right text-primary">◀ ATTAQUANT</span>
        <span />
        <span className="text-info">DÉFENSEUR ▶</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.unit.key}
            aria-label={`${row.unit.name} : attaquant ${formatNumber(row.attackerLost)} perdues sur ${formatNumber(row.sent)}, défenseur ${formatNumber(row.defenderLost)} perdues sur ${formatNumber(row.present)}`}
            className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-x-1"
          >
            <div aria-hidden className="space-y-0.5">
              <div className="relative ml-auto h-3.5" style={{ width: width(row.sent) }}>
                <div className="absolute inset-0 bg-primary/20" />
                <div
                  className="absolute inset-y-0 right-0 bg-primary"
                  style={{ width: row.sent ? `${String((row.attackerLost / row.sent) * 100)}%` : "0" }}
                />
              </div>
              <div className="text-right font-mono text-[0.6875rem] text-muted-foreground">
                {row.sent > 0 ? `${formatNumber(row.attackerLost)} / ${formatNumber(row.sent)}` : "—"}
              </div>
            </div>
            <span aria-hidden title={row.unit.name} className="text-center font-mono text-xs font-semibold">
              {unitLabel(row.unit.key)}
            </span>
            <div aria-hidden className="space-y-0.5">
              <div className="relative h-3.5" style={{ width: width(row.present) }}>
                <div className="absolute inset-0 bg-info/20" />
                <div
                  className="absolute inset-y-0 left-0 bg-info bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(0_0_0/0.25)_4px_6px)]"
                  style={{ width: row.present ? `${String((row.defenderLost / row.present) * 100)}%` : "0" }}
                />
              </div>
              <div className="font-mono text-[0.6875rem] text-muted-foreground">
                {row.present > 0 ? `${formatNumber(row.defenderLost)} / ${formatNumber(row.present)}` : "—"}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Pertes / unités engagées, de chaque côté.</p>
    </div>
  );
}

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

function StageResult({ stage, form }: { stage: Stage; form: SimulatorForm }) {
  const rows = stageRows(stage);
  const fought = rows.some((row) => row.present > 0);
  const needed = requiredAttack(
    UNITS.map((_, i) => stage.defenderBefore[i] ?? 0),
    form.defender.shield,
    placeHpBonus(stage.place, form.defender),
  );
  const attack = armyAttack(
    UNITS.map((_, i) => stage.attackerBefore[i] ?? 0),
    form.attacker,
  );
  return (
    <section className="space-y-3 border-t pt-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-2 font-heading text-lg font-semibold uppercase">
          {PLACE_LABELS[stage.place]} <Outcome won={stage.won} />
        </h3>
        {fought && <span className="text-xs text-muted-foreground">Riposte à {replyLabel(stage.reply)}</span>}
      </header>
      {fought ? (
        <>
          <MirrorBars rows={rows} />
          <p className="text-sm text-muted-foreground">
            Attaque {formatNumber(attack)} ; pour une riposte à 50 % : plus de {formatNumber(needed.half)}, à 30 % :
            plus de {formatNumber(needed.thirty)}, à 10 % : plus de {formatNumber(needed.ten)}.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Personne à cet endroit.</p>
      )}
    </section>
  );
}

const sum = (counts: readonly number[]) => counts.reduce((total, count) => total + count, 0);

const hasUnits = (form: SimulatorForm) => Object.values(form.attacker.army).some((count) => (count ?? 0) > 0);

export function CombatResult({ form }: { form: SimulatorForm }) {
  const { attacker, defender, target } = form;
  const outOfRange = attacker.field > 0 && defender.field > 0 && !inRange(attacker.field, defender.field);
  if (!hasUnits(form)) {
    return (
      <>
        <OutOfRange shown={outOfRange} />
        <p className="text-sm text-muted-foreground">Ajoutez des unités à l&apos;attaquant.</p>
      </>
    );
  }
  const { fought, loot } = simulate(form);
  const sent = sum(fought.stages[0]?.attackerBefore ?? []);
  const attackerLost = sum(fought.stages.flatMap((stage) => stage.attackerLost));
  const present = sum(fought.stages.flatMap((stage) => stage.defenderBefore));
  const defenderLost = sum(fought.stages.flatMap((stage) => stage.defenderLost));
  return (
    <>
      <OutOfRange shown={outOfRange} />
      <div className="space-y-1">
        <p className="font-heading text-4xl leading-none font-bold uppercase">
          {fought.won ? "L'attaque réussit" : "L'attaque échoue"}
        </p>
        {fought.won && (
          <p className="text-muted-foreground">
            {loot.colony
              ? "La fourmilière devient votre colonie."
              : `Gain : ${formatNumber(loot.field)} cm²` +
                (target === "nest"
                  ? `, ${formatNumber(loot.food)} nourriture et ${formatNumber(loot.materials)} matériaux`
                  : "") +
                "."}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 border">
        <div className="border-r px-3 py-2.5">
          <div className="font-mono text-[0.6875rem] tracking-wider text-primary uppercase">Pertes attaquant</div>
          <div className="font-mono text-2xl">{formatNumber(attackerLost)}</div>
          <div className="text-xs text-muted-foreground">sur {formatNumber(sent)} unités</div>
        </div>
        <div className="px-3 py-2.5">
          <div className="font-mono text-[0.6875rem] tracking-wider text-info uppercase">Pertes défenseur</div>
          <div className="font-mono text-2xl">{formatNumber(defenderLost)}</div>
          <div className="text-xs text-muted-foreground">sur {formatNumber(present)} unités</div>
        </div>
      </div>
      {fought.stages.map((stage) => (
        <StageResult key={stage.place} stage={stage} form={form} />
      ))}
    </>
  );
}

function OutOfRange({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <p role="alert" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm">
      Le TDC du défenseur doit être entre 50 % et 300 % de celui de l&apos;attaquant : cette attaque est impossible.
    </p>
  );
}
