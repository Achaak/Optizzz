// The AdSense account, from the environment (src/env.js); what it does: src/lib/ads.ts.
import { env } from "~/env";

export interface AdsConfig {
  /** « ca-pub-1234567890123456 ». */
  client: string;
  /** The responsive display unit every slot uses. */
  slot: string;
}

/** The AdSense account, when both settings are there; null shows no ad and loads no Google script. */
export function adsConfig(): AdsConfig | null {
  const client = env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = env.NEXT_PUBLIC_ADSENSE_SLOT;
  return client && slot ? { client, slot } : null;
}
