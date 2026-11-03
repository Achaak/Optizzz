"use client";

// The travel tool: two ends (a player of a server, or a position), the sender's Attack Speed and a departure give the
// distance, the travel time and the arrival, Paris time; towards alliances, the same for each of their members.
// See docs/features/site-trajets.md.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatEndTimeShort, parisParts } from "@optizzz/game/format/time-format";
import { distance } from "@optizzz/game/travel";
import { useMemo, useState, useSyncExternalStore } from "react";
import { NumberField } from "~/components/number-field";
import { SmallLabel, Panel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels } from "../my-levels";
import { ChoiceButtons, PlayerPicker, ServerSelect, usePickedPlayer } from "../player-picker";
import { InvalidLinkNote, ToolLayout, Verdict } from "../tool-page";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { allianceTrips, type AllianceMember } from "./travel-alliances";
import { AlliancePicker, AllianceTripsTable } from "./travel-alliances-view";
import { departureTime, endPoint, travelResult } from "./travel-result";
import {
  EMPTY_TRAVEL,
  swapEnds,
  travelFormat,
  withAlliance,
  withoutAlliance,
  withServer,
  type TravelMode,
  type TravelState,
} from "./travel-state";

const withMyLevels = (state: TravelState, mine: Parameters<typeof pickLevels>[0]): TravelState => ({
  ...state,
  attackSpeed: pickLevels(mine, ["attackSpeed"]).attackSpeed ?? state.attackSpeed,
});

/** The clock, read again at each render and at each new minute: an arrival from now moves with it. Null on the server. */
let shownNow: Date | null = null;
function readNow(): Date {
  // The same instant within a second: React reads it twice per render.
  if (!shownNow || Date.now() - shownNow.getTime() >= 1000) shownNow = new Date();
  return shownNow;
}
function subscribeMinutes(onMinute: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const wait = () => {
    timer = setTimeout(
      () => {
        onMinute();
        wait();
      },
      60_000 - (Date.now() % 60_000) + 50,
    );
  };
  wait();
  return () => clearTimeout(timer);
}
export const useNow = () => useSyncExternalStore(subscribeMinutes, readNow, () => null);

