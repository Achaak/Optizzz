import type { Place } from "@/game/army/battle";
import { unitLabel, UNITS, type Army } from "@/game/army/units";
import { PLACE_FROM, PLACE_NAMES, placesWithoutProbe, probeMoves } from "@/game/probes";
import type { ProbesResult } from "@/data/probes";

const BOX_CLASS = "optizzz-probes";

export const PROBES_STYLE = `
.${BOX_CLASS} { margin: 8px auto; width: fit-content; max-width: 100%; box-sizing: border-box; padding: 6px 10px;
  text-align: left; color: var(--optizzz-text); background: var(--optizzz-warning-bg);
  border: 1px solid var(--optizzz-warning); border-radius: var(--optizzz-radius); }
.${BOX_CLASS} p { margin: 4px 0; }
.${BOX_CLASS}-moves { font-size: var(--optizzz-font-size-small); color: var(--optizzz-text-muted); }`;

/** « le Dôme et la Loge ». */
function placeList(places: readonly Place[]): string {
  const names = places.map((place) => PLACE_NAMES[place]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1) ?? ""}` : (names[0] ?? "");
}

/**
 * Above the garrison on Armee.php, when a watched place has no ant: a warning, and a button that moves one there.
 * Nothing when every probe is in place.
 */
export function renderProbes(
  doc: Document,
  armies: Record<Place, Army>,
  watched: readonly Place[],
  place: () => Promise<ProbesResult>,
  reload: () => void,
): void {
  const empty = placesWithoutProbe(armies, watched);
  const table = [...doc.querySelectorAll("table.simulateur")].find((candidate) =>
    candidate.textContent.includes("Troupes en Garnison"),
  );
  if (empty.length === 0 || !table || doc.querySelector(`.${BOX_CLASS}`)) return;

  const box = doc.createElement("div");
  box.className = BOX_CLASS;
  const warning = doc.createElement("p");
  warning.textContent = `⚠ Pas de sonde sur ${placeList(empty)} : si l'on vous y attaque, aucun combat n'a lieu et le rapport ne montre pas l'armée de l'attaquant.`;
  box.append(warning);

  const { moves, missing } = probeMoves(armies, watched);
  if (moves.length > 0) {
    const line = doc.createElement("p");
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = moves.length > 1 ? "Placer les sondes" : "Placer la sonde";
    const detail = doc.createElement("span");
    detail.className = `${BOX_CLASS}-moves`;
    detail.textContent = ` ${moves
      .map(
        (move) => `1 ${unitLabel(UNITS[move.unit]?.key ?? "")} ${PLACE_FROM[move.from]} vers ${PLACE_NAMES[move.to]}`,
      )
      .join(", ")}`;
    line.append(button, detail);
    box.append(line);

    const outcome = doc.createElement("p");
    outcome.hidden = true;
    box.append(outcome);
    button.addEventListener("click", () => {
      button.disabled = true;
      button.textContent = "Déplacement…";
      void place()
        .catch((): ProbesResult => ({ placed: [], missing: empty, failed: true }))
        .then((result) => {
          if (!result.failed) {
            reload();
            return;
          }
          outcome.hidden = false;
          outcome.textContent = `Le jeu n'a pas pris le déplacement${result.placed.length > 0 ? ` (sonde placée sur ${placeList(result.placed)})` : ""}. Rechargez la page pour réessayer.`;
          button.textContent = "Échec";
        });
    });
  }
  if (missing.length > 0) {
    const short = doc.createElement("p");
    short.textContent = `Pas assez de fourmis à la maison pour une sonde sur ${placeList(missing)} : une par lieu, sans vider un autre lieu.`;
    box.append(short);
  }
  table.before(box);
}
