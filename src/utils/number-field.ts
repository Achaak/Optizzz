export interface NumberFieldRules {
  min?: number;
  max?: number;
  /** Rounds down to a whole number. */
  integer?: boolean;
  /** An empty field means « no value » (null) instead of being refused. */
  allowEmpty?: boolean;
}

/**
 * What a number field holds once the player is done typing: the clamped number, null for an allowed empty field,
 * or undefined when the text is not a number (the field then goes back to its previous value).
 */
export function parseNumberField(text: string, rules: NumberFieldRules = {}): number | null | undefined {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return rules.allowEmpty ? null : undefined;
  let value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  if (rules.integer) value = Math.floor(value);
  if (rules.min !== undefined) value = Math.max(rules.min, value);
  if (rules.max !== undefined) value = Math.min(rules.max, value);
  return value;
}
