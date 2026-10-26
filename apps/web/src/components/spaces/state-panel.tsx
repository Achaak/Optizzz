"use client";

// The « État » tab of a space (docs/features/site-envois.md, « Vues »): the former « Partage » of the extension,
// merged. Each member's Production, TDC, workers, army, hunts, levels and works, from their Envois and from the states
// pasted here from Discord (« Mon état »), the newest reading of each part winning. Pasted states stay in this tab
// only: nothing of them leaves the browser. The units of the armies appear to the Admins only.
import { UNITS, unitLabel } from "@optizzz/game/army/units";
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { BUILDINGS, RESEARCH, type BuildingKey, type ResearchKey } from "@optizzz/game/levels";
import { parseShares } from "@optizzz/game/sharing/share-text";
import type { MemberStates, SharedState } from "@optizzz/game/sharing/shared-state";
import { productionPerDay } from "@optizzz/game/site-links/envoi-states";
import { useId, useMemo, useState } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { memberStates, type MemberState } from "~/lib/envois/states";
import { Callout, Panel } from "./parts";

const GROUPS = [
  { value: "summary", label: "Résumé" },
  { value: "production", label: "Production" },
  { value: "army", label: "Armée" },
  { value: "hunts", label: "Chasses" },
  { value: "buildings", label: "Bâtiments" },
  { value: "research", label: "Recherches" },
  { value: "works", label: "Chantiers" },
] as const;
type Group = (typeof GROUPS)[number]["value"];

const DAY = 24 * 3600_000;
/** A change is shown this long after the reading that shows it. */
const CHANGE_MS = DAY;
/** Past this age, a reading is said to be old. */
const OLD_MS = 3 * DAY;

const SUMMARY_RESEARCH: ResearchKey[] = ["weapons", "shield", "attackSpeed"];
const SUMMARY_BUILDINGS: BuildingKey[] = ["dome", "lodge"];

const num = "text-right tabular-nums whitespace-nowrap";

/** « 12 348 ↑ » when the value moved in the last 24 hours, the value before in the tooltip. */
function Value({ value, before, recent }: { value: number | undefined; before: number | undefined; recent: boolean }) {
  if (value === undefined) return <span className="text-muted-foreground">—</span>;
  const moved = recent && before !== undefined && before !== value;
  return (
    <span title={moved ? `avant : ${formatNumber(before)}` : undefined}>
      {formatNumber(value)}
      {moved && (value > before ? " ↑" : " ↓")}
    </span>
  );
}

function readingOf(member: MemberState, now: Date) {
  const latest = member.states?.latest;
  const previous = member.states?.previous;
  const recent = !!latest && now.getTime() - latest.readAt.getTime() < CHANGE_MS;
  return { latest, previous, recent };
}

function ReadAt({ latest, now }: { latest: SharedState | undefined; now: Date }) {
  if (!latest) return <span className="text-muted-foreground">aucun relevé</span>;
  const old = now.getTime() - latest.readAt.getTime() > OLD_MS;
  return (
    <span className={old ? "text-muted-foreground" : undefined}>
      {formatPastTime(latest.readAt, now)}
      {old && " (ancien)"}
    </span>
  );
}

