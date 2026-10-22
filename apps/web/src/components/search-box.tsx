"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

/** The header's search: a player on any server, from two letters on. */
export function SearchBox() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const listId = useId();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const search = api.players.search.useQuery({ q: query }, { enabled: query.length >= 2 });
  const results = query.length >= 2 ? (search.data ?? []) : [];

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
                href={`/${player.server}/joueurs/${String(player.id)}`}
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
      {query.length >= 2 && search.data?.length === 0 && (
        <p className="absolute right-0 left-0 z-10 mt-1 rounded-lg border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          Aucun joueur ne commence par « {query} ».
        </p>
      )}
    </div>
  );
}
