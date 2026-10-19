import type { Place } from "@/game/army/battle";
import { unitLabel, UNITS, type Army } from "@/game/army/units";
import {
  PLACE_FROM,
  PLACE_NAMES,
  PLACES,
  placesWithoutProbe,
  probeMoves,
  storeMoves,
  type ProbeMove,
} from "@/game/probes";
import { probePlan, type ProbeTargets, type ProbesResult } from "@/data/probes";
import { parseGameInteger } from "@/utils/game-number";
import { formatNumber } from "@/utils/number-format";

const BOX_CLASS = "optizzz-probes";

export const PROBES_STYLE = `
.${BOX_CLASS} { width: fit-content; max-width: 100%; margin: var(--optizzz-space-4) auto; }
.${BOX_CLASS} p { margin: var(--optizzz-space-2) 0; }
.${BOX_CLASS} summary { cursor: pointer; }
.${BOX_CLASS} input { width: 7em; text-align: right; }`;

/** « le Dôme et la Loge », or with `names` = PLACE_FROM « du Dôme et de la Loge ». */
function placeList(places: readonly Place[], names: Record<Place, string> = PLACE_NAMES): string {
  const words = places.map((place) => names[place]);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} et ${words.at(-1) ?? ""}` : (words[0] ?? "");
}

/** « Dôme », « Loge ». */
const placeTitle = (place: Place) => PLACE_NAMES[place].replace(/^(le|la) /, "").replace(/^./, (c) => c.toUpperCase());

/** « 10 JSN, 2 SN », or « aucune ». */
const armyText = (army: Army) =>
  UNITS.flatMap((unit, i) => ((army[i] ?? 0) > 0 ? [`${formatNumber(army[i] ?? 0)} ${unitLabel(unit.key)}`] : [])).join(
    ", ",
  ) || "aucune";

/** « 10 JSN du Terrain de chasse vers la Loge ». */
const moveText = (move: ProbeMove) =>
  `${formatNumber(move.count)} ${unitLabel(UNITS[move.unit]?.key ?? "")} ${PLACE_FROM[move.from]} vers ${PLACE_NAMES[move.to]}`;

export interface ProbesPanel {
  armies: Record<Place, Army>;
  watched: readonly Place[];
  targets: ProbeTargets;
  place: () => Promise<ProbesResult>;
  /** « Replacer l'armée »: everything in the Loge but the probes of the other places. */
  store: () => Promise<ProbesResult>;
  save: (targets: ProbeTargets) => Promise<void>;
  reload: () => void;
}

/**
 * Above the garrison on Armee.php: the probes of each watched place, a button that moves the missing ones there, and
 * a form to choose how many of each unit each place keeps.
 */
export function renderProbes(doc: Document, panel: ProbesPanel): void {
  const { armies, watched, targets } = panel;
  const table = [...doc.querySelectorAll("table.simulateur")].find((candidate) =>
    candidate.textContent.includes("Troupes en Garnison"),
  );
  if (watched.length === 0 || !table || doc.querySelector(`.${BOX_CLASS}`)) return;

  const plan = probePlan(targets, watched);
  const short = placesWithoutProbe(armies, plan);
  const box = doc.createElement("div");
  box.className = `${BOX_CLASS} ${short.length > 0 ? "optizzz-callout optizzz-callout--warning" : "optizzz-panel"}`;
  const status = doc.createElement("p");
  status.textContent =
    short.length > 0
      ? `⚠ Il manque des sondes sur ${placeList(short)}.`
      : `✓ Sondes en place : ${watched.map((place) => `${placeTitle(place)} ${armyText(plan[place] ?? [])}`).join(" · ")}.`;
  box.append(status);

  const { moves, missing } = probeMoves(armies, plan);
  if (moves.length > 0) box.append(actionLine(doc, "Placer les sondes", moves, short, panel.place, panel.reload));
  // After an army comes back: its ants are wherever it left from, the probes may be gone.
  const stored = storeMoves(armies, plan);
  if (stored.moves.length > 0) {
    box.append(actionLine(doc, "Replacer l'armée", stored.moves, short, panel.store, panel.reload));
  }
  if (missing.length > 0) {
    const line = doc.createElement("p");
    line.textContent = `Pas assez de fourmis à la maison pour les sondes ${placeList(missing, PLACE_FROM)}, sans prendre celles d'un autre lieu.`;
    box.append(line);
  }
  box.append(settingsForm(doc, panel));
  table.before(box);
}

