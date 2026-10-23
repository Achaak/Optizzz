"use client";

// The site's hunt simulator: the extension's hunt launcher without launching nor hunts away. Its entries live in the
// address (`#p=`), so a plan is shared as a link; the launcher opens it the same way, and the same engine gives the
// same plan, computed in a Web Worker. See docs/features/site-chasse.md.
import { UNITS } from "@optizzz/game/army/units";
import { emptyHuntForm, layingSpeed, missingEntries, type HuntForm } from "@optizzz/game/hunt/hunt-form";
import { huntsText } from "@optizzz/game/hunt/texts";
import { huntLinkFormat, type HuntToolState } from "@optizzz/game/site-links/hunt";
import { formatAmount } from "@optizzz/game/format/number-format";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { CopyLinkButton } from "../copy-link-button";
import { InvalidLinkNote, ToolLayout } from "../tool-page";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { HuntDetails } from "./hunt-details";
import { HuntEntries } from "./hunt-entries";
import { HuntParameters } from "./hunt-parameters";
import { Note, Part, Warning } from "./hunt-parts";
import { FieldTable, HuntResult } from "./hunt-result";
import { advancedSettings, editHunt, withLevels } from "./hunt-settings";
import { AdvancedInUse, KeyFigures, SimpleChoice } from "./hunt-simple";
import { ColumnChoices, HuntTable, NO_COLUMNS, type ColumnKey } from "./hunt-table";
import { useHuntPlan } from "./use-hunt-plan";

const EMPTY: HuntToolState = { form: emptyHuntForm(), advanced: false };

/** Return times move with the clock. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function HuntTool() {
  const tool = useToolState({
    tool: "hunt",
    format: huntLinkFormat,
    empty: EMPTY,
    withMyLevels: (state, mine) => ({ ...state, form: withLevels(state.form, mine) }),
  });
  const levels = useMyLevels(tool);
  const { form, advanced } = tool.state;
  const hunt = useHuntPlan(form);
  const now = useNow();
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(NO_COLUMNS);

  /** A change of entries or settings: the hunts changed by hand are dropped, as in the launcher. */
  const changeForm = (change: Partial<HuntForm> | ((current: HuntForm) => Partial<HuntForm>)) =>
    tool.change((state) => ({
      ...state,
      form: { ...state.form, ...(typeof change === "function" ? change(state.form) : change), edited: null },
    }));
  const setAdvanced = (value: boolean) => tool.change((state) => ({ ...state, advanced: value }));

  const { plan, advised, input } = hunt;
  const hasPlan = plan !== null && plan.hunts.length > 0;
  const speed = layingSpeed(form.laying);
  const missing = missingEntries(form);
  const unitKeys = UNITS.filter((unit) => (form.army[unit.key] ?? 0) > 0).map((unit) => unit.key);

  const notices = (
    <>
      {missing.length > 0 && <Note>Remplissez {missing.join(", ")} pour calculer les chasses.</Note>}
      {input?.slots === 0 && <Warning>Tous vos créneaux de chasse sont pris.</Warning>}
      {hunt.computing && <Note>Calcul…</Note>}
      {input && !hunt.computing && advised?.hunts.length === 0 && input.slots > 0 && (
        <Warning>
          Aucune chasse possible avec ces unités et ce réglage{advanced ? "." : " : essayez « Prudent » ou « Rapide »."}
        </Warning>
      )}
    </>
  );

  const table = hasPlan && (
    <HuntTable
      plan={plan}
      unitKeys={unitKeys}
      columns={advanced ? columns : NO_COLUMNS}
      now={now}
      onEdit={(index, edit) =>
        tool.change((state) => ({ ...state, form: { ...state.form, edited: editHunt(plan, index, edit) } }))
      }
    />
  );

  const simple = (
    <>
      <SimpleChoice form={form} onSettings={changeForm} />
      {notices}
      {hasPlan && <KeyFigures plan={plan} form={form} layingSpeed={speed} now={now} />}
      {table}
      <AdvancedInUse settings={advancedSettings(form)} onAdvanced={() => setAdvanced(true)} />
    </>
  );

  const detailed = (
    <>
      <Part title="Paramètres de chasse">
        <HuntParameters
          form={form}
          onSettings={changeForm}
          ratioChoices={hunt.ratios}
          planCount={advised?.hunts.length ?? 1}
          planAmount={advised?.hunts[0]?.amount ?? 1}
          now={now}
        />
      </Part>
      {notices}
      {hasPlan && input && (
        <>
          <Part
            title="Informations sur la chasse"
            aside={`${huntsText(plan)} · +${formatAmount(plan.totalAmount)} cm²`}
          >
            <HuntResult
              plan={plan}
              field={input.field}
              layingSpeed={speed}
              wavesAsked={form.dispatch === "waves"}
              now={now}
            />
          </Part>
          <Part title="Pertes selon le TdC à l'arrivée" defaultOpen={false}>
            {hunt.extras ? <FieldTable rows={hunt.extras.byField} field={input.field} /> : <Note>Calcul…</Note>}
          </Part>
          <Part title="Chasses">
            <ColumnChoices
              columns={columns}
              onColumn={(column, shown) => setColumns((current) => ({ ...current, [column]: shown }))}
            />
            {table}
            {form.edited && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => tool.change((state) => ({ ...state, form: { ...state.form, edited: null } }))}
              >
                Revenir au plan calculé
              </Button>
            )}
          </Part>
          <Part title="Détails" aside="Calystene, promotions, courbe, conseils" defaultOpen={false}>
            <HuntDetails
              plan={plan}
              advised={advised}
              extras={hunt.extras}
              custom={form.edited !== null || form.huntAmount !== null}
              onPickAmount={(huntAmount) => changeForm({ huntAmount })}
            />
          </Part>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <InvalidLinkNote shown={tool.invalidLink} />
      <ToolLayout
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              {advanced ? "Affichage simple" : "Réglages avancés"}
            </Button>
            <ResumeLevelsButton
              levels={levels}
              onResume={(mine) => changeForm((current) => withLevels(current, mine))}
            />
            <CopyLinkButton />
          </>
        }
        form={
          <HuntEntries
            form={form}
            onLevel={(key, value) => {
              changeForm((current) => ({ levels: { ...current.levels, [key]: value } }));
              levels.remember({ [key]: value });
            }}
            onLayingLevel={(key, value) => {
              changeForm((current) => ({ laying: { ...current.laying, [key]: value } }));
              levels.remember({ [key]: value });
            }}
            onLaunchField={(launchField) => changeForm({ launchField })}
            onArmy={(army) => changeForm({ army })}
          />
        }
        result={
          <>
            <h2 className="text-lg font-semibold">
              {advanced ? "Plan de chasse, réglages avancés" : "Plan de chasse"}
            </h2>
            {advanced ? detailed : simple}
          </>
        }
      />
    </div>
  );
}
