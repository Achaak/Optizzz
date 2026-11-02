"use client";

// A space's Demandes for its member's page (docs/features/site-demandes.md): read again every minute while the page is
// open, opened here with the Clé d'alliance, each with what the convoys attached to it cover (from the Envois). Making
// one seals it here; deciding, cancelling and ordering change only what the site keeps in clear.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import {
  needsRevalidation,
  type AttachedConvoy,
  type DemandeContent,
  type DemandeConvoy,
} from "@optizzz/game/site-links/demandes";
import { useEffect, useState } from "react";
import {
  declaredConvoyEnvoi,
  newDemande,
  openDemandes,
  resealDemande,
  type OpenedDemande,
} from "~/lib/demandes/demandes";
import { api } from "~/trpc/react";
import type { MemberView } from "./use-space-access";

const REFRESH_MS = 60_000;

type EnvoiRows = Parameters<typeof openDemandes>[1];

export function useSpaceDemandes(view: MemberView, keyring: AllianceKeyring | null, envois: EnvoiRows | null) {
  const query = api.demandes.space.useQuery(
    { spaceId: view.space.id },
    { refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: REFRESH_MS / 2, retry: false },
  );
  const utils = api.useUtils();
  const refresh = () => utils.demandes.space.invalidate({ spaceId: view.space.id });
  const create = api.demandes.create.useMutation({ onSuccess: refresh });
  const decide = api.demandes.decide.useMutation({ onSuccess: refresh });
  const cancel = api.demandes.cancel.useMutation({ onSuccess: refresh });
  const reorder = api.demandes.reorder.useMutation({ onSettled: refresh });
  const update = api.demandes.update.useMutation({ onSuccess: refresh });
  const suspend = api.demandes.suspend.useMutation({ onSuccess: refresh });
  const finish = api.demandes.finish.useMutation({ onSuccess: refresh });
  // A declared convoy is an Envoi: the space's Envois are read again to count it.
  const declare = api.envois.declareConvoy.useMutation({
    onSuccess: () => utils.envois.space.invalidate({ spaceId: view.space.id }),
  });
  const [opened, setOpened] = useState<{
    demandes: OpenedDemande[];
    refused: number;
    convoys: AttachedConvoy[];
  } | null>(null);
  const data = query.data;

  useEffect(() => {
    if (!data || !keyring) return;
    const run = { cancelled: false };
    openDemandes(data.demandes, envois ?? [], keyring, view.members, new Date())
      .then((result) => {
        if (!run.cancelled) setOpened(result);
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] the Demandes could not be opened", error);
      });
    return () => {
      run.cancelled = true;
    };
  }, [data, envois, keyring, view.members]);

  return {
    loading: query.isPending,
    error: query.error,
    demandes: keyring ? (opened?.demandes ?? null) : null,
    refused: opened?.refused ?? 0,
    /** The convoys attached to a Demande, for the Convois statistics. */
    convoys: keyring ? (opened?.convoys ?? null) : null,
    /** Seals a new Demande for the member's Joueur, and hands it to the site. */
    async make(content: DemandeContent) {
      if (!keyring) throw new Error("No Clé d'alliance");
      const sealed = await newDemande({ server: view.me.server, playerId: view.me.playerId, content }, keyring);
      await create.mutateAsync({ server: view.me.server, playerId: view.me.playerId, ...sealed });
    },
    decide: (id: string, decision: "validated" | "refused") => decide.mutateAsync({ id, decision }),
    cancel: (id: string) => cancel.mutateAsync({ id }),
    reorder: (ids: string[]) => reorder.mutateAsync({ server: view.me.server, playerId: view.me.playerId, ids }),
    /** The requester's change, sealed here; asking for more or for another day sends it back to validation. */
    async change(demande: OpenedDemande, content: DemandeContent) {
      if (!keyring) throw new Error("No Clé d'alliance");
      const sealed = await resealDemande(demande, content, keyring);
      await update.mutateAsync({ id: demande.id, ...sealed, revalidate: needsRevalidation(demande.content, content) });
    },
    suspend: (id: string) => suspend.mutateAsync({ id }),
    finish: (id: string) => finish.mutateAsync({ id }),
    /** A convoy the member sent to a Demande's requester, declared by hand. */
    async declare(convoy: DemandeConvoy) {
      if (!keyring) throw new Error("No Clé d'alliance");
      const me = { server: view.me.server, playerId: view.me.playerId };
      const { keyVersion, item } = await declaredConvoyEnvoi(me, convoy, keyring, new Date());
      await declare.mutateAsync({ ...me, keyVersion, items: [item], removed: [] });
    },
    /** Withdraws a convoy the member declared. */
    async withdraw(fingerprint: string) {
      if (!keyring) throw new Error("No Clé d'alliance");
      const keyVersion = Math.max(...keyring.map((k) => k.version));
      await declare.mutateAsync({
        server: view.me.server,
        playerId: view.me.playerId,
        keyVersion,
        items: [],
        removed: [fingerprint],
      });
    },
  };
}

export type SpaceDemandes = ReturnType<typeof useSpaceDemandes>;
