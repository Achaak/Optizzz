import { formatNumber } from "@optizzz/game/format/number-format";
import { formatPastTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { Pager } from "~/components/pager";
import { PageHeader, Panel } from "~/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { discordState, latest, maskEmail, remindersState } from "~/lib/admin/accounts";
import { pageOf } from "~/lib/game-server";
import { shortDate } from "~/lib/short-date";
import { requireAdmin } from "~/server/admin";
import { db } from "~/server/db";

// The back office's « Comptes et Espaces » (docs/features/site-back-office.md): counts, dates and states. What the spaces
// hold is encrypted and stays so; the addresses are masked.

// No title of its own: the 404 shown to anyone else must not name the back office.
export const metadata: Metadata = { robots: { index: false } };

/** Column heads in small mono capitals, as on « Votre compte ». */
const HEAD =
  "[&_th]:h-auto [&_th]:py-2 [&_th]:font-mono [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:tracking-widest [&_th]:text-muted-foreground [&_th]:uppercase";
const ACCOUNTS_PER_PAGE = 50;

const serverName = (id: string) => serverById(id)?.name ?? id;

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const now = new Date();
  const page = pageOf((await searchParams).page);
  const [spaces, demandes, envois, lastDemandes, accounts, total] = await Promise.all([
    db.space.findMany({
      select: {
        id: true,
        name: true,
        server: true,
        createdAt: true,
        _count: { select: { members: true, requests: { where: { status: "pending" } } } },
        members: { select: { joinedAt: true }, orderBy: { joinedAt: "desc" }, take: 1 },
        discord: { select: { refusedStatus: true } },
        reminders: { select: { suspendedStatus: true, kinds: true } },
      },
    }),
    db.demande.groupBy({
      by: ["spaceId"],
      where: { status: { in: ["pending", "validated"] } },
      _count: { _all: true },
    }),
    db.envoiItem.groupBy({
      by: ["spaceId"],
      where: { expiresAt: { gt: now } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    db.demande.groupBy({ by: ["spaceId"], _max: { updatedAt: true } }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ACCOUNTS_PER_PAGE,
      take: ACCOUNTS_PER_PAGE,
      select: {
        id: true,
        email: true,
        createdAt: true,
        players: { select: { server: true, pseudo: true }, orderBy: { server: "asc" } },
        extensions: { select: { browser: true }, orderBy: { createdAt: "asc" } },
        personalKey: { select: { userId: true } },
        sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
    }),
    db.user.count(),
  ]);
  const ofSpace = <T extends { spaceId: string }>(rows: readonly T[], id: string) => rows.find((r) => r.spaceId === id);
  // Last activity: a member joined, a Demande moved, a relevé was shared.
  const rows = spaces
    .map((space) => {
      const envoi = ofSpace(envois, space.id);
      return {
        ...space,
        demandes: ofSpace(demandes, space.id)?._count._all ?? 0,
        envois: envoi?._count._all ?? 0,
        last:
          latest([
            space.createdAt,
            space.members[0]?.joinedAt,
            ofSpace(lastDemandes, space.id)?._max.updatedAt,
            envoi?._max.updatedAt,
          ]) ?? space.createdAt,
      };
    })
    .sort((a, b) => b.last.getTime() - a.last.getTime());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader kicker="Back office · comptes et Espaces" title="Comptes et Espaces">
        <p>
          Des nombres, des dates et des états. Adhésions en attente, Demandes en cours, relevés partagés encore
          valables. Le contenu des Espaces est chiffré&nbsp;: ni ce back office ni Optizzz ne peuvent le lire. Les
          adresses sont masquées.
        </p>
      </PageHeader>

      <Panel
        flush
        title="Espaces d'alliance"
        aside={
          <span className="text-xs text-muted-foreground">{formatNumber(rows.length)} · par dernière activité</span>
        }
      >
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Espace</TableHead>
                  <TableHead>Serveur</TableHead>
                  <TableHead className="text-right">Membres</TableHead>
                  <TableHead className="text-right">Adhésions</TableHead>
                  <TableHead className="text-right">Demandes</TableHead>
                  <TableHead className="text-right">Relevés</TableHead>
                  <TableHead>Discord</TableHead>
                  <TableHead>Rappels</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="pr-4">Dernière activité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((space) => (
                  <TableRow key={space.id}>
                    <TableCell className="pl-4 font-semibold">{space.name}</TableCell>
                    <TableCell className="font-mono">{serverName(space.server)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(space._count.members)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(space._count.requests)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(space.demandes)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(space.envois)}</TableCell>
                    <TableCell className="whitespace-nowrap">{discordState(space.discord)}</TableCell>
                    <TableCell className="whitespace-nowrap">{remindersState(space.reminders)}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">{shortDate(space.createdAt, now)}</TableCell>
                    <TableCell className="pr-4 whitespace-nowrap text-muted-foreground">
                      {formatPastTime(space.last, now)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="px-4 py-3.5 text-muted-foreground">Aucun Espace.</p>
        )}
      </Panel>

      <Panel
        flush
        title="Comptes"
        aside={
          <span className="text-xs text-muted-foreground">{formatNumber(total)} · les plus récents d&apos;abord</span>
        }
      >
        {accounts.length > 0 ? (
          <div className="overflow-x-auto">
            <Table className="text-[0.8125rem]">
              <TableHeader className={HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Adresse</TableHead>
                  <TableHead>Joueurs</TableHead>
                  <TableHead>Extension</TableHead>
                  <TableHead>Clé de chiffrement</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="pr-4">Dernière connexion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const session = account.sessions[0];
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="pl-4 font-mono">{maskEmail(account.email)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {account.players.length > 0
                          ? account.players.map((p) => `${serverName(p.server)} ${p.pseudo}`).join(" · ")
                          : "— aucun"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {account.extensions.length > 0
                          ? account.extensions.map((e) => e.browser).join(" · ")
                          : "— non liée"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {account.personalKey ? "✓ créée" : "— aucune"}
                      </TableCell>
                      <TableCell className="font-mono whitespace-nowrap">{shortDate(account.createdAt, now)}</TableCell>
                      <TableCell className="pr-4 whitespace-nowrap text-muted-foreground">
                        {session ? formatPastTime(session.updatedAt, now) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="px-4 py-3.5 text-muted-foreground">Aucun compte sur cette page.</p>
        )}
        <Pager path="/admin/comptes" query={{}} page={page} pages={Math.ceil(total / ACCOUNTS_PER_PAGE)} />
      </Panel>
    </div>
  );
}
