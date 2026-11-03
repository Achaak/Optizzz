"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SmallLabel } from "~/components/panel";

export interface SectionLink {
  href: string;
  label: string;
}

/**
 * The bar under the header: the server's pages, or the tools. Full width whatever the page's container, the current
 * page in a pill.
 */
export function SectionNav({ label, links }: { label: string; links: SectionLink[] }) {
  const pathname = usePathname();
  // The longest match wins: « /s5/players/7 » is under « Joueurs », not « Vue d'ensemble ».
  const current = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="relative left-1/2 -mt-6 mb-6 w-screen -translate-x-1/2">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2.5">
        <SmallLabel className="mr-3 hidden shrink-0 sm:block">{label}</SmallLabel>
        {links.map((link) => {
          const active = link === current;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "shrink-0 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold"
                  : "shrink-0 rounded-full px-3.5 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
