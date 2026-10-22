import type { Metadata } from "next";
import { ServerMap } from "~/components/map/server-map";
import { serverOfPath } from "~/lib/game-server";

interface Props {
  params: Promise<{ server: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const server = serverOfPath((await params).server, "/carte");
  return {
    title: `Carte de ${server.name}`,
    description: `Situer les joueurs et les alliances du serveur ${server.name} de Fourmizzz, avec distances et trajets.`,
  };
}

// The map loads its players itself (/api/[server]/carte): the page holds no data.
export default async function MapPage({ params }: Props) {
  const server = serverOfPath((await params).server, "/carte");
  return <ServerMap server={{ id: server.id, name: server.name }} />;
}
