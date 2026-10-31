import { adsTxt } from "~/lib/ads";
import { adsClient } from "~/lib/ads-config";

// Who may sell the site's ad slots (IAB ads.txt), required by AdSense; none without an account.
export function GET() {
  const client = adsClient();
  if (!client) return new Response("Not found\n", { status: 404 });
  return new Response(adsTxt(client), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
