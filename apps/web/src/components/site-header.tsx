import { SERVERS } from "@optizzz/game/servers";
import Image from "next/image";
import Link from "next/link";
import { SearchBox } from "~/components/search-box";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src="/logo.svg" alt="" width={28} height={28} />
          Optizzz
        </Link>
        <nav aria-label="Serveurs" className="flex gap-1 text-sm">
          {SERVERS.map((server) => (
            <Link key={server.id} href={`/${server.id}`} className="rounded-md px-2 py-1 hover:bg-muted">
              {server.name}
            </Link>
          ))}
        </nav>
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <span>Données : export public de Fourmizzz, relu chaque heure.</span>
        <Link href="/mentions-legales" className="hover:text-foreground">
          Mentions légales
        </Link>
        <Link href="/confidentialite" className="hover:text-foreground">
          Confidentialité
        </Link>
        <a href="https://github.com/Achaak/Optizzz" className="hover:text-foreground">
          Code source
        </a>
      </div>
    </footer>
  );
}
