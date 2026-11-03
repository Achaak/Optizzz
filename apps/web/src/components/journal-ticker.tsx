import { describeChange } from "@optizzz/game/changes";
import { ChangeStamp } from "~/components/change-stamp";
import type { JournalLine } from "~/server/queries";

/** The latest Journal lines of a server scrolling along a band, paused under the pointer; still when motion is reduced. */
export function JournalTicker({ server, lines }: { server: string; lines: JournalLine[] }) {
  if (lines.length === 0) return null;
  const items = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex gap-10 px-5 py-3 whitespace-nowrap">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center gap-2.5">
          <ChangeStamp change={line.change} />
          <span>
            <strong className="font-semibold">{line.name}</strong> {describeChange(line.change)}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <section
      aria-label={`Derniers changements sur ${server}`}
      className="ticker-box relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-card text-sm shadow-panel"
    >
      <div className="ticker">
        {items(false)}
        {items(true)}
      </div>
    </section>
  );
}
