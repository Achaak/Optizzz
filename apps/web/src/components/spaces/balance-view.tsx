"use client";

// The « Équilibre » view of the Convois tab (docs/features/site-envois.md, « Équilibre des ressources »): who should
// convoy and who should receive, each member's Écart to their Part, and their Entrepôt estimé. The verdict is written
// in words with a shape, never told by a colour alone (ADR 0003). Worked out in this browser; the site sees none of it.
import { formatCompact, formatDecimal, formatNumber } from "@optizzz/game/format/number-format";
import { cn } from "cn";
import { Fragment, useState } from "react";
import { Stat, StatGrid } from "~/components/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { inOutOf, signedCompact, verdictText, type Balance, type BalanceRow, type Verdict } from "~/lib/envois/balance";
import { listNames } from "~/lib/envois/convoy-stats";
import { InOutChart } from "./in-out-chart";
import { Callout, Panel } from "./parts";

type SortKey = "gap" | "field" | "production" | "sent" | "received" | "part" | "ratio";

/** The columns past the member, hidden on a phone but the Écart and the verdict (the row unfolds for the rest). */
const COLUMNS: readonly { key: SortKey | null; label: string; className: string }[] = [
  { key: "field", label: "TDC", className: "hidden text-right xl:table-cell" },
  { key: null, label: "Entrepôt estimé", className: "hidden text-right md:table-cell" },
  { key: "production", label: "Production", className: "hidden text-right sm:table-cell" },
  { key: null, label: "Colonies", className: "hidden text-right xl:table-cell" },
  { key: "sent", label: "Envoyés", className: "hidden text-right sm:table-cell" },
  { key: "received", label: "Reçus", className: "hidden text-right sm:table-cell" },
  { key: "part", label: "Part", className: "hidden text-right md:table-cell" },
  { key: "gap", label: "Écart", className: "" },
  { key: "ratio", label: "Ratio", className: "hidden text-right md:table-cell" },
];

const VERDICT_STYLE: Record<Verdict, string> = {
  convoy: "bg-primary/15 text-primary",
  balanced: "bg-muted text-foreground",
  receive: "bg-chart-2/20 text-foreground",
};

/** ↑ to convoy, ↓ to receive, = balanced: the shape says it with the word. */
function VerdictIcon({ verdict }: { verdict: Verdict }) {
  const path = { convoy: "M12 19V5M5 12l7-7 7 7", receive: "M12 5v14M5 12l7 7 7-7", balanced: "M5 9h14M5 15h14" }[
    verdict
  ];
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
      <path d={path} />
    </svg>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (verdict === null) return <span className="text-xs text-muted-foreground">— partiel</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-px text-xs font-semibold whitespace-nowrap",
        VERDICT_STYLE[verdict],
      )}
    >
      <VerdictIcon verdict={verdict} />
      {verdictText(verdict)}
    </span>
  );
}

const ratioText = (row: BalanceRow) => (row.ratio === null ? "—" : formatDecimal(row.ratio));

const taxText = (row: BalanceRow) => {
  const net = row.taxes.received - row.taxes.paid;
  if (row.taxes.paid === 0 && row.taxes.received === 0) return "—";
  return `${row.taxes.estimated ? "≈ " : ""}${signedCompact(net)}`;
};

function Warehouse({ row }: { row: BalanceRow }) {
  if (!row.warehouse) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs leading-snug">
      <span className="block">
        ≤ {formatCompact(row.warehouse.food)} <span className="text-muted-foreground">nourr.</span>
      </span>
      <span className="block">
        ≤ {formatCompact(row.warehouse.materials)} <span className="text-muted-foreground">mat.</span>
      </span>
    </span>
  );
}

