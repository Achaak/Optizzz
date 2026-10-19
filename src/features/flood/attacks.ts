// The attacks on their way, as the game lists them on Armee.php (docs/research/fourmizzz-pages.md, « Armee.php »),
// matched with the ones Optizzz noted when the player sent them.
import type { Launch } from "@/data/launches";

export interface AttackOnWay {
  target: string;
  arrivesAt: Date;
}

/** An attack as the game lists it, with what the line says beyond its target and arrival. */
export interface AttackLine extends AttackOnWay {
  alliance: string | null;
  /** « Terrain de chasse », « Fourmilière », « Loge Impériale », as the game writes it (S5); null when absent. */
  place: string | null;
  /** With Compte+: « Troupes en attaques : 4 047 Jeunes Soldates Naines. », as the game writes it. */
  troops: string | null;
  /** The bold span holding the target's link and its alliance's. */
  targetElement: Element | null;
  /** The game's countdown, `span#attaque_N`, kept up to date by the game. */
  countdown: HTMLElement;
  /** With Compte+, the game's note under the line: troops and arrival time. */
  note: Element | null;
  /** The game's « Annuler » link after the countdown, while the attack can still be cancelled. */
  cancel: HTMLAnchorElement | null;
}

/**
 * « - Vous allez attaquer <a>X</a>(TAG) (Terrain de chasse) dans <span id="attaque_N">…</span>
 * <script>reste(559, "attaque_N")</script> - <a href="/Armee.php?annuler=N">Annuler</a><br><small><em>Troupes en attaques : … <br>Arrivée à 19h54</em></small> ».
 */
export function readAttackLines(doc: Document, now: Date): AttackLine[] {
  const seconds = countdownSeconds(doc);
  return [...doc.querySelectorAll<HTMLElement>("#centre span[id^='attaque_']")].flatMap((countdown) => {
    const left = seconds.get(countdown.id);
    // The target's link is in the bold span just before « dans ».
    const targetElement = countdown.previousElementSibling;
    const target = targetElement?.querySelector("a[href^='Membre.php']")?.textContent.trim();
    if (left === undefined || !target) return [];
    const alliance = targetElement?.querySelector("a[href*='alliance=']")?.textContent.trim() ?? null;
    const between = countdown.previousSibling?.nodeType === Node.TEXT_NODE ? countdown.previousSibling.textContent : "";
    const note = noteAfter(countdown);
    const cancel = lineAfter(countdown).find(isCancelLink) ?? null;
    const place = /\(([^)]+)\)\s*dans\s*$/.exec(between ?? "")?.[1]?.trim() ?? null;
    return [
      {
        target,
        alliance,
        place,
        troops: troopsIn(note),
        arrivesAt: new Date(now.getTime() + left * 1000),
        targetElement: targetElement ?? null,
        countdown,
        note,
        cancel,
      },
    ];
  });
}

/** Troops coming home, which the game calls reinforcements (after the army of a colony was called back or freed). */
export interface ReinforcementLine {
  arrivesAt: Date;
  /** The game's countdown, `span#attaque_N`, kept up to date by the game. */
  countdown: HTMLElement;
  /** With Compte+: « Troupes en renforts : 10 Jeunes Soldates Naines. », as the game writes it. */
  troops: string | null;
  /** With Compte+, the game's note under the line: troops and arrival time. */
  note: Element | null;
}

/**
 * « - Des renforts arrivent dans <span id="attaque_N">42m 36s </span><br><script>reste(2556, "attaque_N")</script> »
 * (S2, 2026-10-19, after « Rappeler l'armée » on colonies.php): no target, the same countdown ids as the attacks. With
 * Compte+, `<small><em> Troupes en renforts : 10 Jeunes Soldates Naines.<br>Arrivée à 12h57</em></small>` follows.
 */
export function readReinforcementLines(doc: Document, now: Date): ReinforcementLine[] {
  const seconds = countdownSeconds(doc);
  return [...doc.querySelectorAll<HTMLElement>("#centre span[id^='attaque_']")].flatMap((countdown) => {
    const left = seconds.get(countdown.id);
    const before = countdown.previousSibling?.nodeType === Node.TEXT_NODE ? countdown.previousSibling.textContent : "";
    if (left === undefined || !/renforts arrivent\s+dans\s*$/i.test(before ?? "")) return [];
    const note = noteAfter(countdown);
    return [{ arrivesAt: new Date(now.getTime() + left * 1000), countdown, troops: troopsIn(note), note }];
  });
}

/** The game's `reste(<seconds>, "attaque_N")` calls, by countdown id. */
function countdownSeconds(doc: Document): Map<string, number> {
  const seconds = new Map<string, number>();
  for (const script of doc.querySelectorAll("#centre script")) {
    for (const [, left, id] of script.textContent.matchAll(/reste\((\d+),\s*"(attaque_\d+)"\)/g)) {
      if (id) seconds.set(id, Number(left));
    }
  }
  return seconds;
}

