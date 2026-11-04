"use client";

// « Ce qui entre, ce qui sort » under the Équilibre table (docs/features/site-envois.md, « Ce qui entre, ce qui
// sort »): each member's production, taxes and convoys a day of presence, what comes in right of the axis, what goes
// out left of it, their rest marked against the alliance's average Part. Each segment is told by its side, its place
// from the axis and its pattern as well as its colour, and the legend says it in words (ADR 0003). Drawn in HTML
// rather than Recharts: on a phone the name sits above a full-width bar.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { cn } from "cn";
import { useState, type CSSProperties } from "react";
import type { InOut, InOutRow } from "~/lib/envois/balance";
import { Panel } from "./parts";

type Segment = "production" | "taxesIn" | "convoysIn" | "convoysOut" | "taxesOut";

const hatch = (color: string, soft: string) =>
  `repeating-linear-gradient(45deg, ${color} 0 3px, color-mix(in oklab, ${soft} 75%, ${color}) 3px 6px)`;

const SEGMENTS: Record<Segment, { label: string; where: string; style: CSSProperties }> = {
  production: {
    label: "Production",
    where: "à droite, contre l'axe, plein",
    style: { background: "var(--chart-1)" },
  },
  taxesIn: {
    label: "Taxes reçues",
    where: "à droite, ensuite, pointillé",
    style: {
      backgroundColor: "var(--chart-3)",
      backgroundImage: "radial-gradient(var(--card) 1.1px, transparent 1.5px)",
      backgroundSize: "5px 5px",
    },
  },
  convoysIn: {
    label: "Convois reçus",
    where: "à droite, au bout, hachuré",
    style: { background: hatch("var(--chart-1)", "var(--card)") },
  },
  convoysOut: {
    label: "Convois livrés",
    where: "à gauche, contre l'axe, plein",
    style: { background: "var(--chart-2)" },
  },
  taxesOut: {
    label: "Taxe versée",
    where: "à gauche, au bout, hachuré",
    style: { background: hatch("var(--chart-2)", "var(--card)") },
  },
};

const RIGHT: readonly Segment[] = ["production", "taxesIn", "convoysIn"];
const LEFT: readonly Segment[] = ["convoysOut", "taxesOut"];

const valueOf = (row: InOutRow, segment: Segment) =>
  ({
    production: row.in.production,
    taxesIn: row.in.taxes,
    convoysIn: row.in.convoys,
    convoysOut: row.out.convoys,
    taxesOut: row.out.taxes,
  })[segment];

function Swatch({ segment }: { segment: Segment }) {
  return <span aria-hidden className="inline-block h-3 w-[18px] shrink-0" style={SEGMENTS[segment].style} />;
}

function RestIcon() {
  return (
    <svg width={14} height={16} viewBox="0 0 14 16" aria-hidden className="shrink-0">
      <rect x={5.5} y={3} width={3} height={13} fill="currentColor" />
      <rect x={3.5} y={0.5} width={7} height={7} transform="rotate(45 7 4)" fill="currentColor" />
    </svg>
  );
}

const perDay = (value: number) => `${formatCompact(value)}/j`;

/** The row in words, for a screen reader. */
function rowLabel(row: InOutRow): string {
  if (!row.present) return `${row.pseudo} : pas dans l'alliance sur la période`;
  const inflow = row.in.production + row.in.taxes + row.in.convoys;
  const out = row.out.convoys + row.out.taxes;
  const days = row.days === null ? "" : ` (${String(row.days)} jour${row.days > 1 ? "s" : ""})`;
  const rest = row.rest === null ? "partiel" : `reste ${formatCompact(row.rest)}`;
  return `${row.pseudo}${days} : par jour, entre ${formatCompact(inflow)}, sort ${formatCompact(out)}, ${rest}`;
}

