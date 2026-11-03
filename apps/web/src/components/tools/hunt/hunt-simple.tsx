"use client";

// The simple display: one choice (Prudent, Équilibré, Rapide), « Faire monter mes troupes »; the head of the report
// with its four key figures. As the extension's launcher. See docs/features/site-chasse.md and hunt-launcher.md.
import { UNITS } from "@optizzz/game/army/units";
import { formatAmount, formatDecimal } from "@optizzz/game/format/number-format";
import { formatDuration, formatEndTime } from "@optizzz/game/format/time-format";
import type { HuntForm } from "@optizzz/game/hunt/hunt-form";
import type { Plan } from "@optizzz/game/hunt/planner";
import {
  formatChance,
  formatLosses,
  huntsText,
  presetOf,
  PRESETS,
  promotionCounts,
  splitText,
} from "@optizzz/game/hunt/texts";
import { cn } from "cn";
import { SmallLabel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { Verdict } from "../tool-page";
import { Check, Note, Segmented, Warning } from "./hunt-parts";

/** The army has troops that can be promoted besides young dwarves: the waves are worth offering. */
const hasTroops = (form: HuntForm) =>
  UNITS.some((unit) => unit.key !== "JSN" && unit.promotesTo && (form.army[unit.key] ?? 0) > 0);

/** « le réglage courant » → « Le réglage courant. » */
const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

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
        <SmallLabel>Type de chasse</SmallLabel>
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
      </div>
      <p className="text-sm text-muted-foreground">
        {preset
          ? sentence(PRESETS.find((p) => p.key === preset)?.hint ?? "")
          : `Réglage personnalisé (${form.objective === "ratio" ? `ratio ${formatDecimal(form.ratio)}` : "rendement"}).`}
      </p>
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

/**
 * The head of the report, as the mockup: the plan in a few words (« 2 chasses de 9 000 cm² ») with its losses and
 * return, then the figures that matter: field won, units lost, promotions, duration.
 */
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
  const worst = plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.max, 0);
  const laying = plan.hunts.reduce((sum, hunt) => sum + hunt.outcome.lossLayingSeconds.mean, 0);
  const promotions = promotionCounts(plan);
  const winChance = Math.min(1, ...plan.hunts.map((hunt) => hunt.outcome.winChance));
  const troops = hasTroops(form);
  const back = formatEndTime(new Date(now.getTime() + plan.durationSeconds * 1000), now);
  const split = splitText(plan.hunts.map((hunt) => hunt.amount));
  return (
    <>
      <div className="px-4 pt-4">
        <Verdict title={huntsText(plan)}>
          Pertes moyennes ≈ {formatLosses(lost)} unité{lost >= 2 ? "s" : ""} · retour {back}
        </Verdict>
      </div>
      <div className="grid grid-cols-2 border-b">
        <Figure
          label="TdC gagné"
          tone="primary"
          value={`+ ${formatAmount(plan.totalAmount)}`}
          note={plan.hunts.length > 1 ? `cm² au total (${split})` : "cm² au total"}
        />
        <Figure
          label="Unités perdues"
          tone="info"
          value={formatLosses(lost)}
          note={
            layingSpeed === null
              ? `en moyenne ; pire tirage ${formatAmount(worst)}`
              : `pire tirage ${formatAmount(worst)} ; ${formatDuration(laying * layingSpeed * 1000)} de ponte`
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
        <Figure label="Durée" value={formatDuration(plan.durationSeconds * 1000)} note={`retour ${back}`} />
      </div>
      {(winChance < 1 || (form.dispatch === "waves" && plan.waves === "worse")) && (
        <div className="space-y-2 border-b px-4 py-3">
          {winChance < 1 && (
            <Warning danger>
              Chasse perdue dans {formatChance(1 - winChance)} des tirages : choisissez « Prudent ».
            </Warning>
          )}
          {form.dispatch === "waves" && plan.waves === "worse" && (
            <Note>Vos troupes restent mêlées aux JSN : ici, les envoyer à part en ferait perdre ou monter moins.</Note>
          )}
        </div>
      )}
    </>
  );
}

/** One figure of the report; its label in the colour of what it measures (the label says it too). */
function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "primary" | "info";
}) {
  return (
    <div className="min-w-0 border-b px-4 py-3.5 odd:border-r [&:nth-last-child(-n+2)]:border-b-0">
      <SmallLabel className={cn(tone === "primary" && "text-primary", tone === "info" && "text-info")}>
        {label}
      </SmallLabel>
      <div className="font-mono text-xl leading-tight break-words sm:text-[1.375rem]">{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
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
