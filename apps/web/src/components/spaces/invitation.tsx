"use client";

// The invitation link, opened by someone who is not (yet) a member: a step bar to the request, then the Code de
// sécurité with an Admin. The newcomer reads the space as soon as an Admin gives the access, without another gesture
// (the page asks again every few seconds).
import { serverById } from "@optizzz/game/servers";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { shortDate } from "~/lib/short-date";
import { spaceTrustOf } from "~/lib/spaces/trust-store";
import type { SpaceView } from "~/server/spaces/space-service";
import { PageHeader } from "~/components/panel";
import { api } from "~/trpc/react";
import { AdminExchange } from "./admin-exchange";
import { errorText } from "./errors";
import { PassphraseSetup, PassphraseUnlock } from "./passphrase-forms";
import { Callout, Panel } from "./parts";
import { useSpaceKeys } from "./space-keys";
import { StepBar } from "./step-bar";

type InvitationView = Extract<SpaceView, { kind: "invitation" }>;

export function Invitation({ view }: { view: InvitationView }) {
  const keys = useSpaceKeys();
  const utils = api.useUtils();
  const request = api.spaces.requestToJoin.useMutation();
  const cancel = api.spaces.cancelRequest.useMutation();
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(false);
  const { space, player } = view;
  const server = serverById(space.server)?.name ?? space.server;
  const ready = view.linked && player !== null && player.inAlliance && !view.inOtherSpace;
  const step = !view.linked ? 1 : !player ? 2 : !view.hasKey ? 3 : view.request?.status === "pending" ? 5 : 4;

  const ask = () => {
    if (!player) return;
    setError(null);
    request
      .mutateAsync({ spaceId: space.id, playerId: player.playerId })
      .then(() => utils.spaces.view.invalidate({ spaceId: space.id }))
      .catch((failure: unknown) => setError(errorText(failure)));
  };

  // « puis la demande est faite pour cet espace »: once the steps are done, the request goes by itself, once.
  useEffect(() => {
    if (ready && view.hasKey && view.request === null && !asked.current) {
      asked.current = true;
      ask();
    }
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader kicker="Invitation" title={<span className="break-words">Rejoindre {space.name}</span>}>
        Espace d&apos;alliance de {space.tag} sur {server} · Admins&nbsp;: {space.admins.join(", ") || "aucun"} ·{" "}
        {String(space.memberCount)} membre{space.memberCount > 1 ? "s" : ""} · créé le{" "}
        {shortDate(space.createdAt, new Date())}
      </PageHeader>
      <StepBar current={step} />
      {error && <Callout>{error}</Callout>}

      {step === 1 && (
        <Panel title="Connecter l'extension">
          <p>
            L&apos;extension Optizzz, liée à votre Compte Optizzz, rattache votre pseudo du jeu à votre compte. Dans ses
            paramètres («&nbsp;Fonctionnalités&nbsp;»), cliquez «&nbsp;Connecter mon Compte Optizzz&nbsp;», puis revenez
            sur cette page.
          </p>
          <Button variant="outline" onClick={() => void utils.spaces.view.invalidate({ spaceId: space.id })}>
            C&apos;est fait
          </Button>
        </Panel>
      )}

      {step === 2 && (
        <Panel title="Rattacher votre pseudo">
          <p>
            Ouvrez le jeu sur {server}&nbsp;: l&apos;extension vous proposera «&nbsp;Rattacher votre pseudo ({server}) à
            votre Compte Optizzz&nbsp;». Cliquez «&nbsp;Rattacher&nbsp;», puis revenez ici.
          </p>
          <Button variant="outline" onClick={() => void utils.spaces.view.invalidate({ spaceId: space.id })}>
            C&apos;est fait
          </Button>
        </Panel>
      )}

      {player && !player.inAlliance && (
        <Callout tone="warning">
          {player.pseudo} n&apos;est pas dans l&apos;alliance {space.tag} d&apos;après l&apos;export public du serveur,
          relu chaque heure. Seuls les membres de l&apos;alliance peuvent rejoindre cet espace.
        </Callout>
      )}
      {view.inOtherSpace && player && (
        <Callout tone="warning">
          {player.pseudo} est déjà dans un autre espace.{" "}
          <Link href="/spaces" className="underline">
            Quittez-le
          </Link>{" "}
          d&apos;abord pour rejoindre celui-ci.
        </Callout>
      )}

      {step === 3 && player?.inAlliance && (
        <Panel title="Choisir votre phrase">
          <p>Elle protège votre accès aux espaces, sur tous vos appareils. Personne ne la connaît, pas même Optizzz.</p>
          <PassphraseSetup submitLabel="Enregistrer et demander à rejoindre" />
        </Panel>
      )}

      {step === 4 && ready && (
        <Panel title="Demander à rejoindre">
          {view.request?.status === "refused" ? (
            <>
              <p>
                Votre demande a été refusée le {shortDate(view.request.decidedAt ?? view.request.createdAt, new Date())}
                . Parlez-en avec un Admin sur Discord&nbsp;; vous pouvez demander de nouveau.
              </p>
              <Button onClick={ask} disabled={request.isPending}>
                Demander de nouveau
              </Button>
            </>
          ) : (
            <p role="status">Envoi de la demande…</p>
          )}
        </Panel>
      )}

      {step === 5 && view.request && (
        <Panel title="Échanger le Code de sécurité">
          <p className="text-muted-foreground">
            Demande envoyée le {shortDate(view.request.createdAt, new Date())} ·{" "}
            <button
              type="button"
              className="underline underline-offset-4"
              disabled={cancel.isPending}
              onClick={() => {
                cancel
                  .mutateAsync({ spaceId: space.id })
                  .then(() => utils.spaces.view.invalidate({ spaceId: space.id }))
                  .catch((failure: unknown) => setError(errorText(failure)));
              }}
            >
              Annuler la demande
            </button>
          </p>
          {!keys.pair ? (
            <PassphraseUnlock
              intro={<p>Tapez la phrase secrète de votre compte pour échanger le Code de sécurité.</p>}
            />
          ) : (
            <>
              <AdminExchange
                spaceId={space.id}
                admins={view.admins}
                verified={(key) =>
                  spaceTrustOf(keys.trust ?? { spaces: [] }, space.id).verified.some((v) => v.publicKey === key)
                }
              />
              <p className="text-muted-foreground">
                Une fois les codes échangés, l&apos;Admin vous donne l&apos;accès&nbsp;: cette page s&apos;ouvrira
                d&apos;elle-même.
              </p>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