function Bar({ row, at }: { row: InOutRow; at: (value: number) => number }) {
  const pieces: { segment: Segment; from: number; to: number }[] = [];
  for (const [segments, sign] of [
    [RIGHT, 1],
    [LEFT, -1],
  ] as const) {
    let edge = 0;
    for (const segment of segments) {
      const value = valueOf(row, segment);
      if (value <= 0) continue;
      pieces.push({ segment, from: edge, to: edge + sign * value });
      edge += sign * value;
    }
  }
  return (
    <span className={cn("absolute inset-0 block", row.partial && "opacity-50")}>
      {pieces.map(({ segment, from, to }) => {
        const left = at(Math.min(from, to));
        return (
          <span
            key={segment}
            className="absolute inset-y-0 block"
            style={{
              ...SEGMENTS[segment].style,
              left: `calc(${String(left)}% + 1px)`,
              width: `max(1px, calc(${String(at(Math.max(from, to)) - left)}% - 2px))`,
            }}
          />
        );
      })}
    </span>
  );
}

function Track({ row, chart, part }: { row: InOutRow; chart: InOut; part: number }) {
  const at = (value: number) => (100 * (value - chart.min)) / (chart.max - chart.min);
  return (
    <span className="relative block h-4">
      {chart.ticks.map((tick) => (
        <span
          key={tick}
          aria-hidden
          className={cn(
            "absolute block w-0",
            tick === 0 ? "-inset-y-1.5 border-l-2 border-muted-foreground" : "-inset-y-1 border-l border-border",
          )}
          style={{ left: `${String(at(tick))}%` }}
        />
      ))}
      {row.present && <Bar row={row} at={at} />}
      <span
        aria-hidden
        className="absolute -inset-y-1.5 block w-0 border-l-2 border-dashed border-foreground/70"
        style={{ left: `${String(at(part))}%` }}
      />
      {row.rest !== null && (
        <span
          aria-hidden
          className="absolute -inset-y-2 block text-foreground"
          style={{ left: `${String(at(row.rest))}%` }}
        >
          <span className="absolute inset-y-0 -ml-[1.5px] block w-[3px] bg-current shadow-[0_0_0_1.5px_var(--card)]" />
          <span className="absolute -top-1 -ml-[4.5px] block size-[9px] rotate-45 bg-current shadow-[0_0_0_1.5px_var(--card)]" />
        </span>
      )}
    </span>
  );
}

function Tip({ row, id }: { row: InOutRow; id: string }) {
  const lines = [...RIGHT, ...LEFT].filter((segment) => valueOf(row, segment) > 0);
  return (
    <span
      id={id}
      role="tooltip"
      className="absolute top-full right-0 z-10 mt-1 block w-64 space-y-0.5 rounded-[0.625rem] border bg-popover p-3 text-left text-xs text-popover-foreground shadow-lg"
    >
      <strong className="block text-sm">
        {row.pseudo} · par jour
        {row.days === null ? "" : ` sur ${String(row.days)} jour${row.days > 1 ? "s" : ""}`}
      </strong>
      {lines.map((segment) => (
        <span key={segment} className="flex items-center gap-1.5">
          <Swatch segment={segment} />
          <span className="text-muted-foreground">{SEGMENTS[segment].label}</span>
          <span className="ml-auto font-mono">
            {LEFT.includes(segment) ? "−" : "+"}
            {formatNumber(Math.round(valueOf(row, segment)))}
          </span>
        </span>
      ))}
      <span className="mt-1 flex gap-1.5 border-t pt-1">
        <strong>Reste</strong>
        <span className="ml-auto font-mono font-semibold">
          {row.rest === null ? "partiel" : formatNumber(Math.round(row.rest))}
        </span>
      </span>
      {row.part !== null && (
        <span className="flex gap-1.5">
          <span className="text-muted-foreground">Sa Part</span>
          <span className="ml-auto font-mono">{formatNumber(Math.round(row.part))}</span>
        </span>
      )}
      {row.partial && (
        <span className="block text-muted-foreground">
          N&apos;envoie pas «&nbsp;Convois&nbsp;» : seuls ses échanges avec ceux qui l&apos;envoient comptent.
        </span>
      )}
    </span>
  );
}

const GRID = "sm:grid sm:grid-cols-[minmax(7rem,13rem)_minmax(0,1fr)_6rem] sm:items-center sm:gap-4";

