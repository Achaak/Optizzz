import { siteToolPath } from "@optizzz/game/site-links/site";
import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { CertaintyMark } from "~/components/guides/guide-parts";
import { PageHeader, SmallLabel } from "~/components/panel";
import { TOOLS } from "~/components/tools/tool-list";
import { GUIDE_GROUPS, GUIDES, guidePath, longDay, type GuideEntry } from "~/lib/guides/guides";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Comprendre Fourmizzz règle par règle : la chasse, le combat, les trajets, la nourriture, la chaîne de TDC, le flood. Chaque règle dit si elle est vérifiée dans le jeu.",
  alternates: { canonical: "/guides" },
};

function GuideCard({ guide, number }: { guide: GuideEntry; number: number }) {
  const facts = [
    String(number).padStart(2, "0"),
    guide.readingMinutes && `${String(guide.readingMinutes)} min`,
    guide.updated && `mis à jour le ${longDay(guide.updated)}`,
  ].filter(Boolean);
  return (
    <li
      className={cn("relative flex flex-col gap-2 rounded-[0.875rem] bg-card p-5 shadow-panel", guide.ready && "lift")}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SmallLabel>{facts.join(" · ")}</SmallLabel>
        {!guide.ready && <SmallLabel className="rounded-full border px-2">Bientôt</SmallLabel>}
      </div>
      <h3 className="font-heading text-[1.75rem] leading-none font-bold uppercase">
        {guide.ready ? (
          // The whole card is the link: its title stretches over it.
          <Link href={guidePath(guide.id)} className="after:absolute after:inset-0 hover:text-primary">
            {guide.title}
          </Link>
        ) : (
          guide.title
        )}
      </h3>
      <p className="text-sm text-muted-foreground">{guide.description}</p>
      <ul className="mt-auto flex flex-wrap gap-1.5 pt-1" aria-label="Dans ce guide">
        {guide.topics.map((topic) => (
          <li key={topic} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            {topic}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** How sure a rule is, explained once for every guide. */
function CertaintyLegend() {
  return (
    <div className="flex flex-col gap-2.5 rounded-[0.875rem] bg-card px-4.5 py-4 text-sm shadow-panel">
      <strong>Chaque règle dit d&apos;où elle vient</strong>
      <p className="flex flex-wrap items-center gap-2">
        <CertaintyMark certainty="checked" />
        <span className="text-muted-foreground">dans l&apos;aide du jeu ou sur un vrai rapport, avec la date</span>
      </p>
      <p className="flex flex-wrap items-center gap-2">
        <CertaintyMark certainty="players" />
        <span className="text-muted-foreground">constaté par d&apos;autres joueurs, pas encore par Optizzz</span>
      </p>
      <p className="flex flex-wrap items-center gap-2">
        <CertaintyMark certainty="unchecked" />
        <span className="text-muted-foreground">supposé, et dit comme tel</span>
      </p>
    </div>
  );
}

/** Each guide's tool: the guides' examples and the tools share their code. */
function GuidesToTools() {
  const links = GUIDES.flatMap((guide) => {
    const tool = TOOLS.find((entry) => entry.id === guide.tool && entry.ready);
    return tool ? [{ guide, tool }] : [];
  });
  return (
    <section
      aria-labelledby="guides-tools"
      className="grid gap-x-8 gap-y-4 rounded-[0.875rem] bg-card p-5 shadow-panel md:grid-cols-2"
    >
      <div className="space-y-1.5">
        <h2 id="guides-tools" className="font-heading text-[1.625rem] leading-none font-bold uppercase">
          Du guide à l&apos;outil
        </h2>
        <p className="text-sm text-muted-foreground">
          Les exemples des guides sont calculés avec le même code que les outils du site : une règle corrigée change les
          deux à la fois.
        </p>
      </div>
      <ul className="divide-y text-sm">
        {links.map(({ guide, tool }) => (
          <li key={guide.id} className="flex flex-wrap justify-between gap-x-3 py-2">
            <span>{guide.title}</span>
            <Link href={siteToolPath(tool.id)} className="text-primary hover:underline">
              {tool.title} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GuidesPage() {
  return (
    <div className="space-y-9">
      <div className="grid items-end gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <PageHeader title="Comprendre Fourmizzz" kicker={`Guides · ${String(GUIDES.length)} guides`}>
          Les règles du jeu expliquées une par une, avec des exemples chiffrés sur une alliance inventée. Écrits pour un
          joueur qui connaît les bases et veut savoir pourquoi les choses se passent comme elles se passent.
        </PageHeader>
        <CertaintyLegend />
      </div>

      {GUIDE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`guides-${group.id}`} className="space-y-3.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id={`guides-${group.id}`} className="font-heading text-3xl leading-none font-bold uppercase">
              {group.title}
            </h2>
            <span className="text-sm text-muted-foreground">{group.description}</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.filter((guide) => guide.group === group.id).map((guide) => (
              <GuideCard key={guide.id} guide={guide} number={GUIDES.indexOf(guide) + 1} />
            ))}
          </ul>
        </section>
      ))}

      <GuidesToTools />
      <AdSlot />
    </div>
  );
}
