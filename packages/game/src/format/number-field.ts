export interface NumberFieldRules {
  min?: number;
  max?: number;
  /** Rounds down to a whole number. */
  integer?: boolean;
  /** An empty field means « no value » (null) instead of being refused. */
  allowEmpty?: boolean;
  /** An amount as the game writes it (« 10 000 ») or shortened (« 10k », « 1,5M »). */
  amount?: boolean;
}

const SUFFIXES: Record<string, number> = { k: 1e3, m: 1e6 };

/** « 10 000 », « 10k », « 1,5 M » → the number, spaces left out; null when unreadable. */
function readAmount(text: string): number | null {
  const match = /^(\d+(?:\.\d+)?)([km])?$/i.exec(text.replace(/[\s\u00a0\u202f]/g, ""));
  if (!match?.[1]) return null;
  return Number(match[1]) * (match[2] ? (SUFFIXES[match[2].toLowerCase()] ?? 1) : 1);
}

/**
 * What a number field holds once the player is done typing: the clamped number, null for an allowed empty field,
 * or undefined when the text is not a number (the field then goes back to its previous value).
 */
export function parseNumberField(text: string, rules: NumberFieldRules = {}): number | null | undefined {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return rules.allowEmpty ? null : undefined;
  let value = rules.amount ? (readAmount(trimmed) ?? NaN) : Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  if (rules.integer) value = Math.floor(value);
  if (rules.min !== undefined) value = Math.max(rules.min, value);
  if (rules.max !== undefined) value = Math.min(rules.max, value);
  return value;
}
