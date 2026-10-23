"use client";

// The simple display: one choice (Prudent, Équilibré, Rapide), « Faire monter mes troupes », four key figures. As the
// extension's launcher. See docs/features/site-chasse.md and hunt-launcher.md.
import { UNITS } from "@optizzz/game/army/units";
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { formatDuration, formatEndTime } from "@optizzz/game/format/time-format";
import type { HuntForm } from "@optizzz/game/hunt/hunt-form";
import type { Plan } from "@optizzz/game/hunt/planner";
import { formatChance, presetOf, PRESETS, promotionCounts, splitText } from "@optizzz/game/hunt/texts";
import { Stat } from "~/components/stat";
import { Button } from "~/components/ui/button";
import { Check, Note, Segmented, Warning } from "./hunt-parts";

/** The army has troops that can be promoted besides young dwarves: the waves are worth offering. */
const hasTroops = (form: HuntForm) =>
  UNITS.some((unit) => unit.key !== "JSN" && unit.promotesTo && (form.army[unit.key] ?? 0) > 0);

export function SimpleChoice({
  form,
  onSettings,
}: {
  form: HuntForm;
  onSettings: (change: Partial<HuntForm>) => void;
}) {
  const preset = presetOf(form);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented
          label="Type de chasse"
          value={preset}
          options={PRESETS.map((p) => ({
            value: p.key,
            label: p.label,
            hint: `${p.hint} (ratio ${formatDecimal(p.ratio)})`,
          }))}
          onChange={(key) => {
            const chosen = PRESETS.find((p) => p.key === key);
            if (chosen) onSettings({ objective: "ratio", ratio: chosen.ratio, huntAmount: null });
          }}
        />
        <span className="text-sm text-muted-foreground">
          {preset
            ? PRESETS.find((p) => p.key === preset)?.hint
            : `réglage personnalisé (${form.objective === "ratio" ? `ratio ${formatDecimal(form.ratio)}` : "rendement"})`}
        </span>
      </div>
      {hasTroops(form) && (
        <Check
          checked={form.dispatch === "waves"}
          onChange={(waves) => onSettings({ dispatch: waves ? "waves" : "mix" })}
        >
          Faire monter mes troupes
          <span className="text-muted-foreground">
            {" "}
            : elles partent ensemble dans les dernières chasses, protégées par juste assez de JSN
          </span>
        </Check>
      )}
    </div>
  );
}

/** The four figures that matter: field won, return, losses, promotions. */
export function KeyFigures({
  plan,
  form,
  layingSpeed,
  now,
}: {
  plan: Plan;
  form: HuntForm;
  layingSpeed: number | null;
  now: Date;
}) {
  const lost = plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.mean, 0);
  const laying = plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lossLayingSeconds.mean, 0);
  const promotions = promotionCounts(plan);
  const winChance = Math.min(1, ...plan.hunts.map((hunt) => hunt.outcome.winChance));
  const troops = hasTroops(form);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label="Terrain gagné"
          value={`+${formatAmount(plan.totalAmount)} cm²`}
          note={splitText(plan.hunts.map((hunt) => hunt.amount))}
        />
        <Figure
          label="Retour"
          value={formatEndTime(new Date(now.getTime() + plan.durationSeconds * 1000), now)}
          note={`dans ${formatDuration(plan.durationSeconds * 1000)}`}
        />
        <Figure
          label="Pertes"
          value={`≈ ${formatAmount(lost)}`}
          note={
            layingSpeed === null
              ? "unités, en moyenne"
              : `unités, ${formatDuration(laying * layingSpeed * 1000)} de ponte`
          }
        />
        {troops ? (
          <Figure
            label="Promotions"
            value={`${formatAmount(promotions.troops)} troupe${Math.round(promotions.troops) > 1 ? "s" : ""}`}
            note={`et ${formatAmount(promotions.youngDwarves)} JSN → SN${plan.waves === "applied" ? ", par vagues" : ""}`}
          />
        ) : (
          <Figure label="Promotions" value={formatAmount(promotions.youngDwarves)} note="JSN → SN, en moyenne" />
        )}
      </div>
      {winChance < 1 && (
        <Warning danger>Chasse perdue dans {formatChance(1 - winChance)} des tirages : choisissez « Prudent ».</Warning>
      )}
      {form.dispatch === "waves" && plan.waves === "worse" && (
        <Note>Vos troupes restent mêlées aux JSN : ici, les envoyer à part en ferait perdre ou monter moins.</Note>
      )}
    </>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="space-y-1">
      <Stat label={label} value={value} />
      <p className="px-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

/** « Réglages avancés en cours : … », with a way to see them. */
export function AdvancedInUse({ settings, onAdvanced }: { settings: string[]; onAdvanced: () => void }) {
  if (settings.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Réglages avancés en cours : {settings.join(", ")}.{" "}
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onAdvanced}>
        Les voir
      </Button>
    </p>
  );
}
