import { formatAmount, formatNumber } from "@optizzz/game/format/number-format";
import { formatDuration, formatEndTime, formatEndTimeShort } from "@optizzz/game/format/time-format";
import type { Affordability, ColonyState } from "@optizzz/game/forecast";
import {
  layingShortcuts,
  planLaying,
  readOrder,
  readUnitCost,
  type LayingContext,
  type LayingRow,
  type Order,
} from "./laying";
import { clockValue, parseClock, parseHours, type LayingSettings } from "./settings";

export const LAYING_STYLE = `
.optizzz-laying { margin-top: var(--optizzz-space-4); }
.optizzz-laying-group { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-2); margin: var(--optizzz-space-1) 0; }
.optizzz-laying-group-label { width: 100px; flex: none; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }
.optizzz-laying-count { font-weight: bold; }
.optizzz-laying-limit { color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); font-weight: normal; }
.optizzz-laying-chip[aria-pressed="true"] .optizzz-laying-limit { color: inherit; }
.optizzz-laying-empty { padding: 1px 0; color: var(--optizzz-text-muted); }
.optizzz-laying-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: var(--optizzz-space-3); min-height: 54px; }
.optizzz-laying-summary-empty { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; padding: 0 var(--optizzz-space-4); border: 1px dashed var(--optizzz-border-soft); border-radius: var(--optizzz-radius); color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); text-align: center; }
.optizzz-laying-tile-value { font-size: var(--optizzz-font-size); }
.optizzz-laying-preview .optizzz-laying-tile { border-style: dashed; }
.optizzz-laying-link { margin-left: auto; align-self: flex-start; font-size: var(--optizzz-font-size-small); }
.optizzz-laying-settings { display: grid; grid-template-columns: auto 1fr; gap: var(--optizzz-space-2) var(--optizzz-space-4); align-items: center; margin-top: var(--optizzz-space-2); padding-top: var(--optizzz-space-3); border-top: 1px solid var(--optizzz-border-soft); font-size: var(--optizzz-font-size-small); }
.optizzz-laying-settings[hidden] { display: none; }
.optizzz-laying-settings input { width: 90px; }
.optizzz-laying-settings p { grid-column: 1 / -1; margin: 0; color: var(--optizzz-text-muted); }`;

/** The player's shortcut settings, shared by every row: a change redraws them all. */
export interface SettingsStore {
  get: () => LayingSettings;
  set: (settings: LayingSettings) => void;
  subscribe: (listener: () => void) => void;
}

