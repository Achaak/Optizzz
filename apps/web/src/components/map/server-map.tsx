"use client";

import { versionDate } from "@optizzz/game/export-versions";
import type { Player } from "@optizzz/game/exports";
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime } from "@optizzz/game/format/time-format";
import { fittedBounds } from "@optizzz/map/axes";
import { decodeMapData, mapDataSchema } from "@optizzz/map/map-data";
import { addChip, highlightedPlayers, initialChips, type Chip } from "@optizzz/map/selection";
import { frameRequest, tableRows, zoomAround, type ZoomRequest } from "@optizzz/map/view";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NumberField } from "~/components/number-field";
import { ChipBar } from "./chip-bar";
import { MapChart, type MapDisplay } from "./map-chart";
import { decodeMapState, EMPTY_STATE, encodeMapState, requestedMap, type MapState } from "./map-state";
import { useMapPalette } from "./palette";
import { PlayerTable } from "./player-table";

type MapData = ReturnType<typeof decodeMapData>;

const storageKey = (server: string) => `optizzz:map:${server}`;

function readStored(server: string): MapState | null {
  try {
    const stored = localStorage.getItem(storageKey(server));
    return stored ? decodeMapState(stored) : null;
  } catch {
    return null;
  }
}

export function ServerMap({ server }: { server: { id: string; name: string } }) {
  const router = useRouter();
  const palette = useMapPalette();
  const [data, setData] = useState<MapData | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<MapState | null>(null);
  const [display, setDisplay] = useState<MapDisplay>({ others: true, allNames: false });
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<ZoomRequest | null>(null);
  /** The address held a shared map that could not be read (cut, hand-edited, unknown version). */
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    let current = true;
    fetch(`/api/${server.id}/map`)
      .then(async (response) => {
        // 404: the cron has not read this server yet, an expected state rather than a failure.
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`map: ${String(response.status)}`);
        return decodeMapData(mapDataSchema.parse(await response.json()));
      })
      .then(
        (loaded) => {
          if (!current) return;
          if (loaded) setData(loaded);
          else setFailed(true);
        },
        (error: unknown) => {
          console.error("Loading the server map failed", error);
          if (current) setFailed(true);
        },
      );
    return () => {
      current = false;
    };
  }, [server.id]);

  const players = useMemo(() => data?.players ?? [], [data]);
  const axes = useMemo(() => fittedBounds(players.length > 0 ? players : [{ x: 0, y: 0 }]), [players]);
  /** The chosen players framed; without any, the middle of the server's players. */
  const frame = useCallback(
    (chips: readonly Chip[]) => {
      const chosen = [...highlightedPlayers(chips, players).keys()];
      setZoom(frameRequest(chosen.length > 0 ? chosen : players, axes, Date.now()));
    },
    [players, axes],
  );

  /** Opens what the address asks for: a shared map, a target, else the last map of this browser. */
  const open = useCallback(() => {
    const request = requestedMap(new URL(window.location.href));
    const initial =
      request.kind === "state"
        ? request.state
        : request.kind === "target"
          ? { ...EMPTY_STATE, chips: initialChips(null, null, request.target, palette.chips) }
          : request.kind === "none"
            ? (readStored(server.id) ?? { ...EMPTY_STATE })
            : { ...EMPTY_STATE };
    setInvalidLink(request.kind === "invalid");
    setState(initial);
    frame(initial.chips);
  }, [server.id, palette.chips, frame]);

  // The state at opening, once the players are known.
  const opened = useRef(false);
  useEffect(() => {
    if (!data || opened.current) return;
    opened.current = true;
    open();
  }, [data, open]);

  // A link pasted in this tab only changes the fragment: the page does not reload.
  useEffect(() => {
    if (!data) return;
    window.addEventListener("hashchange", open);
    return () => {
      window.removeEventListener("hashchange", open);
    };
  }, [data, open]);

  // Each change goes to the fragment of the address (to share it, never sent to the site) and to the browser (to come
  // back to it). replaceState: no history entry for each change.
  useEffect(() => {
    if (!state) return;
    const encoded = encodeMapState(state);
    window.history.replaceState(null, "", `/${server.id}/map#p=${encoded}`);
    // A link that could not be read keeps this browser's last map until the visitor changes something.
    if (invalidLink) return;
    try {
      localStorage.setItem(storageKey(server.id), encoded);
    } catch {
      // Private browsing or storage refused: the address still holds the state.
    }
  }, [state, server.id, invalidLink]);

  const chips = useMemo(() => state?.chips ?? [], [state]);
  const highlighted = useMemo(() => highlightedPlayers(chips, players), [chips, players]);
  const reference: Player | null = players.find((player) => player.id === state?.reference) ?? null;
  const level = useMemo(() => ({ level: state?.level ?? 0, estimated: false }), [state?.level]);
  const rows = useMemo(
    () => (reference ? tableRows(reference, highlighted, level) : []),
    [reference, highlighted, level],
  );

  if (failed)
    return (
      <p className="text-sm text-muted-foreground">
        La carte de {server.name} n&apos;est pas encore prête : le site n&apos;a pas encore relu ce serveur. Revenez
        dans une heure.
      </p>
    );
  if (!data || !state) return <p className="text-sm text-muted-foreground">Chargement des positions…</p>;

  const change = (next: Partial<MapState>, { reframe = false } = {}) => {
    setInvalidLink(false);
    setState({ ...state, ...next });
    if (reframe && next.chips) frame(next.chips);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {formatNumber(players.length)} joueurs · positions de l&apos;export du{" "}
        {/* « 6 h 00 » stays on one line on a phone. */}
        <span className="whitespace-nowrap">{formatDateTime(versionDate(data.version))}</span>
      </p>
      {invalidLink && (
        <p role="status" className="border border-warning-border bg-warning-soft px-3 py-2 text-sm rounded-[0.625rem]">
          Ce lien n&apos;est pas valide : la carte s&apos;ouvre vide.
        </p>
      )}
      <ChipBar
        players={players}
        alliances={data.alliances}
        chips={chips}
        palette={palette}
        referenceField={reference?.field ?? null}
        onChips={(next, options) => change({ chips: next }, options)}
        onAdd={(target) => change({ chips: addChip(chips, target, palette.chips) }, { reframe: true })}
      />
      <MapChart
        palette={palette}
        players={players}
        highlighted={highlighted}
        reference={reference}
        level={level}
        focusedId={focusedId}
        axes={axes}
        zoom={zoom}
        display={display}
        onDisplay={(next) => setDisplay((current) => ({ ...current, ...next }))}
        onFrame={() => frame(chips)}
        onZoom={setZoom}
        onReference={(player) => change({ reference: player.id })}
        onOpen={(player) => router.push(`/${server.id}/players/${String(player.id)}`)}
      />
      {reference ? (
        <section className="space-y-2" aria-label="Distances">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span>
              Distances et trajets depuis <b>{reference.pseudo}</b>
            </span>
            <label className="flex items-center gap-2">
              Vitesse d&apos;attaque
              <NumberField
                value={state.level}
                rules={{ min: 0, max: 100, integer: true }}
                aria-label={`Vitesse d'attaque de ${reference.pseudo}`}
                className="w-16"
                onCommit={(value) => change({ level: value ?? 0 })}
              />
            </label>
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => change({ reference: null })}
            >
              ne plus mesurer
            </button>
          </div>
          <PlayerTable
            server={server.id}
            rows={rows}
            onFocus={setFocusedId}
            onZoom={(player) => setZoom(zoomAround(player, axes, Date.now()))}
            onReference={(player) => change({ reference: player.id })}
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cliquez sur un joueur de la carte pour mesurer les distances et les trajets depuis lui.
        </p>
      )}
    </div>
  );
}
