"use client";

// /spaces: for each Player of the account, its space, or the spaces of its alliance to join, and « Créer un espace ».
import { serverById } from "@optizzz/game/servers";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { shortDate } from "~/lib/short-date";
import { newSpace } from "~/lib/spaces/access";
import { withVerified } from "~/lib/spaces/trust-store";
import type { SpacesOverview } from "~/server/spaces/space-service";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { PassphraseSetup, PassphraseUnlock } from "./passphrase-forms";
import { Callout, Panel } from "./parts";
import { useSpaceKeys } from "./space-keys";

type PlayerEntry = SpacesOverview["players"][number];

const ROLE_LABEL = { admin: "Admin", delegate: "Délégué", member: "Membre" } as const;

export function SpacesHome() {
  const overview = api.spaces.overview.useQuery(undefined, { staleTime: 0 });

  if (overview.isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (overview.isError) return <Callout>{errorText(overview.error)}</Callout>;
  const { players, extensionLinked } = overview.data;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Espaces d&apos;alliance</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;endroit où les membres d&apos;une alliance mettent leurs données en commun. Même Optizzz ne peut pas
          les lire.
        </p>
      </div>
      {players.length === 0 ? (
        <Panel title="Rattacher votre Joueur">
          {extensionLinked ? (
            <p>
              Ouvrez le jeu&nbsp;: l&apos;extension liée vous proposera de rattacher votre pseudo à votre Compte
              Optizzz. Revenez ensuite ici.
            </p>
          ) : (
            <p>
              Un espace se rejoint avec votre pseudo du jeu, rattaché par l&apos;extension Optizzz. Dans ses paramètres
              («&nbsp;Fonctionnalités&nbsp;»), cliquez «&nbsp;Connecter mon Compte Optizzz&nbsp;», puis ouvrez le jeu.
            </p>
          )}
        </Panel>
      ) : (
        players.map((player) => <PlayerSpaces key={`${player.server}:${String(player.playerId)}`} player={player} />)
      )}
    </div>
  );
}

function PlayerSpaces({ player }: { player: PlayerEntry }) {
  const now = new Date();
  const server = serverById(player.server)?.name ?? player.server;
  const pending = player.requests.filter((r) => r.status === "pending");
  return (
    <Panel title={`${player.pseudo} (${server})`}>
      {player.membership ? (
        <p>
          <Link href={`/spaces/${player.membership.spaceId}`} className="font-medium underline underline-offset-4">
            {player.membership.name}
          </Link>
          <span className="text-muted-foreground">
            {" "}
            · {ROLE_LABEL[player.membership.role]}
            {player.membership.keyStatus === "resend" && " · accès à renvoyer"}
          </span>
        </p>
      ) : player.alliance === null ? (
        <p className="text-muted-foreground">
          {player.pseudo} n&apos;est dans aucune alliance d&apos;après l&apos;export public du serveur.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="space-y-1">
              {pending.map((r) => (
                <li key={r.spaceId}>
                  Demande envoyée à{" "}
                  <Link href={`/spaces/${r.spaceId}`} className="underline underline-offset-4">
                    {r.name}
                  </Link>{" "}
                  le {shortDate(r.createdAt, now)}
                </li>
              ))}
            </ul>
          )}
          {player.joinable.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-medium">Espaces de {player.alliance}</h3>
              <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                {player.joinable.map((space) => (
                  <li key={space.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <strong>{space.name}</strong>
                      <span className="block text-muted-foreground">
                        Admins&nbsp;: {space.admins.join(", ") || "aucun"} · {String(space.memberCount)} membre
                        {space.memberCount > 1 ? "s" : ""} · créé le {shortDate(space.createdAt, now)}
                      </span>
                    </span>
                    <Link
                      href={`/spaces/${space.id}`}
                      className="rounded-lg px-2.5 py-1 font-medium ring-1 ring-foreground/20 hover:bg-muted"
                    >
                      {pending.some((r) => r.spaceId === space.id) ? "Voir ma demande" : "Demander à rejoindre"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Aucun espace pour {player.alliance} sur {server} pour l&apos;instant.
            </p>
          )}
          <CreateSpace player={player} alliance={player.alliance} />
        </>
      )}
    </Panel>
  );
}

function CreateSpace({ player, alliance }: { player: PlayerEntry; alliance: string }) {
  const id = useId();
  const router = useRouter();
  const keys = useSpaceKeys();
  const create = api.spaces.create.useMutation();
  const server = serverById(player.server)?.name ?? player.server;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${alliance} sur ${server}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Créer un espace pour {alliance}
      </Button>
    );

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!keys.pair) return;
    setBusy(true);
    setError(null);
    try {
      const spaceId = crypto.randomUUID();
      const { sealed, root } = await newSpace(keys.pair, spaceId, Date.now());
      // The creator is their own Admin root (ADR 0005, « Ce que doit faire l'interface »).
      await keys.updateTrust((list) => withVerified(list, spaceId, root));
      await create.mutateAsync({ id: spaceId, server: player.server, playerId: player.playerId, name, sealed });
      router.push(`/spaces/${spaceId}`);
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg p-3 ring-1 ring-foreground/10">
      <h3 className="font-medium">Créer un espace pour {alliance}</h3>
      {!keys.hasKey ? (
        <>
          <p>Choisissez d&apos;abord la phrase secrète de votre compte&nbsp;: elle protège votre accès aux espaces.</p>
          <PassphraseSetup />
        </>
      ) : !keys.pair ? (
        <PassphraseUnlock />
      ) : (
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1">
            <label htmlFor={`${id}-name`} className="block font-medium">
              Nom de l&apos;espace
            </label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              className="max-w-sm"
            />
          </div>
          <p className="text-muted-foreground">
            Vous en serez Admin. D&apos;autres espaces peuvent porter le tag {alliance}&nbsp;: chacun choisit le sien.
          </p>
          {error && <Callout>{error}</Callout>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Création…" : "Créer l'espace"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
