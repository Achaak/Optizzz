import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { DeleteAccount, SignOutButtons } from "./account-actions";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function AccountPage() {
  // The header's session query extends the session; this read leaves it be (a page cannot set cookies).
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) redirect("/login");
  const now = new Date();

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">
          Compte Optizzz créé {formatPastTime(session.user.createdAt, now)}.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Adresse e-mail</h2>
        <p className="text-sm break-all">{session.user.email}</p>
        <p className="text-sm text-muted-foreground">Vos liens de connexion arrivent à cette adresse.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Connexion</h2>
        <p className="text-sm text-muted-foreground">
          Sur ce navigateur, vous restez connecté jusqu&apos;à {formatEndTime(session.session.expiresAt, now)}, et 30
          jours de plus à chaque visite.
        </p>
        <SignOutButtons />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Supprimer le compte</h2>
        <p className="text-sm text-muted-foreground">
          Votre e-mail et vos connexions sont effacés tout de suite, sans retour possible.
        </p>
        <DeleteAccount email={session.user.email} />
      </section>
    </div>
  );
}
