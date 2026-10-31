// The AdSense account, from the environment (src/env.js); what it does: src/lib/ads.ts.
import { env } from "~/env";

/**
 * The AdSense account (« ca-pub-1234567890123456 »), enough for Google to check the site (script, meta, ads.txt);
 * null loads no Google script. The slots also need the unit (NEXT_PUBLIC_ADSENSE_SLOT, src/components/ad-slot.tsx).
 */
export function adsClient(): string | null {
  return env.NEXT_PUBLIC_ADSENSE_CLIENT ?? null;
}