/** What follows the countdown, up to the next attack. */
function lineAfter(countdown: Element): ChildNode[] {
  const nodes: ChildNode[] = [];
  for (let node = countdown.nextSibling; node; node = node.nextSibling) {
    if (node instanceof Element && node.id.startsWith("attaque_")) break;
    if (node.nodeType === Node.TEXT_NODE && /Vous allez attaquer|renforts arrivent/.test(node.textContent ?? "")) break;
    nodes.push(node);
  }
  return nodes;
}

/** The Compte+ note after the countdown, before the next attack. */
const noteAfter = (countdown: Element): Element | null =>
  lineAfter(countdown).find((node): node is Element => node instanceof Element && node.tagName === "SMALL") ?? null;

/** The game's « Annuler » link (`Armee.php?annuler=<id>` for an attack), while it can still be cancelled. */
export const isCancelLink = (node: Node | null | undefined): node is HTMLAnchorElement =>
  node instanceof Element && node.tagName === "A" && /[?&]annuler=/i.test(node.getAttribute("href") ?? "");

function troopsIn(note: Element | null): string | null {
  const text = note?.textContent.replace(/\s+/g, " ") ?? "";
  return /Troupes en (?:attaques|renforts)\s*:[^\n]*?\./.exec(text)?.[0].trim() ?? null;
}

/** « Troupes en renforts : 10 Jeunes Soldates Naines. » → « 10 Jeunes Soldates Naines. », for `readTroops`. */
export const troopList = (troops: string) => troops.replace(/^Troupes en \S+\s*:\s*/, "");

/** The attacks the game lists: target and arrival. */
export function readAttacksOnWay(doc: Document, now: Date): AttackOnWay[] {
  return readAttackLines(doc, now).map(({ target, arrivesAt }) => ({ target, arrivesAt }));
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * The attack as the game writes it, its countdown as the game shows it now, its Compte+ note on the next lines:
 * « Vous allez attaquer X(TAG) (Terrain de chasse) dans 3 heures 14 minutes 54 secondes
 * Troupes en attaques : 4 047 Jeunes Soldates Naines.
 * Arrivée à 19h54 ».
 */
export function gameAttackText(attack: Pick<AttackLine, "target" | "place" | "targetElement" | "countdown" | "note">) {
  const target = clean(attack.targetElement?.textContent ?? attack.target);
  const place = attack.place ? ` (${attack.place})` : "";
  return [
    `Vous allez attaquer ${target}${place} dans ${clean(attack.countdown.textContent)}`,
    ...noteLines(attack.note),
  ].join("\n");
}

/** « Des renforts arrivent dans 42 minutes 36 secondes », then the Compte+ note on the next lines. */
export function gameReinforcementText(line: Pick<ReinforcementLine, "countdown" | "note">) {
  return [`Des renforts arrivent dans ${clean(line.countdown.textContent)}`, ...noteLines(line.note)].join("\n");
}

/** The Compte+ note's lines, which the game breaks with <br>. */
function noteLines(note: Element | null): string[] {
  if (!note) return [];
  const copy = note.cloneNode(true) as Element;
  for (const br of copy.querySelectorAll("br")) br.replaceWith("\n");
  return copy.textContent.split("\n").map(clean).filter(Boolean);
}

/**
 * The launches still on their way according to the game: per target, each listed attack is paired with the noted
 * launch arriving nearest. A launch left alone was cancelled: forgotten. A listed attack left alone was sent
 * without Optizzz: `unknown` (it takes a slot, its take is not known).
 */
export function reconcileLaunches(launches: Launch[], onWay: AttackOnWay[]): { launches: Launch[]; unknown: number } {
  const pairs = onWay.flatMap((attack, a) =>
    launches.flatMap((launch, l) =>
      launch.target.toLowerCase() === attack.target.toLowerCase()
        ? [{ a, l, gap: Math.abs(launch.arrivesAt.getTime() - attack.arrivesAt.getTime()) }]
        : [],
    ),
  );
  pairs.sort((x, y) => x.gap - y.gap);
  const pairedAttacks = new Map<number, number>();
  const pairedLaunches = new Set<number>();
  for (const { a, l } of pairs) {
    if (pairedAttacks.has(a) || pairedLaunches.has(l)) continue;
    pairedAttacks.set(a, l);
    pairedLaunches.add(l);
  }
  const kept = [...pairedAttacks.entries()]
    .sort(([a1], [a2]) => a1 - a2)
    .flatMap(([a, l]) => {
      const launch = launches[l];
      const attack = onWay[a];
      return launch && attack ? [{ ...launch, arrivesAt: attack.arrivesAt }] : [];
    });
  return { launches: kept, unknown: onWay.length - pairedAttacks.size };
}