export function InOutChart({
  chart,
  partPerDay,
  chosen,
}: {
  chart: InOut;
  partPerDay: number;
  /** The member chosen (`?membre=`), highlighted. */
  chosen: string | null;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const at = (value: number) => (100 * (value - chart.min)) / (chart.max - chart.min);
  const zero = at(0);

  return (
    <Panel title="Ce qui entre, ce qui sort" aside="par jour de présence · même ordre que le tableau">
      <div className="space-y-3">
        <div aria-hidden className={cn("pb-1", GRID)}>
          <span className="hidden sm:block" />
          <span className="relative block h-10">
            <span
              className="absolute top-0 left-0 pr-2.5 text-right text-xs font-semibold text-chart-2"
              style={{ right: `${String(100 - zero)}%` }}
            >
              ← sort
            </span>
            <span
              className="absolute top-0 pl-2.5 text-xs font-semibold text-primary"
              style={{ left: `${String(zero)}%` }}
            >
              entre →
            </span>
            {chart.ticks.map((tick, i) => (
              <span
                key={tick}
                className={cn(
                  "absolute bottom-0 font-mono text-xs text-muted-foreground",
                  // The ends stay inside the panel.
                  i === 0 ? "" : i === chart.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: `${String(at(tick))}%` }}
              >
                {tick === 0 ? "0" : tick < 0 ? `−${formatCompact(-tick)}` : formatCompact(tick)}
              </span>
            ))}
          </span>
          <span className="hidden self-end text-right text-xs text-muted-foreground sm:block">Reste</span>
        </div>
        <ul aria-label="Ce qui entre et ce qui sort, par membre">
          {chart.rows.map((row) => {
            const tipId = `in-out-${row.pseudo}`;
            const highlighted = chosen !== null && chosen.toLowerCase() === row.pseudo.toLowerCase();
            return (
              <li key={row.pseudo} className="relative border-t">
                <button
                  type="button"
                  aria-label={rowLabel(row)}
                  aria-describedby={open === row.pseudo ? tipId : undefined}
                  disabled={!row.present}
                  onClick={() => setOpen((current) => (current === row.pseudo ? null : row.pseudo))}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") setOpen(row.pseudo);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") setOpen((current) => (current === row.pseudo ? null : current));
                  }}
                  onBlur={() => setOpen((current) => (current === row.pseudo ? null : current))}
                  className={cn(
                    "block w-full space-y-3 py-2.5 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring sm:space-y-0",
                    GRID,
                    highlighted && "bg-primary/10",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2 sm:block sm:text-right sm:leading-tight">
                    <span>
                      <span className="font-semibold">{row.pseudo}</span>
                      {row.days !== null && row.present && (
                        <span className="text-xs text-muted-foreground"> {row.days} j</span>
                      )}
                      {row.partial && (
                        <span className="block text-xs text-muted-foreground">
                          n&apos;envoie pas «&nbsp;Convois&nbsp;»
                        </span>
                      )}
                    </span>
                    <span className="font-mono sm:hidden">
                      {!row.present ? "" : row.rest === null ? "partiel" : perDay(row.rest)}
                    </span>
                  </span>
                  {row.present ? (
                    <Track row={row} chart={chart} part={partPerDay} />
                  ) : (
                    <span className="block text-xs text-muted-foreground">pas dans l&apos;alliance sur la période</span>
                  )}
                  <span className="hidden text-right font-mono sm:block">
                    {!row.present ? (
                      ""
                    ) : row.rest === null ? (
                      <span className="text-muted-foreground">partiel</span>
                    ) : (
                      perDay(row.rest)
                    )}
                  </span>
                </button>
                {open === row.pseudo && row.present && <Tip row={row} id={tipId} />}
              </li>
            );
          })}
        </ul>
        <ul aria-label="Légende" className="flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-2.5 text-xs">
          {[...RIGHT, ...LEFT].map((segment) => (
            <li key={segment} className="flex items-center gap-1.5">
              <Swatch segment={segment} />
              {SEGMENTS[segment].label} ({SEGMENTS[segment].where})
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <RestIcon />
            Reste par jour : entrées − sorties
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-4 w-0 border-l-2 border-dashed border-foreground/70" />
            Part moyenne par jour ({formatNumber(Math.round(partPerDay))})
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          La distance entre le Reste et la ligne de la Part moyenne montre l&apos;écart. Un membre arrivé en cours de
          période est compté sur ses jours de présence ; un membre qui n&apos;envoie pas «&nbsp;Convois&nbsp;» est pâle
          et n&apos;a pas de Reste.
        </p>
      </div>
    </Panel>
  );
}
