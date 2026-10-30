"use client";

import { Menu } from "@base-ui/react/menu";
import { SERVERS, serverById } from "@optizzz/game/servers";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { ChevronDownIcon } from "~/components/icons";

const STORAGE_KEY = "optizzz-server";

function readRemembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const noSubscription = () => () => undefined;

/** The server of the page (« /s5/… »), else the last one visited in this browser. */
export function useCurrentServer() {
  const pathname = usePathname();
  const fromPath = serverById(pathname.split("/")[1] ?? "");
  const remembered = useSyncExternalStore(noSubscription, readRemembered, () => null);
  useEffect(() => {
    if (!fromPath) return;
    try {
      localStorage.setItem(STORAGE_KEY, fromPath.id);
    } catch {
      // Private browsing: nothing remembered.
    }
  }, [fromPath]);
  return { server: fromPath ?? serverById(remembered ?? ""), onServerPage: !!fromPath, pathname };
}

/** « Serveur S5 ▾ »: the same page on another server, or that server's overview. */
export function ServerPicker() {
  const { server, onServerPage, pathname } = useCurrentServer();
  const rest = onServerPage ? pathname.split("/").slice(2, 3).join("/") : "";
  // The same section on another server (players, alliances, map); a player or an alliance sheet has no twin.
  const hrefOn = (id: string) => (rest ? `/${id}/${rest}` : `/${id}`);
  return (
    <Menu.Root>
      <Menu.Trigger
        className={`flex shrink-0 items-center gap-2 px-3 hover:bg-accent data-popup-open:bg-accent ${onServerPage ? "bg-accent" : ""}`}
        aria-label={server ? `Serveur ${server.name}, changer de serveur` : "Choisir un serveur"}
      >
        <span className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">Serveur</span>
        <span className="font-heading text-xl font-bold text-primary">{server?.name ?? "—"}</span>
        <ChevronDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start" className="z-50 outline-hidden">
          <Menu.Popup className="min-w-40 border bg-popover py-1 text-popover-foreground shadow-lg outline-hidden">
            {SERVERS.map((each) => (
              <Menu.LinkItem
                key={each.id}
                render={<Link href={hrefOn(each.id)} />}
                closeOnClick
                aria-current={each.id === server?.id ? "true" : undefined}
                className="flex items-center justify-between gap-6 px-3 py-2 text-sm outline-hidden data-highlighted:bg-accent"
              >
                <span className="font-heading text-lg font-bold">{each.name}</span>
                {each.id === server?.id && <span className="text-xs text-muted-foreground">actuel</span>}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
