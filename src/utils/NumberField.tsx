import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { parseNumberField, type NumberFieldRules } from "./number-field";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max">;

interface Props extends InputProps, NumberFieldRules {
  value: number | null;
  /** Called once the player is done typing (pause, Enter, leaving the field), with a valid value only. */
  onCommit: (value: number | null) => void;
  /** Pause after the last keystroke before the value is committed. */
  commitDelayMs?: number;
}

/**
 * A number input that keeps what the player types while they type: the value it shows is never rewritten by a
 * computation that answers later, and only a valid, clamped number is passed on.
 */
export function NumberField({ value, onCommit, min, max, integer, allowEmpty, commitDelayMs = 600, ...input }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (text: string) => {
    clearTimeout(timer.current);
    const parsed = parseNumberField(text, { min, max, integer, allowEmpty });
    if (parsed !== undefined && parsed !== value) onCommit(parsed);
  };

  return (
    <input
      {...input}
      type="number"
      min={min}
      max={max}
      value={draft ?? value ?? ""}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          commit(text);
        }, commitDelayMs);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && draft !== null) commit(draft);
        input.onKeyDown?.(event);
      }}
      onBlur={(event) => {
        if (draft !== null) commit(draft);
        setDraft(null);
        input.onBlur?.(event);
      }}
    />
  );
}
