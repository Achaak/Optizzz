import { SERVERS, serverById } from "@optizzz/game/servers";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    { href: `/${server.id}/joueurs`, label: "Joueurs" },
    { href: `/${server.id}/alliances`, label: "Alliances" },
  ];
  return (
    <div className="space-y-6">
      <nav
        aria-label={`Serveur ${server.name}`}
        className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b pb-3"
      >
        <span className="text-2xl font-semibold tracking-tight">{server.name}</span>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
