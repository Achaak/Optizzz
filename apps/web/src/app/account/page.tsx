import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { shortDate } from "~/lib/short-date";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { SpaceKeysProvider } from "~/components/spaces/space-keys";
import { adminMemberships } from "~/server/spaces/prisma-store";
import { DeleteAccount, RemoveExtensionButton, SignOutButtons } from "./account-actions";
import { PassphraseSettings } from "./passphrase-settings";
import { ResumeAfterLogin } from "./resume-after-login";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function AccountPage() {
  // The header's session query extends the session; this read leaves it be (a page cannot set cookies).
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) redirect("/login");
  const now = new Date();
  const [players, extensions, adminOf] = await Promise.all([
    db.declaredPlayer.findMany({
      where: { userId: session.user.id },
      orderBy: [{ server: "asc" }, { pseudo: "asc" }],
    }),
    db.extensionToken.findMany({
      where: { userId: session.user.id },
      select: { id: true, browser: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    adminMemberships(db, session.user.id),
  ]);
  // « J'ai oublié ma phrase » warns the sole Admin of a space: nobody could send them their access again.
  const soleAdminOf = adminOf.filter((m) => m.admins === 1).map((m) => m.spaceName);

  return (
    <div className="max-w-2xl space-y-8">
      <ResumeAfterLogin />
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
        <h2 className="text-base font-semibold">Espaces d&apos;alliance</h2>
        <p className="text-sm text-muted-foreground">
          Mettez vos données en commun avec votre alliance, sans que personne d&apos;autre puisse les lire.{" "}
          <Link href="/spaces" className="font-medium text-foreground underline underline-offset-4">
            Mes espaces
          </Link>
        </p>
      </section>

      <section id="phrase" className="scroll-mt-8 space-y-3">
        <div>
          <h2 className="text-base font-semibold">Phrase secrète de votre compte</h2>
          <p className="text-xs text-muted-foreground">Phrase de chiffrement</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Elle protège votre accès aux Espaces d&apos;alliance. Optizzz ne la connaît pas et ne peut pas la retrouver.
        </p>
        <SpaceKeysProvider userId={session.user.id} email={session.user.email}>
          <PassphraseSettings soleAdminOf={soleAdminOf} />
        </SpaceKeysProvider>
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
          Votre e-mail, vos connexions, vos extensions liées, vos Joueurs, votre place dans vos espaces et votre phrase
          secrète sont effacés tout de suite, sans retour possible. Un espace où vous êtes seul part avec le compte ; le
          dernier Admin d&apos;un espace qui a d&apos;autres membres doit d&apos;abord nommer un autre Admin.
        </p>
        <DeleteAccount email={session.user.email} />
      </section>
    </div>
  );
}
