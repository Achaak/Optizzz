import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "~/components/icons";

// The building blocks of the « Campagne vivante » direction (docs/features/site-refonte.md): a rounded panel lifted by
// a shadow, a page title under the ant trail, quiet small labels.

/** A panel; `title` in condensed capitals, `aside` on the right of its header (a link, a date). */
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
    <section
      aria-labelledby={labelledBy}
      className={cn("min-w-0 rounded-[0.875rem] bg-card text-card-foreground shadow-panel", className)}
    >
      {(title ?? aside) && (
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4.5 pt-4 pb-1.5">
          {title && (
            <h2 id={labelledBy} className="font-heading text-[1.375rem] font-bold tracking-wide uppercase">
              {title}
            </h2>
          )}
          {aside}
        </header>
      )}
      <div className={flush ? "pb-1" : "px-4.5 pt-2.5 pb-4.5"}>{children}</div>
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

/** A quiet small label: a figure's label, a kicker, a group's name. */
export function SmallLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-xs font-medium text-muted-foreground", className)}>{children}</span>;
}

/** The ant trail: the logo's three dots walking along a line, over a page title or a curve. */
export function AntTrail({ width = 48, className }: { width?: number; className?: string }) {
  return (
    <svg width={width} height={8} viewBox={`0 0 ${width} 8`} aria-hidden="true" className={className}>
      <path className="ant-trail" d={`M0 4 H${width}`} stroke="var(--primary)" strokeWidth={4} />
    </svg>
  );
}

/** « Relevé de 9 h 00 · relu chaque heure », after a breathing dot: data that the site reads again by itself. */
export function LiveBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs shadow-panel", className)}
    >
      <span aria-hidden="true" className="live-dot size-2 shrink-0 rounded-full bg-primary" />
      {children}
    </span>
  );
}

/**
 * The page's title under the ant trail: a `kicker` above it (« Joueur · S5 »), a line under it, a `live` badge for data
 * read again every hour (« Export du 26/10 · 9 h 00 · relu chaque heure »), and on the right a `note` or the page's
 * `actions` (« Comparer », « Copier le lien »).
 */
export function PageHeader({
  title,
  kicker,
  note,
  live,
  actions,
  children,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  note?: ReactNode;
  live?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="rise flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-1">
      <div className="min-w-0 space-y-2">
        {kicker && <SmallLabel className="block">{kicker}</SmallLabel>}
        <AntTrail className="block" />
        <h1>{title}</h1>
        {children && <div className="max-w-3xl text-muted-foreground">{children}</div>}
        {live && <LiveBadge className="mt-1">{live}</LiveBadge>}
      </div>
      {(note ?? actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {note && <SmallLabel>{note}</SmallLabel>}
          {actions}
        </div>
      )}
    </header>
  );
}
