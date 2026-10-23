"use client";

// The tools' player picker (travel, flood): a server, then a player by pseudo (from two letters, like the header's
// search) or a position (x and y). It gives the player's id, pseudo, position and hunting field (TDC), read in the
// site's database. A tool's link keeps only the id (`PickedEnd`); `usePickedPlayer` reads the rest back.
// See docs/features/site-outils.md.
import { formatNumber } from "@optizzz/game/format/number-format";
import { SERVERS } from "@optizzz/game/servers";
import { useId, useState } from "react";
import { NumberField } from "~/components/number-field";
import { usePlayerSearch } from "~/components/search-box";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

/** What a tool keeps of a choice, in its link. */
export type PickedEnd = { kind: "player"; id: number } | { kind: "position"; x: number | null; y: number | null };

/** A player as the latest export shows them. */
export interface PickedPlayer {
  server: string;
  id: number;
  pseudo: string;
  alliance: string | null;
  x: number;
  y: number;
  /** Hunting field (TDC), cm². */
  field: number;
}

/** The server field of a tool; null: none chosen (positions only). */
export function ServerSelect({ value, onChange }: { value: string | null; onChange: (server: string | null) => void }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="block">Serveur</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="block h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
      >
        <option value="">Aucun (positions seulement)</option>
        {SERVERS.map((server) => (
          <option key={server.id} value={server.id}>
            {server.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The chosen player, read back from the site's database; undefined while loading, null when gone or not a player. */
export function usePickedPlayer(server: string | null, end: PickedEnd | null): PickedPlayer | null | undefined {
  const id = end?.kind === "player" ? end.id : null;
  const query = api.players.byId.useQuery(
    { server: server ?? "", id: id ?? 0 },
    { enabled: server !== null && id !== null },
  );
  if (server === null || id === null) return null;
  return query.isPending ? undefined : (query.data ?? null);
}

const playerLine = (player: PickedPlayer) =>
  `${player.alliance ? `${player.alliance} · ` : ""}TDC ${formatNumber(player.field)} · x ${String(player.x)}, y ${String(player.y)}`;

/**
 * One end of a tool: a player of `server` or a position. Without a server, only a position. `onChange` gives the
 * player read in the database with the choice (null for a position).
 */
export function PlayerPicker({
  label,
  server,
  value,
  onChange,
}: {
  label: string;
  server: string | null;
  value: PickedEnd | null;
  onChange: (end: PickedEnd | null, player: PickedPlayer | null) => void;
}) {
  // Chosen by the visitor; until then, a player as soon as there is a server.
  const [mode, setMode] = useState<PickedEnd["kind"] | null>(null);
  const shownMode = server ? (mode ?? value?.kind ?? "player") : "position";
  const picked = usePickedPlayer(server, value);
  const position = value?.kind === "position" ? value : { kind: "position" as const, x: null, y: null };

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {server && (
        <div className="flex gap-1" role="group" aria-label={`${label} : joueur ou position`}>
          {(["player", "position"] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              size="sm"
              variant={shownMode === kind ? "secondary" : "ghost"}
              aria-pressed={shownMode === kind}
              onClick={() => {
                setMode(kind);
                if (value && value.kind !== kind) onChange(null, null);
              }}
            >
              {kind === "player" ? "Joueur" : "Position"}
            </Button>
          ))}
        </div>
      )}
      {shownMode === "position" ? (
        <div className="flex flex-wrap gap-3">
          {(["x", "y"] as const).map((axis) => (
            <label key={axis} className="space-y-1 text-sm">
              <span className="block">{axis}</span>
              <NumberField
                value={position[axis]}
                rules={{ min: 0, integer: true, allowEmpty: true }}
                aria-label={`${label} : ${axis}`}
                className="w-24"
                onCommit={(next) => onChange({ ...position, [axis]: next }, null)}
              />
            </label>
          ))}
        </div>
      ) : value?.kind === "player" && server ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {picked ? (
            <span>
              <b>{picked.pseudo}</b> <span className="text-muted-foreground">{playerLine(picked)}</span>
            </span>
          ) : picked === null ? (
            <span className="text-muted-foreground">Ce joueur n&apos;est plus dans l&apos;export de ce serveur.</span>
          ) : (
            <span className="text-muted-foreground">Chargement du joueur…</span>
          )}
          <Button type="button" variant="link" size="sm" className="px-0" onClick={() => onChange(null, null)}>
            Changer
          </Button>
        </div>
      ) : (
        server && (
          <PlayerSearch
            label={label}
            server={server}
            onPick={(player) => onChange({ kind: "player", id: player.id }, player)}
          />
        )
      )}
    </fieldset>
  );
}

function PlayerSearch({
  label,
  server,
  onPick,
}: {
  label: string;
  server: string;
  onPick: (player: PickedPlayer) => void;
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const { query, results, none } = usePlayerSearch(text, server);

  return (
    <div className="relative max-w-80">
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Pseudo (deux lettres au moins)"
        aria-label={`${label} : pseudo`}
        aria-controls={listId}
      />
      {results.length > 0 && (
        <ul
          id={listId}
          className="absolute right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border bg-popover text-sm shadow-md"
        >
          {results.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                className="flex w-full flex-wrap justify-between gap-x-3 px-3 py-2 text-left hover:bg-muted"
                onClick={() => onPick(player)}
              >
                <span>{player.pseudo}</span>
                <span className="text-muted-foreground">{playerLine(player)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {none && (
        <p className="absolute right-0 left-0 z-10 mt-1 rounded-lg border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          Aucun joueur ne commence par « {query} ».
        </p>
      )}
    </div>
  );
}
