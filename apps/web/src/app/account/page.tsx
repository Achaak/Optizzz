import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockIcon } from "~/components/icons";
import { PageHeader, Panel } from "~/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { shortDate } from "~/lib/short-date";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { SpaceKeysProvider } from "~/components/spaces/space-keys";
import { adminMemberships } from "~/server/spaces/prisma-store";
import { DeleteAccount, RemoveExtensionButton, SignOutButtons } from "./account-actions";
import { PassphraseSettings } from "./passphrase-settings";
import { ResumeAfterLogin } from "./resume-after-login";

/** Two panels side by side, one under the other below 860 px or so. */
const ROW = "grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-5";
/** Column heads in small mono capitals. */
const HEAD = "[&_th]:h-auto [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground";
const ROLE_LABEL = { admin: "Admin", delegate: "Délégué", member: "Membre" } as const;

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function AccountPage() {
  // The header's session query extends the session; this read leaves it be (a page cannot set cookies).
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) redirect("/login");
  const now = new Date();
  const [players, extensions, adminOf, memberships] = await Promise.all([
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
    db.spaceMember.findMany({
      where: { player: { userId: session.user.id } },
      select: {
        role: true,
        server: true,
        space: { select: { id: true, name: true, _count: { select: { members: true } } } },
      },
      orderBy: [{ server: "asc" }, { space: { name: "asc" } }],
    }),
  ]);
  // Each Player's alliance today, from the public export.
  const inExport = await db.player.findMany({
    where: { OR: players.map((p) => ({ server: p.server, id: p.playerId })) },
    select: { server: true, id: true, alliance: true },
  });
  const allianceOf = new Map(inExport.map((p) => [`${p.server}:${String(p.id)}`, p.alliance]));
  // « J'ai oublié ma phrase » warns the sole Admin of a space: nobody could send them their access again.
  const soleAdminOf = adminOf.filter((m) => m.admins === 1).map((m) => m.spaceName);

  return (
    <div className="flex flex-col gap-5">
      <ResumeAfterLogin />
      <PageHeader title="Votre compte" actions={<SignOutButtons />}>
        <p>
          Connecté avec <span className="break-all text-foreground">{session.user.email}</span> par lien magique.
          Optizzz ne garde aucun mot de passe.
        </p>
        <p className="mt-1 text-sm">
          Sur ce navigateur, vous restez connecté jusqu&apos;à {formatEndTime(session.session.expiresAt, now)}, et 30
          jours de plus à chaque visite. «&nbsp;Partout&nbsp;» ferme aussi vos connexions sur vos autres appareils.
        </p>
      </PageHeader>

      <div className={ROW}>
        <Panel
          flush
          className="h-full"
          title="Vos joueurs"
          aside={<span className="text-xs text-muted-foreground">un par serveur</span>}
        >
          {players.length > 0 ? (
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Serveur</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Alliance</TableHead>
                  <TableHead className="pr-4">Rattaché le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => {
                  const key = `${player.server}:${String(player.playerId)}`;
                  const alliance = allianceOf.get(key);
                  return (
                    <TableRow key={key}>
                      <TableCell className="pl-4">{serverById(player.server)?.name ?? player.server}</TableCell>
                      <TableCell>
                        <Link
                          href={`/${player.server}/players/${String(player.playerId)}`}
                          className="font-semibold hover:underline"
                        >
                          {player.pseudo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {alliance ? (
                          <Link
                            href={`/${player.server}/alliances/${encodeURIComponent(alliance)}`}
                            className="hover:underline"
                          >
                            {alliance}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4">{shortDate(player.declaredAt, now)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="px-4 py-3.5 text-muted-foreground">Aucun Joueur rattaché.</p>
          )}
          <p className="mt-auto border-t px-4 py-3 text-[0.8125rem] text-muted-foreground">
            Un Joueur se rattache depuis l&apos;extension liée, qui vous le propose quand vous jouez&nbsp;: un pseudo
            par serveur, et un seul Compte Optizzz par Joueur.
          </p>
        </Panel>

        <Panel className="h-full" title={extensions.length > 1 ? "Extensions" : "Extension"}>
          <div className="flex flex-col gap-2.5">
            {extensions.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {extensions.map((extension) => (
                  <li key={extension.id} className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className="flex flex-wrap items-baseline gap-2.5">
                      <span className="bg-accent px-2 py-0.5 font-mono text-xs text-primary">● CONNECTÉE</span>
                      {extension.browser} · depuis le {shortDate(extension.createdAt, now)}
                    </span>
                    <RemoveExtensionButton id={extension.id} browser={extension.browser} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune extension liée.</p>
            )}
            <p className="text-[0.8125rem] text-muted-foreground">
              {extensions.length > 0 ? (
                <>
                  L&apos;extension n&apos;envoie rien au site sans un clic de votre part&nbsp;: relevés partagés dans un
                  Espace, Demandes, convois. La déconnecter lui retire aussitôt l&apos;accès.
                </>
              ) : (
                <>
                  Pour lier l&apos;extension Optizzz d&apos;un navigateur, cliquez «&nbsp;Connecter mon Compte
                  Optizzz&nbsp;» dans ses paramètres («&nbsp;Fonctionnalités&nbsp;»).
                </>
              )}
            </p>
          </div>
        </Panel>
      </div>

      <div className={ROW}>
        <section id="phrase" className="scroll-mt-8">
          <Panel
            className="h-full"
            title="Chiffrement"
            aside={
              <span className="inline-flex items-center gap-1.5 bg-raised px-2 py-0.5 text-xs text-muted-foreground">
                <LockIcon width={14} height={14} />
                chiffré de bout en bout
              </span>
            }
          >
            <div className="flex flex-col gap-2.5">
              <p>
                Votre <strong>Phrase de chiffrement</strong> ouvre vos Espaces. Elle ne quitte jamais votre
                appareil&nbsp;; sans elle, personne, pas même Optizzz, ne lit ce qu&apos;ils contiennent.
              </p>
              <SpaceKeysProvider userId={session.user.id} email={session.user.email}>
                <PassphraseSettings soleAdminOf={soleAdminOf} />
              </SpaceKeysProvider>
            </div>
          </Panel>
        </section>

        <Panel flush className="h-full" title="Vos Espaces">
          {memberships.length > 0 ? (
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Espace</TableHead>
                  <TableHead>Serveur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="pr-4 text-right">Membres</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((m) => (
                  <TableRow key={m.space.id}>
                    <TableCell className="pl-4">
                      <Link href={`/spaces/${m.space.id}`} className="font-semibold text-primary hover:underline">
                        {m.space.name}
                      </Link>
                    </TableCell>
                    <TableCell>{serverById(m.server)?.name ?? m.server}</TableCell>
                    <TableCell>{ROLE_LABEL[m.role]}</TableCell>
                    <TableCell className="pr-4 text-right">{formatNumber(m.space._count.members)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-4 py-3.5 text-muted-foreground">
              Aucun espace pour l&apos;instant.{" "}
              <Link href="/spaces" className="text-primary underline">
                Créer ou rejoindre un Espace d&apos;alliance
              </Link>
              .
            </p>
          )}
        </Panel>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 border border-warning-border bg-warning-soft px-4 py-3.5 rounded-[0.625rem]">
        <div className="max-w-3xl">
          <h2 className="font-heading text-xl font-semibold tracking-wide uppercase">Supprimer le compte</h2>
          <p className="mt-0.5 text-[0.8125rem]">
            Vos joueurs sont détachés et vous quittez vos Espaces&nbsp;; votre e-mail, vos extensions liées et votre
            phrase secrète sont effacés. Irréversible. Un espace où vous êtes seul part avec le compte&nbsp;; le dernier
            Admin d&apos;un espace qui a d&apos;autres membres doit d&apos;abord nommer un autre Admin.
          </p>
        </div>
        <DeleteAccount email={session.user.email} />
      </section>
    </div>
  );
}
