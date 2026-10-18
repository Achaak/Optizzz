// « Par vagues »: the units that can still be promoted go together in the last hunts, behind just enough young dwarves,
// the others and the bulk of the young dwarves in the first ones. Order of Calystene's simulator (ComputeHuntDispatch,
// v2.00.38); the young dwarves of each wave are found by simulation instead of his 2 × max losses. Measures:
// docs/research/promotions.md.
import { difficulty } from "./difficulty";
import { evaluateHunt } from "./evaluate";
import type { Draft, PlanInput } from "./planner";
import { UNITS } from "@/game/army/units";

/** Units that can still be promoted, the first ones filling a wave first. */
const XP_ORDER = ["Tu", "Tk", "A", "C", "S", "JS", "SN"];
/** Units that cannot, sent after them. */
const NO_XP_ORDER = ["TuE", "TkE", "SE", "AE", "CE", "NE"];
/**
 * Mean units other than young dwarves lost in a wave: under 0.1, they come back unhurt 9 times out of 10. Half that,
 * for the search runs on fewer draws than the plan shown.
 */
const SAFE_OTHER_LOSSES = 0.05;
const DEFAULT_SAMPLES = 1000;

const JSN = UNITS.findIndex((unit) => unit.key === "JSN");
const indexes = (keys: readonly string[]) => keys.map((key) => UNITS.findIndex((unit) => unit.key === key));
const XP = indexes(XP_ORDER);
const FILL = [...XP, ...indexes(NO_XP_ORDER)];

const baseAttack = (army: readonly number[]) =>
  army.reduce((sum, count, i) => sum + count * (UNITS[i]?.attack ?? 0), 0);

/** A wave: `youngDwarves` JSN, then units in order until the wave has the attack it needs. */
function fill(left: readonly number[], need: number, youngDwarves: number): number[] {
  const army = UNITS.map(() => 0);
  army[JSN] = youngDwarves;
  let missing = need - youngDwarves * (UNITS[JSN]?.attack ?? 0);
  for (const i of FILL) {
    const available = left[i] ?? 0;
    const attack = UNITS[i]?.attack ?? 0;
    if (available <= 0 || missing <= 0 || attack <= 0) continue;
    const count = Math.min(available, Math.round(missing / attack));
    army[i] = count;
    missing -= count * attack;
  }
  return army;
}

function safe(draft: Draft, input: PlanInput): boolean {
  const outcome = evaluateHunt({ ...draft, levels: input.levels, samples: input.searchSamples ?? DEFAULT_SAMPLES });
  const others = UNITS.reduce((sum, unit, i) => sum + (i === JSN ? 0 : (outcome.lost[unit.key] ?? 0)), 0);
  return outcome.winChance >= 0.99 && others < SAFE_OTHER_LOSSES;
}

/**
 * The same hunts (surfaces and fields), their units dispatched by waves; « same » when there is nothing to put in
 * waves, « unsafe » when even every young dwarf cannot bring a wave's other units back unhurt.
 */
export function dispatchWaves(input: PlanInput, drafts: readonly Draft[]): Draft[] | "same" | "unsafe" {
  if (drafts.length < 2 || XP.every((i) => (input.army[i] ?? 0) <= 0)) return "same";
  const left = [...input.army];
  const difficulties = drafts.map((draft) => difficulty(draft.field, draft.amount));
  const totalDifficulty = difficulties.reduce((sum, value) => sum + value, 0);
  const attack = baseAttack(input.army);
  const armies: number[][] = drafts.map(() => UNITS.map(() => 0));
  let remainingDifficulty = totalDifficulty;

  // From the last hunt to the second; the first takes what is left.
  for (let h = drafts.length - 1; h >= 1; h--) {
    const draft = drafts[h];
    const huntDifficulty = difficulties[h] ?? 0;
    if (!draft) continue;
    const need = (attack * huntDifficulty) / totalDifficulty;
    const youngDwarves = left[JSN] ?? 0;
    let army: number[];
    if (XP.some((i) => (left[i] ?? 0) > 0)) {
      // Fewest young dwarves keeping the other units of the wave unhurt.
      const wave = (count: number) => ({ ...draft, army: fill(left, need, count) });
      let low = 0;
      let high = youngDwarves;
      if (safe(wave(0), input)) high = 0;
      else if (!safe(wave(high), input)) return "unsafe";
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (safe(wave(middle), input)) high = middle;
        else low = middle;
      }
      army = wave(high).army;
    } else {
      // Nothing left to promote: young dwarves by difficulty, as the mix does.
      army = fill(left, need, Math.round((youngDwarves * huntDifficulty) / remainingDifficulty));
    }
    remainingDifficulty -= huntDifficulty;
    army.forEach((count, i) => (left[i] = (left[i] ?? 0) - count));
    armies[h] = army;
  }
  armies[0] = left;
  return drafts.map((draft, i) => ({ ...draft, army: armies[i] ?? [] }));
}
