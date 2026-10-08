import { featureCatalog, type FeatureId } from "../catalog";
import { isEnabled, type Toggles } from "../toggles";

export type ToggleChange = (feature: FeatureId, option: string | undefined, enabled: boolean) => void;

/** Styles of « Fonctionnalités », shared by the in-game dialog and the toolbar popup. */
export const FEATURES_STYLE = `
.features { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.features label { display: flex; gap: 6px; align-items: baseline; cursor: pointer; }
.features input { margin: 0; }
.feature-name { font-weight: bold; }
.feature-description { margin: 2px 0 0 19px; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }
.feature-options { list-style: none; padding: 0; margin: 4px 0 0 19px; display: grid; gap: 3px; }
.feature-options input:disabled + span { color: var(--optizzz-text-muted); opacity: 0.7; }
.features-reload { margin: 12px 0 0; font-style: italic; }
.features-reload button { margin-left: 6px; font: inherit; font-style: normal; cursor: pointer; }`;

/**
 * « Fonctionnalités » : one checkbox per feature and option. Changes apply on the next page load, so the
 * section then shows a reload button (`reload`) or, without one, asks to reload the game pages.
 */
export function buildFeaturesSection(
  doc: Document,
  toggles: Toggles,
  onChange: ToggleChange,
  reload?: () => void,
): HTMLElement {
  const section = doc.createElement("div");
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
    notice.className = "features-reload";
    if (reload) {
      notice.textContent = "Les changements s'appliquent au prochain chargement de la page.";
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = "Recharger la page";
      button.addEventListener("click", reload);
      notice.append(button);
    } else {
      notice.textContent = "Rechargez les pages du jeu pour appliquer les changements.";
    }
    section.append(notice);
  };

  for (const entry of featureCatalog) {
    const item = doc.createElement("li");
    const feature = checkboxRow(entry.id, isEnabled(toggles, entry.id), entry.label, "feature-name");
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

    feature.input.addEventListener("change", () => {
      onChange(entry.id, undefined, feature.input.checked);
      for (const input of optionInputs) input.disabled = !feature.input.checked;
      showReloadNotice();
    });
    list.append(item);
  }

  section.append(list);
  return section;
}
