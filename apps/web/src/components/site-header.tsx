import Image from "next/image";
import Link from "next/link";
import { AccountLink } from "~/components/account-link";
import { MainNav, MobileMenu } from "~/components/main-nav";
import { SearchBox } from "~/components/search-box";
import { ServerPicker } from "~/components/server-picker";
import { ThemeToggle } from "~/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-stretch px-4">
        <Link
          href="/"
          className="mr-1 flex shrink-0 items-center gap-2.5 border-r pr-4 font-heading text-2xl font-bold tracking-wider uppercase"
        >
          <Image src="/logo.svg" alt="" width={28} height={28} />
          <span className="hidden sm:inline">Optizzz</span>
          <span className="sr-only sm:hidden">Optizzz, accueil</span>
        </Link>
        <ServerPicker />
        <MainNav />
        <div className="flex-1" />
        <div className="mr-2 hidden w-60 items-center md:flex">
          <SearchBox />
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AccountLink />
          <MobileMenu />
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-6 gap-y-2 px-4 py-6 font-mono text-xs text-muted-foreground">
        <span>Données : export public de Fourmizzz, relu chaque heure</span>
        <Link href="/legal" className="hover:text-foreground">
          Mentions légales
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Confidentialité
        </Link>
        <a href="https://github.com/Achaak/Optizzz" className="hover:text-foreground">
          Code source
        </a>
      </div>
    </footer>
  );
}
