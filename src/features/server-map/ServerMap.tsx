import { Amount } from "@/utils/Amount";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadAlliancesExport,
  loadPlayersExport,
  type AlliancesExport,
  type Player,
  type PlayersExport,
} from "@/data/exports";
import { loadStoredLevels } from "@/data/levels";
import { levelOf, type KnownLevels } from "@/features/alliance-map/neighbor-table";
import { readSettings as readAllianceMapSettings, type Settings } from "@/features/alliance-map/settings";
import { enteredAtOf, useSharedAttackSpeeds } from "@/features/alliance-map/shared-levels";
import { diplomaticCamps } from "@/game/diplomacy";
import { CHART_COLORS } from "@/theme";
import { formatExportVersion } from "@/utils/export-date";
import { fittedBounds } from "@/utils/map-chart/axes";
import { ChipBar } from "./ChipBar";
import { PlayerTable } from "./PlayerTable";
import { ServerMapChart } from "./ServerMapChart";
import { addChip, highlightedPlayers, initialChips, sameTarget, type Chip, type ChipTarget } from "./selection";
import {
  DEFAULT_DISPLAY,
  loadPlayerPseudo,
  readServerMapSettings,
  writeServerMapSettings,
  type MapDisplay,
} from "./settings";
import { frameRequest, tableRows, zoomAround, type ZoomRequest } from "./view";

interface Props {
  origin: string;
  /** Opened by « Voir sur la carte ». */
  target: ChipTarget | null;
  embedded: boolean;
  /** « Partage d'alliance » is on: the Attack Speed members shared counts. */
  sharing: boolean;
}

/** The export, and whether it came from the cache because the API did not answer. */
function useExports(origin: string) {
  const [players, setPlayers] = useState<PlayersExport | null>(null);
  const [alliances, setAlliances] = useState<AlliancesExport | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadPlayersExport(origin).then(setPlayers, (e: unknown) => {
      console.error("[Optizzz] server map: loading the players export failed", e);
      setError(true);
    });
    // Without alliances, only the pacts and wars buttons are missing.
    loadAlliancesExport(origin).then(setAlliances, (e: unknown) => {
      console.warn("[Optizzz] server map: loading the alliances export failed", e);
    });
  }, [origin]);
  return { players, alliances, error };
}

