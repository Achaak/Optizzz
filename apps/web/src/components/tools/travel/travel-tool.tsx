"use client";

// The travel tool: two ends (a player of a server, or a position), the sender's Attack Speed and a departure give the
// distance, the travel time and the arrival, Paris time. See docs/features/site-trajets.md.
import { formatEndTime, formatEndTimeShort, parisParts } from "@optizzz/game/format/time-format";
import { distance } from "@optizzz/game/travel";
import { useState, useSyncExternalStore } from "react";
import { NumberField } from "~/components/number-field";
import { SmallLabel, Panel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels } from "../my-levels";
import { ChoiceButtons, PlayerPicker, ServerSelect, usePickedPlayer } from "../player-picker";
import { InvalidLinkNote, ToolLayout, Verdict } from "../tool-page";
import { ResumeLevelsButton, useMyLevels } from "../use-my-levels";
import { useToolState } from "../use-tool-state";
import { departureTime, endPoint, travelResult } from "./travel-result";
import { EMPTY_TRAVEL, swapEnds, travelFormat, withServer, type TravelState } from "./travel-state";

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

export function TravelTool() {
  const tool = useToolState({ tool: "travel", format: travelFormat, empty: EMPTY_TRAVEL, withMyLevels });
  const levels = useMyLevels(tool);
  const { state, change } = tool;
  const now = useNow();
  /** « Inverser » remounts the pickers: each shows its new end. */
  const [swaps, setSwaps] = useState(0);
  const fromPlayer = usePickedPlayer(state.server, state.from);
  const toPlayer = usePickedPlayer(state.server, state.to);

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
        }
      >
        <div className="space-y-4">
          <ServerSelect value={state.server} onChange={(server) => change((current) => withServer(current, server))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerPicker
              key={`from-${String(tool.opening)}-${String(swaps)}`}
              label="Expéditeur"
              server={state.server}
              value={state.from}
              onChange={(from) => change((current) => ({ ...current, from }))}
            />
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

  return (
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
      result={
        <Result
          state={state}
          now={now}
          from={from}
          to={to}
          loading={fromPlayer === undefined || toPlayer === undefined}
        />
      }
    />
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
