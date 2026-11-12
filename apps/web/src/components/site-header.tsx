import Image from "next/image";
import Link from "next/link";
import { AccountLink } from "~/components/account-link";
import { MainNav, MobileMenu } from "~/components/main-nav";
import { SearchBox } from "~/components/search-box";
import { ServerPicker } from "~/components/server-picker";
import { ThemeToggle } from "~/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="relative z-10 bg-card shadow-panel">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-2 sm:px-4">
        <Link
          href="/"
          className="mr-1 flex shrink-0 items-center gap-2.5 pr-2 font-heading text-2xl font-bold tracking-wider uppercase sm:pr-3"
        >
          <Image src="/logo.svg" alt="" width={28} height={28} />
          <span className="hidden sm:inline">Optizzz</span>
          <span className="sr-only sm:hidden">Optizzz, accueil</span>
        </Link>
        <ServerPicker />
        <MainNav />
        <div className="flex-1" />
        <div className="mr-1 hidden w-60 items-center md:flex">
          <SearchBox />
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
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
    <footer className="mt-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3.5 px-4 pt-2 pb-6 text-[0.8125rem] text-muted-foreground">
        {/* The logo's three dots, as an ending. */}
        <svg width={96} height={10} viewBox="0 0 96 10" aria-hidden="true">
          <circle cx={30} cy={5} r={2.6} fill="var(--dot)" />
          <circle cx={44} cy={5} r={1.8} fill="var(--dot)" />
          <circle cx={58} cy={5} r={3.2} fill="var(--primary)" />
        </svg>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <span>Données : export public de Fourmizzz, relu chaque heure</span>
          <Link href="/about" className="hover:text-foreground">
            À propos
          </Link>
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
      </div>
    </footer>
  );
}
