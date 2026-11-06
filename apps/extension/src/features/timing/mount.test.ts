import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import formHtml from "../flood/__fixtures__/attack-form.html?raw";
import { mountTiming, type TimingContext } from "./mount";

// PC 3 s behind the game, 100 ms from it. The game is at 9 h 30 min 40,3 s (Paris) when the block opens.
const pcStart = Date.parse("2026-11-04T08:30:37.300Z");
const clock = { offsetMs: 3000, errorMs: 200, oneWayMs: 100 };

function setup(options: Partial<TimingContext> = {}) {
  const doc = new DOMParser().parseFromString(formHtml, "text/html");
  const context: TimingContext = {
    target: "Cible_1",
    travel: { seconds: 548, source: "formula", formulaSeconds: 548 },
    sound: false,
    onSoundChange: vi.fn(),
    beep: vi.fn(),
    onSend: vi.fn(),
    ...options,
  };
  const timing = mountTiming(doc, context, () => Date.now());
  const block = () => doc.querySelector<HTMLElement>(".optizzz-timing");
  const text = () => block()?.textContent.replace(/\s+/g, " ") ?? "";
  const countdown = () => doc.querySelector<HTMLElement>(".optizzz-timing-countdown");
  const field = () => doc.querySelector<HTMLInputElement>(".optizzz-timing-aim input");
  const sound = () => doc.querySelector<HTMLInputElement>(".optizzz-timing-sound input");
  const submit = () => doc.querySelector<HTMLInputElement>("input[name=ChoixArmee]");
  const tick = (ms: number) => vi.advanceTimersByTime(ms);
  return { doc, context, timing, block, text, countdown, field, sound, submit, tick };
}