/** « 2026-10-23T20:15 », Paris time: the value of the departure field. */
function parisInputValue(date: Date): string {
  const { year, month, day, hours, minutes } = parisParts(date);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${String(year)}-${two(month)}-${two(day)}T${two(hours)}:${two(minutes)}`;
}

const NO_MEMBERS: AllianceMember[] = [];

/** The members of the alliances chosen; undefined while loading. */
function useAllianceMembers(server: string | null, tags: readonly string[]) {
  const query = api.players.byAlliances.useQuery(
    { server: server ?? "", tags: [...tags] },
    { enabled: server !== null && tags.length > 0 },
  );
  if (server === null || tags.length === 0) return NO_MEMBERS;
  return query.data;
}

export function TravelTool() {
  const tool = useToolState({ tool: "travel", format: travelFormat, empty: EMPTY_TRAVEL, withMyLevels });
  const levels = useMyLevels(tool);
  const { state, change } = tool;
  const now = useNow();
  /** « Inverser » remounts the pickers: each shows its new end. */
  const [swaps, setSwaps] = useState(0);
  const fromPlayer = usePickedPlayer(state.server, state.from);
  const toPlayer = usePickedPlayer(state.server, state.to);
  /** Towards alliances only on a server. */
  const mode: TravelMode = state.server ? state.mode : "point";
  const towardsAlliances = mode === "alliances";
  const members = useAllianceMembers(state.server, towardsAlliances ? state.alliances : []);
  const membersPerTag = useMemo(() => {
    if (!members) return undefined;
    const counts = new Map<string, number>();
    for (const member of members)
      if (member.alliance) counts.set(member.alliance, (counts.get(member.alliance) ?? 0) + 1);
    return counts;
  }, [members]);

  const setAttackSpeed = (attackSpeed: number | null) => {
    change((current) => ({ ...current, attackSpeed }));
    levels.remember({ attackSpeed });
  };

  const from = endPoint(state.from, fromPlayer);
  const to = endPoint(state.to, toPlayer);

  const form = (
    <>
      <InvalidLinkNote shown={tool.invalidLink} />
      <Panel
        title="Expéditeur et destination"
        aside={
          !towardsAlliances && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                change(swapEnds);
                setSwaps((count) => count + 1);
              }}
            >
              Inverser
            </Button>
          )
        }
      >
        <div className="space-y-4">
          <ServerSelect value={state.server} onChange={(server) => change((current) => withServer(current, server))} />
          <div className="space-y-1">
            <ChoiceButtons
              label="Destination : un point ou des alliances"
              options={[
                { value: "point", label: "Vers un point" },
                { value: "alliances", label: "Vers des alliances", disabled: !state.server },
              ]}
              value={mode}
              onChange={(next) => change((current) => ({ ...current, mode: next }))}
            />
            {!state.server && (
              <span className="block text-xs text-muted-foreground">
                Vers des alliances : choisissez d&apos;abord un serveur.
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerPicker
              key={`from-${String(tool.opening)}-${String(swaps)}`}
              label="Expéditeur"
              server={state.server}
              value={state.from}
              onChange={(from) => change((current) => ({ ...current, from }))}
            />
            {towardsAlliances && state.server ? (
              <div className="sm:row-span-2">
                <AlliancePicker
                  server={state.server}
                  chosen={state.alliances}
                  members={membersPerTag}
                  onAdd={(tag) => change((current) => withAlliance(current, tag))}
                  onRemove={(tag) => change((current) => withoutAlliance(current, tag))}
                />
              </div>
            ) : (
              <>
                <PlayerPicker
                  key={`to-${String(tool.opening)}-${String(swaps)}`}
                  label="Destination"
                  server={state.server}
                  value={state.to}
                  onChange={(to) => change((current) => ({ ...current, to }))}
                />
                <div className="space-y-1 text-sm">
                  <SmallLabel className="block">Distance</SmallLabel>
                  <output className="flex h-8 items-center border bg-background px-2.5 font-mono rounded-lg">
                    {from && to ? `${String(Math.ceil(distance(from, to)))} cases` : "—"}
                  </output>
                  <span className="block text-xs text-muted-foreground">calculée depuis les positions</span>
                </div>
              </>
            )}
            <label className="block space-y-1 text-sm">
              <SmallLabel className="block">Vitesse d&apos;attaque de l&apos;expéditeur</SmallLabel>
              <NumberField
                value={state.attackSpeed}
                rules={{ min: 0, max: 1000, integer: true, allowEmpty: true }}
                onCommit={setAttackSpeed}
              />
            </label>
          </div>
        </div>
      </Panel>
      <Panel title="Départ" aside={<span className="text-xs text-muted-foreground">heure de Paris</span>}>
        <Departure state={state} now={now} onChange={(departure) => change((current) => ({ ...current, departure }))} />
      </Panel>
      <p className="bg-info-soft px-3.5 py-2.5 text-[0.8125rem] rounded-[0.625rem]">
        Même temps pour une attaque et pour un convoi.
      </p>
    </>
  );

  const departureText =
    !now || state.departure === null ? "maintenant" : formatEndTime(departureTime(state.departure, now), now);
  const trips =
    towardsAlliances && from && members && now && state.attackSpeed !== null && state.alliances.length > 0
      ? allianceTrips({
          sender: {
            ...from,
            id: state.from?.kind === "player" ? (fromPlayer?.id ?? null) : null,
            field: state.from?.kind === "player" ? (fromPlayer?.field ?? null) : null,
          },
          members,
          attackSpeed: state.attackSpeed,
          departure: departureTime(state.departure, now),
          now,
        })
      : null;

  const result = towardsAlliances ? (
    <AlliancesSummary
      trips={trips}
      alliances={state.alliances.length}
      missing={
        !now
          ? "Chargement…"
          : !from
            ? fromPlayer === undefined
              ? "Chargement du joueur…"
              : "Choisissez l'expéditeur : un joueur ou une position (x et y)."
            : state.attackSpeed === null
              ? "Saisissez la Vitesse d'attaque de l'expéditeur."
              : state.alliances.length === 0
                ? "Choisissez une alliance ou plusieurs, par leur tag."
                : "Chargement des membres…"
      }
      senderPseudo={state.from?.kind === "player" ? (fromPlayer?.pseudo ?? null) : null}
      departureText={departureText}
    />
  ) : (
    <Result state={state} now={now} from={from} to={to} loading={fromPlayer === undefined || toPlayer === undefined} />
  );

  return (
    <>
      <ToolLayout
        actions={
          <>
            <ResumeLevelsButton
              levels={levels}
              onResume={(mine) => change((current) => ({ ...current, attackSpeed: mine.attackSpeed ?? null }))}
            />
            <CopyLinkButton />
          </>
        }
        form={form}
        result={result}
      />
      {trips && state.server && (
        <AllianceTripsTable
          server={state.server}
          trips={trips}
          alliances={state.alliances.length}
          senderPseudo={state.from?.kind === "player" ? (fromPlayer?.pseudo ?? null) : null}
          departureText={departureText}
        />
      )}
    </>
  );
}

/** The report towards alliances: the closest member, how many, how many in range; the table comes under the tool. */
function AlliancesSummary({
  trips,
  alliances,
  missing,
  senderPseudo,
  departureText,
}: {
  trips: ReturnType<typeof allianceTrips> | null;
  alliances: number;
  missing: string;
  senderPseudo: string | null;
  departureText: string;
}) {
  if (!trips) return <p className="text-sm text-muted-foreground">{missing}</p>;
  const [closest] = trips;
  const inRange = trips.filter((trip) => trip.range === "in").length;
  return (
    <>
      {closest ? (
        <Verdict title={`Le plus proche : ${closest.time}`}>
          {closest.pseudo} ({closest.alliance}), arrivée {closest.arrivalText} en partant {departureText}
        </Verdict>
      ) : (
        <Verdict title="Aucun membre">dans ces alliances, hors bannis</Verdict>
      )}
      <div className="-mx-4 -mb-4 grid grid-cols-2">
        <Figure
          label={`Membres, ${String(alliances)} alliance${alliances > 1 ? "s" : ""}`}
          value={formatNumber(trips.length)}
        />
        {senderPseudo !== null ? (
          <Figure label={`À portée de ${senderPseudo}`} value={String(inRange)} />
        ) : (
          <Figure label="Portée" value="—" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">Le tableau des membres est sous l&apos;outil.</p>
    </>
  );
}

const DEPARTURES = [
  { value: "now", label: "Maintenant" },
  { value: "fixed", label: "À une heure donnée" },
] as const;

function Departure({
  state,
  now,
  onChange,
}: {
  state: TravelState;
  now: Date | null;
  onChange: (departure: string | null) => void;
}) {
  const fixed = state.departure !== null;
  return (
    <div className="space-y-4">
      <ChoiceButtons
        label="Départ : maintenant ou à une heure donnée"
        options={DEPARTURES}
        value={fixed ? "fixed" : "now"}
        onChange={(choice) => {
          if (choice === "now") onChange(null);
          else if (!fixed) onChange(parisInputValue(now ?? new Date()));
        }}
      />
      {fixed && (
        <label className="block space-y-1 text-sm">
          <SmallLabel className="block">Départ souhaité</SmallLabel>
          <Input
            type="datetime-local"
            value={state.departure ?? ""}
            className="w-full font-mono sm:w-auto"
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          />
        </label>
      )}
    </div>
  );
}

function Result({
  state,
  now,
  from,
  to,
  loading,
}: {
  state: TravelState;
  now: Date | null;
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  loading: boolean;
}) {
  if (!from || !to || state.attackSpeed === null || !now) {
    const missing =
      !from || !to
        ? loading
          ? "Chargement du joueur…"
          : "Choisissez les deux bouts : un joueur ou une position (x et y)."
        : "Saisissez la Vitesse d'attaque de l'expéditeur.";
    return <p className="text-sm text-muted-foreground">{now ? missing : "Chargement…"}</p>;
  }
  const fixed = state.departure !== null;
  const departure = departureTime(state.departure, now);
  const trip = travelResult({ from, to, attackSpeed: state.attackSpeed, departure, now });
  const departureText = fixed ? formatEndTime(departure, now) : "maintenant";
  const arrivalShort = formatEndTimeShort(trip.arrival, now);
  const fromNow = new Date(now.getTime() + trip.seconds * 1000);
  return (
    <>
      <Verdict title={`Arrivée ${arrivalShort}`}>
        {fixed ? `en partant ${departureText}` : "en partant maintenant"}, heure de Paris
      </Verdict>
      {/* Under the verdict, ruled blocks edge to edge, as the report of the mockups. */}
      <div className="-mx-4 -mt-4 -mb-4">
        <div className="grid grid-cols-2 border-b">
          <Figure label="Temps de trajet" value={trip.time} />
          {fixed ? (
            <Figure label="Arrivée si vous lancez maintenant" value={formatEndTimeShort(fromNow, now)} />
          ) : (
            <Figure label="Distance" value={`${String(trip.distance)} cases`} />
          )}
        </div>
        <Timeline
          departure={fixed ? formatEndTimeShort(departure, now) : "maintenant"}
          arrival={arrivalShort}
          label={`Départ ${departureText}, arrivée ${trip.arrivalText}, après ${trip.time} de trajet`}
        />
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
          {fixed && (
            <>
              <dt className="text-muted-foreground">Distance</dt>
              <dd className="text-right font-mono">{trip.distance} cases</dd>
            </>
          )}
          <dt className="text-muted-foreground">Vitesse d&apos;attaque</dt>
          <dd className="text-right font-mono">{state.attackSpeed}</dd>
          <dt className="text-muted-foreground">Départ</dt>
          <dd className="text-right font-mono">{departureText}</dd>
        </dl>
      </div>
    </>
  );
}

/** The trip as a bar: the departure under its start, the arrival over its end. */
function Timeline({ departure, arrival, label }: { departure: string; arrival: string; label: string }) {
  return (
    <figure className="border-b px-4 pt-3.5 pb-4">
      <figcaption className="mb-2.5 font-heading text-lg tracking-wide uppercase">Frise</figcaption>
      <div role="img" aria-label={label} className="space-y-1.5">
        <div className="text-right">
          <SmallLabel className="block text-primary">Arrivée</SmallLabel>
          <div className="font-mono text-[0.9375rem]">{arrival}</div>
        </div>
        <div className="h-2.5 bg-primary" />
        <div>
          <SmallLabel className="block">Départ</SmallLabel>
          <div className="font-mono text-[0.9375rem]">{departure}</div>
        </div>
      </div>
    </figure>
  );
}

/** One figure of the report, as `Stat` but wrapping: a long travel time (« 1J 0H 43m 37s ») stays whole. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5 first:border-r">
      <SmallLabel className="block">{label}</SmallLabel>
      <div className="font-mono text-[1.375rem] leading-tight break-words">{value}</div>
    </div>
  );
}