export function ServerMap({ origin, target, embedded, sharing }: Props) {
  const host = new URL(origin).host;
  const { players: playersExport, alliances: alliancesExport, error } = useExports(origin);
  /** Null until the chips at opening are known. */
  const [storedChips, setStoredChips] = useState<Chip[] | null>(null);
  const [display, setDisplay] = useState<MapDisplay>(DEFAULT_DISPLAY);
  const showMe = display.showMe;
  const [pseudo, setPseudo] = useState<string | null | undefined>(undefined);
  const [mapSettings, setMapSettings] = useState<Settings | null>(null);
  const [labLevel, setLabLevel] = useState<number | null>(null);
  const [referenceId, setReferenceId] = useState<number | null>(null);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<ZoomRequest | null>(null);

  useEffect(() => {
    void loadPlayerPseudo(origin).then(setPseudo);
    // Levels entered on the alliance map, and mine as last read on the Laboratory: no request from here.
    void readAllianceMapSettings(host).then(setMapSettings);
    void loadStoredLevels(origin).then((levels) => setLabLevel(levels.attackSpeed ?? null));
  }, [origin, host]);

  const players = useMemo(() => playersExport?.players.filter((player) => !player.isBanned) ?? [], [playersExport]);
  const axes = useMemo(() => fittedBounds(players.length > 0 ? players : [{ x: 0, y: 0 }]), [players]);
  const me = useMemo(() => players.find((player) => player.pseudo === pseudo) ?? null, [players, pseudo]);
  const myTag = me?.alliance ?? null;

  // The chips at opening, once the export says who I am and where my alliance is; then saved at each change.
  const ready = playersExport !== null && pseudo !== undefined;
  /** The players of `chips`, and me when my marker is shown, framed. */
  const frame = useCallback(
    (chips: readonly Chip[], withMe: boolean) => {
      const points = [...highlightedPlayers(chips, players).keys()];
      setZoom(frameRequest(withMe && me && !points.includes(me) ? [me, ...points] : points, axes, Date.now()));
    },
    [players, me, axes],
  );
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    void readServerMapSettings(host).then((settings) => {
      const chips = initialChips(settings.chips, myTag, target);
      setStoredChips(chips);
      setDisplay({ showMe: settings.showMe, others: settings.others, allNames: settings.allNames });
      frame(chips, settings.showMe);
    });
  }, [host, ready, myTag, target, frame]);
  useEffect(() => {
    if (!storedChips) return;
    writeServerMapSettings(host, { chips: storedChips, ...display }).catch((error: unknown) => {
      console.error("[Optizzz] saving the server map failed", error);
    });
  }, [host, storedChips, display]);

  const chips = useMemo(() => storedChips ?? [], [storedChips]);
  const highlighted = useMemo(() => highlightedPlayers(chips, players), [chips, players]);
  const camps = useMemo(
    () => (myTag && alliancesExport ? diplomaticCamps(myTag, alliancesExport.alliances) : null),
    [myTag, alliancesExport],
  );

  const members = useMemo(() => players.filter((player) => myTag && player.alliance === myTag), [players, myTag]);
  const shared = useSharedAttackSpeeds(origin, myTag, members, sharing);
  const levels = useMemo<KnownLevels>(
    () => ({
      myId: me?.id ?? null,
      labLevel: labLevel ?? mapSettings?.labLevel ?? null,
      manualLevel: mapSettings?.manualLevel ?? null,
      byPlayer: new Map(Object.entries(mapSettings?.playerLevels ?? {}).map(([id, level]) => [Number(id), level])),
      enteredAt: enteredAtOf(mapSettings?.playerLevelsAt ?? {}),
      shared,
    }),
    [me?.id, labLevel, mapSettings, shared],
  );

  const reference = players.find((player) => player.id === referenceId) ?? me;
  const level = useMemo(
    () => (reference ? levelOf(reference.id, levels) : { level: 0, estimated: true }),
    [reference, levels],
  );
  const rows = useMemo(
    () => (reference ? tableRows(reference, highlighted, level) : []),
    [reference, highlighted, level],
  );

  const setChips = (next: Chip[], { reframe = false } = {}) => {
    setStoredChips(next);
    if (reframe) frame(next, showMe);
  };

  const profileUrl = (player: Player) => `${origin}/Membre.php?Pseudo=${encodeURIComponent(player.pseudo)}`;
  const linkTarget = embedded ? "_top" : "_blank";

  if (error) {
    return (
      <div className="optizzz-server-map server-map optizzz-panel optizzz-panel--danger">
        Impossible de charger les positions : l'export public de Fourmizzz ne répond pas. Réessayez dans quelques
        minutes.
      </div>
    );
  }
  if (!playersExport || !storedChips)
    return <div className="optizzz-server-map server-map optizzz-panel">Chargement des positions…</div>;

  return (
    <div className="optizzz-server-map server-map optizzz-panel">
      <h2 className="optizzz-panel-title">Carte du serveur {host.split(".")[0]?.toUpperCase()}</h2>
      <p className="optizzz-note">
        <Amount value={players.length} /> joueurs · positions du {formatExportVersion(playersExport.version)}
        {!me && " · connectez-vous au jeu sur ce serveur pour vous situer sur la carte"}
      </p>
      <ChipBar
        players={players}
        alliances={alliancesExport?.alliances ?? []}
        chips={chips}
        camps={camps}
        onAdd={(target) => setChips(addChip(chips, target), { reframe: true })}
        onAddCamp={(camp) => {
          const palette = camp === "pacts" ? CHART_COLORS.allies : CHART_COLORS.enemies;
          // One hue family per camp: each alliance takes the next colour of its camp.
          const tags = camps?.[camp] ?? [];
          setChips(
            tags.reduce<Chip[]>((next, tag) => addChip(next, { kind: "alliance", tag }, palette), chips),
            { reframe: true },
          );
        }}
        onRemove={(chip) => setChips(chips.filter((other) => !sameTarget(other, chip)))}
        onColor={(chip, color) =>
          setChips(chips.map((other) => (sameTarget(other, chip) ? { ...other, color } : other)))
        }
        myField={me?.field ?? null}
        onFilter={(chip, filter) =>
          setChips(chips.map((other) => (sameTarget(other, chip) ? { ...other, filter } : other)))
        }
      />
      <ServerMapChart
        players={players}
        highlighted={highlighted}
        me={me}
        display={display}
        onDisplay={(change) => setDisplay((current) => ({ ...current, ...change }))}
        reference={reference}
        level={level}
        focusedId={focusedId}
        axes={axes}
        zoom={zoom}
        onFrame={() => frame(chips, showMe)}
        onZoom={setZoom}
        onReference={(player) => setReferenceId(player.id)}
        onOpenProfile={(player) => window.open(profileUrl(player), linkTarget)}
      />
      {reference ? (
        <PlayerTable
          rows={rows}
          reference={reference}
          profileUrl={profileUrl}
          linkTarget={linkTarget}
          onFocus={setFocusedId}
          onZoom={(player) => setZoom(zoomAround(player, axes, Date.now()))}
          onReference={(player) => setReferenceId(player.id)}
          onReferenceMe={me && reference.id !== me.id ? () => setReferenceId(null) : undefined}
        />
      ) : (
        <p className="optizzz-note">Cliquez sur un joueur de la carte pour mesurer les distances depuis lui.</p>
      )}
    </div>
  );
}
