"use client";

// The home page of a signed-in account: its Spaces with what waits there, its Players, the tools. Counted from what
// the site reads in clear (docs/features/site-refonte.md): the encrypted content opens in the Space itself.
import { formatNumber } from "@optizzz/game/format/number-format";
import { serverById } from "@optizzz/game/servers";
import Link from "next/link";
import type { ReactNode } from "react";
import { LockIcon, PlusIcon } from "~/components/icons";
import { MonoLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { Stat } from "~/components/stat";
import { buttonVariants } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";
import { ordinal, trendText } from "~/lib/server-stats";
import type { SpacesOverview } from "~/server/spaces/space-service";
import { api } from "~/trpc/react";

type PlayerEntry = SpacesOverview["players"][number];
type Membership = NonNullable<PlayerEntry["membership"]>;

const ROLE_LABEL = { admin: "Admin", delegate: "Délégué", member: "Membre" } as const;

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
  return (
    <div className="space-y-6">
      <PageHeader title={first ? `Bonjour ${first.pseudo}` : "Bonjour"}>
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
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {players.map((player) =>
            player.membership ? (
              <SpaceCard
                key={`${player.server}:${String(player.playerId)}`}
                player={player}
                space={player.membership}
              />
            ) : (
              <NoSpaceCard key={`${player.server}:${String(player.playerId)}`} player={player} />
            ),
          )}
          <Link
            href="/spaces"
            className="flex min-h-48 flex-col items-center justify-center gap-1.5 border border-dashed p-6 text-center text-muted-foreground hover:border-solid hover:bg-accent"
          >
            <PlusIcon />
            <span className="font-semibold text-foreground">Créer ou rejoindre un Espace</span>
            <span className="text-xs">avec une invitation de votre alliance</span>
          </Link>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {players.length > 0 && (
          <div className="space-y-6">
            {players.map((player) => (
              <PlayerCard key={`${player.server}:${String(player.playerId)}`} player={player} />
            ))}
          </div>
        )}
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] border-b [&>*:last-child]:border-r-0 [&>*]:border-b-0">
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
      <div className="flex flex-wrap gap-2 px-4 py-3">
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
      <MonoLabel>{serverById(player.server)?.name ?? player.server}</MonoLabel>
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

/** A figure of the Space on its own line, marked « ▲ » (not by colour alone) when it waits on you. */
function Counter({ value, label, urgent }: { value: number | null; label: string; urgent?: boolean }) {
  const waiting = urgent && value !== null && value > 0;
  return (
    <li className="flex items-baseline gap-3 border-b px-4 py-2">
      <span className={`min-w-8 font-mono text-2xl ${waiting ? "text-primary" : ""}`}>
        {value === null ? "…" : formatNumber(value)}
      </span>
      <span className={value === 0 ? "text-muted-foreground" : ""}>
        {waiting && <span aria-hidden>▲ </span>}
        {label}
      </span>
    </li>
  );
}

function SpaceCard({ player, space }: { player: PlayerEntry; space: Membership }) {
  const admin = space.role === "admin";
  const validator = admin || space.role === "delegate";
  const view = api.spaces.view.useQuery({ spaceId: space.spaceId }, { enabled: admin, staleTime: 30_000 });
  const demandes = api.demandes.space.useQuery({ spaceId: space.spaceId }, { staleTime: 30_000 });
  const envois = api.envois.space.useQuery({ spaceId: space.spaceId }, { staleTime: 30_000 });
  const pending = demandes.data ? demandes.data.demandes.filter((d) => d.status === "pending").length : null;
  const items = envois.data?.items ?? null;
  const count = (categories: string[]) =>
    items ? items.filter((item) => categories.includes(item.category)).length : null;
  const requests = view.data?.requests;
  const members = view.data?.members;

  return (
    <Panel
      flush
      title={space.name}
      aside={
        <MonoLabel className="inline-flex items-center gap-1.5">
          <LockIcon width={12} height={12} />
          chiffré · {ROLE_LABEL[space.role]}
        </MonoLabel>
      }
    >
      <div className="border-b px-4 py-2.5">
        <PlayerLine player={player} />
      </div>
      <ul>
        <Counter value={pending} label={validator ? "Demandes à valider" : "Demandes en attente"} urgent={validator} />
        <Counter value={count(["convoys", "demande-convoys"])} label="convois partagés" />
        <Counter value={count(["floods"])} label="floods partagés" />
        {admin && (
          <>
            <Counter value={requests ? requests.length : null} label="demandes d'adhésion" urgent />
            <Counter
              value={members ? members.filter((m) => m.keyStatus === "resend").length : null}
              label="clés à renvoyer"
              urgent
            />
          </>
        )}
      </ul>
      {space.keyStatus === "resend" && (
        <p className="border-b bg-warning-soft px-4 py-2 text-sm">
          Un Admin doit vous renvoyer l&apos;accès à l&apos;Espace.
        </p>
      )}
      <div className="px-4 py-3">
        <Link href={`/spaces/${space.spaceId}`} className={buttonVariants()}>
          Ouvrir l&apos;Espace
        </Link>
      </div>
    </Panel>
  );
}
