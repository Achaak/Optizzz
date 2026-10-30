"use client";

import { Menu } from "@base-ui/react/menu";
import { SERVERS } from "@optizzz/game/servers";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "~/components/icons";

const MAIN_LINKS = [
  { href: "/tools", label: "Outils" },
  { href: "/spaces", label: "Espaces" },
];

const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Outils and Espaces, beside the server picker. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Site" className="hidden items-stretch md:flex">
      {MAIN_LINKS.map((link) => {
        const active = isUnder(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center px-3 font-heading text-lg font-semibold tracking-wider uppercase hover:bg-accent ${active ? "bg-accent shadow-[inset_0_-3px_0_var(--primary)]" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

const itemClass = "flex px-4 py-2.5 text-sm outline-hidden data-highlighted:bg-accent";

/** On a phone: the same links, and the servers, behind one button. */
export function MobileMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Menu"
        className="grid size-11 shrink-0 place-items-center hover:bg-accent data-popup-open:bg-accent md:hidden"
      >
        <MenuIcon width={20} height={20} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end" className="z-50 outline-hidden">
          <Menu.Popup className="min-w-56 border bg-popover py-1 text-popover-foreground shadow-lg outline-hidden">
            {MAIN_LINKS.map((link) => (
              <Menu.LinkItem key={link.href} render={<Link href={link.href} />} closeOnClick className={itemClass}>
                <span className="font-heading text-lg font-semibold tracking-wider uppercase">{link.label}</span>
              </Menu.LinkItem>
            ))}
            <Menu.Separator className="my-1 h-px bg-border" />
            <div className="px-4 pt-1 pb-0.5 font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
              Serveurs
            </div>
            {SERVERS.map((server) => (
              <Menu.LinkItem
                key={server.id}
                render={<Link href={`/${server.id}`} />}
                closeOnClick
                className={itemClass}
              >
                {server.name}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
