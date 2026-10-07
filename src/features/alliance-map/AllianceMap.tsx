import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPlayersExport, type PlayersExport } from "./api";
import type { MapMember } from "./chart-option";
import { formatExportVersion } from "./dates";
import { LevelSharing } from "./LevelSharing";
import { MapChart } from "./MapChart";
import { globalLevel, neighborRows, type KnownLevels } from "./neighbor-table";
import { NeighborTable } from "./NeighborTable";
import { readAttackSpeedLevel } from "./pages";
import { readSettings, writeSettings, type Settings } from "./settings";

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** Hunting fields read live on the members page, by nickname. */
  liveHuntingFields: ReadonlyMap<string, number>;
}

async function fetchLabLevel(origin: string): Promise<number | null> {
  const html = await fetch(`${origin}/laboratoire.php`).then((response) => response.text());
  return readAttackSpeedLevel(new DOMParser().parseFromString(html, "text/html"));
}

const parseLevel = (value: string) => (value === "" ? null : Number(value));

export function AllianceMap({ origin, loggedInPseudo, liveHuntingFields }: Props) {
  const host = new URL(origin).host;
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const updateSettings = useCallback(
    (update: (current: Settings) => Settings) =>
      setSettings((current) => {
        if (!current) return current;
        const next = update(current);
        void writeSettings(host, next);
        return next;
      }),
    [host],
  );

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => setError(String(e)));
  }, [origin]);

  useEffect(() => {
    void readSettings(host).then(async (stored) => {
      setSettings(stored);
      const labLevel = await fetchLabLevel(origin).catch(() => null); // keep the last known level
      if (labLevel !== null) updateSettings((current) => ({ ...current, labLevel }));
    });
  }, [origin, host, updateSettings]);

  const me = playersExport?.players.find((p) => p.pseudo === loggedInPseudo) ?? null;
  const allianceTag = me?.alliance ?? null;

  // For now: my alliance's members. The filter can later accept other tags.
  const members = useMemo<MapMember[]>(() => {
    if (!playersExport || !allianceTag) return [];
    return playersExport.players
      .filter((p) => p.alliance === allianceTag)
      .map((p) => ({ ...p, huntingField: liveHuntingFields.get(p.pseudo) ?? p.field }));
  }, [playersExport, allianceTag, liveHuntingFields]);

  const levels = useMemo<KnownLevels | null>(
    () =>
      settings && {
        myId: me?.id ?? null,
        labLevel: settings.labLevel,
        manualLevel: settings.manualLevel,
        byPlayer: new Map(Object.entries(settings.playerLevels).map(([id, level]) => [Number(id), level])),
      },
    [settings, me?.id],
  );

  if (error) return <div className="alliance-map error">Impossible de charger les positions : {error}</div>;
  if (!playersExport || !settings || !levels) return <div className="alliance-map">Chargement des positions…</div>;
  const myMember = members.find((m) => m.id === me?.id);
  if (!myMember || !allianceTag) {
    return (
      <div className="alliance-map">
        Ton alliance n'apparaît pas dans l'export du {formatExportVersion(playersExport.version)}. Si tu viens de la
        rejoindre, elle apparaîtra après la prochaine mise à jour (chaque nuit à minuit).
      </div>
    );
  }

  const selected = members.find((m) => m.id === selectedId) ?? myMember;
  const k = Math.min(settings.k, members.length - 1);

  return (
    <div className="alliance-map">
      <h2>Carte de l'alliance {allianceTag}</h2>
      <p className="meta">
        {members.length} membres · positions du {formatExportVersion(playersExport.version)} · TDC{" "}
        {liveHuntingFields.size > 0 ? "en direct (page Membres)" : "de l'export"}
      </p>

      <div className="settings">
        <label>
          Voisins reliés (k){" "}
          <input
            type="number"
            min={1}
            max={Math.max(1, members.length - 1)}
            value={settings.k}
            onChange={(e) => updateSettings((s) => ({ ...s, k: Math.max(1, Number(e.target.value) || 1) }))}
          />
        </label>
        <label>
          Vitesse d'attaque globale{" "}
          <input
            type="number"
            min={0}
            max={30}
            placeholder={String(settings.labLevel ?? 0)}
            value={settings.manualLevel ?? ""}
            onChange={(e) => updateSettings((s) => ({ ...s, manualLevel: parseLevel(e.target.value) }))}
          />
        </label>
        <span className="note">
          Temps calculés avec Vitesse d'attaque niveau {globalLevel(levels)} pour les membres sans niveau saisi
          {settings.labLevel !== null && ` (ton niveau Laboratoire : ${settings.labLevel})`}.
        </span>
      </div>

      <MapChart members={members} selected={selected} k={k} levels={levels} onSelect={setSelectedId} />

      <NeighborTable
        selected={selected}
        rows={neighborRows(selected, members, k, levels)}
        playerLevels={settings.playerLevels}
        globalLevel={globalLevel(levels)}
        onSelect={setSelectedId}
        onLevelChange={(playerId, level) =>
          updateSettings((s) => ({
            ...s,
            playerLevels: Object.fromEntries(
              Object.entries({ ...s.playerLevels, [playerId]: level }).filter(
                (entry): entry is [string, number] => entry[1] !== null,
              ),
            ),
          }))
        }
      />

      <LevelSharing
        members={members}
        levels={levels.byPlayer}
        onImport={(imported) =>
          updateSettings((s) => ({ ...s, playerLevels: { ...s.playerLevels, ...Object.fromEntries(imported) } }))
        }
      />
    </div>
  );
}
