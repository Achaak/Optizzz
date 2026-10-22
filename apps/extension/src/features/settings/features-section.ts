import { featureCatalog, type FeatureId } from "../catalog";
import { isEnabled, type Toggles } from "../toggles";

export type ToggleChange = (feature: FeatureId, option: string | undefined, enabled: boolean) => void;

/** Styles of « Fonctionnalités », shared by the in-game dialog and the toolbar popup. */
export const FEATURES_STYLE = `
.features-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-3) var(--optizzz-space-5); margin: 0 0 var(--optizzz-space-3); }
.features-toolbar input { flex: 1 1 180px; min-width: 0; }
.features-count { margin: 0; white-space: nowrap; }
.features { list-style: none; padding: 0; margin: 0; }
.features > li { padding: var(--optizzz-space-4) 0; border-bottom: 1px solid var(--optizzz-border-soft); }
.features > li:last-child { border-bottom: none; }
.features > li[hidden] { display: none; }
.features label { display: flex; gap: var(--optizzz-space-3); align-items: baseline; cursor: pointer; }
.features input { margin: 0; }
.feature-name { font-weight: bold; }
.feature-off .feature-name { color: var(--optizzz-text-muted); }
.feature-description { margin: var(--optizzz-space-1) 0 0 19px; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }
.feature-options {
  list-style: none; margin: var(--optizzz-space-3) 0 0 19px; padding: 0 0 0 var(--optizzz-space-4);
  display: grid; gap: var(--optizzz-space-2); border-left: 1px solid var(--optizzz-border-soft);
}
.feature-options input:disabled + span { color: var(--optizzz-text-muted); opacity: 0.7; }
.features-empty { margin: var(--optizzz-space-5) 0; }
/* Stays in view at the bottom of the tab, however far down the change was made: opaque over the list. */
.features-reload {
  position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-3) var(--optizzz-space-5);
  margin-bottom: 0;
  background: linear-gradient(var(--optizzz-warning-bg), var(--optizzz-warning-bg)), var(--optizzz-surface-raised);
  box-shadow: 0 -4px 8px var(--optizzz-surface-raised);
}`;

/** Lower case, without accents: « prevision » finds « Prévisions ». */
const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * « Fonctionnalités » : one checkbox per feature and option, with a filter. Changes apply on the next page load, so
 * the section then shows a reload button (`reload`) or, without one, asks to reload the game pages.
 */
export function buildFeaturesSection(
  doc: Document,
  toggles: Toggles,
  onChange: ToggleChange,
  reload?: () => void,
): HTMLElement {
  const section = doc.createElement("div");
  section.className = "features-section";
  const list = doc.createElement("ul");
  list.className = "features";

  const checkboxRow = (key: string, checked: boolean, text: string, textClass?: string) => {
    const label = doc.createElement("label");
    const input = doc.createElement("input");
    input.type = "checkbox";
    input.dataset.toggle = key;
    input.checked = checked;
    const span = doc.createElement("span");
    if (textClass) span.className = textClass;
    span.textContent = text;
    label.append(input, span);
    return { label, input };
  };

  let notice: HTMLElement | undefined;
  const showReloadNotice = () => {
    if (notice) return;
    notice = doc.createElement("p");
    notice.className = "features-reload optizzz-callout optizzz-callout--warning";
    notice.setAttribute("role", "status");
    if (reload) {
      notice.textContent = "Les changements s'appliquent au prochain chargement de la page.";
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "optizzz-button-primary";
      button.textContent = "Recharger la page";
      button.addEventListener("click", reload);
      notice.append(button);
    } else {
      notice.textContent = "Rechargez les pages du jeu pour appliquer les changements.";
    }
    section.append(notice);
  };

  const count = doc.createElement("p");
  count.className = "features-count optizzz-note";
  const featureInputs: HTMLInputElement[] = [];
  const updateCount = () => {
    const on = featureInputs.filter((input) => input.checked).length;
    count.textContent = `${String(on)} sur ${String(featureInputs.length)} activées`;
  };

  /** Each feature's row and the text the filter looks into. */
  const rows: { item: HTMLLIElement; text: string }[] = [];
  for (const entry of featureCatalog) {
    const item = doc.createElement("li");
    const feature = checkboxRow(entry.id, isEnabled(toggles, entry.id), entry.label, "feature-name");
    featureInputs.push(feature.input);
    const description = doc.createElement("p");
    description.className = "feature-description";
    description.textContent = entry.description;
    item.append(feature.label, description);

    const optionInputs: HTMLInputElement[] = [];
    if (entry.options.length > 0) {
      const options = doc.createElement("ul");
      options.className = "feature-options";
      for (const option of entry.options) {
        // An option shows its own state, greyed out while its feature is off.
        const ownState = isEnabled({ ...toggles, [entry.id]: true }, entry.id, option.id);
        const row = checkboxRow(`${entry.id}.${option.id}`, ownState, option.label);
        row.input.disabled = !feature.input.checked;
        row.input.addEventListener("change", () => {
          onChange(entry.id, option.id, row.input.checked);
          showReloadNotice();
        });
        optionInputs.push(row.input);
        const optionItem = doc.createElement("li");
        optionItem.append(row.label);
        options.append(optionItem);
      }
      item.append(options);
    }

    const showState = () => item.classList.toggle("feature-off", !feature.input.checked);
    showState();
    feature.input.addEventListener("change", () => {
      onChange(entry.id, undefined, feature.input.checked);
      for (const input of optionInputs) input.disabled = !feature.input.checked;
      showState();
      updateCount();
      showReloadNotice();
    });
    list.append(item);
    rows.push({
      item,
      text: searchable([entry.label, entry.description, ...entry.options.map((option) => option.label)].join(" ")),
    });
  }
  updateCount();

  const filter = doc.createElement("input");
  filter.type = "search";
  filter.placeholder = "Filtrer les fonctionnalités";
  filter.setAttribute("aria-label", "Filtrer les fonctionnalités");
  const empty = doc.createElement("p");
  empty.className = "features-empty optizzz-note";
  empty.hidden = true;
  filter.addEventListener("input", () => {
    const words = searchable(filter.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const { item, text } of rows) {
      item.hidden = !words.every((word) => text.includes(word));
      if (!item.hidden) shown++;
    }
    empty.hidden = shown > 0;
    empty.textContent = `Aucune fonctionnalité ne correspond à « ${filter.value.trim()} ».`;
  });

  const toolbar = doc.createElement("div");
  toolbar.className = "features-toolbar";
  toolbar.append(filter, count);
  section.append(toolbar, list, empty);
  return section;
}