describe("mountTiming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(pcStart);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sits just above the « Attaquer » button, inside the game's form, and waits for the game's clock", () => {
    const { block, submit, text } = setup();
    expect(block()?.nextElementSibling).toBe(submit());
    expect(text()).toContain("Mesure de l'heure du jeu…");
  });

  it("shows the game's time, the PC's drift, the trip and the next arrival at :59, then counts down to the click", () => {
    const { timing, text, countdown } = setup();
    timing.setClock(clock);
    expect(text()).toContain("Heure du jeu : 09:30:40");
    expect(text()).toContain("Votre horloge retarde de 3 s : le bloc en tient compte.");
    expect(text()).toContain("Trajet : 9 min 08 s · arrivée visée : 9 h 39 min 59 s · départ : 9 h 30 min 51 s");
    // Window: 51.5 s on the game's clock, − 3 s, − 100 ms → 48.4 s on the PC's, from 48.1 s: 10.8 s left.
    expect(countdown()?.textContent).toBe("Cliquez dans 11 s");
    vi.advanceTimersByTime(7_000);
    expect(countdown()?.textContent).toBe("Cliquez dans 3,8 s");
    expect(text()).toContain("Heure du jeu : 09:30:47");
  });

  it("says « Cliquez maintenant » in a thick frame during the window, then too late and the next :59", () => {
    const { timing, countdown, text, tick } = setup();
    timing.setClock(clock);
    tick(10_900); // PC 48.2 s.
    expect(countdown()?.textContent).toBe("Cliquez maintenant");
    expect(countdown()?.classList.contains("optizzz-timing-now")).toBe(true);
    tick(600); // PC 48.8 s.
    expect(countdown()?.classList.contains("optizzz-timing-now")).toBe(false);
    expect(text()).toContain("Trop tard pour 9 h 39 min 59 s");
    expect(text()).toContain("arrivée visée : 9 h 40 min 59 s");
  });

  it("aims at :59 of the minute written in « Arrivée visée »", () => {
    const { timing, field, text } = setup();
    timing.setClock(clock);
    const input = field();
    if (!input) throw new Error("no field");
    input.value = "10 h 15";
    input.dispatchEvent(new Event("input"));
    expect(text()).toContain("arrivée visée : 10 h 15 min 59 s · départ : 10 h 06 min 51 s");
    expect(text()).toContain("Cliquez dans 36 min 11 s");
  });

  it("stays on a written minute once missed", () => {
    const { timing, field, text, tick } = setup();
    timing.setClock(clock);
    const input = field();
    if (!input) throw new Error("no field");
    input.value = "9 h 39";
    input.dispatchEvent(new Event("input"));
    tick(12_000);
    expect(text()).toContain("Trop tard pour 9 h 39 min 59 s");
    expect(text()).toContain("arrivée visée : 9 h 39 min 59 s");
  });

  it("says when « Arrivée visée » is not a time", () => {
    const { timing, field, text } = setup();
    timing.setClock(clock);
    const input = field();
    if (!input) throw new Error("no field");
    input.value = "midi";
    input.dispatchEvent(new Event("input"));
    expect(text()).toContain("Écrivez une heure, par exemple 23 h 40");
    expect(text()).toContain("arrivée visée : 9 h 39 min 59 s");
  });

  it("never sends the form from « Arrivée visée »: Enter does nothing", () => {
    const { field } = setup();
    const enter = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    field()?.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
  });

  it("leaves the « Attaquer » button alone", () => {
    const { timing, submit, tick } = setup();
    timing.setClock(clock);
    tick(11_000);
    expect(submit()?.disabled).toBe(false);
    expect(submit()?.outerHTML).toBe('<input type="submit" name="ChoixArmee" value="Attaquer">');
  });

  it("beeps only with « Son » ticked: short at 3, 2 and 1 s before the middle of the window, long at it", () => {
    const off = setup();
    const on = setup({ sound: true });
    off.timing.setClock(clock);
    on.timing.setClock(clock);
    vi.advanceTimersByTime(11_200);
    expect(off.context.beep).not.toHaveBeenCalled();
    expect(vi.mocked(on.context.beep).mock.calls).toEqual([["short"], ["short"], ["short"], ["long"]]);
  });

  it("remembers « Son »", () => {
    const { sound, context } = setup();
    expect(sound()?.checked).toBe(false);
    sound()?.click();
    expect(context.onSoundChange).toHaveBeenCalledWith(true);
  });

  it("notes an attack sent around the window, with the arrival aimed at", () => {
    const { timing, doc, context, tick } = setup();
    timing.setClock(clock);
    tick(10_900);
    doc.getElementById("formulaireChoixArmee")?.dispatchEvent(new Event("submit"));
    expect(context.onSend).toHaveBeenCalledWith({
      target: "Cible_1",
      aimedAt: Date.parse("2026-11-04T08:39:59Z"),
      clock,
      sentAt: Date.parse("2026-11-04T08:30:48.200Z"),
    });
  });

  it("notes nothing for an attack sent far from the window without a written minute", () => {
    const { timing, doc, context } = setup();
    timing.setClock(clock);
    doc.getElementById("formulaireChoixArmee")?.dispatchEvent(new Event("submit"));
    expect(context.onSend).not.toHaveBeenCalled();
  });

  it("says when the game's clock cannot be read", () => {
    const { timing, text, countdown } = setup();
    timing.setClock(null);
    expect(text()).toContain("Heure du jeu illisible");
    expect(countdown()?.textContent ?? "").toBe("");
  });

  it("says why without a trip, and still shows the game's time", () => {
    const { timing, text } = setup({ travel: { seconds: null, reason: "Votre Vitesse d'attaque est inconnue." } });
    timing.setClock(clock);
    expect(text()).toContain("Heure du jeu : 09:30:40");
    expect(text()).toContain("Trajet inconnu. Votre Vitesse d'attaque est inconnue.");
  });

  it("takes the game's trip when the profile shows it, and says when the formula differs", () => {
    const { timing, text } = setup({ travel: { seconds: 548, source: "game", formulaSeconds: 547 } });
    timing.setClock(clock);
    expect(text()).toContain("Trajet du profil de Cible_1 ; la formule d'Optizzz donne 9 min 07 s.");
  });

  it("explains « Pourquoi :59 ? », folded", () => {
    const { doc } = setup();
    const why = doc.querySelector<HTMLDetailsElement>(".optizzz-timing details");
    expect(why?.open).toBe(false);
    expect(why?.querySelector("summary")?.textContent).toBe("Pourquoi :59 ?");
    expect(why?.textContent).toContain("dans l'ordre de leur seconde d'arrivée");
  });
});
