import { describeChange } from "@optizzz/game/changes";
import { formatDateTime } from "@optizzz/game/format/time-format";
import Link from "next/link";
import { journalGroupOf, journalTag } from "~/lib/server-stats";
import type { JournalLine } from "~/server/queries";

// The kind's word takes its group's tone; the word itself tells the kinds apart (ADR 0003).
const TONES = {
  players: "text-foreground",
  alliances: "text-muted-foreground",
  colonies: "text-primary",
  diplomacy: "text-info",
};

/** Journal lines, latest first; `named` adds who changed (a server's feed), `timed={false}` drops the time (lines
 * under a heading that gives it). */
export function JournalList({
  server,
  lines,
  named,
  timed = true,
}: {
  server: string;
  lines: JournalLine[];
  named: boolean;
  timed?: boolean;
}) {
  if (lines.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">Aucun changement noté depuis le premier relevé du site.</p>;
  return (
    <ul className="divide-y text-sm">
      {lines.map((line) => (
        <li
          key={line.id}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 px-4 py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
        >
          <span
            className={`pt-0.5 font-mono text-[0.6875rem] tracking-wider uppercase ${TONES[journalGroupOf(line.change.kind)]}`}
          >
            {journalTag(line.change)}
          </span>
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
            {describeChange(line.change)}
          </span>
          {timed && (
            <time
              dateTime={line.at.toISOString()}
              className="col-start-2 font-mono text-xs text-muted-foreground sm:col-start-3"
            >
              {formatDateTime(line.at)}
            </time>
          )}
        </li>
      ))}
    </ul>
  );
}
