import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "~/components/icons";

// The building blocks of the « Campagne » direction (docs/features/site-refonte.md): a panel with its own header
// under a thin rule, a page title over a rule, small capitals in mono for labels.

/** A bordered panel; `title` in condensed capitals, `aside` on the right of its header (a link, a date). */
export function Panel({
  title,
  aside,
  children,
  flush,
  className,
  labelledBy,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  /** No padding: a table or a list that draws its own rules. */
  flush?: boolean;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className={cn("min-w-0 border bg-card text-card-foreground", className)}>
      {(title ?? aside) && (
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-4 py-2.5">
          {title && (
            <h2 id={labelledBy} className="font-heading text-xl font-semibold tracking-wide uppercase">
              {title}
            </h2>
          )}
          {aside}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** « Tous les joueurs → » in a panel's header. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
      {children}
      <ArrowRightIcon width={14} height={14} />
    </Link>
  );
}

/** Small capitals in mono: a figure's label, a column's head, a kicker. */
export function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase", className)}>
      {children}
    </span>
  );
}

/** The page's title over a rule, with a note on the right (« Export du 26/10 · 9 h 00 »). */
export function PageHeader({ title, note, children }: { title: ReactNode; note?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-3">
      <div className="min-w-0 space-y-2">
        <h1>{title}</h1>
        {children && <div className="max-w-3xl text-muted-foreground">{children}</div>}
      </div>
      {note && <MonoLabel>{note}</MonoLabel>}
    </header>
  );
}
