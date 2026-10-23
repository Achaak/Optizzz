"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

/** Players whose pseudo starts with what is typed, from two letters on: on every server, or on `server` alone. */
export function usePlayerSearch(text: string, server?: string) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const search = api.players.search.useQuery({ q: query, server }, { enabled: query.length >= 2 });
  return {
    query,
    results: query.length >= 2 ? (search.data ?? []) : [],
    /** Nothing found: worth saying. */
    none: query.length >= 2 && search.data?.length === 0,
  };
}

/** The header's search: a player on any server, from two letters on. */
export function SearchBox() {
  const [text, setText] = useState("");
  const listId = useId();
  const { query, results, none } = usePlayerSearch(text);

  return (
    <div className="relative w-full max-w-64">
      <Input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Rechercher un joueur"
        aria-label="Rechercher un joueur"
        aria-controls={listId}
      />
      {results.length > 0 && (
        <ul
          id={listId}
          className="absolute right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border bg-popover text-sm shadow-md"
        >
          {results.map((player) => (
            <li key={`${player.server}:${String(player.id)}`}>
              <Link
                href={`/${player.server}/players/${String(player.id)}`}
                className="flex justify-between gap-3 px-3 py-2 hover:bg-muted"
                onClick={() => setText("")}
              >
                <span>{player.pseudo}</span>
                <span className="text-muted-foreground">
                  {player.server.toUpperCase()}
                  {player.alliance ? ` · ${player.alliance}` : ""}
                </span>
              </Link>
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
