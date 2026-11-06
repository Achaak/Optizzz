"use client";

// The « Mouvements » tab of a space (docs/features/site-mouvements.md): every arrival of the alliance on the day chosen,
// hour by hour in Paris (floods, convoys, hunts coming back), the same movement repeated within an hour folded into one
// line that opens on its detail. Today, the hours already past are folded. The day, the member and the kinds are kept
// in the address. Worked out in this browser from the Envois the page opened; the site sees none of it.
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { parisParts } from "@optizzz/game/format/time-format";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import { cn } from "cn";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { Stat, StatGrid } from "~/components/stat";
import type { AllianceConvoy } from "~/lib/envois/convoys";
import type { AllianceFlood } from "~/lib/envois/floods";
import type { AllianceHunt } from "~/lib/envois/hunts";
import { listNames } from "~/lib/envois/convoy-stats";
import { movementViewSearch, readMovementView, type MovementView } from "~/lib/envois/movement-view";
import {
  allianceMovements,
  dayTimeline,
  foldPastHours,
  membersWithoutHuntsLog,
  movementDays,
  parisDay,
  type Movement,
  type MovementGroup,
  type MovementHour,
  type MovementKind,
} from "~/lib/envois/movements";
import { Callout, DeclaredTag, FIELD_LABEL, Panel } from "./parts";

const KINDS: readonly { kind: MovementKind; word: string; plural: string }[] = [
  { kind: "flood", word: "Flood", plural: "Floods" },
  { kind: "convoy", word: "Convoi", plural: "Convois" },
  { kind: "hunt", word: "Chasse", plural: "Chasses" },
];

/** Each kind's shape: the word says it too, never the colour alone (ADR 0003). */
function KindShape({ kind }: { kind: MovementKind }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      {kind === "flood" && <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill="var(--chart-1)" />}
      {kind === "convoy" && <rect x={1} y={1} width={10} height={10} fill="var(--chart-2)" />}
      {kind === "hunt" && <circle cx={6} cy={6} r={5} fill="var(--chart-5)" />}
    </svg>
  );
}

/** « 13 h 36 », Paris time. */
function clock(at: number): string {
  const { hours, minutes } = parisParts(new Date(at));
  return `${String(hours)} h ${String(minutes).padStart(2, "0")}`;
}

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** « mar. 3 nov. · aujourd'hui ». */
function dayLabel(day: string, today: string, yesterday: string, tomorrow: string): string {
  const label = DAY_LABEL.format(new Date(`${day}T12:00:00Z`));
  const near = day === today ? "aujourd'hui" : day === yesterday ? "hier" : day === tomorrow ? "demain" : null;
  return near ? `${label} · ${near}` : label;
}

