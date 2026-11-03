import type { ReactNode } from "react";
import { SmallLabel } from "~/components/panel";

/** One figure with its label: « Joueurs · 1 877 », a hint under it (« 16 % des joueurs »). */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  /** The label in the accent: a figure that waits on the reader (never alone: the label says what). */
  tone?: "accent";
}) {
  return (
    <div className="min-w-0 rounded-[0.625rem] bg-raised px-4 py-3">
      <SmallLabel className={tone === "accent" ? "text-primary" : undefined}>{label}</SmallLabel>
      <div className="truncate text-[1.75rem] leading-tight font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** A row of `Stat`, tiles in one panel. */
export function StatGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 gap-2.5 rounded-[0.875rem] bg-card p-2.5 shadow-panel sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
    >
      {children}
    </section>
  );
}

/** « Relevé du 22/10 à 16 h 03 » under a page title, or why there is nothing yet. */
export function ReadingNote({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

/** In place of a curve with too few days: the day's figure, and when the curve comes. */
export function NotEnoughDays({ value, caption, day }: { value: string; caption: string; day?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-[0.625rem] bg-raised p-5 text-center">
      <svg width={180} height={40} viewBox="0 0 180 40" aria-hidden="true">
        <path
          className="ant-trail"
          d="M0 30 C40 30 50 8 90 10 S140 34 180 20"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={4}
        />
      </svg>
      <span className="text-4xl leading-none font-semibold">{value}</span>
      <span>
        {caption}
        {day && ` le ${day}`}
      </span>
      <span className="text-xs text-muted-foreground">Courbe disponible après 3 jours de relevés</span>
    </div>
  );
}
