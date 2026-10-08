import { useEffect, useMemo, useState } from "react";
import { loadPlayersExport, type PlayersExport } from "@/data/exports";
import type { MapMember } from "./chart-option";
import { formatExportVersion } from "@/utils/export-date";
import { LevelSharing } from "./LevelSharing";
import { MapChart } from "./MapChart";
import { globalLevel, neighborRows, type KnownLevels } from "./neighbor-table";
import { NeighborTable } from "./NeighborTable";
import { readSettings, writeSettings } from "./settings";
import { refreshLevels } from "@/data/levels";
import { NumberField } from "@/utils/NumberField";
import { useStoredSettings } from "@/utils/useStoredSettings";

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** Hunting fields read live on the members page, by nickname. */
  liveHuntingFields: ReadonlyMap<string, number>;
}

/** Read fresh at each opening: a research may have ended since the levels were remembered. */
async function fetchLabLevel(origin: string): Promise<number | null> {
  return (await refreshLevels(origin, "laboratoire.php")).attackSpeed ?? null;
}

export function AllianceMap({ origin, loggedInPseudo, liveHuntingFields }: Props) {
  const host = new URL(origin).host;
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, updateSettings] = useStoredSettings(host, readSettings, writeSettings);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => {
      console.error("[Optizzz] alliance map: loading the public export failed", e);
      setError("l'export public de Fourmizzz ne répond pas. Réessayez dans quelques minutes.");
    });
  }, [origin]);

  const settingsRead = settings !== null;
  useEffect(() => {
    if (!settingsRead) return;
    void fetchLabLevel(origin)
      .catch(() => null) // keep the last known level
      .then((labLevel) => {
        if (labLevel !== null) updateSettings((current) => ({ ...current, labLevel }));
      });
  }, [origin, settingsRead, updateSettings]);

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
        Votre alliance n'apparaît pas dans l'export du {formatExportVersion(playersExport.version)}. Si vous venez de la
        rejoindre, elle apparaîtra à la prochaine mise à jour de l'export, dans l'heure.
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
          Voisins reliés à chaque membre sur la carte :{" "}
          <NumberField
            min={1}
            max={Math.max(1, members.length - 1)}
            integer
            value={k}
            onCommit={(value) => {
              if (value !== null) updateSettings((s) => ({ ...s, k: value }));
            }}
          />
        </label>
        <label>
          Vitesse d'attaque par défaut :{" "}
          <NumberField
            min={0}
            max={30}
            integer
            allowEmpty
            placeholder={String(settings.labLevel ?? 0)}
            value={settings.manualLevel}
            onCommit={(manualLevel) => {
              updateSettings((s) => ({ ...s, manualLevel }));
            }}
          />
        </label>
        <span className="note">
          Utilisée pour les membres dont on ne connaît pas la Vitesse d'attaque (actuellement niveau{" "}
          {globalLevel(levels)}). Vide = votre niveau du Laboratoire
          {settings.labLevel !== null && ` (${settings.labLevel})`}.
        </span>
      </div>

      <MapChart members={members} selected={selected} k={k} levels={levels} onSelect={setSelectedId} />

      <NeighborTable
        selected={selected}
        rows={neighborRows(selected, members, k, levels)}
        playerLevels={settings.playerLevels}
        defaultLevel={globalLevel(levels)}
        levels={levels}
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
