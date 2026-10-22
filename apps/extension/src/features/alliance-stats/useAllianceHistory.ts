import { useEffect, useState } from "react";
import { dailyVersions } from "@/data/export-history";
import { loadAlliancesExport, loadAlliancesVersions, type AlliancesExport } from "@/data/exports";
import { loadAllianceHistory, type AllianceSnapshot } from "./api";

export interface AllianceHistoryState {
  /** Latest export: names and diplomacy of today's alliances. */
  alliancesExport: AlliancesExport | null;
  snapshots: AllianceSnapshot[];
  /** Exports of the period, loaded or not. */
  total: number;
  loading: boolean;
  error: string | null;
}

interface Loaded {
  days: number | null;
  snapshots: AllianceSnapshot[];
  total: number;
  done: boolean;
}

const EXPORT_ERROR = "l'export public de Fourmizzz ne répond pas. Réessayez dans quelques minutes.";

/** The alliances exports of the last `days` days (null: all; undefined: not known yet), filled in as they arrive. */
export function useAllianceHistory(origin: string, days: number | null | undefined): AllianceHistoryState {
  const [alliancesExport, setAlliancesExport] = useState<AlliancesExport | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlliancesExport(origin).then(setAlliancesExport, (e: unknown) => {
      console.error("[Optizzz] alliance stats: loading the public export failed", e);
      setError(EXPORT_ERROR);
    });
  }, [origin]);

  useEffect(() => {
    if (days === undefined) return;
    const run = new AbortController();
    void (async () => {
      try {
        const versions = dailyVersions(await loadAlliancesVersions(origin), days, new Date());
        const progress = (snapshots: AllianceSnapshot[], done: boolean) => {
          if (!run.signal.aborted) setLoaded({ days, snapshots, total: versions.length, done });
        };
        progress([], versions.length === 0);
        progress(await loadAllianceHistory(origin, versions, (partial) => progress(partial, false), run.signal), true);
      } catch (e) {
        console.error("[Optizzz] alliance stats: loading the exports failed", e);
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
    alliancesExport,
    snapshots: current?.snapshots ?? loaded?.snapshots ?? [],
    total: current?.total ?? 0,
    loading: !current?.done && error === null,
    error,
  };
}