export function settingsStore(initial: LayingSettings, save: (settings: LayingSettings) => void): SettingsStore {
  let current = initial;
  const listeners: (() => void)[] = [];
  return {
    get: () => current,
    set: (settings) => {
      current = settings;
      save(settings);
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => listeners.push(listener),
  };
}

const signed = (value: number) => (value < 0 ? `−${formatAmount(-value)}` : `+${formatAmount(value)}`);

/** A tone said in bold as well as in colour (docs/design-system.md). */
type Tone = "positive" | "waiting" | "negative";
const TONE_CLASS: Record<Tone, string> = {
  positive: "optizzz-text-success",
  waiting: "optizzz-text-warning",
  negative: "optizzz-text-danger",
};

function payable(affordability: Affordability, now: Date): { text: string; note?: string; tone?: Tone } {
  switch (affordability.kind) {
    case "now":
      return { text: "maintenant", tone: "positive" };
    case "at":
      return {
        text: `dans ${formatDuration(affordability.at.getTime() - now.getTime())}`,
        note: formatEndTime(affordability.at, now),
        tone: "waiting",
      };
    case "warehouse":
      return { text: "jamais", note: `entrepôt de ${formatAmount(affordability.capacity)}`, tone: "negative" };
    case "never":
    case "workers":
      return { text: "jamais", note: "au rythme actuel", tone: "negative" };
  }
}

/** Under the first unit's description, when no plan can be made: says why. */
export function mountLayingNotice(row: LayingRow | undefined, text: string) {
  if (!row) return;
  const note = row.input.ownerDocument.createElement("div");
  note.className = "optizzz-laying optizzz-laying-notice optizzz-panel optizzz-panel--inset";
  note.textContent = text;
  row.panel.append(note);
}

export interface LayingOptions {
  /** The player's laying speed read in the page's script; null to divide the shown time. */
  speed: number | null;
  settings: SettingsStore;
}

/**
 * Next to a unit's laying form, in its description cell: shortcuts that fill the game's form (hovering one previews
 * it), and what the chosen order costs, when it can be paid and ends, and what it changes. Follows the game's slider
 * and fields. Never sends the form.
 */
export function mountLayingPlan(
  row: LayingRow,
  state: ColonyState,
  context: LayingContext,
  /** When `state` was read: plans are computed at this time. */
  readAt: Date,
  clock: () => Date,
  options: LayingOptions,
) {
  const doc = row.input.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const block = el("div", "optizzz-laying optizzz-panel optizzz-panel--inset");
  const shortcuts = el("div", "optizzz-laying-shortcuts");
  const summary = el("div", "optizzz-laying-summary optizzz-stats");
  const toggle = el("button", "optizzz-laying-link optizzz-button-link", "Régler");
  toggle.type = "button";
  const form = buildSettingsForm(doc, options.settings);
  form.hidden = true;
  toggle.title = "Régler les raccourcis : délais, durées, heure de fin";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden;
    toggle.setAttribute("aria-expanded", String(!form.hidden));
  });
  block.append(shortcuts, summary, form);
  row.panel.append(block);

  /** The count hovered or focused, shown instead of the game's order until the pointer leaves. */
  let preview: number | null = null;

  const fill = (count: number) => {
    row.input.value = String(count);
    // The game recomputes its cost and moves its slider on keyup.
    row.input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    row.input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const tile = (label: string, value: string | Node, note?: string, tone?: Tone) => {
    const box = el("div", "optizzz-laying-tile optizzz-stat");
    const valueBox = el(
      "div",
      `optizzz-laying-tile-value optizzz-stat-value${tone ? ` optizzz-laying-${tone} ${TONE_CLASS[tone]}` : ""}`,
    );
    valueBox.append(value);
    box.append(el("div", "optizzz-laying-tile-label optizzz-stat-label", label), valueBox);
    if (note) box.append(el("div", "optizzz-laying-tile-note optizzz-stat-note", note));
    return box;
  };

  const renderSummary = (order: Order, isPreview: boolean, now: Date) => {
    summary.classList.toggle("optizzz-laying-preview", isPreview);
    if (order.count <= 0) {
      // Keeps the room the tiles will take, so that hovering a shortcut does not move the page.
      summary.replaceChildren(
        el(
          "div",
          "optizzz-laying-summary-empty",
          "Survolez un raccourci pour voir le résultat ; un clic remplit le formulaire du jeu, sans lancer la ponte.",
        ),
      );
      return;
    }
    const plan = planLaying(order, state, context, readAt);
    const pay = payable(plan.affordability, now);
    summary.replaceChildren(
      tile(isPreview ? "Aperçu" : "Quantité", formatNumber(order.count)),
      tile("Coût", formatAmount(order.food), "nourriture"),
      tile("Payable", pay.text, pay.note, pay.tone),
      tile("Fin de ponte", plan.endsAt ? formatEndTimeShort(plan.endsAt, now) : "—"),
      plan.idleWorkers === null
        ? tile(
            "Bilan après",
            `${signed(plan.balanceAfter)} / j`,
            `entretien ${formatAmount(plan.upkeepPerDay)} / j`,
            plan.balanceAfter < 0 ? "negative" : undefined,
          )
        : tile("Sans travail", formatAmount(plan.idleWorkers), `TDC ${formatAmount(context.huntingField)}`),
    );
  };

  const render = () => {
    const now = clock();
    const order = readOrder(row);
    const unit = readUnitCost(row, options.speed);
    const groups = layingShortcuts({
      destination: order.destination,
      unit,
      state,
      context,
      settings: options.settings.get(),
      readAt,
      now,
    });
    shortcuts.replaceChildren(
      ...groups.map((group) => {
        const line = el("div", "optizzz-laying-group");
        line.append(el("span", "optizzz-laying-group-label", group.label));
        for (const shortcut of group.shortcuts) {
          if (shortcut.count <= 0 && shortcut.empty) {
            const empty = el("span", "optizzz-laying-empty", `${shortcut.label} : ${shortcut.empty}`);
            empty.title = shortcut.title;
            line.append(empty);
            continue;
          }
          const chip = el("button", "optizzz-laying-chip optizzz-chip", shortcut.label);
          chip.type = "button";
          chip.title = `${shortcut.title} Un clic remplit le formulaire du jeu.`;
          chip.setAttribute("aria-pressed", String(order.count > 0 && shortcut.count === order.count));
          chip.append(el("span", "optizzz-laying-count", formatNumber(shortcut.count)));
          if (shortcut.limit) chip.append(el("span", "optizzz-laying-limit", shortcut.limit));
          const show = () => {
            preview = shortcut.count;
            renderPreview();
          };
          const hide = () => {
            preview = null;
            renderPreview();
          };
          chip.addEventListener("mouseenter", show);
          chip.addEventListener("focus", show);
          chip.addEventListener("mouseleave", hide);
          chip.addEventListener("blur", hide);
          chip.addEventListener("click", () => {
            preview = null;
            fill(shortcut.count);
          });
          line.append(chip);
        }
        return line;
      }),
    );
    shortcuts.firstElementChild?.append(toggle);
    renderPreview();
  };

  /** Only the summary: redrawing the shortcuts under the pointer would lose the hover. */
  const renderPreview = () => {
    const now = clock();
    const order = readOrder(row);
    // Hovering the shortcut just clicked: nothing more to preview.
    if (preview === null || preview === order.count) {
      renderSummary(order, false, now);
      return;
    }
    const unit = readUnitCost(row, options.speed);
    renderSummary(
      { count: preview, food: preview * unit.food, duration: preview * unit.duration, destination: order.destination },
      true,
      now,
    );
  };

  // After the game's own handler has updated the cost.
  const later = () => setTimeout(render, 0);
  for (const event of ["keyup", "input", "change"]) row.input.addEventListener(event, later);
  doc.getElementById(`texte_destination${row.suffix}`)?.addEventListener("click", later);
  // The slider and the time and food fields only change the game's cost: follow what it writes.
  const observer = new MutationObserver(render);
  for (const id of ["cout_nombre", "cout_nourriture", "cout_temps"]) {
    const span = doc.getElementById(`${id}${row.suffix}`);
    if (span) observer.observe(span, { childList: true, characterData: true, subtree: true });
  }
  options.settings.subscribe(render);
  render();
  return { render };
}

