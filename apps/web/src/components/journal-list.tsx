import { describeChange, type Change } from "@optizzz/game/changes";
import { formatDateTime } from "@optizzz/game/format/time-format";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChangeStamp } from "~/components/change-stamp";
import { JOURNAL_GROUPS, journalGroupOf } from "~/lib/server-stats";
import type { JournalLine } from "~/server/queries";

/** The other names a Change speaks of: alliances lead to their sheet, players (known by name only) stand out. */
function namesOf(change: Change): { name: string; alliance: boolean }[] {
  switch (change.kind) {
    case "pseudo":
      return [{ name: change.from, alliance: false }];
    case "alliance":
      return [change.from, change.to].flatMap((tag) => (tag ? [{ name: tag, alliance: true }] : []));
    case "colonized":
      return [{ name: change.by, alliance: false }];
    case "freed":
      return [{ name: change.from, alliance: false }];
    case "joined":
    case "left":
      return [{ name: change.pseudo, alliance: false }];
    case "war":
    case "war-ended":
    case "pact":
    case "pact-ended":
      return [{ name: change.tag, alliance: true }];
    default:
      return [];
  }
}

const BEFORE = new Set([" ", "(", "'", "’"]);
const AFTER = new Set([" ", ")", ","]);

/** Where `name` stands as a whole word in `text`, -1 when it does not. */
function wordAt(text: string, name: string): number {
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    const before = at === 0 || BEFORE.has(text.charAt(at - 1));
    const end = at + name.length;
    if (before && (end === text.length || AFTER.has(text.charAt(end)))) return at;
  }
  return -1;
}

/** « a quitté ABC pour XYZ » with ABC and XYZ as links to their sheets. */
function describe(server: string, change: Change): ReactNode[] {
  const text = describeChange(change);
  const found = namesOf(change)
    .filter(({ name }) => name !== "")
    .map((entry) => ({ ...entry, at: wordAt(text, entry.name) }))
    .filter(({ at }) => at !== -1)
    .sort((a, b) => a.at - b.at);
  const parts: ReactNode[] = [];
  let from = 0;
  for (const { name, alliance, at } of found) {
    if (at < from) continue;
    parts.push(text.slice(from, at));
    parts.push(
      alliance ? (
        <Link
          key={at}
          href={`/${server}/alliances/${encodeURIComponent(name)}`}
          className="font-semibold hover:underline"
        >
          {name}
        </Link>
      ) : (
        <strong key={at} className="font-semibold">
          {name}
        </strong>
      ),
    );
    from = at + name.length;
  }
  parts.push(text.slice(from));
  return parts;
}

/** Journal lines, latest first; `named` adds who changed (a server's feed), `timed={false}` drops the time (lines
 * under a heading that gives it), `grouped` names the line's group on the right (« Diplomatie »). */
export function JournalList({
  server,
  lines,
  named,
  timed = true,
  grouped = false,
}: {
  server: string;
  lines: JournalLine[];
  named: boolean;
  timed?: boolean;
  grouped?: boolean;
}) {
  if (lines.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">Aucun changement noté depuis le premier relevé du site.</p>;
  const aside = timed || grouped;
  return (
    <ul className="divide-y divide-dashed text-sm">
      {lines.map((line) => (
        <li
          key={line.id}
          className={`grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 px-4.5 py-2 ${aside ? "sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]" : ""}`}
        >
          <ChangeStamp change={line.change} />
          <span>
            {named && (
              <>
                <Link
                  href={
                    line.playerId === null
                      ? `/${server}/alliances/${encodeURIComponent(line.tag ?? "")}`
                      : `/${server}/players/${String(line.playerId)}`
                  }
                  className="font-semibold hover:underline"
                >
                  {line.name}
                </Link>{" "}
              </>
            )}
            {describe(server, line.change)}
          </span>
          {timed ? (
            <time
              dateTime={line.at.toISOString()}
              className="col-start-2 font-mono text-xs text-muted-foreground sm:col-start-3"
            >
              {formatDateTime(line.at)}
            </time>
          ) : (
            grouped && (
              <span className="hidden font-mono text-xs text-muted-foreground sm:col-start-3 sm:block">
                {JOURNAL_GROUPS.find((group) => group.id === journalGroupOf(line.change.kind))?.label}
              </span>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
