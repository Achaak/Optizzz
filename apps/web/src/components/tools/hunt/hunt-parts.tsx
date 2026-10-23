"use client";

// Small pieces of the hunt simulator's page: a choice of buttons, a part that folds, notes and warnings.
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "~/components/ui/button";

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
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          aria-pressed={value === option.value}
          title={option.hint}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
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
    <details open={defaultOpen} className="group rounded-xl ring-1 ring-foreground/10">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 px-4 py-3 font-medium select-none">
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">
          ›
        </span>
        {title}
        {aside && <span className="text-sm font-normal text-muted-foreground">{aside}</span>}
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
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
    <p role="status" className={cn("rounded-md border px-3 py-2 text-sm", danger && "border-destructive/50")}>
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
