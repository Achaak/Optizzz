"use client";

// Each player's alliance on a server, for the Convois statistics' « Hors alliance » (docs/features/site-envois.md,
// « Statistiques des convois »). The whole server's public map is read, the same for every reader and cached: asking
// the site for a few pseudos would tell it whom the alliance exchanges convoys with.
import { mapDataSchema } from "@optizzz/map/map-data";
import { useEffect, useState } from "react";

/** Lower-case pseudo → alliance tag (null without an alliance); null until read, or when it cannot be. */
export function useServerAlliances(server: string, wanted: boolean): Map<string, string | null> | null {
  const [alliances, setAlliances] = useState<Map<string, string | null> | null>(null);

  useEffect(() => {
    if (!wanted || alliances) return;
    let current = true;
    fetch(`/api/${server}/map`)
      .then(async (response) => {
        if (!response.ok) return null;
        const { players } = mapDataSchema.parse(await response.json());
        return new Map(players.pseudo.map((pseudo, i) => [pseudo.toLowerCase(), players.alliance[i] ?? null]));
      })
      .then(
        (loaded) => {
          if (current && loaded) setAlliances(loaded);
        },
        (error: unknown) => {
          // Without it, the pseudos are shown alone.
          console.error("[Optizzz] the server's alliances could not be read", error);
        },
      );
    return () => {
      current = false;
    };
  }, [server, wanted, alliances]);

  return alliances;
}
