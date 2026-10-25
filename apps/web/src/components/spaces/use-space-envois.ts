"use client";

// A space's Envois for its member's page (docs/features/site-envois.md): the encrypted rows, read again every minute
// while the page is open, opened here with the Clé d'alliance; what each member sends; the newest key version. The
// page also hands the opened Clé d'alliance to the extension of this browser, for its own Envois.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { useEffect, useMemo, useState } from "react";
import { openConvoys, type AllianceConvoy } from "~/lib/envois/convoys";
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
  const [opened, setOpened] = useState<{ convoys: AllianceConvoy[]; refused: number } | null>(null);
  const data = query.data;

  useEffect(() => {
    if (!data || !keyring) return;
    const run = { cancelled: false };
    openConvoys(data.items, keyring, data.sends)
      .then((result) => {
        if (!run.cancelled) setOpened(result);
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] the convoys could not be opened", error);
      });
    return () => {
      run.cancelled = true;
    };
  }, [data, keyring]);

  return {
    loading: query.isPending,
    error: query.error,
    version: data?.version ?? null,
    sends: data?.sends ?? [],
    convoys: keyring ? (opened?.convoys ?? null) : null,
    refused: opened?.refused ?? 0,
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
