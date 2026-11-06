// The block « Timing à la seconde » above the « Attaquer » button of the attack form (docs/features/timing.md).
// Optizzz never clicks, never sends the form, never greys or enables the button: the click stays the player's.
import {
  arrivalInMinute,
  arrivalText,
  beepsBetween,
  clickPhase,
  clickWindow,
  countdownText,
  driftText,
  formatSeconds,
  gameClock,
  nextArrival,
  parseAimedMinute,
  type AimedMinute,
  type Beep,
  type ServerClock,
} from "@optizzz/game/timing";
import { onAttackSent } from "../flood/page";
import type { TimedLaunch } from "./sent";

const C = "optizzz-timing";

export const TIMING_STYLE = `
.${C} { margin: var(--optizzz-space-3) 0; text-align: left; }
.${C} p { margin: var(--optizzz-space-2) 0; }
.${C}-clock { font-variant-numeric: tabular-nums; }
.${C}-aim { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-2) var(--optizzz-space-3); }
.${C}-aim input { width: 7em; }
.${C}-countdown {
  margin: var(--optizzz-space-3) 0;
  padding: var(--optizzz-space-3);
  border: 1px solid var(--optizzz-border-soft);
  font-size: var(--optizzz-font-size-title-large);
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.${C}-countdown:empty { display: none; }
.${C}-countdown.${C}-now { border: 4px solid var(--optizzz-title); }`;

export type Travel =
  | {
      seconds: number;
      /** « game »: read on the target's profile (Compte+); « formula »: Optizzz's formula. */
      source: "game" | "formula";
      /** What Optizzz's formula gives, to compare; null when it cannot be computed. */
      formulaSeconds: number | null;
    }
  | { seconds: null; reason: string };

export interface TimingContext {
  target: string;
  travel: Travel;
  /** « Son », remembered per server. */
  sound: boolean;
  onSoundChange: (on: boolean) => void;
  beep: (beep: Beep) => void;
  /** An attack sent with the block on, noted for the check after the send. */
  onSend: (launch: TimedLaunch) => void;
}

/** Attacks sent this close to the window are noted even without a written minute: the player was timing them. */
const NOTE_AROUND_MS = 3000;
/** « Trop tard pour … » stays this long once the next :59 is aimed at. */
const MISSED_SHOWN_MS = 5000;
const TICK_MS = 100;

const WHY = [
  "Le jeu règle ensemble, à la minute suivante, toutes les attaques arrivées dans une même minute, dans l'ordre de leur seconde d'arrivée : à :59, la vôtre passe après les autres.",
  "Mesuré par Optizzz en novembre 2026 sur S2. Deux attaques arrivées à la même seconde : ordre inconnu.",
  "Le bloc vise le milieu de la seconde de départ et retire le temps que l'envoi met à atteindre le jeu : cliquez pendant « Cliquez maintenant ». Optizzz n'envoie jamais l'attaque à votre place.",
];

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The block above the « Attaquer » button: the game's time, the trip and the arrival aimed at, and a countdown to the
 * click. `setClock` gives it the game's clock once measured (null: unreadable). `now` is the PC's clock.
 */
