"use client";

import { formatNumber } from "@optizzz/game/format/number-format";
import { parseNumberField, type NumberFieldRules } from "@optizzz/game/format/number-field";
import { useState, type ComponentProps } from "react";
import { Input } from "~/components/ui/input";

/**
 * A number typed freely, committed once readable (« 10 000 », « 10k » for an amount); the field keeps what is being
 * typed and goes back to the value when it is left unreadable.
 */
export function NumberField({
  value,
  onCommit,
  rules,
  ...input
}: { value: number | null; onCommit: (value: number | null) => void; rules: NumberFieldRules } & Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
>) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value === null ? "" : rules.amount ? formatNumber(value) : String(value);
  return (
    <Input
      {...input}
      type="text"
      inputMode="decimal"
      value={draft ?? shown}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = parseNumberField(event.target.value, rules);
        if (parsed !== undefined && parsed !== value) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
