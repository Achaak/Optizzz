// Hunt difficulty and duration. Formulas: docs/research/chasse.md.

const MIN_FIELD = 50;
const STEP = 10 ** 0.1;

/** Difficulty step of a hunting field (+4 % every ×10^0.1). */
function stepIndex(field: number): number {
  return Math.round(Math.log(Math.max(field, MIN_FIELD) / MIN_FIELD) / Math.log(STEP));
}

/** Difficulty of hunting `amount` cm² while the hunting field is `field` cm² at fight time. */
export function difficulty(field: number, amount: number): number {
  return (amount + Math.max(field, MIN_FIELD) * 0.01) * 1.04 ** stepIndex(field) * 3;
}

/** Food the prey bring back, and what the prey draw aims at. */
export function foodTarget(field: number, amount: number): number {
  return 0.8 * difficulty(field, amount);
}

/** Smallest hunting field above `field` that is one difficulty step higher. */
export function nextDifficultyStep(field: number): number {
  const next = stepIndex(field) + 1;
  let candidate = Math.ceil(MIN_FIELD * STEP ** (next - 0.5));
  while (stepIndex(candidate) < next) candidate++;
  while (candidate - 1 > field && stepIndex(candidate - 1) >= next) candidate--;
  return candidate;
}

export function huntDurationSeconds(fieldAtLaunch: number, amount: number, huntSpeed: number): number {
  return Math.round((fieldAtLaunch + amount) * 0.9 ** huntSpeed);
}