function GapBar({ gap, widest }: { gap: number; widest: number }) {
  const width = (50 * Math.abs(gap)) / widest;
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden className="relative hidden h-2 min-w-20 flex-1 bg-muted sm:block">
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-muted-foreground" />
        <div
          className={cn("absolute inset-y-0", gap >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-chart-2")}
          style={{ width: `${String(width)}%` }}
        />
      </div>
      <span className="min-w-16 text-right font-mono">{signedCompact(gap)}</span>
    </div>
  );
}

/** What the phone hides, and a way to the member's days. */
function Detail({ row, onShowDays }: { row: BalanceRow; onShowDays?: (pseudo: string) => void }) {
  const days = row.daily.filter((day) => day.present);
  const facts: [string, React.ReactNode][] = [
    ["TDC", row.field === null ? "—" : formatNumber(row.field)],
    ["Entrepôt estimé", <Warehouse key="w" row={row} />],
    ["Production", formatCompact(row.production)],
    ["Colonies", taxText(row)],
    ["Envoyés", formatCompact(row.sent)],
    ["Reçus", formatCompact(row.received)],
    ["Part", formatCompact(row.part)],
    ["Ratio", ratioText(row)],
  ];
  return (
    // As wide as the table, never wider.
    <div className="w-0 min-w-full space-y-3 rounded-[0.625rem] bg-card p-3">
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:hidden">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {days.length === 0 ? (
        <p className="text-muted-foreground">Pas dans l&apos;alliance sur la période, d&apos;après l&apos;export.</p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {days.length < row.daily.length &&
            `Dans l'alliance depuis le ${days[0]?.label ?? ""} : sa Part commence ce jour-là.`}
          {onShowDays && (
            <button
              type="button"
              onClick={() => onShowDays(row.pseudo)}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Voir ses jours →
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export function BalanceView({
  balance,
  days,
  member,
  onShowDays,
}: {
  balance: Balance;
  days: number;
  member: string | null;
  /** Opens the « Jours » view on a member. */
  onShowDays?: (pseudo: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("gap");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(member ? [member] : []));
  const value = (row: BalanceRow) =>
    sort === "field" ? (row.field ?? 0) : sort === "ratio" ? (row.ratio ?? 0) : row[sort];
  const rows =
    sort === "gap"
      ? balance.rows
      : [...balance.rows].sort(
          (a, b) => Number(a.verdict === null) - Number(b.verdict === null) || value(b) - value(a),
        );
  const widest = Math.max(1, ...rows.map((row) => Math.abs(row.gap)));
  const { coverage, counts } = balance;
  const toggle = (pseudo: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(pseudo)) next.add(pseudo);
      return next;
    });

  return (
    <div className="space-y-5">
      {coverage.missing.length > 0 && (
        <Callout tone="warning">
          <strong>
            {formatNumber(coverage.senders)} membre{coverage.senders > 1 ? "s" : ""} sur{" "}
            {formatNumber(coverage.members)} {coverage.senders > 1 ? "envoient leurs" : "envoie ses"} convois.
          </strong>{" "}
          {listNames(coverage.missing)} {coverage.missing.length > 1 ? "n'envoient" : "n'envoie"} pas
          «&nbsp;Convois&nbsp;» : on ne voit que ce qu&apos;
          {coverage.missing.length > 1 ? "ils échangent" : "il échange"} avec ceux qui l&apos;envoient, donc pas de
          verdict. {coverage.missing.length > 1 ? "Leur" : "Sa"} production compte quand même dans la Part de tous.
        </Callout>
      )}

      <StatGrid label={`Équilibre sur ${String(days)} jours`}>
        <Stat
          label={`Production de l'alliance · ${String(days)} jours`}
          value={formatCompact(balance.production)}
          hint="plafond : TDC × 48 chaque jour, nourriture et matériaux"
        />
        <Stat
          label="Part moyenne par jour"
          value={formatCompact(balance.partPerDay)}
          hint="par membre présent, à parts égales"
        />
        <Stat
          label="Verdicts"
          value={`${formatNumber(counts.convoy)} · ${formatNumber(counts.receive)}`}
          hint={[
            `${formatNumber(counts.convoy)} à convoyer`,
            `${formatNumber(counts.receive)} à recevoir`,
            `${formatNumber(counts.balanced)} équilibré${counts.balanced > 1 ? "s" : ""}`,
            ...(counts.unknown > 0 ? [`${formatNumber(counts.unknown)} sans verdict`] : []),
          ].join(" · ")}
        />
      </StatGrid>

      <Panel
        title="Qui convoie, qui reçoit"
        aside="cliquez un en-tête pour trier · nourriture et matériaux additionnés"
        flush
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Membre</TableHead>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.label}
                    className={column.className}
                    aria-sort={column.key !== null && sort === column.key ? "descending" : undefined}
                  >
                    {column.key === null ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSort(column.key ?? "gap")}
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground",
                          sort === column.key ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {column.label}
                        {sort === column.key && <span aria-hidden>▼</span>}
                      </button>
                    )}
                  </TableHead>
                ))}
                <TableHead className="hidden sm:table-cell">Verdict</TableHead>
                <TableHead className="pr-4">
                  <span className="sr-only">Détail</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const unfolded = open.has(row.pseudo);
                const chosen = member !== null && member.toLowerCase() === row.pseudo.toLowerCase();
                return (
                  <Fragment key={row.pseudo}>
                    <TableRow className={cn(chosen && "bg-primary/10")}>
                      <TableCell className="pl-4 align-top font-semibold">
                        {row.pseudo}
                        {row.partial && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            n&apos;envoie pas «&nbsp;Convois&nbsp;»
                          </span>
                        )}
                        {row.verdict !== null && (
                          <span className="mt-1 block sm:hidden">
                            <VerdictBadge verdict={row.verdict} />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={COLUMNS[0]?.className}>
                        {row.field === null ? "—" : formatNumber(row.field)}
                      </TableCell>
                      <TableCell className={COLUMNS[1]?.className}>
                        <Warehouse row={row} />
                      </TableCell>
                      <TableCell className={COLUMNS[2]?.className}>{formatCompact(row.production)}</TableCell>
                      <TableCell className={COLUMNS[3]?.className}>{taxText(row)}</TableCell>
                      <TableCell className={COLUMNS[4]?.className}>
                        {formatCompact(row.sent)}
                        {row.partial && <span className="text-xs text-muted-foreground"> partiel</span>}
                      </TableCell>
                      <TableCell className={COLUMNS[5]?.className}>{formatCompact(row.received)}</TableCell>
                      <TableCell className={COLUMNS[6]?.className}>{formatCompact(row.part)}</TableCell>
                      <TableCell className="align-top sm:min-w-44 sm:align-middle">
                        <GapBar gap={row.gap} widest={widest} />
                      </TableCell>
                      <TableCell className={COLUMNS[8]?.className}>{ratioText(row)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <VerdictBadge verdict={row.verdict} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <button
                          type="button"
                          aria-expanded={unfolded}
                          aria-label={`Détail de ${row.pseudo}`}
                          onClick={() => toggle(row.pseudo)}
                          className="inline-grid size-9 place-items-center rounded-lg border bg-card hover:bg-muted"
                        >
                          <svg
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden
                          >
                            <path d={unfolded ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
                          </svg>
                        </button>
                      </TableCell>
                    </TableRow>
                    {unfolded && (
                      <TableRow className={cn(chosen && "bg-primary/10", "hover:bg-transparent")}>
                        <TableCell colSpan={COLUMNS.length + 3} className="px-4 pb-3 whitespace-normal">
                          <Detail row={row} onShowDays={onShowDays} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-3 bg-primary" />à droite, «&nbsp;+&nbsp;» : lui reste plus que sa Part
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-3 bg-chart-2" />à gauche, «&nbsp;−&nbsp;» : lui reste moins que sa Part
          </span>
          <span>«&nbsp;≈&nbsp;» : taux de taxe supposé à 20 %</span>
        </div>
      </Panel>

      <InOutChart chart={inOutOf(rows, balance.partPerDay)} partPerDay={balance.partPerDay} chosen={member} />

      <details className="rounded-[0.875rem] bg-card px-4 pb-3 shadow-panel">
        <summary className="cursor-pointer py-3 font-heading text-lg font-bold uppercase">
          Comment c&apos;est calculé
        </summary>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>
            <strong>Production</strong> : le plafond, TDC × 48 par jour, avec le TDC de l&apos;export de la nuit
            (données publiques). Ce que récoltent vraiment les ouvrières peut être moins.
          </li>
          <li>
            <strong>Part</strong> : chaque jour, la production des membres de l&apos;Espace présents dans
            l&apos;alliance, partagée à parts égales. Un membre arrivé en cours de période n&apos;a de Part qu&apos;à
            partir de son arrivée.
          </li>
          <li>
            <strong>Écart</strong> : production + taxes reçues − taxes versées − convois envoyés + convois reçus, moins
            la Part. «&nbsp;Équilibré&nbsp;» à ±5 % de la Part ; le ratio divise ce qui reste par la Part.
          </li>
          <li>
            <strong>Taxes de colonie</strong> : au taux de l&apos;Envoi Production du colonisé, sinon 20 % + 1 % par
            niveau de l&apos;Étable à pucerons du colonisateur, sinon 20 % («&nbsp;≈&nbsp;»), d&apos;après qui colonise
            qui aujourd&apos;hui. Une taxe entre deux membres ne change pas le total de l&apos;alliance.
          </li>
          <li>
            <strong>Convois</strong> : comptés à leur livraison, une fois, y compris avec des joueurs hors alliance.
          </li>
          <li>
            <strong>Entrepôt estimé</strong> : le dernier stock envoyé (moins de 48 h), plus la production depuis, moins
            les convois partis, plus ceux arrivés, borné par la capacité des entrepôts quand on la connaît. Un maximum :
            les dépenses ne sont pas connues.
          </li>
          <li>
            La Priorité compare ce qu&apos;un membre a reçu à sa propre production ; l&apos;Équilibre compare ce qui lui
            reste à sa Part.
          </li>
        </ul>
      </details>

      <p className="text-xs text-muted-foreground">
        Chiffres calculés dans ce navigateur, avec la Clé d&apos;alliance et les TDC publics : le site ne voit ni les
        quantités, ni les stocks.
      </p>
    </div>
  );
}
