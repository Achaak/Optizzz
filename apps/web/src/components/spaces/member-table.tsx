"use client";

// The table of the « État » tab (docs/features/site-envois.md, « État : le tableau des membres »): one row per member,
// the columns chosen in the « Colonnes » menu (kept in this browser, the same for every space), the time of its
// reading under each value, greyed past 48 hours, and a sort on each header.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatPastTime, formatPastTimeShort } from "@optizzz/game/format/time-format";
import { productionPerDay } from "@optizzz/game/site-links/envoi-states";
import { sentCategoriesText } from "@optizzz/game/site-links/envois";
import { useMemo, useState, useSyncExternalStore } from "react";
import { readStorage, writeStorage } from "~/components/tools/browser-storage";
import { Button } from "~/components/ui/button";
import {
  COLUMN_GROUPS,
  DEFAULT_COLUMNS,
  cellChange,
  cellReadAt,
  huntsOut,
  isOld,
  levelOf,
  nextSort,
  nextWork,
  parseColumns,
  sortRows,
  toggleColumn,
  type Column,
  type ColumnKey,
  type Sort,
  type TableRow,
} from "~/lib/envois/member-table";
import { cn } from "cn";

const STORAGE_KEY = "optizzz:state-columns";
const COLUMNS = new Map<ColumnKey, Column>(COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => [c.key, c] as const)));
/** Columns of words, read from the left. */
const TEXT_COLUMNS: ReadonlySet<ColumnKey> = new Set(["nextWork", "sends", "lastEnvoi"]);
/** Under these headers, what the arrows mean, so that they never carry it alone. */
const HEADER_HINTS: Partial<Record<ColumnKey, string>> = {
  convoys: "↑ envoyés · ↓ reçus",
  floods: "↑ lancés · ↓ subis",
};

/** The columns kept by this page or by another tab of the site. */
const listeners = new Set<() => void>();
/** The last choice, for a browser that refuses to keep it (private browsing): it then lasts as long as the page. */
let chosen: string | null = null;
const readColumns = () => readStorage(STORAGE_KEY) ?? chosen;
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const sticky = "sticky left-0 z-[1] bg-card shadow-[1px_0_0_var(--border)]";
const empty = <span className="text-muted-foreground">—</span>;

function Dated({ children, readAt, now }: { children: React.ReactNode; readAt: Date | undefined; now: Date }) {
  if (!readAt) return <>{children}</>;
  return (
    <span
      className={isOld(readAt, now) ? "text-muted-foreground" : undefined}
      title={`relevé ${formatPastTime(readAt, now)}`}
    >
      {children}
      <span className="block font-mono text-[0.6875rem] text-muted-foreground">{formatPastTimeShort(readAt, now)}</span>
    </span>
  );
}

function Moves({ up, down, upLabel, downLabel }: { up: number; down: number; upLabel: string; downLabel: string }) {
  if (up + down === 0) return empty;
  return (
    <>
      <span aria-label={`${formatNumber(up)} ${upLabel}`}>↑ {formatNumber(up)}</span>
      {" · "}
      <span aria-label={`${formatNumber(down)} ${downLabel}`}>↓ {formatNumber(down)}</span>
    </>
  );
}

function Cell({ row, column, now }: { row: TableRow; column: ColumnKey; now: Date }) {
  const latest = row.states?.latest;
  const readAt = cellReadAt(row, column);
  switch (column) {
    case "production": {
      const perDay = latest?.production && productionPerDay(latest.production, now);
      if (!perDay) return empty;
      return (
        <Dated readAt={readAt} now={now}>
          {perDay.coloniesKnown ? "" : "≥ "}
          {formatNumber(perDay.total)}
        </Dated>
      );
    }
    case "nextWork": {
      const work = nextWork(row, now);
      if (!work) return null;
      return (
        <Dated readAt={readAt} now={now}>
          {work.name} {work.level}, fin {formatEndTime(work.endsAt, now)}
        </Dated>
      );
    }
    case "hunts": {
      const out = huntsOut(row, now);
      if (!out) return empty;
      const gain = out.reduce((sum, h) => sum + h.fieldGain, 0);
      return (
        <Dated readAt={readAt} now={now}>
          {out.length === 0 ? "aucune" : `${formatNumber(out.length)} · +${formatNumber(gain)} cm²`}
        </Dated>
      );
    }
    case "convoys": {
      const c = row.convoys;
      const title =
        c.received > 0 && c.nextArrival
          ? `vers ${row.pseudo} : ${formatNumber(c.food)} nourriture, ${formatNumber(c.materials)} matériaux, le prochain ${formatEndTime(c.nextArrival, now)}`
          : undefined;
      return (
        <span title={title}>
          <Moves up={c.sent} down={c.received} upLabel="envoyés" downLabel="reçus" />
        </span>
      );
    }
    case "floods": {
      const f = row.floods;
      return (
        <span title={f.nextArrival ? `le prochain arrive ${formatEndTime(f.nextArrival, now)}` : undefined}>
          <Moves up={f.launched} down={f.aimed} upLabel="lancés" downLabel="subis" />
        </span>
      );
    }
    case "sends":
      return <span className="text-xs">{sentCategoriesText(row.sends)}</span>;
    case "lastEnvoi":
      return row.lastEnvoi ? (
        <span className={isOld(row.lastEnvoi, now) ? "text-muted-foreground" : undefined}>
          {formatPastTime(row.lastEnvoi, now)}
        </span>
      ) : (
        <span className="text-muted-foreground">aucun</span>
      );
    default: {
      const value = levelOf(latest, column);
      if (value === undefined) return empty;
      const change = cellChange(row, column, now);
      return (
        <Dated readAt={readAt} now={now}>
          {formatNumber(value)}
          {change === "up" ? " ↑" : change === "down" ? " ↓" : ""}
          {column === "army" && latest?.army?.incomplete && (
            <span className="text-muted-foreground"> (incomplète)</span>
          )}
        </Dated>
      );
    }
  }
}

