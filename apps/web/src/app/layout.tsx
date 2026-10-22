import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SiteFooter, SiteHeader } from "~/components/site-header";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: { default: "Optizzz", template: "%s · Optizzz" },
  description: "Les joueurs, les alliances et leur évolution sur chaque serveur de Fourmizzz.",
  metadataBase: new URL("https://optizzz.fr"),
};

// shadcn reads the font from --font-sans.
const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={geist.variable}>
      <body className="min-h-screen">
        <TRPCReactProvider>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <SiteFooter />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
