import type { NotificationKind, NotificationSettings } from "../alerts/notifications";

/** Styles of « Notifications », shared by the in-game dialog and the toolbar popup. */
export const NOTIFICATIONS_STYLE = `
.notifications-intro { margin: 0 0 10px; color: #6b5d3a; font-size: 11px; }
.notifications { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.notifications label { display: flex; gap: 6px; align-items: baseline; cursor: pointer; }
.notifications input { margin: 0; }
.notifications-blocked { margin: 12px 0 0; color: #c00; }
.notifications-blocked button { margin-left: 6px; font: inherit; cursor: pointer; }`;

const KINDS: { kind: NotificationKind; label: string }[] = [
  { kind: "famine", label: "Famine dans moins d'1 h" },
  { kind: "full", label: "Entrepôt plein dans moins d'1 h" },
  { kind: "construction", label: "Chantier terminé (construction ou recherche)" },
  { kind: "hunt", label: "Chasse rentrée" },
];

export interface NotificationsTabInput {
  settings: NotificationSettings;
  /** Whether the browser lets the extension show notifications (an optional permission). */
  permitted: () => Promise<boolean>;
  onChange: (kind: NotificationKind, enabled: boolean) => void;
  /** Opens the extension's page asking for the permission: only an extension page may ask. */
  grant: () => void;
}

/** « Notifications » : one checkbox per kind, all off by default; switching one on asks for the permission. */
export function buildNotificationsSection(doc: Document, input: NotificationsTabInput): HTMLElement {
  const section = doc.createElement("div");
  const settings = { ...input.settings };
  /** Unknown until the background answers. */
  let permitted: boolean | null = null;

  const intro = doc.createElement("p");
  intro.className = "notifications-intro";
  intro.textContent =
    "Pour tous vos serveurs, même quand le jeu est fermé, tant que le navigateur est ouvert. Calculées depuis les pages lues, sans interroger le jeu.";

  const blocked = doc.createElement("p");
  blocked.className = "notifications-blocked";
  blocked.textContent = "Notifications bloquées par le navigateur.";
  const allow = doc.createElement("button");
  allow.type = "button";
  allow.textContent = "Autoriser";
  allow.addEventListener("click", input.grant);
  blocked.append(allow);

  const showBlocked = () => {
    const wanted = Object.values(settings).some(Boolean);
    if (permitted === false && wanted) section.append(blocked);
    else blocked.remove();
  };

  const list = doc.createElement("ul");
  list.className = "notifications";
  for (const { kind, label } of KINDS) {
    const item = doc.createElement("li");
    const row = doc.createElement("label");
    const box = doc.createElement("input");
    box.type = "checkbox";
    box.dataset.notification = kind;
    box.checked = settings[kind] === true;
    box.addEventListener("change", () => {
      settings[kind] = box.checked;
      input.onChange(kind, box.checked);
      if (box.checked && permitted === false) input.grant();
      showBlocked();
    });
    const text = doc.createElement("span");
    text.textContent = label;
    row.append(box, text);
    item.append(row);
    list.append(item);
  }
  section.append(intro, list);

  input
    .permitted()
    .then((answer) => {
      permitted = answer;
      section.dataset.permitted = String(answer);
      showBlocked();
    })
    .catch((error: unknown) => {
      console.error("[Optizzz] could not check the notifications permission", error);
    });
  return section;
}