export function StatePanel({
  states,
  refused,
  isAdmin,
  loading,
  members,
  server,
  tag,
}: {
  /** Null while the access to the space is not open on this device. */
  states: MemberStates[] | null;
  refused: number;
  isAdmin: boolean;
  loading: boolean;
  /** The space's members, in its order. */
  members: readonly string[];
  server: string;
  tag: string;
}) {
  const [group, setGroup] = useState<Group>("summary");
  const [text, setText] = useState("");
  const [pasted, setPasted] = useState<SharedState[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const pasteId = useId();
  const rows = useMemo(() => memberStates(members, states ?? [], pasted), [members, states, pasted]);
  const now = new Date();

  if (states === null)
    return (
      <Panel title="État">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des états…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire l'état des membres."}
        </p>
      </Panel>
    );

  const read = () => {
    const parsed = parseShares(text, { server, alliance: tag, members, now });
    setPasted((before) => [...before, ...parsed.states]);
    const parts = [
      parsed.states.length === 1 ? "1 état lu" : `${formatNumber(parsed.states.length)} états lus`,
      parsed.ignored.length > 0 && `${formatNumber(parsed.ignored.length)} ignoré(s) : ${parsed.ignored.join(" ; ")}`,
    ].filter((part) => part !== false);
    setReport(`${parts.join(", ")}.`);
    setText("");
  };

  const memberCell = (row: MemberState) => <TableCell className="font-medium">{row.pseudo}</TableCell>;
  const readCell = (row: MemberState) => (
    <TableCell className="whitespace-nowrap">
      <ReadAt latest={row.states?.latest} now={now} />
    </TableCell>
  );

  let table: React.ReactNode;
  if (group === "summary") {
    table = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead className={num}>Production / jour</TableHead>
            <TableHead className={num}>TDC</TableHead>
            <TableHead className={num}>Ouvrières</TableHead>
            <TableHead className={num}>Armée</TableHead>
            {SUMMARY_RESEARCH.map((key) => (
              <TableHead key={key} className={num}>
                {RESEARCH.find((r) => r.key === key)?.name}
              </TableHead>
            ))}
            {SUMMARY_BUILDINGS.map((key) => (
              <TableHead key={key} className={num}>
                {BUILDINGS.find((b) => b.key === key)?.name}
              </TableHead>
            ))}
            <TableHead>Prochain chantier</TableHead>
            <TableHead>Relevé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { latest, previous, recent } = readingOf(row, now);
            const production = latest?.production && productionPerDay(latest.production, now);
            const next = (latest?.works ?? [])
              .filter((w) => w.endsAt > now)
              .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())[0];
            return (
              <TableRow key={row.pseudo}>
                {memberCell(row)}
                <TableCell className={num}>
                  {production ? (
                    `${production.coloniesKnown ? "" : "≥ "}${formatNumber(production.total)}`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={num}>
                  <Value value={latest?.huntingField} before={previous?.huntingField} recent={recent} />
                </TableCell>
                <TableCell className={num}>
                  <Value value={latest?.workers} before={previous?.workers} recent={recent} />
                </TableCell>
                <TableCell className={num}>
                  <Value value={latest?.army?.total} before={previous?.army?.total} recent={recent} />
                  {latest?.army?.incomplete && <span className="text-muted-foreground"> (incomplète)</span>}
                </TableCell>
                {SUMMARY_RESEARCH.map((key) => (
                  <TableCell key={key} className={num}>
                    <Value value={latest?.research?.[key]} before={previous?.research?.[key]} recent={recent} />
                  </TableCell>
                ))}
                {SUMMARY_BUILDINGS.map((key) => (
                  <TableCell key={key} className={num}>
                    <Value value={latest?.buildings?.[key]} before={previous?.buildings?.[key]} recent={recent} />
                  </TableCell>
                ))}
                <TableCell className="whitespace-nowrap">
                  {next ? `${next.name} ${String(next.level)}, fin ${formatEndTime(next.endsAt, now)}` : ""}
                </TableCell>
                {readCell(row)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  } else if (group === "production") {
    table = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead className={num}>Production / jour</TableHead>
            <TableHead className={num}>Récolte</TableHead>
            <TableHead className={num}>Taxe versée</TableHead>
            <TableHead className={num}>Colonies</TableHead>
            <TableHead>Relevé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const p = row.states?.latest.production;
            const perDay = p && productionPerDay(p, now);
            const colonies = p?.colonies?.length ?? 0;
            return (
              <TableRow key={row.pseudo}>
                {memberCell(row)}
                {p && perDay ? (
                  <>
                    <TableCell className={num}>
                      {perDay.coloniesKnown ? "" : "≥ "}
                      {formatNumber(perDay.total)}
                    </TableCell>
                    <TableCell className={num}>{formatNumber(perDay.harvest)}</TableCell>
                    <TableCell className={num}>
                      {p.taxRate > 0
                        ? `−${formatNumber(perDay.taxPaid)} (${String(Math.round(p.taxRate * 100))} %${p.master ? `, à ${p.master}` : ""})`
                        : "aucune"}
                    </TableCell>
                    <TableCell className={num}>
                      {p.colonies === null
                        ? "inconnues"
                        : colonies === 0
                          ? "aucune"
                          : `+${formatNumber(perDay.colonies)} (${String(colonies)})`}
                    </TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Production non envoyée
                  </TableCell>
                )}
                {readCell(row)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  } else if (group === "army") {
    table = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead className={num}>Total</TableHead>
            {isAdmin &&
              UNITS.map((unit) => (
                <TableHead key={unit.key} className={num} title={unit.name}>
                  {unitLabel(unit.key)}
                </TableHead>
              ))}
            <TableHead>Troupes dehors</TableHead>
            <TableHead>Relevé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { latest, previous, recent } = readingOf(row, now);
            const army = latest?.army;
            return (
              <TableRow key={row.pseudo}>
                {memberCell(row)}
                <TableCell className={num}>
                  <Value value={army?.total} before={previous?.army?.total} recent={recent} />
                </TableCell>
                {isAdmin &&
                  UNITS.map((unit) => (
                    <TableCell key={unit.key} className={num}>
                      {army?.units?.[unit.key] ? formatNumber(army.units[unit.key] ?? 0) : ""}
                    </TableCell>
                  ))}
                <TableCell className="whitespace-nowrap">
                  {[
                    army?.incomplete && "incomplète",
                    army?.returnsAt && army.returnsAt > now && `retour ${formatEndTime(army.returnsAt, now)}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </TableCell>
                {readCell(row)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  } else if (group === "hunts") {
    table = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead>Chasses en cours</TableHead>
            <TableHead>Relevé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const hunts = row.states?.latest.hunts;
            const out = (hunts ?? []).filter((h) => h.returnsAt > now);
            return (
              <TableRow key={row.pseudo}>
                {memberCell(row)}
                <TableCell>
                  {!hunts ? (
                    <span className="text-muted-foreground">Chasses non envoyées</span>
                  ) : out.length === 0 ? (
                    "aucune"
                  ) : (
                    out.map((h) => (
                      <div key={h.returnsAt.getTime()} className="whitespace-nowrap">
                        +{formatNumber(h.fieldGain)} cm², retour {formatEndTime(h.returnsAt, now)}
                      </div>
                    ))
                  )}
                </TableCell>
                {readCell(row)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  } else if (group === "buildings" || group === "research") {
    const list = group === "buildings" ? BUILDINGS : RESEARCH;
    table = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            {list.map((level) => (
              <TableHead key={level.key} className={num}>
                {level.name}
              </TableHead>
            ))}
            <TableHead>Relevé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { latest, previous, recent } = readingOf(row, now);
            const levels = latest?.[group] as Partial<Record<string, number>> | undefined;
            const before = previous?.[group] as Partial<Record<string, number>> | undefined;
            return (
              <TableRow key={row.pseudo}>
                {memberCell(row)}
                {list.map((level) => (
                  <TableCell key={level.key} className={num}>
                    <Value value={levels?.[level.key]} before={before?.[level.key]} recent={recent} />
                  </TableCell>
                ))}
                {readCell(row)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  } else {
    table = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Membre</TableHead>
            <TableHead>Chantiers</TableHead>
            <TableHead>Relevé</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.pseudo}>
              {memberCell(row)}
              <TableCell>
                {(row.states?.latest.works ?? []).map((w) => (
                  <div
                    key={`${w.name}${String(w.level)}`}
                    className={w.endsAt <= now ? "whitespace-nowrap text-muted-foreground" : "whitespace-nowrap"}
                  >
                    {w.name} {w.level} : {w.endsAt <= now ? "terminé" : `fin ${formatEndTime(w.endsAt, now)}`}
                  </div>
                ))}
              </TableCell>
              {readCell(row)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <Panel title="État">
      <p className="text-muted-foreground">
        Ce que les membres envoient depuis l&apos;extension, et les états qu&apos;ils copient depuis «&nbsp;Mon
        état&nbsp;» et collent ci-dessous&nbsp;: pour chaque partie, le relevé le plus récent l&apos;emporte. ↑ ↓&nbsp;:
        changé dans les dernières 24&nbsp;h.
      </p>

      {refused > 0 && (
        <Callout tone="warning">
          {refused === 1 ? "Un Envoi ne s'ouvre pas" : `${formatNumber(refused)} Envois ne s'ouvrent pas`} : modifié
          hors de l&apos;extension d&apos;un membre, ou chiffré avec une version de l&apos;accès que vous n&apos;avez
          pas. Il n&apos;est pas compté.
        </Callout>
      )}

      <div className="space-y-2">
        <label htmlFor={pasteId} className="block text-muted-foreground">
          Coller les états partagés sur Discord (seules les lignes [optizzz:…] comptent ; ils restent dans cet onglet)
        </label>
        <textarea
          id={pasteId}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!text.trim()} onClick={read}>
            Lire les états collés
          </Button>
          {report && (
            <span role="status" className="text-muted-foreground">
              {report}
            </span>
          )}
        </div>
      </div>

      <Segmented label="Données à montrer" options={GROUPS} value={group} onChange={setGroup} />
      <div className="overflow-x-auto">{table}</div>

      <p className="text-xs text-muted-foreground">
        La production par jour est la récolte, moins la taxe versée au colonisateur, plus ce que rapportent les colonies
        (en moyenne depuis leur prise)&nbsp;; «&nbsp;≥&nbsp;» quand des colonies sont inconnues.{" "}
        {isAdmin
          ? "Le détail des armées par unité n'est montré qu'aux Admins : optizzz.fr ne le renvoie qu'à eux (c'est le site qui le réserve, pas le chiffrement)."
          : "Le détail des armées par unité n'est montré qu'aux Admins de l'espace."}
      </p>
    </Panel>
  );
}
