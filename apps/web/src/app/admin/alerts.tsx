import { formatNumber } from "@optizzz/game/format/number-format";

/** The page's title: « Tout va bien », or how many points need a look. */
export const alertsTitle = (alerts: readonly string[]) =>
  alerts.length === 0 ? "Tout va bien" : `${formatNumber(alerts.length)} point${alerts.length > 1 ? "s" : ""} à voir`;

/** « À regarder »: what needs a look, each line with its sign (docs/adr/0003-daltonisme.md); nothing when all is well. */
export function AlertList({ alerts }: { alerts: readonly string[] }) {
  if (alerts.length === 0) return null;
  return (
    <section aria-labelledby="alerts" className="border border-warning-border bg-warning-soft">
      <h2
        id="alerts"
        className="border-b border-warning-border px-4 py-2.5 font-heading text-xl font-semibold tracking-wide uppercase"
      >
        À regarder
      </h2>
      <ul>
        {alerts.map((alert) => (
          <li key={alert} className="border-b border-warning-border px-4 py-2.5 last:border-b-0">
            <span aria-hidden="true">▲ </span>
            {alert}
          </li>
        ))}
      </ul>
    </section>
  );
}
