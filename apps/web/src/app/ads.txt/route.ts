import { adsTxt } from "~/lib/ads";
import { adsConfig } from "~/lib/ads-config";

// Who may sell the site's ad slots (IAB ads.txt), required by AdSense; none without an account.
export function GET() {
  const ads = adsConfig();
  if (!ads) return new Response("Not found\n", { status: 404 });
  return new Response(adsTxt(ads.client), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
