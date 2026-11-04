// The building blocks of a guide (docs/features/site-guides.md): its title, table of contents and sections, how sure
// each rule is, its footer. Server components: a guide is read, not used.
import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdSlot } from "~/components/ad-slot";
import { PageHeader, SmallLabel } from "~/components/panel";
import { CHROME_STORE, FIREFOX_ADDONS } from "~/lib/extension-stores";
import { GUIDES, guide, guidePath, longDay } from "~/lib/guides/guides";

export type Certainty = "checked" | "players" | "unchecked";

const CERTAINTY = {
  checked: {
    label: "Vérifié",
    className: "border-solid border-info text-info",
    // A tick.
    path: "m5 12 5 5 9-10",
  },
  players: {
    label: "D'après les joueurs",
    className: "border-dashed border-primary text-primary",
    // A speech bubble.
    path: "M4 5h16v11H9l-5 4z",
  },
  unchecked: {
    label: "Non vérifié",
    className: "border-dotted border-muted-foreground text-muted-foreground",
    // A question mark.
    path: "M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V15M12 19h.01",
  },
} as const;

/**
 * How sure a rule is: its word, an icon and the stroke of its border tell it apart, not only its color (ADR 0003).
 * `detail` says where from or when (« aide du jeu », « 8 oct. 2026 »).
 */
export function CertaintyMark({ certainty, detail }: { certainty: Certainty; detail?: string }) {
  const mark = CERTAINTY[certainty];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 px-2 py-px text-xs font-semibold whitespace-nowrap",
        mark.className,
      )}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={mark.path} />
      </svg>
      {mark.label}
      {detail && <span className="font-normal"> · {detail}</span>}
    </span>
  );
}

/** A rule of the game, in a card, with how sure it is. */
export function Rule({ certainty, detail, children }: { certainty: Certainty; detail?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-3.5 shadow-panel">
      <div className="min-w-0 flex-[1_1_20rem]">{children}</div>
      <CertaintyMark certainty={certainty} detail={detail} />
    </div>
  );
}

export interface GuideHeading {
  id: string;
  title: string;
}

/** A numbered section, reached from the table of contents. */
export function GuideSection({
  heading,
  index,
  children,
}: {
  heading: GuideHeading;
  index: number;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={heading.id} className="scroll-mt-6 space-y-3">
      <h2 id={heading.id} className="font-heading text-3xl leading-none font-bold uppercase">
        <span className="text-primary">{index}</span> · {heading.title}
      </h2>
      {children}
    </section>
  );
}

function TableOfContents({ headings }: { headings: readonly GuideHeading[] }) {
  return (
    <nav aria-label="Sommaire" className="rounded-[0.875rem] bg-card px-4.5 py-4 shadow-panel lg:sticky lg:top-4">
      <SmallLabel className="mb-2 block">Sommaire</SmallLabel>
      <ol className="list-decimal space-y-1 pl-5 text-sm marker:text-muted-foreground">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`} className="hover:text-primary hover:underline">
              {heading.title}
            </a>
          </li>
        ))}
      </ol>
      <div className="mt-3.5 flex flex-col items-start gap-2 border-t pt-3">
        <SmallLabel>Les mentions</SmallLabel>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <CertaintyMark certainty="checked" /> dans le jeu
        </span>
        <CertaintyMark certainty="players" />
        <CertaintyMark certainty="unchecked" />
      </div>
    </nav>
  );
}

function GuideFooter({ id }: { id: string }) {
  const entry = guide(id);
  const others = GUIDES.filter((candidate) => candidate.id !== id);
  return (
    <footer className="guide-footer grid gap-6 border-t pt-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        {entry.updated && <SmallLabel className="block">Mis à jour le {longDay(entry.updated)}</SmallLabel>}
        <p id="installer" className="scroll-mt-6 text-sm">
          Tout faire dans le jeu : l&apos;extension Optizzz, <a href={CHROME_STORE}>pour Chrome</a> ou{" "}
          <a href={FIREFOX_ADDONS}>pour Firefox</a>.
        </p>
      </div>
      {others.length > 0 && (
        <div className="space-y-1.5">
          <SmallLabel className="block">Autres guides</SmallLabel>
          <ul className="flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.id}>
                {other.ready ? (
                  <Link
                    href={guidePath(other.id)}
                    className="block rounded-full border px-3 py-1 text-sm hover:bg-accent"
                  >
                    {other.shortTitle}
                  </Link>
                ) : (
                  <span className="block rounded-full border px-3 py-1 text-sm text-muted-foreground">
                    {other.shortTitle} · bientôt
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </footer>
  );
}

/** A guide's page: its title, the table of contents beside the text (above it on a phone), its footer, an ad. */
export function GuidePage({
  id,
  headings,
  children,
}: {
  id: string;
  headings: readonly GuideHeading[];
  children: ReactNode;
}) {
  const entry = guide(id);
  return (
    <div className="space-y-8">
      <PageHeader
        title={entry.title}
        kicker={entry.readingMinutes ? `Guide · ${String(entry.readingMinutes)} min de lecture` : "Guide"}
      >
        {entry.description}
      </PageHeader>
      <div className="grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <TableOfContents headings={headings} />
        <article className="guide-text min-w-0 max-w-3xl space-y-10 text-[0.9375rem] leading-relaxed">
          {children}
        </article>
      </div>
      <GuideFooter id={id} />
      <AdSlot />
    </div>
  );
}
