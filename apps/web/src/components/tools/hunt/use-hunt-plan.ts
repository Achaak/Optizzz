"use client";

// The hunt simulator's plan, asked of the engine in a Web Worker (the page never freezes while it searches): the plan
// itself, then the what-ifs around it, the ratio list, and the hunts changed by hand. The same requests as the
// extension's launcher. See docs/features/site-chasse.md.
import { countsToArmy } from "@optizzz/game/army/army-text";
import { createEngine, type Engine } from "@optizzz/game/hunt/client";
import type { RatioChoice } from "@optizzz/game/hunt/extras";
import { baseInput, chainDrafts, planInput, type HuntForm } from "@optizzz/game/hunt/hunt-form";
import { spawnModuleWorker } from "@optizzz/game/hunt/module-worker";
import { summarize, type Plan, type PlanInput } from "@optizzz/game/hunt/planner";
import type { EngineAnswer, EngineRequest, Extras } from "@optizzz/game/hunt/requests";
import { useCallback, useEffect, useRef, useState } from "react";

/** After a pause in typing, as the launcher does. */
const RECOMPUTE_DELAY_MS = 300;

type Ask = <R extends EngineRequest>(request: R) => Promise<EngineAnswer<R>>;

/** The engine, started at the first request (in the browser only) and stopped with the page. */
function useEngine(): Ask {
  const engine = useRef<Engine | null>(null);
  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );
  return useCallback(<R extends EngineRequest>(request: R) => {
    engine.current ??= createEngine(spawnModuleWorker);
    return engine.current(request);
  }, []);
}

/** An answer, with the entries it was computed for. */
interface Keyed<Value> {
  key: string;
  value: Value;
}

export interface HuntPlan {
  /** Null while entries are missing. */
  input: PlanInput | null;
  /** The plan the engine advises. */
  advised: Plan | null;
  /** The plan shown: the hunts changed by hand, or the advised one. */
  plan: Plan | null;
  extras: Extras | null;
  ratios: RatioChoice[] | null;
  /** The plan shown is not yet the one of the entries. */
  computing: boolean;
}

function useDelayed(key: string, run: (isLive: () => boolean) => void) {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      latest.current(() => live);
    }, RECOMPUTE_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key]);
}

export function useHuntPlan(form: HuntForm): HuntPlan {
  const ask = useEngine();
  const input = planInput(form);
  const base = baseInput(form);
  const inputKey = JSON.stringify(input);
  const baseKey = JSON.stringify(base);
  const editedKey = `${inputKey}|${JSON.stringify(form.edited)}`;
  const [answered, setAnswered] = useState<Keyed<Plan> | null>(null);
  const [extras, setExtras] = useState<Keyed<Extras> | null>(null);
  const [ratios, setRatios] = useState<Keyed<RatioChoice[]> | null>(null);
  const [edited, setEdited] = useState<Keyed<Plan> | null>(null);

  useDelayed(inputKey, (isLive) => {
    if (!input) return;
    void ask({ type: "plan", input }).then(async (plan) => {
      if (!isLive()) return;
      setAnswered({ key: inputKey, value: plan });
      const more = await ask({ type: "extras", input, plan, waiting: null });
      if (isLive()) setExtras({ key: inputKey, value: more });
    });
  });

  useDelayed(baseKey, (isLive) => {
    if (!base) return;
    // Each ratio of the list sets its own objective.
    void ask({ type: "ratios", input: { ...base, objective: { kind: "ratio", ratio: 1 } } }).then((choices) => {
      if (isLive()) setRatios({ key: baseKey, value: choices });
    });
  });

  useDelayed(editedKey, (isLive) => {
    if (!input || !form.edited) return;
    const drafts = chainDrafts(
      input.field,
      form.edited.map((hunt) => ({ amount: hunt.amount, army: countsToArmy(hunt.army) })),
    );
    void Promise.all(drafts.map((draft) => ask({ type: "hunt", input, draft }))).then((hunts) => {
      if (isLive()) setEdited({ key: editedKey, value: summarize(hunts) });
    });
  });

  if (!input) return { input, advised: null, plan: null, extras: null, ratios: null, computing: false };
  // While a change is computed, the previous plan stays on screen with « Calcul… ».
  const advised = answered?.value ?? null;
  const plan = form.edited ? (edited?.value ?? advised) : advised;
  return {
    input,
    advised,
    plan,
    extras: extras?.key === inputKey ? extras.value : null,
    ratios: ratios?.value ?? null,
    computing: answered?.key !== inputKey || (form.edited !== null && edited?.key !== editedKey),
  };
}
