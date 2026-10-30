"use client";

// Small pieces of the hunt simulator's page: a choice of buttons, a part that folds, notes and warnings.
import type { ReactNode } from "react";
import { cn } from "cn";

/** One choice among a few buttons; the one chosen is filled and pressed (not told by its colour alone). */
export function Segmented<Value extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: Value; label: string; hint?: string }[];
  value: Value | null;
  onChange: (value: Value) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap border bg-card">
      {options.map((option) => {
        const chosen = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={chosen}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 border-r px-3.5 text-sm last:border-r-0",
              chosen ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A part of the advanced display that folds, open at first unless said otherwise. */
export function Part({
  title,
  aside,
  defaultOpen = true,
  children,
}: {
  title: string;
  aside?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border bg-card">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 px-4 py-3 font-heading text-lg font-semibold tracking-wide uppercase select-none group-open:border-b">
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">
          ›
        </span>
        {title}
        {aside && (
          <span className="font-sans text-sm font-normal tracking-normal text-muted-foreground normal-case">
            {aside}
          </span>
        )}
      </summary>
      <div className="space-y-3 p-4">{children}</div>
    </details>
  );
}

/** A grey remark. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Something to look at before trusting the plan; `danger` when the hunt can be lost. Always starts with « ⚠ ». */
export function Warning({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return (
    <p
      role="status"
      className={cn(
        "border px-3 py-2 text-sm",
        danger ? "border-destructive/60 bg-destructive/10" : "border-warning-border bg-warning-soft",
      )}
    >
      ⚠ {children}
    </p>
  );
}

/** A labelled checkbox. */
export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

export const SELECT_CLASS =
  "h-8 max-w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";
