// « Comment ça marche » under a tool: the rules the tool follows, with an example, rendered by the server so the page
// says something before any input (docs/features/site-outils.md, « Aide d'un outil »). Server components.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "~/components/icons";
import { CertaintyMark, type Certainty } from "~/components/guides/guide-parts";
import { SmallLabel } from "~/components/panel";
import { guide, guidePath } from "~/lib/guides/guides";

export interface HelpHeading {
  id: string;
  title: string;
}

/** The help's frame: its title, what it covers and a link to the guide on the left, the sections on the right. */
export function ToolHelp({
  headings,
  intro,
  guideId,
  children,
}: {
  headings: readonly HelpHeading[];
  intro: ReactNode;
  /** The guide that goes further; linked once it is written. */
  guideId?: string;
  children: ReactNode;
}) {
  const more = guideId ? guide(guideId) : undefined;
  return (
    <section
      aria-labelledby="comment-ca-marche"
      className="grid items-start gap-8 border-t pt-6 lg:grid-cols-[16rem_minmax(0,1fr)]"
    >
      <div className="space-y-3 lg:sticky lg:top-4">
        <h2 id="comment-ca-marche" className="font-heading text-4xl leading-none font-bold uppercase">
          Comment ça marche
        </h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
        <nav aria-label="Sur cette page" className="rounded-[0.875rem] bg-card px-4.5 py-4 shadow-panel">
          <SmallLabel className="mb-2 block">Sur cette page</SmallLabel>
          <ol className="list-decimal space-y-1 pl-5 text-sm marker:text-muted-foreground">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a href={`#${heading.id}`} className="hover:text-primary hover:underline">
                  {heading.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {more?.ready && (
          <Link
            href={guidePath(more.id)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            Lire le guide « {more.shortTitle} » <ArrowRightIcon />
          </Link>
        )}
      </div>
      <article className="guide-text min-w-0 max-w-3xl space-y-9 text-[0.9375rem] leading-relaxed">{children}</article>
    </section>
  );
}

/** One numbered rule of the tool, with how sure it is when it says so. */
export function HelpSection({
  heading,
  index,
  certainty,
  detail,
  children,
}: {
  heading: HelpHeading;
  index: number;
  certainty?: Certainty;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={heading.id} className="scroll-mt-6 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 id={heading.id} className="font-heading text-2xl leading-none font-bold uppercase">
          <span className="text-primary">{index}</span> · {heading.title}
        </h3>
        {certainty && <CertaintyMark certainty={certainty} detail={detail} />}
      </div>
      {children}
    </section>
  );
}

/** A duration to the second, spelled out in an example: « 10 h 01 min 02 s », « 56 min 17 s ». */
export function spelledDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = `${String(minutes).padStart(hours ? 2 : 1, "0")} min ${String(seconds % 60).padStart(2, "0")} s`;
  return hours ? `${String(hours)} h ${rest}` : rest;
}

/** A formula, as the game would compute it, one line per step. */
export function Formula({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-[0.625rem] bg-raised px-3.5 py-3 font-mono text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  );
}
