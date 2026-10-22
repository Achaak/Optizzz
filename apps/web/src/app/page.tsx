import { formatNumber } from "@optizzz/game/format/number-format";
import { SERVERS } from "@optizzz/game/servers";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { playersPerServer } from "~/server/queries";

// Rebuilt by the cron once the exports are stored (api/revalidate), at worst every hour.
export const revalidate = 3600;

export default async function Home() {
  const players = await playersPerServer();
  return (
    <div className="space-y-8">
      <section className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Optizzz</h1>
        <p className="text-muted-foreground">
          Les joueurs et les alliances de chaque serveur de Fourmizzz, leur évolution jour après jour et ce qui a changé
          : alliances quittées, colonisations, guerres et pactes. D&apos;après l&apos;export public du jeu, relu chaque
          heure.
        </p>
      </section>
      <section aria-label="Serveurs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SERVERS.map((server) => (
          <Link key={server.id} href={`/${server.id}`} className="rounded-xl focus-visible:outline-2">
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle>{server.name}</CardTitle>
                <CardDescription>
                  {players.has(server.id) ? `${formatNumber(players.get(server.id) ?? 0)} joueurs` : "Pas encore relu"}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
