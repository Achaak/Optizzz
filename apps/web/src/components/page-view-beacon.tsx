"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// The page views counter (docs/features/site-audience.md): tells the site which page is shown, on each navigation. The
// path only: never the query nor what follows the « # » (a tool's inputs), and no cookie.
export function PageViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/view", { method: "POST", body: pathname, credentials: "omit", keepalive: true }).catch(() => {
      // A blocked or failed count changes nothing for the visitor.
    });
  }, [pathname]);
  return null;
}
