"use client";

// The period of the statistics of the « Convois » and « Floods » tabs (docs/features/site-envois.md, « La période
// libre »): a few fixed periods, or « Du … au … », two Paris days kept within what the site keeps, which it says.
import { dayMonth } from "@optizzz/game/format/time-format";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { addDays, dayStart, parisDay, type DayRange } from "~/lib/envois/period";
import { FIELD_LABEL } from "./parts";

const RANGE = "range";

export function PeriodPicker<Fixed extends string | number>({
  options,
  value,
  range,
  kept,
  keptText,
  now,
  onFixed,
  onRange,
}: {
  options: readonly { value: Fixed; label: string }[];
  value: Fixed;
  /** The free period as kept within its bounds, null for a fixed one. */
  range: DayRange | null;
  /** How many days the site keeps, today included. */
  kept: number;
  /** « Les convois sont gardés 90 jours » : the bound written under the days. */
  keptText: string;
  now: Date;
  onFixed: (value: Fixed) => void;
  onRange: (range: DayRange) => void;
}) {
  const today = parisDay(now);
  const oldest = addDays(today, 1 - kept);
  const all = [...options, { value: RANGE, label: "Du … au …" }] as const;
  const field = "block h-9 rounded-lg border bg-background px-2 text-sm";
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
      <div className="space-y-1">
        <span className={FIELD_LABEL}>Période</span>
        <Segmented<Fixed | typeof RANGE>
          label="Période"
          options={all}
          value={range ? RANGE : value}
          onChange={(next) => {
            if (next !== RANGE) onFixed(next);
            // The last 7 days to begin with.
            else if (!range) onRange({ from: addDays(today, 1 - Math.min(7, kept)), to: today });
          }}
        />
      </div>
      {range && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className={FIELD_LABEL}>Du</span>
              <input
                type="date"
                className={field}
                value={range.from}
                min={oldest}
                max={today}
                onChange={(event) => {
                  if (event.target.value) onRange({ ...range, from: event.target.value });
                }}
              />
            </label>
            <label className="space-y-1">
              <span className={FIELD_LABEL}>Au</span>
              <input
                type="date"
                className={field}
                value={range.to}
                min={oldest}
                max={today}
                onChange={(event) => {
                  if (event.target.value) onRange({ ...range, to: event.target.value });
                }}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {keptText} : pas avant le {dayMonth(new Date(dayStart(oldest)))}.
          </p>
        </div>
      )}
    </div>
  );
}
