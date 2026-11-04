"use client";

// A space's Envois for its member's page (docs/features/site-envois.md): the encrypted rows (convoys, floods, hunts log, states), read
// again every minute while the page is open, opened here with the Clé d'alliance; what each member sends; the newest
// key version. The army sent with a flood, and the army by unit, come only to an Admin: the site leaves it out for the others. The
// page also hands the opened Clé d'alliance to the extension of this browser, for its own Envois.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { useEffect, useMemo, useState } from "react";
import { openConvoys, type AllianceConvoy } from "~/lib/envois/convoys";
import { mergeDeclarations, openDeclarations, type OpenedDeclarations } from "~/lib/envois/declarations";
import { openFloods, type AllianceFlood } from "~/lib/envois/floods";
import { openHunts, type AllianceHunt } from "~/lib/envois/hunts";
import { openStates } from "~/lib/envois/states";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import { handKeysToExtension } from "~/lib/spaces/extension-bridge";
import { keyKeptUntil } from "~/lib/spaces/key-session";
import { noteKeyVersion, seenKeyVersion } from "~/lib/spaces/key-versions";
import { api } from "~/trpc/react";
import type { MemberView } from "./use-space-access";

const REFRESH_MS = 60_000;

export function useSpaceEnvois(view: MemberView, keyring: AllianceKeyring | null) {
  const query = api.envois.space.useQuery(
    { spaceId: view.space.id },
    { refetchInterval: REFRESH_MS, refetchIntervalInBackground: false, staleTime: REFRESH_MS / 2, retry: false },
  );
  const [opened, setOpened] = useState<{
    convoys: AllianceConvoy[];
    floods: AllianceFlood[];
    hunts: AllianceHunt[];
    states: MemberStates[];
    declarations: OpenedDeclarations;
    refused: { convoys: number; floods: number; hunts: number; states: number };
  } | null>(null);
  const data = query.data;

  useEffect(() => {
    if (!data || !keyring) return;
    const run = { cancelled: false };
    const context = { server: view.space.server, alliance: view.space.tag, members: data.sends };
    Promise.all([
      openConvoys(data.items, keyring, data.sends),
      openFloods(data.items, keyring),
      openHunts(data.items, keyring),
      openStates(data.items, keyring, context),
      openDeclarations(data.items, keyring, data.sends),
    ])
      .then(([convoys, floods, hunts, states, declarations]) => {
        // What members declared on the page « Déclarer », marked declared, unless their extension sent it too.
        const lists = { convoys: convoys.convoys, floods: floods.floods, hunts: hunts.hunts, states: states.states };
        if (!run.cancelled)
          setOpened({
            ...mergeDeclarations(lists, declarations, new Date()),
            states: states.states,
            declarations,
            refused: {
              convoys: convoys.refused,
              floods: floods.refused,
              hunts: hunts.refused,
              states: states.refused,
            },
          });
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] the Envois could not be opened", error);
      });
    return () => {
      run.cancelled = true;
    };
  }, [data, keyring, view.space.server, view.space.tag]);

  return {
    loading: query.isPending,
    error: query.error,
    version: data?.version ?? null,
    sends: data?.sends ?? [],
    /** The encrypted rows, for the convoys attached to the Demandes (use-space-demandes.ts). */
    items: data?.items ?? null,
    convoys: keyring ? (opened?.convoys ?? null) : null,
    floods: keyring ? (opened?.floods ?? null) : null,
    hunts: keyring ? (opened?.hunts ?? null) : null,
    states: keyring ? (opened?.states ?? null) : null,
    /** What the members declared on the page « Déclarer », as it came (for « Vos déclarations »). */
    declarations: keyring ? (opened?.declarations ?? null) : null,
    refused: opened?.refused ?? { convoys: 0, floods: 0, hunts: 0, states: 0 },
  };
}

/**
 * The highest version of the Clé d'alliance this device saw, and the hand-over to the extension: never a version
 * lower than one already seen (the site may hide the newest; ADR 0005, « Une version cachée, et l'extension »).
 * Returns whether the site's newest version is older than one this device saw.
 */
export function useKeyHandover(view: MemberView, keyring: AllianceKeyring | null, userId: string): boolean {
  const spaceId = view.space.id;
  const newest = Math.max(0, ...view.versions);
  // Read before this page notes the version it got.
  const older = useMemo(() => seenKeyVersion(spaceId) > newest, [spaceId, newest]);
  useEffect(() => {
    noteKeyVersion(spaceId, newest);
    if (!keyring || older) return;
    handKeysToExtension(spaceId, keyring, keyKeptUntil(userId));
  }, [spaceId, newest, older, keyring, userId]);
  return older;
}
