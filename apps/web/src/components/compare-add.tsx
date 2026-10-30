"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { PlusIcon } from "~/components/icons";
import { usePlayerSearch } from "~/components/search-box";
import { Input } from "~/components/ui/input";
import { compareHref, MAX_COMPARED, type CompareState } from "~/lib/compare";

/**
 * The field that adds one to the Comparer: a player picked among those whose pseudo starts with what is typed, or a
 * name sent as is (an alliance's tag, a whole pseudo) for the page to look up.
 */
export function CompareAdd({ server, state }: { server: string; state: CompareState }) {
  const [text, setText] = useState("");
  const listId = useId();
  const players = state.kind === "players";
  const { results } = usePlayerSearch(players ? text : "", server);
  const shown = results.filter((player) => !state.ids.includes(String(player.id)));

  return (
    <form action={`/${server}/compare`} className="relative w-full sm:w-72">
      {state.kind !== "players" && <input type="hidden" name="type" value={state.kind} />}
      {state.ids.length > 0 && <input type="hidden" name="ids" value={state.ids.join(",")} />}
      {state.metric !== "field" && <input type="hidden" name="courbe" value={state.metric} />}
      {state.period !== "all" && <input type="hidden" name="periode" value={state.period} />}
      <label className="flex h-9 items-center gap-2 border border-dashed bg-background px-2 text-muted-foreground focus-within:border-solid focus-within:border-ring">
        <PlusIcon width={14} height={14} />
        <span className="sr-only">{players ? "Ajouter un joueur" : "Ajouter une alliance"}</span>
        <Input
          name="ajout"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            players ? `Ajouter un joueur (${String(MAX_COMPARED)} au plus)` : "Ajouter une alliance (son tag)"
          }
          autoComplete="off"
          aria-controls={players ? listId : undefined}
          className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </label>
      {shown.length > 0 && (
        <ul
          id={listId}
          className="absolute right-0 left-0 z-50 mt-1 overflow-hidden border bg-popover text-sm shadow-lg"
        >
          {shown.map((player) => (
            <li key={player.id}>
              <Link
                href={compareHref(server, { ...state, ids: [...state.ids, String(player.id)] })}
                onClick={() => setText("")}
                className="flex justify-between gap-3 px-3 py-2 hover:bg-accent"
              >
                <span>{player.pseudo}</span>
                {player.alliance && <span className="font-mono text-xs text-muted-foreground">{player.alliance}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
