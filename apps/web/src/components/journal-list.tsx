import { describeChange } from "@optizzz/game/changes";
import { formatDateTime } from "@optizzz/game/format/time-format";
import Link from "next/link";
import type { JournalLine } from "~/server/queries";

/** Journal lines, latest first; `named` adds who changed (a server's feed). */
export function JournalList({ server, lines, named }: { server: string; lines: JournalLine[]; named: boolean }) {
  if (lines.length === 0)
    return <p className="text-sm text-muted-foreground">Aucun changement noté depuis le premier relevé du site.</p>;
  return (
    <ul className="divide-y text-sm">
      {lines.map((line) => (
        <li key={line.id} className="flex flex-wrap justify-between gap-x-4 py-2">
          <span>
            {named && (
              <>
                <Link
                  href={
                    line.playerId === null
                      ? `/${server}/alliances/${encodeURIComponent(line.tag ?? "")}`
                      : `/${server}/joueurs/${String(line.playerId)}`
                  }
                  className="font-medium hover:underline"
                >
                  {line.name}
                </Link>{" "}
              </>
            )}
            {describeChange(line.change)}
          </span>
          <time dateTime={line.at.toISOString()} className="text-muted-foreground">
            {formatDateTime(line.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
