"use client";

// The home page of a signed-in account: its Spaces with what waits there, its Players, the tools. Counted from what
// the site reads in clear (docs/features/site-refonte.md): the encrypted content opens in the Space itself.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { LockIcon, PlusIcon } from "~/components/icons";
import { SmallLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { Stat } from "~/components/stat";
import { buttonVariants } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";
import { ordinal, trendText } from "~/lib/server-stats";
import type { SpacesOverview } from "~/server/spaces/space-service";
import { api } from "~/trpc/react";

type PlayerEntry = SpacesOverview["players"][number];
type Membership = NonNullable<PlayerEntry["membership"]>;

/** The signed-in home in place of `visitor`, once the browser knows there is a session. */
export function HomeSwitch({
  visitor,
  tools,
  bulletin,
}: {
  visitor: ReactNode;
  tools: ReactNode;
  /** The last visited server's news. */
  bulletin: ReactNode;
}) {
  const { data, isPending } = authClient.useSession();
  if (isPending || !data) return visitor;
  return <Dashboard tools={tools} bulletin={bulletin} />;
}

function Dashboard({ tools, bulletin }: { tools: ReactNode; bulletin: ReactNode }) {
  const overview = api.spaces.overview.useQuery(undefined, { staleTime: 30_000 });
  const players = overview.data?.players ?? [];
  const first = players[0];
  // Which server a Space is on, said only when the account plays on several.
  const servers = new Set(players.map((player) => player.server)).size;
  const now = new Date();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={first ? `Bonjour ${first.pseudo}` : "Bonjour"} note={formatEndTime(now, now)}>
        Ce qui vous attend dans vos Espaces, d&apos;un coup d&apos;œil. Les compteurs se lisent sans votre Phrase de
        chiffrement.
      </PageHeader>
      {overview.isPending ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : players.length === 0 ? (
        <Panel title="Vos joueurs">
          <p className="text-sm">
            Aucun joueur n&apos;est encore lié à votre compte. Liez l&apos;extension depuis le jeu pour déclarer vos
            joueurs, puis rejoignez l&apos;Espace de votre alliance.
          </p>
          <div className="pt-3">
            <PanelLink href="/spaces">Les Espaces d&apos;alliance</PanelLink>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] gap-5">
          {players.map((player) =>
            player.membership ? (
              <SpaceCard
                key={`${player.server}:${String(player.playerId)}`}
                player={player}
                space={player.membership}
                showServer={servers > 1}
              />
            ) : (
              <NoSpaceCard key={`${player.server}:${String(player.playerId)}`} player={player} />
            ),
          )}
          <Link
            href="/spaces"
            className="flex min-h-50 flex-col items-center justify-center gap-1.5 border border-dashed p-6 text-center text-muted-foreground hover:border-solid hover:bg-accent rounded-[0.625rem]"
          >
            <PlusIcon width={14} height={14} />
            <span className="font-semibold text-foreground">Créer ou rejoindre un Espace</span>
            <span className="text-xs">avec une invitation de votre alliance</span>
          </Link>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(26.25rem,100%),1fr))] gap-5">
        {players.map((player) => (
          <PlayerCard key={`${player.server}:${String(player.playerId)}`} player={player} />
        ))}
        {bulletin}
      </div>
      {tools}
    </div>
  );
}