export function mountTiming(
  doc: Document,
  context: TimingContext,
  now: () => number,
): { setClock: (clock: ServerClock | null) => void; stop: () => void } {
  const button = doc.querySelector<HTMLInputElement>("#formulaireChoixArmee input[name=ChoixArmee]");
  const block = element(doc, "div", `${C} optizzz-panel optizzz-panel--inset`);
  const title = element(doc, "div", "optizzz-panel-title", "Timing à la seconde");
  const clockLine = element(doc, "p", `${C}-clock`, "Mesure de l'heure du jeu…");
  const drift = element(doc, "p", "optizzz-note");
  const trip = element(doc, "p", `${C}-trip`);
  const tripNote = element(doc, "p", "optizzz-note");

  const aim = element(doc, "label", `${C}-aim`);
  const field = element(doc, "input");
  field.type = "text";
  field.placeholder = "23 h 40";
  field.autocomplete = "off";
  const aimHint = element(doc, "span", "optizzz-note", "Vide : la prochaine :59.");
  aim.append("Arrivée visée", field, aimHint);

  const countdown = element(doc, "div", `${C}-countdown`);
  const missedLine = element(doc, "p", "optizzz-note");

  const sound = element(doc, "label", `${C}-sound`);
  const soundBox = element(doc, "input");
  soundBox.type = "checkbox";
  soundBox.checked = context.sound;
  sound.append(soundBox, " Son (bips aux trois dernières secondes, bip long au milieu de la fenêtre)");

  const why = element(doc, "details", "optizzz-disclosure");
  why.append(
    element(doc, "summary", undefined, "Pourquoi :59 ?"),
    ...WHY.map((text) => element(doc, "p", "optizzz-note", text)),
  );

  block.append(title, clockLine, drift, trip, tripNote, aim, countdown, missedLine, sound, why);
  if (button) button.before(block);
  else doc.getElementById("formulaireChoixArmee")?.append(block);

  // The game's form must never be sent from here: Enter in a text field would.
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  soundBox.addEventListener("change", () => {
    context.onSoundChange(soundBox.checked);
  });

  const travel = context.travel;
  if (travel.seconds === null) {
    trip.textContent = `Trajet inconnu. ${travel.reason}`;
    aim.hidden = true;
    sound.hidden = true;
  } else if (travel.source === "game" && travel.formulaSeconds !== null && travel.formulaSeconds !== travel.seconds) {
    tripNote.textContent = `Trajet du profil de ${context.target} ; la formule d'Optizzz donne ${formatSeconds(travel.formulaSeconds)}.`;
  }

  let clock: ServerClock | null = null;
  let minute: AimedMinute | null = null;
  let arrival: number | null = null;
  let missed: { arrival: number; until: number } | null = null;
  let lastToMiddle: number | null = null;

  const serverNow = () => now() + (clock?.offsetMs ?? 0);
  const aimAgain = () => {
    if (!clock || travel.seconds === null) return;
    arrival = minute ? arrivalInMinute(minute, serverNow(), travel.seconds) : nextArrival(serverNow(), travel.seconds);
    lastToMiddle = null;
  };

  const render = () => {
    if (!clock) return;
    const server = serverNow();
    clockLine.textContent = `Heure du jeu : ${gameClock(server)}`;
    if (travel.seconds === null || arrival === null) return;
    let window = clickWindow(arrival, travel.seconds, clock);
    let phase = clickPhase(now(), window);
    if (phase.kind === "late" && !minute) {
      missed = { arrival, until: now() + MISSED_SHOWN_MS };
      aimAgain();
      window = clickWindow(arrival, travel.seconds, clock);
      phase = clickPhase(now(), window);
    }
    const departure = arrival - travel.seconds * 1000;
    trip.textContent = `Trajet : ${formatSeconds(travel.seconds)} · arrivée visée : ${arrivalText(arrival, server)} · départ : ${arrivalText(departure, server)}`;

    countdown.classList.toggle(`${C}-now`, phase.kind === "now");
    countdown.textContent =
      phase.kind === "wait"
        ? `Cliquez dans ${countdownText(phase.msLeft)}`
        : phase.kind === "now"
          ? "Cliquez maintenant"
          : `Trop tard pour ${arrivalText(arrival, server)}`;
    if (missed && now() > missed.until) missed = null;
    missedLine.textContent = missed ? `Trop tard pour ${arrivalText(missed.arrival, server)}` : "";

    const toMiddle = window.middle - now();
    if (soundBox.checked && lastToMiddle !== null)
      for (const beep of beepsBetween(lastToMiddle, toMiddle)) context.beep(beep);
    lastToMiddle = toMiddle;
  };

  field.addEventListener("input", () => {
    const text = field.value.trim();
    minute = text ? parseAimedMinute(text) : null;
    aimHint.textContent = text && !minute ? "Écrivez une heure, par exemple 23 h 40." : "Vide : la prochaine :59.";
    missed = null;
    aimAgain();
    render();
  });

  onAttackSent(doc, () => {
    if (!clock || travel.seconds === null || arrival === null) return;
    const sentAt = now();
    const window = clickWindow(arrival, travel.seconds, clock);
    if (!minute && Math.abs(sentAt - window.middle) > NOTE_AROUND_MS) return;
    context.onSend({ target: context.target, aimedAt: arrival, clock, sentAt });
  });

  const timer = setInterval(render, TICK_MS);
  return {
    setClock: (measured) => {
      clock = measured;
      if (!measured) {
        clockLine.textContent =
          "Heure du jeu illisible : le jeu n'a pas donné son heure. Rechargez la page pour réessayer.";
        aim.hidden = true;
        sound.hidden = true;
        return;
      }
      drift.textContent = driftText(measured.offsetMs) ?? "";
      aimAgain();
      render();
    },
    stop: () => {
      clearInterval(timer);
    },
  };
}
