"use client";

// The home page of a signed-in account: its Spaces with what waits there, its Players, the tools. Counted from what
// the site reads in clear (docs/features/site-refonte.md): the encrypted content opens in the Space itself.
import { formatNumber } from "@optizzz/game/format/number-format";
import { serverById } from "@optizzz/game/servers";
import Link from "next/link";
import type { ReactNode } from "react";
import { MonoLabel, PageHeader, Panel, PanelLink } from "~/components/panel";
import { authClient } from "~/lib/auth-client";
import type { SpacesOverview } from "~/server/spaces/space-service";
import { api } from "~/trpc/react";

type PlayerEntry = SpacesOverview["players"][number];
type Membership = NonNullable<PlayerEntry["membership"]>;

const ROLE_LABEL = { admin: "Admin", delegate: "Délégué", member: "Membre" } as const;

/** The signed-in home in place of `visitor`, once the browser knows there is a session. */
export function HomeSwitch({ visitor, tools }: { visitor: ReactNode; tools: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  if (isPending || !data) return visitor;
  return <Dashboard tools={tools} />;
}

function Dashboard({ tools }: { tools: ReactNode }) {
  const overview = api.spaces.overview.useQuery(undefined, { staleTime: 30_000 });
  const players = overview.data?.players ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Votre tableau de bord" />
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
        <div className="grid gap-6 lg:grid-cols-2">
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
        </div>
      )}
      {tools}
    </div>
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

/** A figure of the Space, a link to it when there is something to do. */
function Counter({ value, label, urgent }: { value: number | null; label: string; urgent?: boolean }) {
  return (
    <div className="min-w-0 border-r border-b px-4 py-3">
      <div className={`font-mono text-2xl ${urgent && value ? "text-primary" : ""}`}>
        {value === null ? "…" : formatNumber(value)}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
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
    <Panel flush title={space.name} aside={<MonoLabel className="text-primary">{ROLE_LABEL[space.role]}</MonoLabel>}>
      <div className="border-b px-4 py-2.5">
        <PlayerLine player={player} />
      </div>
      <div className="grid grid-cols-2 border-l-0 sm:grid-cols-3">
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
      </div>
      {space.keyStatus === "resend" && (
        <p className="border-b bg-warning-soft px-4 py-2 text-sm">
          Un Admin doit vous renvoyer l&apos;accès à l&apos;Espace.
        </p>
      )}
      <div className="px-4 py-3">
        <PanelLink href={`/spaces/${space.spaceId}`}>Ouvrir l&apos;Espace</PanelLink>
      </div>
    </Panel>
  );
}
