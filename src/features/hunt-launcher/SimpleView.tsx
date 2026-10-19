import type { Plan } from "./engine/planner";
import type { Settings } from "./settings";
import { formatChance, presetOf, PRESETS, promotionCounts, splitText } from "./view";
import { formatAmount, formatDecimal } from "@/utils/number-format";
import { formatDuration, formatEndTime } from "@/utils/time-format";

interface Props {
  settings: Settings;
  /** Changes a setting; the hunts changed by hand are dropped. */
  updateSettings: (change: (current: Settings) => Settings) => void;
  /** Null while the first plan is computed. */
  plan: Plan | null;
  /** Factor of the queen's laying times, null when unknown. */
  layingSpeed: number | null;
  /** The army has troops that can be promoted besides young dwarves: the waves are worth offering. */
  hasTroops: boolean;
  /** What the advanced settings change that the simple view does not show, as short phrases. */
  custom: string[];
  onAdvanced: () => void;
  now: Date;
}

/** The launcher for players who want one choice and the figures that matter. */
export function SimpleView({ settings, updateSettings, plan, layingSpeed, hasTroops, custom, onAdvanced, now }: Props) {
  const preset = presetOf(settings);
  const hunts = plan?.hunts ?? [];
  const lost = hunts.reduce((sum, hunt) => sum + hunt.outcome.lostUnits.mean, 0);
  const laying = hunts.reduce((sum, hunt) => sum + hunt.outcome.lossLayingSeconds.mean, 0);
  const promotions = plan ? promotionCounts(plan) : { troops: 0, youngDwarves: 0 };
  const winChance = Math.min(1, ...hunts.map((hunt) => hunt.outcome.winChance));
  return (
    <div className="simple">
      <div className="choice">
        <div className="optizzz-segmented" role="group" aria-label="Type de chasse">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={`${p.hint} (ratio ${formatDecimal(p.ratio)})`}
              aria-pressed={preset === p.key}
              onClick={() => {
                updateSettings((s) => ({ ...s, objective: "ratio", ratio: p.ratio }));
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="optizzz-muted">
          {preset
            ? PRESETS.find((p) => p.key === preset)?.hint
            : `réglage personnalisé (${settings.objective === "ratio" ? `ratio ${formatDecimal(settings.ratio)}` : "rendement"})`}
        </span>
      </div>
      {hasTroops && (
        <label className="xp">
          <input
            type="checkbox"
            checked={settings.dispatch === "waves"}
            onChange={(e) => {
              const waves = e.target.checked;
              updateSettings((s) => ({ ...s, dispatch: waves ? "waves" : "mix" }));
            }}
          />
          Faire monter mes troupes
          <span className="optizzz-muted">
            {" "}
            : elles partent ensemble dans les dernières chasses, protégées par juste assez de JSN
          </span>
        </label>
      )}

      {plan && hunts.length > 0 && (
        <>
          <dl className="optizzz-stats">
            <div className="optizzz-stat">
              <dt className="optizzz-stat-label">Terrain gagné</dt>
              <dd className="optizzz-stat-value">+{formatAmount(plan.totalAmount)} cm²</dd>
              <dd className="optizzz-stat-note">{splitText(hunts.map((hunt) => hunt.amount))}</dd>
            </div>
            <div className="optizzz-stat">
              <dt className="optizzz-stat-label">Retour</dt>
              <dd className="optizzz-stat-value">
                {formatEndTime(new Date(now.getTime() + plan.durationSeconds * 1000), now)}
              </dd>
              <dd className="optizzz-stat-note">dans {formatDuration(plan.durationSeconds * 1000)}</dd>
            </div>
            <div className="optizzz-stat">
              <dt className="optizzz-stat-label">Pertes</dt>
              <dd className="optizzz-stat-value">≈ {formatAmount(lost)}</dd>
              <dd className="optizzz-stat-note">
                {layingSpeed === null
                  ? "unités, en moyenne"
                  : `unités, ${formatDuration(laying * layingSpeed * 1000)} de ponte`}
              </dd>
            </div>
            <div className="optizzz-stat">
              <dt className="optizzz-stat-label">Promotions</dt>
              {hasTroops ? (
                <>
                  <dd className="optizzz-stat-value">
                    {formatAmount(promotions.troops)} troupe{Math.round(promotions.troops) > 1 ? "s" : ""}
                  </dd>
                  <dd className="optizzz-stat-note">
                    et {formatAmount(promotions.youngDwarves)} JSN → SN
                    {plan.waves === "applied" ? ", par vagues" : ""}
                  </dd>
                </>
              ) : (
                <>
                  <dd className="optizzz-stat-value">{formatAmount(promotions.youngDwarves)}</dd>
                  <dd className="optizzz-stat-note">JSN → SN, en moyenne</dd>
                </>
              )}
            </div>
          </dl>
          {winChance < 1 && (
            <p className="optizzz-callout optizzz-callout--danger">
              Chasse perdue dans {formatChance(1 - winChance)} des tirages : choisissez « Prudent ».
            </p>
          )}
          {settings.dispatch === "waves" && plan.waves === "worse" && (
            <p className="optizzz-note">
              Vos troupes restent mêlées aux JSN : ici, les envoyer à part en ferait perdre ou monter moins.
            </p>
          )}
        </>
      )}

      {custom.length > 0 && (
        <p className="optizzz-note">
          Réglages avancés en cours : {custom.join(", ")}.{" "}
          <button type="button" className="optizzz-button-link" onClick={onAdvanced}>
            Les voir
          </button>
        </p>
      )}
    </div>
  );
}
