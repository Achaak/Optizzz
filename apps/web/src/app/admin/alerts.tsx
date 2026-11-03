import { formatNumber } from "@optizzz/game/format/number-format";
import type { AdminAlert } from "~/lib/admin/job-runs";

/** The page's title: « Tout va bien », or how many points need a look. */
export const alertsTitle = (alerts: readonly AdminAlert[]) =>
  alerts.length === 0 ? "Tout va bien" : `${formatNumber(alerts.length)} point${alerts.length > 1 ? "s" : ""} à voir`;

const TOPICS: Record<AdminAlert["topic"], string> = { cron: "Cron", backup: "Sauvegarde", discord: "Discord" };

/**
 * « À regarder »: what needs a look, each line after a stamp that names its topic with a sign (▲) and words, never the
 * colour alone (docs/adr/0003-daltonisme.md); nothing when all is well.
 */
export function AlertList({ alerts }: { alerts: readonly AdminAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section
      aria-labelledby="alerts"
      className="rounded-[0.875rem] border border-warning-border bg-warning-soft shadow-panel"
    >
      <h2 id="alerts" className="px-4.5 pt-4 pb-1.5 font-heading text-[1.375rem] font-bold tracking-wide uppercase">
        À regarder
      </h2>
      <ul>
        {alerts.map((alert, index) => (
          <li
            key={alert.text}
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-dashed border-warning-border px-4.5 py-2.5 last:border-b-0"
          >
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] border-2 border-dashed border-primary px-1.5 font-heading text-[0.8125rem] font-bold tracking-wider text-primary uppercase ${index % 2 === 0 ? "-rotate-2" : "rotate-1"}`}
            >
              <span aria-hidden="true">▲</span>
              {TOPICS[alert.topic]}
            </span>
            <span className="min-w-0 flex-[1_1_22rem]">{alert.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
