// Ads without tracking (docs/features/site-publicite.md): Google AdSense, told before its script loads that nobody
// consented to advertising cookies nor to personalisation, so it serves limited, non-personalised ads. No consent
// banner then: the site asks for nothing it would need consent for. Its settings: src/lib/ads-config.ts.

/**
 * Run in <head> before AdSense's script (src/app/layout.tsx): Google's consent mode, everything advertising denied
 * for good (no banner will ever grant it), and non-personalised ads asked for in AdSense's own words too.
 */
export const ADS_CONSENT_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied"});(window.adsbygoogle=window.adsbygoogle||[]).requestNonPersonalizedAds=1;`;

/** The line of ads.txt that says the account may sell this site's slots. */
export const adsTxt = (client: string) => `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`;
