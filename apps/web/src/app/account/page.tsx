import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockIcon } from "~/components/icons";
import { MonoLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
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
    <div className="space-y-6">
      <ResumeAfterLogin />
      <PageHeader title="Votre compte" kicker="Compte Optizzz">
        Connecté avec <span className="break-all text-foreground">{session.user.email}</span> par lien magique, compte
        créé {formatPastTime(session.user.createdAt, now)}. Optizzz ne garde aucun mot de passe.
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel flush title="Vos joueurs" aside={<span className="text-xs text-muted-foreground">un par serveur</span>}>
          {players.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Serveur</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead className="pr-4 text-right">Rattaché le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={`${player.server}:${String(player.playerId)}`}>
                    <TableCell className="pl-4 font-mono">{serverById(player.server)?.name ?? player.server}</TableCell>
                    <TableCell>
                      <Link
                        href={`/${player.server}/players/${String(player.playerId)}`}
                        className="font-semibold hover:underline"
                      >
                        {player.pseudo}
                      </Link>
                    </TableCell>
                    <TableCell className="pr-4 text-right font-mono">{shortDate(player.declaredAt, now)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Aucun Joueur rattaché.</p>
          )}
          <p className="border-t px-4 py-3 text-sm text-muted-foreground">
            Un Joueur se rattache depuis l&apos;extension liée, qui vous le propose quand vous jouez&nbsp;: un pseudo
            par serveur, et un seul Compte Optizzz par Joueur.
          </p>
        </Panel>

        <Panel flush title="Extensions liées">
          {extensions.length > 0 ? (
            <ul className="divide-y text-sm">
              {extensions.map((extension) => (
                <li key={extension.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span className="flex items-baseline gap-2">
                    <MonoLabel className="text-primary">● Liée</MonoLabel>
                    {extension.browser}, le {shortDate(extension.createdAt, now)}
                  </span>
                  <RemoveExtensionButton id={extension.id} browser={extension.browser} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Aucune extension liée.</p>
          )}
          <p className="border-t px-4 py-3 text-sm text-muted-foreground">
            Pour lier l&apos;extension Optizzz d&apos;un navigateur, cliquez «&nbsp;Connecter mon Compte Optizzz&nbsp;»
            dans ses paramètres («&nbsp;Fonctionnalités&nbsp;»). Retirer une extension la déconnecte aussitôt.
          </p>
        </Panel>

        <section id="phrase" className="scroll-mt-8">
          <Panel
            title="Chiffrement"
            aside={
              <MonoLabel className="inline-flex items-center gap-1.5">
                <LockIcon width={12} height={12} />
                Phrase de chiffrement
              </MonoLabel>
            }
          >
            <div className="space-y-3 text-sm">
              <p>
                Votre <strong>phrase secrète</strong> protège votre accès aux Espaces d&apos;alliance. Optizzz ne la
                connaît pas et ne peut pas la retrouver.
              </p>
              <SpaceKeysProvider userId={session.user.id} email={session.user.email}>
                <PassphraseSettings soleAdminOf={soleAdminOf} />
              </SpaceKeysProvider>
            </div>
          </Panel>
        </section>

        <div className="space-y-6">
          <Panel title="Espaces d'alliance" aside={<PanelLink href="/spaces">Mes espaces</PanelLink>}>
            <p className="text-sm text-muted-foreground">
              Mettez vos données en commun avec votre alliance, sans que personne d&apos;autre puisse les lire.
            </p>
          </Panel>
          <Panel title="Connexion">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Sur ce navigateur, vous restez connecté jusqu&apos;à {formatEndTime(session.session.expiresAt, now)}, et
                30 jours de plus à chaque visite.
              </p>
              <SignOutButtons />
            </div>
          </Panel>
        </div>
      </div>

      <section className="space-y-3 border border-warning-border bg-warning-soft p-4">
        <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Supprimer le compte</h2>
        <p className="text-sm">
          Votre e-mail, vos connexions, vos extensions liées, vos Joueurs, votre place dans vos espaces et votre phrase
          secrète sont effacés tout de suite, sans retour possible. Un espace où vous êtes seul part avec le compte ; le
          dernier Admin d&apos;un espace qui a d&apos;autres membres doit d&apos;abord nommer un autre Admin.
        </p>
        <DeleteAccount email={session.user.email} />
      </section>
    </div>
  );
}
