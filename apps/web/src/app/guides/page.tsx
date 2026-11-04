import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { PageHeader, PanelLink, SmallLabel } from "~/components/panel";
import { GUIDES, guidePath } from "~/lib/guides/guides";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Comprendre Fourmizzz avec les outils d'Optizzz : la chaîne de TDC, le flood, le timing d'une attaque. Ce qui n'est pas vérifié dans le jeu est dit comme tel.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Guides">
        Le jeu expliqué avec les outils d&apos;Optizzz, pour un nouveau membre d&apos;alliance comme pour un ancien.
        Chaque règle dit si elle est vérifiée dans le jeu.
      </PageHeader>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((guide, index) => (
          <li
            key={guide.id}
            className={`flex flex-col gap-2 rounded-[0.875rem] bg-card p-5 shadow-panel ${guide.ready ? "lift" : ""}`}
          >
            <SmallLabel className="text-primary">{String(index + 1).padStart(2, "0")}</SmallLabel>
            <h2 className="font-heading text-2xl font-bold uppercase">
              {guide.ready ? (
                <Link href={guidePath(guide.id)} className="hover:text-primary">
                  {guide.title}
                </Link>
              ) : (
                guide.title
              )}
            </h2>
            <p className="text-sm text-muted-foreground">{guide.description}</p>
            <div className="mt-auto pt-2">
              {guide.ready ? <PanelLink href={guidePath(guide.id)}>Lire</PanelLink> : <SmallLabel>Bientôt</SmallLabel>}
            </div>
          </li>
        ))}
      </ul>
      <AdSlot />
    </div>
  );
}
