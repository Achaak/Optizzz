import { useEffect, useState } from "react";
import { loadPlayersExport, loadPlayersVersions, type PlayersExport } from "@/data/exports";
import { loadHistory, type Snapshot } from "./api";
import { dailyVersions } from "./versions";

export interface HistoryState {
  /** Latest export: names, alliances and ids of today's players. */
  playersExport: PlayersExport | null;
  snapshots: Snapshot[];
  /** Exports of the period, loaded or not. */
  total: number;
  loading: boolean;
  error: string | null;
}

interface Loaded {
  /** The period these snapshots belong to. */
  days: number | null;
  snapshots: Snapshot[];
  total: number;
  done: boolean;
}

const EXPORT_ERROR = "l'export public de Fourmizzz ne répond pas. Réessayez dans quelques minutes.";

/** The exports of the last `days` days (null: all; undefined: not known yet), filled in as they are downloaded. */
export function useHistory(origin: string, days: number | null | undefined): HistoryState {
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => {
      console.error("[Optizzz] history: loading the public export failed", e);
      setError(EXPORT_ERROR);
    });
  }, [origin]);

  useEffect(() => {
    if (days === undefined) return;
    const run = new AbortController();
    void (async () => {
      try {
        const versions = dailyVersions(await loadPlayersVersions(origin), days, new Date());
        const progress = (snapshots: Snapshot[], done: boolean) => {
          if (!run.signal.aborted) setLoaded({ days, snapshots, total: versions.length, done });
        };
        progress([], versions.length === 0);
        progress(await loadHistory(origin, versions, (partial) => progress(partial, false), run.signal), true);
      } catch (e) {
        console.error("[Optizzz] history: loading the exports failed", e);
        if (!run.signal.aborted) setError(EXPORT_ERROR);
      }
    })();
    return () => {
      run.abort();
    };
  }, [origin, days]);

  // Until the new period starts loading, the previous one stays drawn.
  const current = loaded?.days === days ? loaded : null;
  return {
    playersExport,
    snapshots: current?.snapshots ?? loaded?.snapshots ?? [],
    total: current?.total ?? 0,
    loading: !current?.done && error === null,
    error,
  };
}
