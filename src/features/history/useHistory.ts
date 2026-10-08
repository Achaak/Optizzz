import { useEffect, useState } from "react";
import { loadPlayersExport, loadPlayersVersions, type PlayersExport } from "../alliance-map/api";
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

/** The exports of the last `days` days (null: all; undefined: not known yet), filled in as they are downloaded. */
export function useHistory(origin: string, days: number | null | undefined): HistoryState {
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => setError(String(e)));
  }, [origin]);

  useEffect(() => {
    if (days === undefined) return;
    // An object, not a let: TypeScript would narrow a boolean across the awaits.
    const run = { cancelled: false };
    void (async () => {
      try {
        const versions = dailyVersions(await loadPlayersVersions(origin), days, new Date());
        const progress = (snapshots: Snapshot[], done: boolean) => {
          if (!run.cancelled) setLoaded({ days, snapshots, total: versions.length, done });
        };
        progress([], versions.length === 0);
        progress(await loadHistory(origin, versions, (partial) => progress(partial, false)), true);
      } catch (e) {
        if (!run.cancelled) setError(String(e));
      }
    })();
    return () => {
      run.cancelled = true;
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