/** « Votre joueur · S5 »: TDC with its week, rank, alliance, and the ways to their sheet and the Comparer. */
function PlayerCard({ player }: { player: PlayerEntry }) {
  const card = api.players.card.useQuery({ server: player.server, id: player.playerId }, { staleTime: 300_000 });
  const name = serverById(player.server)?.name ?? player.server;
  const data = card.data;
  return (
    <Panel
      flush
      title={`Votre joueur · ${name}`}
      aside={<span className="text-sm font-semibold">{player.pseudo}</span>}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2.5 px-4.5 pt-2.5">
        <Stat
          label="TDC"
          value={data ? formatNumber(data.field) : "…"}
          hint={
            data
              ? (trendText(data.weekAgo, data.field) ?? "cm²") + (data.weekAgo === undefined ? "" : " en 7 jours")
              : undefined
          }
        />
        <Stat label="Rang" value={data ? ordinal(data.rank) : "…"} hint="au TDC" />
        <Stat label="Alliance" value={player.alliance ?? "—"} />
      </div>
      <div className="flex flex-wrap gap-2 px-4.5 pt-3 pb-4">
        <Link
          href={`/${player.server}/players/${String(player.playerId)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Ma fiche
        </Link>
        <Link
          href={`/${player.server}/compare?ids=${String(player.playerId)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <PlusIcon />
          Me comparer
        </Link>
      </div>
    </Panel>
  );
}

function PlayerLine({ player }: { player: PlayerEntry }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <SmallLabel>{serverById(player.server)?.name ?? player.server}</SmallLabel>
      <Link href={`/${player.server}/players/${String(player.playerId)}`} className="font-semibold hover:underline">
        {player.pseudo}
      </Link>
      {player.alliance && (
        <Link
          href={`/${player.server}/alliances/${encodeURIComponent(player.alliance)}`}
          className="text-muted-foreground hover:underline"
        >
          {player.alliance}
        </Link>
      )}
    </div>
  );
}

function NoSpaceCard({ player }: { player: PlayerEntry }) {
  const pending = player.requests.find((request) => request.status === "pending");
  return (
    <Panel title="Sans Espace" aside={<PlayerLine player={player} />}>
      <p className="text-sm text-muted-foreground">
        {pending
          ? `Votre demande pour rejoindre « ${pending.name} » attend un Admin.`
          : player.joinable.length > 0
            ? "L'Espace de votre alliance existe : demandez à le rejoindre."
            : "Votre alliance n'a pas encore d'Espace : vous pouvez le créer."}
      </p>
      <div className="pt-3">
        <PanelLink href="/spaces">{pending ? "Voir ma demande" : "Les Espaces d'alliance"}</PanelLink>
      </div>
    </Panel>
  );
}

/**
 * A figure of the Space on its own line, leading to the Space; marked « ▲ » (not by colour alone) when it waits on
 * you.
 */
function Counter({
  href,
  value,
  urgent,
  children,
}: {
  href: string;
  value: number;
  urgent?: boolean;
  children: ReactNode;
}) {
  const waiting = urgent && value > 0;
  return (
    <li>
      <Link href={href} className="flex items-baseline gap-2.5 border-t px-4 py-2 hover:bg-accent">
        <span className={`min-w-8 font-mono text-[1.375rem] ${waiting ? "text-primary" : ""}`}>
          {formatNumber(value)}
        </span>
        <span>
          {waiting && <span aria-hidden>▲ </span>}
          {children}
        </span>
      </Link>
    </li>
  );
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function SpaceCard({ player, space, showServer }: { player: PlayerEntry; space: Membership; showServer: boolean }) {
  const admin = space.role === "admin";
  const validator = admin || space.role === "delegate";
  const view = api.spaces.view.useQuery({ spaceId: space.spaceId }, { enabled: admin, staleTime: 30_000 });
  const demandes = api.demandes.space.useQuery({ spaceId: space.spaceId }, { staleTime: 30_000 });
  const envois = api.envois.space.useQuery({ spaceId: space.spaceId }, { staleTime: 30_000 });
  const href = `/spaces/${space.spaceId}`;
  const pending = demandes.data ? demandes.data.demandes.filter((d) => d.status === "pending").length : null;
  const items = envois.data?.items ?? [];
  const convoys = items.filter((item) => item.category === "convoys" || item.category === "demande-convoys").length;
  const floods = items.filter((item) => item.category === "floods").length;
  const requests = view.data?.requests?.length ?? 0;
  const resend = (view.data?.members ?? []).filter((m) => m.keyStatus === "resend").map((m) => m.pseudo);
  const waits = (validator && (pending ?? 0) > 0) || requests > 0 || resend.length > 0;

  return (
    <Panel
      flush
      title={space.name}
      aside={
        <span className="inline-flex items-center gap-1.5 bg-raised px-2 py-0.5 text-xs text-muted-foreground">
          <LockIcon width={14} height={14} />
          {showServer && `${serverById(player.server)?.name ?? player.server} · `}chiffré
        </span>
      }
    >
      <ul className="-mt-px">
        {pending === null ? (
          <li className="border-t px-4 py-2 text-muted-foreground">Chargement…</li>
        ) : pending === 0 ? (
          <Counter href={href} value={0}>
            <span className="text-muted-foreground">Aucune Demande</span>
          </Counter>
        ) : (
          <Counter href={href} value={pending} urgent={validator}>
            {validator
              ? plural(pending, "Demande à valider", "Demandes à valider")
              : plural(pending, "Demande en attente", "Demandes en attente")}
          </Counter>
        )}
        {requests > 0 && (
          <Counter href={href} value={requests} urgent>
            {plural(requests, "demande d'adhésion", "demandes d'adhésion")}
          </Counter>
        )}
        {convoys > 0 && (
          <Counter href={href} value={convoys}>
            {plural(convoys, "convoi partagé", "convois partagés")}
          </Counter>
        )}
        {floods > 0 && (
          <Counter href={href} value={floods}>
            {plural(floods, "flood partagé", "floods partagés")}
          </Counter>
        )}
        {resend.length > 0 && (
          <Counter href={href} value={resend.length} urgent>
            {plural(resend.length, "clé à renvoyer à ", "clés à renvoyer à ")}
            {resend.map((pseudo, index) => (
              <Fragment key={pseudo}>
                {index > 0 && ", "}
                <strong>{pseudo}</strong>
              </Fragment>
            ))}
          </Counter>
        )}
      </ul>
      {space.keyStatus === "resend" && (
        <p className="border-t bg-warning-soft px-4 py-2 text-sm">
          ▲ Un Admin doit vous renvoyer l&apos;accès à l&apos;Espace.
        </p>
      )}
      <div className="border-t px-4 py-3">
        <Link href={href} className={buttonVariants({ variant: waits ? "default" : "outline" })}>
          Ouvrir l&apos;Espace
        </Link>
      </div>
    </Panel>
  );
}
