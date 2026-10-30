"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SectionLink {
  href: string;
  label: string;
}

/**
 * The bar under the header: the server's pages, or the tools. Full width whatever the page's container, the current
 * page underlined.
 */
export function SectionNav({ label, links }: { label: string; links: SectionLink[] }) {
  const pathname = usePathname();
  // The longest match wins: « /s5/players/7 » is under « Joueurs », not « Vue d'ensemble ».
  const current = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="relative left-1/2 -mt-8 mb-8 w-screen -translate-x-1/2 border-b bg-card">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
        {links.map((link) => {
          const active = link === current;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "shrink-0 px-3 py-2.5 text-sm font-semibold shadow-[inset_0_-3px_0_var(--primary)]"
                  : "shrink-0 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
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
