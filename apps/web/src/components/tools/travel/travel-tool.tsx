"use client";

// The travel tool: two ends (a player of a server, or a position), the sender's Attack Speed and a departure give the
// distance, the travel time and the arrival, Paris time. See docs/features/site-trajets.md.
import { formatEndTime, parisParts } from "@optizzz/game/format/time-format";
import { useState, useSyncExternalStore } from "react";
import { NumberField } from "~/components/number-field";
import { Panel } from "~/components/panel";
import { Stat } from "~/components/stat";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CopyLinkButton } from "../copy-link-button";
import { pickLevels } from "../my-levels";
import { PlayerPicker, ServerSelect, usePickedPlayer } from "../player-picker";
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

  const form = (
    <>
      <InvalidLinkNote shown={tool.invalidLink} />
      <Panel title="Expéditeur et destination">
        <div className="space-y-4">
          <ServerSelect value={state.server} onChange={(server) => change((current) => withServer(current, server))} />
          <PlayerPicker
            key={`from-${String(tool.opening)}-${String(swaps)}`}
            label="Expéditeur"
            server={state.server}
            value={state.from}
            onChange={(from) => change((current) => ({ ...current, from }))}
          />
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
          <PlayerPicker
            key={`to-${String(tool.opening)}-${String(swaps)}`}
            label="Destination"
            server={state.server}
            value={state.to}
            onChange={(to) => change((current) => ({ ...current, to }))}
          />
          <label className="block space-y-1 text-sm">
            <span className="block font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
              Vitesse d&apos;attaque de l&apos;expéditeur
            </span>
            <NumberField
              value={state.attackSpeed}
              rules={{ min: 0, max: 1000, integer: true, allowEmpty: true }}
              className="w-24"
              onCommit={setAttackSpeed}
            />
          </label>
        </div>
      </Panel>
      <Panel title="Départ" aside={<span className="text-xs text-muted-foreground">heure de Paris</span>}>
        <Departure state={state} now={now} onChange={(departure) => change((current) => ({ ...current, departure }))} />
      </Panel>
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
          from={endPoint(state.from, fromPlayer)}
          to={endPoint(state.to, toPlayer)}
          loading={fromPlayer === undefined || toPlayer === undefined}
        />
      }
    />
  );
}

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
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">Départ</legend>
      <div className="flex gap-1" role="group" aria-label="Départ : maintenant ou à une heure donnée">
        <Button
          type="button"
          size="sm"
          variant={fixed ? "ghost" : "secondary"}
          aria-pressed={!fixed}
          onClick={() => onChange(null)}
        >
          Maintenant
        </Button>
        <Button
          type="button"
          size="sm"
          variant={fixed ? "secondary" : "ghost"}
          aria-pressed={fixed}
          onClick={() => {
            if (!fixed) onChange(parisInputValue(now ?? new Date()));
          }}
        >
          À une heure donnée
        </Button>
      </div>
      {fixed && (
        <label className="block space-y-1 text-sm">
          <span className="block font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
            Jour et heure, heure de Paris
          </span>
          <Input
            type="datetime-local"
            value={state.departure ?? ""}
            className="w-auto"
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
          />
        </label>
      )}
    </fieldset>
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
  const departure = departureTime(state.departure, now);
  const trip = travelResult({ from, to, attackSpeed: state.attackSpeed, departure, now });
  return (
    <>
      <Verdict title={`Arrivée ${trip.arrivalText}`}>
        {trip.time} de trajet, {String(trip.distance)} cases · heure de Paris
      </Verdict>
      <div className="grid border-t border-l sm:grid-cols-3 lg:grid-cols-1">
        <Stat label="Distance" value={`${String(trip.distance)} cases`} />
        <Stat label="Temps de trajet" value={trip.time} />
        <Stat label="Arrivée, heure de Paris" value={trip.arrivalText} />
      </div>
      <Timeline departure={formatEndTime(departure, now)} arrival={trip.arrivalText} time={trip.time} />
      <p className="text-sm text-muted-foreground">Même temps pour une attaque et pour un convoi.</p>
    </>
  );
}

/** Departure to arrival on one line, the travel time written over it. */
function Timeline({ departure, arrival, time }: { departure: string; arrival: string; time: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-center font-mono text-xs text-primary">{time}</div>
      <div aria-hidden className="flex items-center">
        <span className="size-3 border-2 border-primary bg-card" />
        <span className="h-0.5 flex-1 bg-primary" />
        <span className="border-y-[6px] border-l-[10px] border-y-transparent border-l-primary" />
      </div>
      <div className="flex justify-between gap-4 text-sm">
        <span>
          <span className="block font-mono text-[0.6875rem] tracking-wider text-muted-foreground uppercase">
            Départ
          </span>
          {departure}
        </span>
        <span className="text-right">
          <span className="block font-mono text-[0.6875rem] tracking-wider text-muted-foreground uppercase">
            Arrivée
          </span>
          {arrival}
        </span>
      </div>
    </div>
  );
}
