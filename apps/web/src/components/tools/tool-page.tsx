// The template of a tool page: title and description from the list (rendered on the server, indexed), then the
// tool's form and its result. See docs/features/site-outils.md and docs/features/site-refonte.md.
import type { SiteToolId } from "@optizzz/game/site-links/site";
import { cn } from "cn";
import type { ReactNode } from "react";
import { AdSlot } from "~/components/ad-slot";
import { MonoLabel, PageHeader } from "~/components/panel";
import { TOOLS } from "./tool-list";

/** A tool's page: `children` is its client component, laid out with `ToolLayout`. */
export function ToolPage({ tool, children }: { tool: SiteToolId; children: ReactNode }) {
  const entry = TOOLS.find((candidate) => candidate.id === tool);
  return (
    <div className="space-y-6">
      <PageHeader title={entry?.title}>{entry?.description}</PageHeader>
      {children}
    </div>
  );
}

/**
 * The form on the left, the result beside it in its own panel, kept in sight while the form scrolls (« Copier le
 * lien » and the other `actions` in its header); on a phone, the result comes under the form. A result with tables
 * takes half the width (`wide`).
 */
export function ToolLayout({
  form,
  result,
  actions,
  resultTitle = "Résultat",
  wide,
}: {
  form: ReactNode;
  result: ReactNode;
  actions?: ReactNode;
  resultTitle?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("grid items-start gap-6", wide ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,1fr)_26rem]")}>
      <section aria-label="Saisie" className="min-w-0 space-y-4">
        {form}
      </section>
      <section
        aria-label={resultTitle}
        className="min-w-0 border bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 lg:sticky lg:top-0 lg:z-10 lg:bg-card">
          <MonoLabel>{resultTitle}</MonoLabel>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <div aria-live="polite" className="space-y-4 p-4">
          {result}
        </div>
      </section>
      <AdSlot className="lg:col-start-2" />
    </div>
  );
}

/** The result in a few words, at the head of the report: « 6 attaques », its detail in a line under it. */
export function Verdict({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 border-b px-4 py-4">
      <p className="font-heading text-4xl leading-none font-bold tracking-wide uppercase">{title}</p>
      {children && <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** A warning above a tool: rules not checked, a figure to take with care. */
export function ToolNote({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm">
      {children}
    </p>
  );
}

/** Shown when the address held a link that could not be read: the tool opened empty. */
export function InvalidLinkNote({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <p role="status" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm">
      Ce lien n&apos;est pas valide : l&apos;outil s&apos;ouvre vide.
    </p>
  );
}
