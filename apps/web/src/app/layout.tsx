import "~/styles/globals.css";

import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteFooter, SiteHeader } from "~/components/site-header";
import Script from "next/script";
import { ADS_CONSENT_SCRIPT } from "~/lib/ads";
import { adsConfig } from "~/lib/ads-config";
import { THEME_SCRIPT } from "~/lib/theme";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: { default: "Optizzz", template: "%s · Optizzz" },
  description:
    "Le compagnon de Fourmizzz : coordonner son alliance, calculer combats, chasses et floods, suivre les joueurs et les alliances de chaque serveur.",
  metadataBase: new URL("https://optizzz.fr"),
};

// Direction « Campagne » (docs/features/site-refonte.md): condensed titles, Plex for the text and the figures.
const heading = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-heading" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono" });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ads = adsConfig();
  return (
    // The extension marks <html> on /connect-extension (data-optizzz-link), and the theme script sets data-theme
    // before React: not hydration mismatches.
    <html lang="fr" className={`${heading.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* A constant of ours, no outside text: it must run before the first paint, which next/script cannot promise. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {ads && (
          <>
            {/* The same: consent denied before AdSense's script reads it (docs/features/site-publicite.md). */}
            {/* eslint-disable-next-line no-restricted-syntax */}
            <script dangerouslySetInnerHTML={{ __html: ADS_CONSENT_SCRIPT }} />
            <Script
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`}
              strategy="afterInteractive"
              crossOrigin="anonymous"
            />
          </>
        )}
      </head>
      <body className="min-h-screen overflow-x-clip">
        <TRPCReactProvider>
          <SiteHeader />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
          <SiteFooter />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
