// The attacks on their way, as the game lists them on Armee.php (docs/research/fourmizzz-pages.md, « Armee.php »),
// matched with the ones Optizzz noted when the player sent them.
import type { Launch } from "@/data/launches";

export interface AttackOnWay {
  target: string;
  arrivesAt: Date;
}

/** « - Vous allez attaquer <a>X</a>(TAG) dans <span id="attaque_N">…</span><script>reste(559, "attaque_N")</script> ». */
export function readAttacksOnWay(doc: Document, now: Date): AttackOnWay[] {
  const seconds = new Map<string, number>();
  for (const script of doc.querySelectorAll("#centre script")) {
    for (const [, left, id] of script.textContent.matchAll(/reste\((\d+),\s*"(attaque_\d+)"\)/g)) {
      if (id) seconds.set(id, Number(left));
    }
  }
  return [...doc.querySelectorAll<HTMLElement>("#centre span[id^='attaque_']")].flatMap((span) => {
    const left = seconds.get(span.id);
    // The target's link is in the bold span just before « dans ».
    const target = span.previousElementSibling?.querySelector("a[href^='Membre.php']")?.textContent.trim();
    return left !== undefined && target ? [{ target, arrivesAt: new Date(now.getTime() + left * 1000) }] : [];
  });
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
