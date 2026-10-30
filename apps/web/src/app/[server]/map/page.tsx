import type { Metadata } from "next";
import { ServerMap } from "~/components/map/server-map";
import { PageHeader } from "~/components/panel";
import { serverOfPath } from "~/lib/game-server";

interface Props {
  params: Promise<{ server: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/map");
  return {
    title: `Carte de ${server.name}`,
    description: `Situer les joueurs et les alliances du serveur ${server.name} de Fourmizzz, avec distances et trajets.`,
  };
}

// The map loads its players itself (/api/[server]/map): the page holds no data.
export default async function MapPage({ params }: Props) {
  const server = serverOfPath((await params).server, "/map");
  return (
    <div className="space-y-6">
      <PageHeader kicker={`Serveur ${server.name}`} title={`Carte de ${server.name}`}>
        Situez joueurs et alliances ; choisissez un joueur pour voir distances et trajets depuis lui.
      </PageHeader>
      <ServerMap server={{ id: server.id, name: server.name }} />
    </div>
  );
}
