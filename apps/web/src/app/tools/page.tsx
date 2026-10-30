import { siteToolPath } from "@optizzz/game/site-links/site";
import { SERVERS } from "@optizzz/game/servers";
import type { Metadata } from "next";
import Link from "next/link";
import { MonoLabel, PageHeader, PanelLink } from "~/components/panel";
import { TOOLS } from "~/components/tools/tool-list";

export const metadata: Metadata = {
  title: "Outils",
  description:
    "Les outils d'Optizzz pour Fourmizzz : temps de trajet, coûts, simulateurs de combat, de chasse et de flood, carte des serveurs.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Outils">
        Calculer sans quitter le navigateur, et partager le résultat par un lien : ce que vous saisissez reste dans
        l&apos;adresse de la page, jamais envoyé au site.
      </PageHeader>
      <ul className="grid border-t border-l bg-card sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool, index) => (
          <li key={tool.id} className="flex flex-col gap-2 border-r border-b p-5">
            <MonoLabel className="text-primary">{String(index + 1).padStart(2, "0")}</MonoLabel>
            <h2 className="font-heading text-2xl font-bold uppercase">
              {tool.ready ? (
                <Link href={siteToolPath(tool.id)} className="hover:text-primary">
                  {tool.title}
                </Link>
              ) : (
                tool.title
              )}
            </h2>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
            <div className="mt-auto pt-2">
              {tool.ready ? <PanelLink href={siteToolPath(tool.id)}>Ouvrir</PanelLink> : <MonoLabel>Bientôt</MonoLabel>}
            </div>
          </li>
        ))}
        <li className="flex flex-col gap-2 border-r border-b p-5">
          <MonoLabel className="text-primary">{String(TOOLS.length + 1).padStart(2, "0")}</MonoLabel>
          <h2 className="font-heading text-2xl font-bold uppercase">Carte du serveur</h2>
          <p className="text-sm text-muted-foreground">
            Situer des joueurs et des alliances sur tout un serveur, avec distances et trajets.
          </p>
          <nav aria-label="Carte du serveur" className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {SERVERS.map((server) => (
              <Link
                key={server.id}
                href={`/${server.id}/map`}
                className="border px-2.5 py-1 font-heading text-lg font-bold hover:bg-accent"
              >
                {server.name}
              </Link>
            ))}
          </nav>
        </li>
      </ul>
    </div>
  );
}