function ColumnsMenu({ columns, onChange }: { columns: readonly ColumnKey[]; onChange: (next: ColumnKey[]) => void }) {
  return (
    <details className="group">
      <summary className="inline-flex h-9.5 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-card px-3 select-none [&::-webkit-details-marker]:hidden">
        Colonnes · {formatNumber(columns.length)}
        <span aria-hidden="true" className="text-muted-foreground group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-2 space-y-3 rounded-[0.875rem] border border-border bg-card p-4 shadow-panel">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-x-5 gap-y-3">
          {COLUMN_GROUPS.map((group) => (
            <fieldset key={group.label} className="min-w-0 space-y-0.5">
              <legend className="pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group.label}
              </legend>
              {group.columns.map((column) => (
                <label key={column.key} className="flex min-h-8 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={columns.includes(column.key)}
                    onChange={() => onChange(toggleColumn(columns, column.key))}
                    className="size-4 accent-primary"
                  />
                  {column.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...DEFAULT_COLUMNS])}>
            Colonnes par défaut
          </Button>
          <span className="text-xs text-muted-foreground">
            Gardées dans ce navigateur, les mêmes pour tous vos espaces. «&nbsp;Membre&nbsp;» reste toujours.
          </span>
        </div>
      </div>
    </details>
  );
}

export function MemberTable({ rows, now }: { rows: readonly TableRow[]; now: Date }) {
  const stored = useSyncExternalStore(subscribe, readColumns, () => null);
  const columns = useMemo(() => parseColumns(stored), [stored]);
  const [sort, setSort] = useState<Sort | null>(null);
  const choose = (next: ColumnKey[]) => {
    chosen = JSON.stringify(next);
    writeStorage(STORAGE_KEY, chosen);
    for (const listener of listeners) listener();
  };
  const sorted = sortRows(rows, sort, now);
  const ariaSort = (key: ColumnKey) => (sort?.key === key ? sort.direction : "none");

  return (
    <div className="space-y-3">
      <ColumnsMenu columns={columns} onChange={choose} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">
            État des membres
            {sort &&
              `, trié par ${COLUMNS.get(sort.key)?.label ?? ""} ${sort.direction === "descending" ? "décroissant" : "croissant"}`}
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={cn("px-2 py-2 text-left font-medium", sticky)}>
                Membre
              </th>
              {columns.map((key) => {
                const text = TEXT_COLUMNS.has(key);
                const hint = HEADER_HINTS[key];
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={ariaSort(key)}
                    className={cn(
                      "px-2 py-2 align-bottom font-medium whitespace-nowrap",
                      text ? "text-left" : "text-right",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSort((current) => nextSort(current, key))}
                      className={cn(
                        "min-h-8 cursor-pointer leading-tight",
                        text ? "text-left" : "text-right",
                        sort?.key === key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {COLUMNS.get(key)?.label}
                      {sort?.key === key && (
                        <span aria-hidden="true" className="text-primary">
                          {sort.direction === "descending" ? " ▼" : " ▲"}
                        </span>
                      )}
                      {hint && <span className="block text-xs font-normal">{hint}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.pseudo} className="border-b border-border last:border-0 hover:bg-muted/50">
                <th scope="row" className={cn("px-2 py-1.5 text-left align-top font-medium whitespace-nowrap", sticky)}>
                  {row.pseudo}
                </th>
                {columns.map((key) => (
                  <td
                    key={key}
                    className={cn(
                      "px-2 py-1.5 align-top",
                      key === "sends" ? "min-w-40 max-w-56" : "whitespace-nowrap",
                      TEXT_COLUMNS.has(key) ? "text-left" : "text-right",
                    )}
                  >
                    <Cell row={row} column={key} now={now} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