/** « Régler les raccourcis »: the hours of « Durée de ponte » and the time of « jusqu'à ». */
function buildSettingsForm(doc: Document, store: SettingsStore): HTMLFormElement {
  const form = doc.createElement("form");
  form.className = "optizzz-laying-settings";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  const field = (label: string, input: HTMLInputElement) => {
    const id = `optizzz-laying-${Math.random().toString(36).slice(2)}`;
    input.id = id;
    const caption = doc.createElement("label");
    caption.htmlFor = id;
    caption.textContent = label;
    form.append(caption, input);
  };
  const hours = (values: number[]) => values.join(" ");

  const settings = store.get();
  const durations = doc.createElement("input");
  durations.type = "text";
  durations.value = hours(settings.durations);
  durations.placeholder = "1 8";
  const returnAt = doc.createElement("input");
  returnAt.type = "time";
  returnAt.value = clockValue(settings.returnAt);
  field("Durées de ponte (h)", durations);
  field("Ponte jusqu'à", returnAt);
  const note = doc.createElement("p");
  note.textContent = "Heures séparées par des espaces, 4 au plus. Réglages communs à toutes les unités de ce serveur.";
  form.append(note);

  // Another row's form may change them.
  store.subscribe(() => {
    const current = store.get();
    durations.value = hours(current.durations);
    returnAt.value = clockValue(current.returnAt);
  });
  form.addEventListener("change", () => {
    const current = store.get();
    const next: LayingSettings = {
      durations: parseHours(durations.value),
      returnAt: parseClock(returnAt.value) ?? current.returnAt,
    };
    store.set(next);
  });
  return form;
}