function actionLine(
  doc: Document,
  label: string,
  moves: ProbeMove[],
  short: Place[],
  run: () => Promise<ProbesResult>,
  reload: () => void,
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const line = doc.createElement("p");
  const button = doc.createElement("button");
  button.type = "button";
  button.textContent = label;
  const detail = doc.createElement("span");
  detail.className = `${BOX_CLASS}-moves optizzz-muted`;
  detail.textContent = ` ${moves.map(moveText).join(", ")}`;
  line.append(button, detail);

  const outcome = doc.createElement("p");
  outcome.hidden = true;
  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Déplacement…";
    void run()
      .catch((): ProbesResult => ({ placed: [], missing: short, failed: true }))
      .then((result) => {
        if (!result.failed) {
          reload();
          return;
        }
        outcome.hidden = false;
        outcome.textContent = `Le jeu n'a pas pris le déplacement${result.placed.length > 0 ? ` (sondes placées sur ${placeList(result.placed)})` : ""}. Rechargez la page pour réessayer.`;
        button.textContent = "Échec";
      });
  });
  fragment.append(line, outcome);
  return fragment;
}

/** How many of each unit each watched place keeps: the units the player has, and those already asked for. */
function settingsForm(doc: Document, panel: ProbesPanel): HTMLDetailsElement {
  const { armies, watched, targets } = panel;
  const details = doc.createElement("details");
  const summary = doc.createElement("summary");
  summary.textContent = "Régler les sondes";
  details.append(summary);

  const form = doc.createElement("form");
  const grid = doc.createElement("table");
  grid.className = "optizzz-table optizzz-table--dense";
  const head = grid.createTHead().insertRow();
  for (const title of ["Unité", ...watched.map(placeTitle)]) {
    const th = doc.createElement("th");
    th.scope = "col";
    th.textContent = title;
    head.append(th);
  }
  const body = grid.createTBody();
  const inputs: { place: Place; key: string; input: HTMLInputElement }[] = [];
  const shown = UNITS.filter(
    (unit, i) =>
      PLACES.some((place) => (armies[place][i] ?? 0) > 0) ||
      watched.some((place) => (targets[place][unit.key] ?? 0) > 0),
  );
  for (const unit of shown) {
    const row = body.insertRow();
    const name = doc.createElement("th");
    name.scope = "row";
    name.className = "optizzz-name";
    name.textContent = unit.name;
    row.append(name);
    for (const place of watched) {
      const input = doc.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.value = String(targets[place][unit.key] ?? 0);
      input.setAttribute("aria-label", `${unit.name}, ${placeTitle(place)}`);
      row.insertCell().append(input);
      inputs.push({ place, key: unit.key, input });
    }
  }

  const note = doc.createElement("p");
  note.className = "optizzz-note";
  note.textContent =
    "Fourmis gardées sur chaque lieu ; 0 pour aucune. Le Lanceur de chasse et le Plan de flood les laissent à la maison, et elles sont remises en place après l'envoi.";
  const save = doc.createElement("button");
  save.type = "submit";
  save.className = "optizzz-button-primary";
  save.textContent = "Enregistrer";
  form.append(grid, note, save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next: ProbeTargets = { field: { ...targets.field }, nest: { ...targets.nest }, lodge: { ...targets.lodge } };
    for (const { place, key, input } of inputs) next[place][key] = parseGameInteger(input.value);
    for (const place of PLACES) next[place] = Object.fromEntries(Object.entries(next[place]).filter(([, n]) => n > 0));
    save.disabled = true;
    void panel.save(next).then(panel.reload);
  });
  details.append(form);
  return details;
}
