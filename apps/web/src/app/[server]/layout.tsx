import { SERVERS, serverById } from "@optizzz/game/servers";
import { notFound } from "next/navigation";
import { SectionNav } from "~/components/section-nav";

export function generateStaticParams() {
  return SERVERS.map((server) => ({ server: server.id }));
}

export default async function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ server: string }>;
}) {
  // Each page sends « /S5/… » to « /s5/… » with the rest of its path.
  const server = serverById((await params).server);
  if (!server) notFound();
  const links = [
    { href: `/${server.id}`, label: "Vue d'ensemble" },
    { href: `/${server.id}/players`, label: "Joueurs" },
    { href: `/${server.id}/alliances`, label: "Alliances" },
    { href: `/${server.id}/map`, label: "Carte" },
  ];
  return (
    <>
      <SectionNav label={`Serveur ${server.name}`} links={links} />
      {children}
    </>
  );
}
