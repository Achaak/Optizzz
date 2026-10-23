// The template of a tool page: title and description from the list (rendered on the server, indexed), then the
// tool's form and result. On a phone, the result comes under the form. See docs/features/site-outils.md.
import type { SiteToolId } from "@optizzz/game/site-links/site";
import Link from "next/link";
import type { ReactNode } from "react";
import { TOOLS } from "./tool-list";

/** A tool's page: `children` is its client component, laid out with `ToolLayout`. */
export function ToolPage({ tool, children }: { tool: SiteToolId; children: ReactNode }) {
  const entry = TOOLS.find((candidate) => candidate.id === tool);
  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground">
          Outils
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{entry?.title}</h1>
        <p className="text-muted-foreground">{entry?.description}</p>
      </header>
      {children}
    </div>
  );
}

/** Form and result side by side on a wide screen, the result under the form on a phone. */
export function ToolLayout({ form, result, actions }: { form: ReactNode; result: ReactNode; actions?: ReactNode }) {
  return (
    <div className="space-y-4">
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Saisie" className="min-w-0 space-y-4">
          {form}
        </section>
        <section aria-label="Résultat" aria-live="polite" className="min-w-0 space-y-4">
          {result}
        </section>
      </div>
    </div>
  );
}

/** Shown when the address held a link that could not be read: the tool opened empty. */
export function InvalidLinkNote({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <p role="status" className="rounded-md border px-3 py-2 text-sm">
      Ce lien n&apos;est pas valide : l&apos;outil s&apos;ouvre vide.
    </p>
  );
}
