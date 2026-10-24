import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { shortDate } from "~/lib/short-date";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { DeleteAccount, RemoveExtensionButton, SignOutButtons } from "./account-actions";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function AccountPage() {
  // The header's session query extends the session; this read leaves it be (a page cannot set cookies).
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) redirect("/login");
  const now = new Date();
  const [players, extensions] = await Promise.all([
    db.declaredPlayer.findMany({
      where: { userId: session.user.id },
      orderBy: [{ server: "asc" }, { pseudo: "asc" }],
    }),
    db.extensionToken.findMany({
      where: { userId: session.user.id },
      select: { id: true, browser: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

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
        <h2 className="text-base font-semibold">Joueurs</h2>
        {players.length > 0 ? (
          <ul className="divide-y rounded-xl text-sm ring-1 ring-foreground/10">
            {players.map((player) => (
              <li key={`${player.server}:${String(player.playerId)}`} className="px-4 py-3">
                <Link
                  href={`/${player.server}/players/${String(player.playerId)}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {player.pseudo} ({serverById(player.server)?.name ?? player.server})
                </Link>
                <span className="text-muted-foreground">
                  , déclaré par l&apos;extension le {shortDate(player.declaredAt, now)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun Joueur rattaché.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Un Joueur se rattache depuis l&apos;extension liée, qui vous le propose quand vous jouez&nbsp;: un pseudo par
          serveur, et un seul Compte Optizzz par Joueur.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Extensions liées</h2>
        {extensions.length > 0 ? (
          <ul className="divide-y rounded-xl text-sm ring-1 ring-foreground/10">
            {extensions.map((extension) => (
              <li key={extension.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {extension.browser}, lié le {shortDate(extension.createdAt, now)}
                </span>
                <RemoveExtensionButton id={extension.id} browser={extension.browser} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune extension liée.</p>
        )}
        <p className="text-sm text-muted-foreground">
          Pour lier l&apos;extension Optizzz d&apos;un navigateur, cliquez «&nbsp;Connecter mon Compte Optizzz&nbsp;»
          dans ses paramètres («&nbsp;Fonctionnalités&nbsp;»). Retirer une extension la déconnecte aussitôt.
        </p>
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
          Votre e-mail, vos connexions, vos extensions liées et vos Joueurs sont effacés tout de suite, sans retour
          possible.
        </p>
        <DeleteAccount email={session.user.email} />
      </section>
    </div>
  );
}
