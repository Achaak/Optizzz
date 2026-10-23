import { siteToolPath } from "@optizzz/game/site-links/site";
import { SERVERS } from "@optizzz/game/servers";
import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "~/components/tools/tool-list";
import { Badge } from "~/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const metadata: Metadata = {
  title: "Outils",
  description:
    "Les outils d'Optizzz pour Fourmizzz : temps de trajet, coûts, simulateurs de combat, de chasse et de flood, carte des serveurs.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      <section className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Outils</h1>
        <p className="text-muted-foreground">
          Calculer sans quitter le navigateur, et partager le résultat par un lien : ce que vous saisissez reste dans
          l&apos;adresse de la page, jamais envoyé au site.
        </p>
      </section>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <li key={tool.id}>
            {tool.ready ? (
              <Link href={siteToolPath(tool.id)} className="block h-full rounded-xl focus-visible:outline-2">
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ) : (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {tool.title}
                    <Badge variant="outline">Bientôt</Badge>
                  </CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            )}
          </li>
        ))}
        <li>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Carte du serveur</CardTitle>
              <CardDescription>
                Situer des joueurs et des alliances sur tout un serveur, avec distances et trajets. Choisissez le
                serveur :
              </CardDescription>
              <nav aria-label="Carte du serveur" className="flex flex-wrap gap-1 pt-1 text-sm">
                {SERVERS.map((server) => (
                  <Link
                    key={server.id}
                    href={`/${server.id}/map`}
                    className="rounded-md border px-2 py-1 hover:bg-muted"
                  >
                    {server.name}
                  </Link>
                ))}
              </nav>
            </CardHeader>
          </Card>
        </li>
      </ul>
    </div>
  );
}
