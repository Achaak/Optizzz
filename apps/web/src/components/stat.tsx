import type { ReactNode } from "react";
import { MonoLabel } from "~/components/panel";

/** One figure with its label: « Joueurs · 1 877 », a hint under it (« 16 % des joueurs »). */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r px-4 py-3">
      <MonoLabel>{label}</MonoLabel>
      <div className="truncate font-mono text-2xl">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** A row of `Stat`, ruled as one block. */
export function StatGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 overflow-hidden border-t border-l bg-card sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
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
    <div className="flex min-h-48 flex-col items-center justify-center gap-1 border border-dashed p-4 text-center">
      <span className="font-mono text-3xl">{value}</span>
      <span>
        {caption}
        {day && ` le ${day}`}
      </span>
      <span className="text-xs text-muted-foreground">Courbe disponible après 3 jours de relevés</span>
    </div>
  );
}
