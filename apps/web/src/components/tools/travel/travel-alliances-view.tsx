"use client";

// The travel tool towards alliances: the choice of alliances (by tag, ten at most), and the table of their members
// from the closest to the farthest. See docs/features/site-trajets.md.
import { formatNumber } from "@optizzz/game/format/number-format";
import { cn } from "cn";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { CloseIcon, CopyIcon } from "~/components/icons";
import { Panel, SmallLabel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { api } from "~/trpc/react";
import { rangeWord, tripsText, type AllianceTrip } from "./travel-alliances";
import { MAX_ALLIANCES } from "./travel-state";

/** « 1 membre », « 42 membres ». */
const membersCount = (count: number) => `${formatNumber(count)} membre${count > 1 ? "s" : ""}`;

/** Rows shown before « Voir plus », and added by each click. */
const PAGE_ROWS = 50;

function useAllianceSearch(text: string, server: string) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const search = api.alliances.search.useQuery({ server, q: query }, { enabled: query.length >= 1 });
  return {
    query,
    results: query.length >= 1 ? (search.data ?? []) : [],
    none: query.length >= 1 && search.data?.length === 0,
  };
}

/** The alliances chosen, each a tag that can be taken off, and the search that adds one. */
export function AlliancePicker({
  server,
  chosen,
  members,
  onAdd,
  onRemove,
}: {
  server: string;
  chosen: readonly string[];
  /** Members per tag, once read. */
  members: ReadonlyMap<string, number> | undefined;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [text, setText] = useState("");
  const listId = useId();
  const inputId = useId();
  const { query, results, none } = useAllianceSearch(text, server);
  const full = chosen.length >= MAX_ALLIANCES;

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-sm">
        <label htmlFor={inputId} className="block">
          <SmallLabel>Alliances ({MAX_ALLIANCES} au plus)</SmallLabel>
        </label>
        <div className="relative max-w-80">
          <Input
            id={inputId}
            type="search"
            value={text}
            disabled={full}
            onChange={(event) => setText(event.target.value)}
            placeholder={full ? `${String(MAX_ALLIANCES)} alliances choisies` : "Tag ou nom d'une alliance"}
            aria-controls={listId}
          />
          {!full && results.length > 0 && (
            <ul
              id={listId}
              className="absolute right-0 left-0 z-10 mt-1 overflow-hidden border bg-popover text-sm shadow-md rounded-lg"
            >
              {results.map((alliance) => (
                <li key={alliance.tag}>
                  <button
                    type="button"
                    disabled={chosen.includes(alliance.tag)}
                    className="flex w-full flex-wrap justify-between gap-x-3 px-3 py-2 text-left hover:bg-muted disabled:opacity-60"
                    onClick={() => {
                      onAdd(alliance.tag);
                      setText("");
                    }}
                  >
                    <span>
                      <b>{alliance.tag}</b> <span className="text-muted-foreground">{alliance.name}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {chosen.includes(alliance.tag) ? "déjà choisie" : membersCount(alliance.playersCount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!full && none && (
            <p className="absolute right-0 left-0 z-10 mt-1 border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md rounded-lg">
              Aucune alliance ne commence par « {query} ».
            </p>
          )}
        </div>
      </div>
      {chosen.length > 0 && (
        <ul aria-label="Alliances choisies" className="flex flex-wrap gap-2">
          {chosen.map((tag) => {
            const count = members?.get(tag);
            return (
              <li
                key={tag}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-accent pr-1 pl-3 text-sm"
              >
                <b>{tag}</b>
                <span className="text-muted-foreground">{count === undefined ? "…" : membersCount(count)}</span>
                <button
                  type="button"
                  aria-label={`Retirer ${tag}`}
                  onClick={() => onRemove(tag)}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <CloseIcon width={14} height={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const head = "text-xs font-medium text-muted-foreground";

/** « 87 membres, 3 alliances ». */
const membersTitle = (members: number, alliances: number) =>
  `${membersCount(members)}, ${String(alliances)} alliance${alliances > 1 ? "s" : ""}`;

/** The members of the alliances chosen, from the closest to the farthest, 50 at a time. */
export function AllianceTripsTable({
  server,
  trips,
  alliances,
  senderPseudo,
  departureText,
}: {
  server: string;
  trips: readonly AllianceTrip[];
  alliances: number;
  /** Null from a position: no attack range. */
  senderPseudo: string | null;
  /** « maintenant », « demain 8 h 00 ». */
  departureText: string;
}) {
  const [onlyInRange, setOnlyInRange] = useState(false);
  const [shownRows, setShownRows] = useState(PAGE_ROWS);
  const withRange = senderPseudo !== null;
  const kept = withRange && onlyInRange ? trips.filter((trip) => trip.range === "in") : trips;
  const shown = kept.slice(0, shownRows);
  const left = kept.length - shown.length;

  return (
    <Panel
      flush
      title={membersTitle(trips.length, alliances)}
      aside={
        <div className="flex flex-wrap items-center gap-3">
          {withRange && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyInRange}
                onChange={(event) => setOnlyInRange(event.target.checked)}
                className="size-4.5 accent-primary"
              />
              Seulement à portée
            </label>
          )}
          <CopyTableButton text={tripsText(kept)} />
        </div>
      }
    >
      <p className="px-4.5 pb-2 text-sm text-muted-foreground">
        Du plus proche au plus loin, départ {departureText}.
        {withRange && ` Portée d'après le TDC de ${senderPseudo} (de 50 % à 300 %).`}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={cn(head, "pl-4.5")}>Joueur</TableHead>
            <TableHead className={cn(head, "hidden sm:table-cell")}>Alliance</TableHead>
            <TableHead className={cn(head, "hidden text-right sm:table-cell")}>Distance</TableHead>
            <TableHead className={cn(head, "text-right")}>Trajet</TableHead>
            <TableHead className={cn(head, "pr-4.5 sm:pr-2")}>Arrivée</TableHead>
            <TableHead className={cn(head, "hidden text-right md:table-cell")}>TDC</TableHead>
            {withRange && <TableHead className={cn(head, "hidden pr-4.5 md:table-cell")}>Portée</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((trip) => {
            const range = rangeWord(trip);
            return (
              <TableRow key={trip.id} className={cn(trip.onHoliday && "text-muted-foreground")}>
                <TableCell className="pl-4.5 whitespace-normal">
                  <Link href={`/${server}/players/${String(trip.id)}`} className="font-semibold hover:underline">
                    {trip.pseudo}
                  </Link>
                  {/* On a phone, the columns hidden under the pseudo. */}
                  <span className="block text-xs text-muted-foreground md:hidden">
                    <span className="sm:hidden">
                      {trip.alliance} · {trip.distance} cases ·{" "}
                    </span>
                    TDC {formatNumber(trip.field)}
                    {range && ` · ${range}`}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{trip.alliance}</TableCell>
                <TableCell className="hidden text-right font-mono sm:table-cell">{trip.distance}</TableCell>
                <TableCell className="text-right font-mono">{trip.time}</TableCell>
                <TableCell className="pr-4.5 whitespace-normal sm:pr-2">{trip.arrivalText}</TableCell>
                <TableCell className="hidden text-right font-mono md:table-cell">{formatNumber(trip.field)}</TableCell>
                {withRange && <TableCell className="hidden pr-4.5 md:table-cell">{range}</TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {kept.length === 0 && (
        <p className="px-4.5 py-3 text-sm text-muted-foreground">
          {trips.length === 0 ? "Aucun membre dans ces alliances." : "Aucun membre à portée."}
        </p>
      )}
      {left > 0 && (
        <div className="border-t px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShownRows((rows) => rows + PAGE_ROWS)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Voir plus ({formatNumber(left)} restant{left > 1 ? "s" : ""}) ↓
          </button>
        </div>
      )}
    </Panel>
  );
}

/** « Copier le tableau »: the rows kept by the filter, one line each, to paste on Discord. */
function CopyTableButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <>
      <span role="status" className="text-xs text-muted-foreground">
        {copied === "done" && "Tableau copié."}
        {copied === "failed" && "La copie a échoué."}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={!text}
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => setCopied("done"),
            () => setCopied("failed"),
          );
        }}
      >
        <CopyIcon />
        Copier le tableau
      </Button>
    </>
  );
}
