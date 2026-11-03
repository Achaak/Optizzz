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
export function SectionNav({
  label,
  links,
  stamped,
}: {
  label: string;
  links: SectionLink[];
  /** The label as a stamp: a part of the site apart from the rest (the back office). */
  stamped?: boolean;
}) {
  const pathname = usePathname();
  // The longest match wins: « /s5/players/7 » is under « Joueurs », not « Vue d'ensemble ».
  const current = links
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav aria-label={label} className="relative left-1/2 -mt-6 mb-6 w-screen -translate-x-1/2">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2.5">
        {stamped ? (
          <span className="mr-3 inline-flex shrink-0 -rotate-2 items-center gap-1 rounded-[3px] border-[3px] border-double border-primary px-1.5 font-heading text-sm font-bold tracking-wider text-primary uppercase">
            <svg
              width={11}
              height={11}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.8}
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />
            </svg>
            {label}
          </span>
        ) : (
          <SmallLabel className="mr-3 hidden shrink-0 sm:block">{label}</SmallLabel>
        )}
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
