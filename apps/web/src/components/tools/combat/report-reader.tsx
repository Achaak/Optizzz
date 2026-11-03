"use client";

// « Lire un rapport d'attaque » (docs/features/site-combat.md): a pasted attack report gives back the opponent's
// Weapons, and the Bouclier, Dôme or Loge that give the defenders the hp for the report's kills. Read in the browser,
// never sent. « Simuler » puts the report's armies, place and levels in the simulator.
import { type Counts } from "@optizzz/game/army/army-text";
import {
  defenseLevelsText,
  guessDefenseLevels,
  levelsWithShield,
  type DefenseLevels,
} from "@optizzz/game/army/report-levels";
import { formatNumber } from "@optizzz/game/format/number-format";
import { combatWeapons, readCombat, type CombatReport } from "@optizzz/game/pages/combat-reports";
import { UNITS } from "@optizzz/game/army/units";
import { useId, useMemo, useState } from "react";
import { SmallLabel, Panel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { NumberField } from "~/components/number-field";
import { PLACE_LABELS } from "./combat-result";

/** What « Simuler » puts in the simulator. */
export interface ReadReport {
  report: CombatReport;
  weapons: number | null;
  /** Null when the report does not tell them. */
  levels: DefenseLevels | null;
}

const PLACE_LEVEL = { field: null, nest: "Dôme", lodge: "Loge" } as const;

/** Only the units the engine knows: a name it does not know stays out of the counts. */
export const knownUnits = (counts: Record<string, number>): Counts =>
  Object.fromEntries(Object.entries(counts).filter(([key]) => UNITS.some((unit) => unit.key === key)));

function readReport(text: string) {
  const report = text.trim() ? readCombat("", text) : null;
  if (!report?.place) return { report, guesses: [] };
  const exchanges = report.exchanges.map(({ dealt, killed }) => ({ dealt: dealt.base + dealt.bonus, killed }));
  return { report, guesses: guessDefenseLevels(report.place, knownUnits(report.defenders), exchanges) };
}

export function ReportReader({ onSimulate }: { onSimulate: (read: ReadReport) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  // Empty until the visitor types it: no pair is chosen for them.
  const [shield, setShield] = useState<number | null>(null);
  const { report, guesses } = useMemo(() => readReport(text), [text]);
  const place = report?.place ?? null;
  const placeLevel = place ? PLACE_LEVEL[place] : null;
  const weapons = report ? combatWeapons(report.taken) : null;
  const withShield = shield === null ? [] : levelsWithShield(guesses, shield);
  // The levels « Simuler » takes: the one left once the Bouclier is known, or the only one.
  const chosen: DefenseLevels | null =
    guesses.length === 1
      ? (guesses[0] ?? null)
      : shield !== null && withShield.length === 1
        ? { shield, level: withShield[0] ?? 0 }
        : null;
  const fell = report ? report.exchanges.reduce((sum, exchange) => sum + exchange.killed, 0) : 0;
  const defenders = report ? Object.values(report.defenders).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <Panel title="Lire un rapport d'attaque" aside={<SmallLabel>le Bouclier, le Dôme ou la Loge adverses</SmallLabel>}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-sm text-muted-foreground">
            Le rapport collé depuis la messagerie, d&apos;«&nbsp;Vous attaquez&nbsp;» à la fin des échanges
          </label>
          <textarea
            id={id}
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full min-w-0 border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 rounded-lg"
          />
          <p className="text-xs text-muted-foreground">Lu dans votre navigateur, jamais envoyé.</p>
        </div>
        <div aria-live="polite" className="min-w-0 space-y-3 text-sm">
          {!text.trim() ? (
            <p className="text-muted-foreground">
              Les pertes adverses dépendent de leur vie : Bouclier, et Dôme à la Fourmilière ou Loge à la Loge. Le
              rapport redonne les niveaux qui expliquent ses morts, échange par échange.
            </p>
          ) : !report ? (
            <p>
              Ce texte n&apos;est pas un rapport d&apos;attaque : il manque « Vous attaquez », les troupes ou un
              échange.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
                <dt>
                  <SmallLabel>Lieu</SmallLabel>
                </dt>
                <dd>
                  {place ? PLACE_LABELS[place] : "lieu inconnu"} de <strong>{report.opponent}</strong>
                </dd>
                <dt>
                  <SmallLabel>Armes</SmallLabel>
                </dt>
                <dd>{weapons === null ? "? (dégâts trop faibles pour le dire)" : formatNumber(weapons)}</dd>
                <dt>
                  <SmallLabel>Niveaux</SmallLabel>
                </dt>
                <dd>
                  {defenseLevelsText(place ?? "field", guesses) ??
                    (fell >= defenders
                      ? "tous les défenseurs sont tombés : le rapport ne dit pas jusqu'où montait leur vie"
                      : fell === 0
                        ? "aucun défenseur n'est tombé : le rapport ne dit pas leur vie"
                        : "aucun niveau ne redonne ces pertes (unité inconnue, ou règle qui diffère)")}
                </dd>
              </dl>
              {placeLevel && guesses.length > 1 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {place === "nest"
                      ? "À la Fourmilière, 2 niveaux de Dôme valent 1 niveau de Bouclier : le rapport ne peut pas les départager."
                      : "À la Loge, 3 niveaux de Bouclier valent 2 niveaux de Loge : le rapport ne peut pas les départager."}
                  </p>
                  <label className="flex flex-wrap items-center gap-2">
                    <span>Son Bouclier, si vous le savez</span>
                    <NumberField
                      aria-label="Bouclier adverse"
                      className="w-20"
                      placeholder="?"
                      value={shield}
                      onCommit={setShield}
                      rules={{ min: 0, max: 1000, integer: true, allowEmpty: true }}
                    />
                    {shield !== null && (
                      <span>
                        →{" "}
                        {withShield.length === 0
                          ? "aucun couple ne colle"
                          : `${placeLevel} ${withShield.map((level) => formatNumber(level)).join(" ou ")}`}
                      </span>
                    )}
                  </label>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSimulate({ report, weapons, levels: chosen })}
              >
                {chosen
                  ? `Simuler avec Bouclier ${formatNumber(chosen.shield)}${placeLevel ? `, ${placeLevel} ${formatNumber(chosen.level)}` : ""}`
                  : "Simuler ce combat"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
