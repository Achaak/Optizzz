"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MonoLabel } from "~/components/panel";
import { env } from "~/env";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const client = env.NEXT_PUBLIC_ADSENSE_CLIENT;
const slot = env.NEXT_PUBLIC_ADSENSE_SLOT;

/** One AdSense unit, filled once mounted; a new one for each page, since the site changes pages without reloading. */
function Unit() {
  useEffect(() => {
    try {
      (window.adsbygoogle ??= []).push({});
    } catch {
      // A blocker, or AdSense refused the slot: the frame stays empty.
    }
  }, []);
  return (
    <ins
      className="adsbygoogle block min-h-[90px]"
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

/**
 * A place for an ad on a public page, said to be one (« Publicité »), its height kept so the page does not jump.
 * Nothing at all without an AdSense account (src/lib/ads.ts): dev and previews stay clean.
 */
export function AdSlot({ className }: { className?: string }) {
  const pathname = usePathname();
  if (!client || !slot) return null;
  return (
    <aside aria-label="Publicité" className={className}>
      <MonoLabel className="mb-1 block">Publicité</MonoLabel>
      <Unit key={pathname} />
    </aside>
  );
}