const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count > 1 ? "s" : ""}`;

/** What a movement brings: the take, the loads, the field. */
function amountText(movements: readonly Movement[]): string {
  const first = movements[0];
  if (!first) return "";
  if (first.kind === "flood") {
    const takes = movements.flatMap((m) => (m.kind === "flood" && m.take !== null ? [m.take] : []));
    if (takes.length === 0) return "— sans le Plan";
    return `${takes.length < movements.length ? "≥ " : ""}${formatNumber(takes.reduce((a, b) => a + b, 0))}`;
  }
  if (first.kind === "convoy") {
    const food = movements.reduce((sum, m) => sum + (m.kind === "convoy" ? m.food : 0), 0);
    const materials = movements.reduce((sum, m) => sum + (m.kind === "convoy" ? m.materials : 0), 0);
    const parts = [
      food > 0 && `${formatNumber(food)} nourriture`,
      materials > 0 && `${formatNumber(materials)} matériaux`,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "vide";
  }
  return `+${formatNumber(movements.reduce((sum, m) => sum + (m.kind === "hunt" ? m.field : 0), 0))} cm²`;
}

const unconfirmed = (movements: readonly Movement[]) => movements.filter((m) => m.kind === "convoy" && m.unconfirmed);

function GroupRow({ group, open, onToggle }: { group: MovementGroup; open: boolean; onToggle: () => void }) {
  const { movements } = group;
  const first = movements[0]?.at ?? 0;
  const last = movements[movements.length - 1]?.at ?? 0;
  const word = KINDS.find((k) => k.kind === group.kind)?.word ?? "";
  const pending = unconfirmed(movements).length;
  const declared = movements.filter((m) => m.declared).length;
  const detailId = useId();
  return (
    <li className="border-t">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 pr-2 pl-4">
        <span className="w-28 shrink-0 text-muted-foreground tabular-nums">
          {movements.length > 1 && first !== last ? `${clock(first)} – ${clock(last)}` : clock(first)}
        </span>
        <span className="inline-flex w-20 shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <KindShape kind={group.kind} />
          {word}
        </span>
        <span className="min-w-0 flex-[1_1_14rem] break-words">
          <strong>{group.from}</strong>
          {group.to !== null && (
            <>
              {" "}
              <span className="text-muted-foreground" aria-label="vers">
                →
              </span>{" "}
              <strong>{group.to}</strong>
            </>
          )}
          {movements.length > 1 && (
            <span className="ml-1.5 rounded-full bg-raised px-1.5 text-xs font-semibold">
              ×{formatNumber(movements.length)}
            </span>
          )}
          {declared > 0 && <DeclaredTag count={movements.length > 1 ? declared : undefined} />}
          {pending > 0 && (
            <span className="ml-1.5 rounded-full border border-dashed border-warning-border bg-warning-soft px-1.5 text-xs font-semibold">
              {movements.length === 1
                ? "arrivé, non confirmé"
                : `${formatNumber(pending)} non confirmé${pending > 1 ? "s" : ""}`}
            </span>
          )}
        </span>
        <span className="ml-auto text-right tabular-nums">{amountText(movements)}</span>
        {movements.length > 1 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`Détail des ${String(movements.length)} mouvements`}
            onClick={onToggle}
            className="grid size-9 shrink-0 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
            </svg>
          </button>
        ) : (
          <span className="size-9 shrink-0" aria-hidden="true" />
        )}
      </div>
      {open && movements.length > 1 && (
        <ul id={detailId} className="bg-raised py-1 pr-4 pl-4 sm:pl-36">
          {movements.map((m, index) => (
            <li key={`${String(m.at)}-${String(index)}`} className="flex justify-between gap-3 py-0.5 tabular-nums">
              <span className="text-muted-foreground">
                {clock(m.at)}
                {m.kind === "convoy" && m.unconfirmed && " · arrivé, non confirmé"}
                {m.declared && " · déclaré"}
              </span>
              <span>{amountText([m])}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const groupKey = (hour: number, group: MovementGroup) =>
  `${String(hour)}|${group.kind}|${group.from.toLowerCase()}|${group.to?.toLowerCase() ?? ""}`;

function HourBlock({
  hour,
  current,
  open,
  onToggle,
}: {
  hour: MovementHour;
  current: boolean;
  open: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <section aria-label={`${String(hour.hour)} h`} className="border-t sm:grid sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <h3
        className={cn(
          "px-4 pt-2.5 pb-1 font-heading text-2xl font-bold sm:pb-2",
          current ? "text-primary" : "text-foreground",
        )}
      >
        {hour.hour} h
        <span className="ml-2 font-sans text-xs font-normal text-muted-foreground sm:hidden">
          {plural(hour.count, "mouvement")}
        </span>
      </h3>
      <ul className="min-w-0 [&>li:first-child]:border-t-0 sm:[&>li:first-child]:border-t-0">
        {hour.groups.map((group) => {
          const key = groupKey(hour.hour, group);
          return <GroupRow key={key} group={group} open={open.has(key)} onToggle={() => onToggle(key)} />;
        })}
      </ul>
    </section>
  );
}

function NowLine({ now, rest }: { now: Date; rest: boolean }) {
  return (
    <div className="flex items-center gap-2 border-t px-4 py-1.5 text-xs font-semibold text-primary">
      <span aria-hidden="true" className="h-0.5 flex-1 bg-primary" />
      maintenant · {clock(now.getTime())}
      {!rest && " · plus rien n'arrive aujourd'hui"}
      <span aria-hidden="true" className="h-0.5 flex-1 bg-primary" />
    </div>
  );
}

export function MovementsPanel({
  floods,
  convoys,
  states,
  hunts,
  refused,
  members,
  me,
  loading,
}: {
  /** Null while the access to the space is not open on this device. */
  floods: AllianceFlood[] | null;
  convoys: AllianceConvoy[] | null;
  states: MemberStates[] | null;
  /** The hunts log, back ones too. */
  hunts: AllianceHunt[] | null;
  /** Envois that do not open, every category together. */
  refused: number;
  members: readonly string[];
  /** The reader's pseudo, for « Moi ». */
  me: string | null;
  loading: boolean;
}) {
  const params = useSearchParams();
  const [choice, setChoice] = useState<MovementView>(() => readMovementView(params, members));
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [showPast, setShowPast] = useState(false);
  const now = new Date();

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${movementViewSearch(choice)}`);
  }, [choice]);

  const movements = useMemo(
    () =>
      floods && convoys && states && hunts
        ? allianceMovements({ floods, convoys, states, hunts, now: new Date() })
        : null,
    [floods, convoys, states, hunts],
  );
  const withoutLog = useMemo(() => (states && hunts ? membersWithoutHuntsLog(states, hunts) : []), [states, hunts]);

  if (movements === null)
    return (
      <Panel title="Mouvements">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des mouvements…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les mouvements de l'alliance."}
        </p>
      </Panel>
    );

  const days = movementDays(movements, now);
  const today = parisDay(now.getTime());
  const day = choice.day !== null && days.includes(choice.day) ? choice.day : today;
  const index = days.indexOf(day);
  const at = (shift: number) => days[days.indexOf(today) + shift] ?? "";
  const label = (d: string) => dayLabel(d, today, at(-1), at(1));
  const change = (next: Partial<MovementView>) => setChoice((current) => ({ ...current, ...next }));
  const goTo = (next: string | undefined) => {
    if (next === undefined) return;
    change({ day: next === today ? null : next });
    setOpen(new Set());
    setShowPast(false);
  };
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const timeline = dayTimeline(movements, { day, member: choice.member, kinds: choice.kinds });
  const { past, shown } = foldPastHours(timeline.hours, day, now);
  const isToday = day === today;
  const currentHour = parisParts(now).hours;
  const pastCount = past.reduce((sum, h) => sum + h.count, 0);
  const others = members.filter((m) => m.toLowerCase() !== me?.toLowerCase());
  const { tiles } = timeline;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex w-full items-center gap-2.5 sm:w-auto">
          <button
            type="button"
            aria-label={index > 0 ? `Jour précédent : ${label(days[index - 1] ?? "")}` : "Jour précédent"}
            disabled={index <= 0}
            onClick={() => goTo(days[index - 1])}
            className="grid size-11 shrink-0 place-items-center rounded-full border bg-card disabled:opacity-40"
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Jour</span>
            <select
              value={day}
              onChange={(event) => goTo(event.target.value)}
              className="h-11 w-full rounded-lg sm:min-w-64 border bg-background px-2 font-heading text-base font-bold uppercase sm:px-3 sm:text-xl"
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {label(d)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label={index < days.length - 1 ? `Jour suivant : ${label(days[index + 1] ?? "")}` : "Jour suivant"}
            disabled={index >= days.length - 1}
            onClick={() => goTo(days[index + 1])}
            className="grid size-11 shrink-0 place-items-center rounded-full border bg-card disabled:opacity-40"
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <fieldset className="space-y-1">
            <legend className={FIELD_LABEL}>Types</legend>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map(({ kind, plural: kindPlural }) => {
                const checked = choice.kinds.includes(kind);
                return (
                  <label
                    key={kind}
                    className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border bg-card px-3 has-disabled:cursor-default"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      // At least one kind stays: the address could not say « none ».
                      disabled={checked && choice.kinds.length === 1}
                      onChange={() =>
                        change({ kinds: checked ? choice.kinds.filter((k) => k !== kind) : [...choice.kinds, kind] })
                      }
                      className="size-4 accent-primary"
                    />
                    <KindShape kind={kind} />
                    {kindPlural}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="space-y-1">
            <span className={FIELD_LABEL}>Membre</span>
            <select
              value={choice.member ?? ""}
              onChange={(event) => change({ member: event.target.value || null })}
              className="block h-9 min-w-44 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Toute l&apos;alliance</option>
              {me !== null && <option value={me}>Moi ({me})</option>}
              {others.map((pseudo) => (
                <option key={pseudo} value={pseudo}>
                  {pseudo}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {refused > 0 && (
        <Callout tone="warning">
          {refused === 1 ? "Un Envoi ne s'ouvre pas" : `${formatNumber(refused)} Envois ne s'ouvrent pas`} : modifié
          hors de l&apos;extension d&apos;un membre, ou chiffré avec une version de l&apos;accès que vous n&apos;avez
          pas. Il n&apos;est pas compté.
        </Callout>
      )}

      <StatGrid label={`${label(day)} en chiffres`}>
        {choice.kinds.includes("flood") && (
          <Stat
            label="Floods"
            value={formatNumber(tiles.flood.count)}
            hint={
              tiles.flood.count === 0
                ? "aucun ce jour-là"
                : `${tiles.flood.take > 0 ? `${formatCompact(tiles.flood.take)} prévus par le Plan` : "prise inconnue"}${
                    tiles.flood.withoutPlan > 0 && tiles.flood.take > 0
                      ? ` · ${formatNumber(tiles.flood.withoutPlan)} sans le Plan`
                      : ""
                  }`
            }
          />
        )}
        {choice.kinds.includes("convoy") && (
          <Stat
            label="Convois"
            value={formatNumber(tiles.convoy.count)}
            hint={
              tiles.convoy.count === 0
                ? "aucun ce jour-là"
                : `${formatCompact(tiles.convoy.food)} nourriture · ${formatCompact(tiles.convoy.materials)} matériaux`
            }
          />
        )}
        {choice.kinds.includes("hunt") && (
          <Stat
            label="Chasses"
            value={formatNumber(tiles.hunt.count)}
            hint={
              tiles.hunt.count === 0 ? "aucune connue ce jour-là" : `+${formatNumber(tiles.hunt.field)} cm² rapportés`
            }
          />
        )}
      </StatGrid>

      <Panel
        title="Arrivées heure par heure"
        aside={
          <span className="text-xs text-muted-foreground">heure de Paris · répétitions de l&apos;heure regroupées</span>
        }
        flush
      >
        {timeline.hours.length === 0 ? (
          <p className="px-4 pb-4 text-muted-foreground">
            {choice.member === null
              ? "Aucun mouvement connu ce jour-là."
              : `Aucun mouvement de ${choice.member} ce jour-là.`}
          </p>
        ) : (
          <div className="pb-1">
            {past.length > 0 && (
              <div className="px-4 pb-3">
                <button
                  type="button"
                  aria-expanded={showPast}
                  onClick={() => setShowPast((value) => !value)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-background"
                >
                  {showPast
                    ? "Masquer les heures précédentes"
                    : `Afficher les heures précédentes · ${plural(past.length, "heure")}, ${plural(pastCount, "mouvement")}`}
                </button>
              </div>
            )}
            {showPast &&
              past.map((hour) => (
                <HourBlock key={hour.hour} hour={hour} current={false} open={open} onToggle={toggle} />
              ))}
            {isToday && <NowLine now={now} rest={shown.length > 0} />}
            {shown.map((hour) => (
              <HourBlock
                key={hour.hour}
                hour={hour}
                current={isToday && hour.hour === currentHour}
                open={open}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </Panel>

      <p className="text-xs text-muted-foreground">
        {withoutLog.length > 0 &&
          `Chasses de ${listNames(withoutLog)} connues par ${withoutLog.length > 1 ? "leur" : "son"} dernier état seulement (extension pas encore à jour) : certaines déjà rentrées peuvent manquer. `}
        Un convoi «&nbsp;arrivé, non confirmé&nbsp;» est arrivé à l&apos;heure prévue, mais ni l&apos;expéditeur ni le
        destinataire n&apos;a encore relu sa messagerie. Les floods ne remontent pas au-delà de 7 jours. Seuls les
        membres qui envoient leurs floods, convois et états à Optizzz apparaissent ici ; tout est calculé dans ce
        navigateur, avec la Clé d&apos;alliance.
      </p>
    </div>
  );
}
