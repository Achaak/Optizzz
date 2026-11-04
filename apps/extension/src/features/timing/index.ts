import { storage } from "wxt/utils/storage";
import { loadPlayersExport } from "@/data/exports";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { fetchGamePage } from "@/utils/game-page";
import { readLoggedInPseudo } from "@optizzz/game/pages/alliance";
import { readProfileTravelTime } from "@optizzz/game/pages/scores";
import type { Beep } from "@optizzz/game/timing";
import { distance, travelTime } from "@optizzz/game/travel";
import type { Feature } from "../feature";
import { readAttackForm } from "../flood/page";
import { browserIo, measureServerClock } from "./clock";
import { mountTiming, TIMING_STYLE, type Travel } from "./mount";
import { checkTimedLaunches, labelTimedAttacks, loadTimedAttacks, queueTimedLaunch } from "./sent";

const soundKey = (origin: string) => `local:timing:${new URL(origin).host}:sound` as const;

let audio: AudioContext | null = null;

/** A beep without a file or a permission (Web Audio). The browser lets it play once the page has been clicked. */
function beep(kind: Beep) {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = kind === "long" ? 1046 : 784;
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + (kind === "long" ? 0.4 : 0.08));
  } catch (error) {
    console.warn("[Optizzz] timing: no sound", error);
  }
}

/** The trip to the target: the game's on the profile (Compte+), else Optizzz's formula. */
async function travelTo(origin: string, me: string, target: { id: number; pseudo: string }): Promise<Travel> {
  const [playersExport, levels, profile] = await Promise.all([
    loadPlayersExport(origin).catch(() => null),
    loadLevelsOf(origin, ["attackSpeed"]).catch((error: unknown) => ({ error })),
    // Shared with the Plan de flood, which reads the same profile for the target's field.
    fetchGamePage(`/Membre.php?Pseudo=${encodeURIComponent(target.pseudo)}`).catch(() => null),
  ]);
  const sender = playersExport?.players.find((player) => player.pseudo.toLowerCase() === me.toLowerCase());
  const aimed = playersExport?.players.find((player) => player.id === target.id);
  const formula =
    sender && aimed && !("error" in levels) ? travelTime(distance(sender, aimed), levels.attackSpeed) : null;
  const game = profile ? readProfileTravelTime(profile) : null;
  if (game !== null) return { seconds: game, source: "game", formulaSeconds: formula };
  if (formula !== null) return { seconds: formula, source: "formula", formulaSeconds: formula };
  if ("error" in levels) return { seconds: null, reason: unknownLevelsHint(levels.error) };
  return { seconds: null, reason: `Votre position ou celle de ${target.pseudo} manque dans l'export public.` };
}

/**
 * On the attack form: when to click for the attack to arrive at :59. On Armee.php and the attack form: the exact
 * arrival of the attacks sent that way. See docs/features/timing.md.
 */
export const timing: Feature = {
  id: "timing",
  toggle: "timing",
  matches: (url) =>
    url.pathname.toLowerCase() === "/armee.php" ||
    (url.pathname.toLowerCase() === "/ennemie.php" && url.searchParams.has("Attaquer")),
  async run(ctx) {
    const origin = location.origin;
    // After the send: the game's list read once, then the verdict on each timed line. Not awaited: the block opens.
    void checkTimedLaunches(origin, sessionStorage, browserIo)
      .then(() => loadTimedAttacks(origin, Date.now()))
      .then((attacks) => {
        labelTimedAttacks(document, attacks);
      })
      .catch((error: unknown) => {
        console.warn("[Optizzz] timing: check after the send failed", error);
      });

    const form = location.pathname.toLowerCase() === "/ennemie.php" ? readAttackForm(document) : null;
    const me = readLoggedInPseudo(document);
    if (!form || !me) return;
    const measuring = measureServerClock(browserIo).catch((error: unknown) => {
      console.warn("[Optizzz] timing: the game's clock is unreadable", error);
      return null;
    });
    const [travel, sound] = await Promise.all([
      travelTo(origin, me, { id: form.targetId, pseudo: form.target }),
      storage.getItem<boolean>(soundKey(origin)),
    ]);
    const style = document.createElement("style");
    style.textContent = TIMING_STYLE;
    document.head.append(style);
    const block = mountTiming(
      document,
      {
        target: form.target,
        travel,
        sound: sound ?? false,
        onSoundChange: (on) => {
          if (on) beep("short");
          void storage.setItem(soundKey(origin), on);
        },
        beep,
        onSend: (launch) => {
          queueTimedLaunch(sessionStorage, launch);
        },
      },
      () => Date.now(),
    );
    ctx.onInvalidated(block.stop);
    block.setClock(await measuring);
  },
};
