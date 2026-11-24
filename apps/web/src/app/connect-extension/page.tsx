import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader } from "~/components/panel";
import { auth } from "~/server/auth";
import { LinkStatus } from "./link-status";

export const metadata: Metadata = { title: "Connecter l'extension", robots: { index: false } };

// The extension's script on this page asks the site for a token, in its own isolated world: the page never holds it.
// See docs/features/site-comptes-espaces.md, « Joueurs et extension ».
export default async function ConnectExtensionPage() {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader kicker="Compte Optizzz" title="Connecter l'extension">
        Liée à votre Compte Optizzz, l&apos;extension pourra y rattacher vos Joueurs, sur votre clic. Sans compte lié,
        elle n&apos;envoie rien.
      </PageHeader>
      {session ? (
        <LinkStatus email={session.user.email} />
      ) : (
        <div className="space-y-3 rounded-[0.875rem] bg-card p-4.5 text-sm shadow-panel">
          <p>Connectez-vous d&apos;abord à votre Compte Optizzz, sur ce navigateur.</p>
          <p className="text-muted-foreground">
            Sans compte, le lien reçu par e-mail en crée un. Ouvrez-le sur ce navigateur dans les 30 minutes&nbsp;: vous
            reviendrez ici et l&apos;extension sera liée d&apos;elle-même.
          </p>
          <Link href="/login?next=/connect-extension" className="inline-block font-medium underline underline-offset-4">
            Se connecter
          </Link>
        </div>
      )}
    </div>
  );
}
