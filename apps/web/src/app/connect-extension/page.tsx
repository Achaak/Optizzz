import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "~/server/auth";
import { LinkStatus } from "./link-status";

export const metadata: Metadata = { title: "Connecter l'extension", robots: { index: false } };

// The extension's script on this page asks the site for a token, in its own isolated world: the page never holds it.
// See docs/features/site-comptes-espaces.md, « Joueurs et extension ».
export default async function ConnectExtensionPage() {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h1>Connecter l&apos;extension</h1>
        <p className="text-sm text-muted-foreground">
          Liée à votre Compte Optizzz, l&apos;extension pourra y rattacher vos Joueurs, sur votre clic. Sans compte lié,
          elle n&apos;envoie rien.
        </p>
      </div>
      {session ? (
        <LinkStatus email={session.user.email} />
      ) : (
        <div className="space-y-3 border bg-card p-4 text-sm">
          <p>Connectez-vous d&apos;abord à votre Compte Optizzz, sur ce navigateur.</p>
          <p className="text-muted-foreground">
            Une fois connecté, cliquez de nouveau «&nbsp;Connecter mon Compte Optizzz&nbsp;» dans l&apos;extension.
          </p>
          <Link href="/login" className="inline-block font-medium underline underline-offset-4">
            Se connecter
          </Link>
        </div>
      )}
    </div>
  );
}
