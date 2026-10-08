import type { NotificationKind, NotificationSettings } from "../alerts/notifications";
import { isEnabled, type Toggles } from "../toggles";

/** Styles of « Notifications », shared by the in-game dialog and the toolbar popup. */
export const NOTIFICATIONS_STYLE = `
.notifications-intro { margin: 0 0 10px; color: var(--optizzz-text-muted); font-size: var(--optizzz-font-size-small); }
.notifications { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.notifications label { display: flex; gap: 6px; align-items: baseline; cursor: pointer; }
.notifications input { margin: 0; }
.notifications-blocked { margin: 12px 0 0; color: var(--optizzz-danger); }
.notifications-off, .notifications-needs { margin: 0 0 10px; color: var(--optizzz-warning); font-size: var(--optizzz-font-size-small); }
.notifications input:disabled + span { opacity: 0.6; }
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
  /** The switches of « Fonctionnalités »: the notifications depend on some of them. */
  toggles?: Toggles;
}

/** « Notifications » : one checkbox per kind, all off by default; switching one on asks for the permission. */
export function buildNotificationsSection(doc: Document, input: NotificationsTabInput): HTMLElement {
  const section = doc.createElement("div");
  const settings = { ...input.settings };
  const toggles = input.toggles ?? {};
  const switchedOn = isEnabled(toggles, "alerts", "notifications");
  /** Unknown until the background answers. */
  let permitted: boolean | null = null;
  let permission = input.permitted();

  const intro = doc.createElement("p");
  intro.className = "notifications-intro";
  intro.textContent =
    "Pour tous vos serveurs, même quand le jeu est fermé, tant que le navigateur est ouvert. Calculées depuis les pages lues, sans interroger le jeu.";

  const off = doc.createElement("p");
  off.className = "notifications-off";
  off.textContent =
    "Notifications coupées dans « Fonctionnalités » (Alertes › Notifications) : rien ne part, quelles que soient ces cases.";

  // « Chantier terminé » and « Chasse rentrée » come from the end times « Heures de fin » keeps.
  const needs = doc.createElement("p");
  needs.className = "notifications-needs";
  needs.textContent =
    "« Chantier terminé » et « Chasse rentrée » ont besoin de « Heures de fin », coupée dans « Fonctionnalités ».";

  // Never asked yet, or refused: the browser has not allowed them so far.
  const blocked = doc.createElement("p");
  blocked.className = "notifications-blocked";
  blocked.textContent = "Notifications pas encore autorisées par le navigateur.";
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
    box.disabled = !switchedOn;
    box.addEventListener("change", () => {
      settings[kind] = box.checked;
      input.onChange(kind, box.checked);
      // The answer may not be in yet: wait for it before asking.
      const checked = box.checked;
      void permission.then((answer) => {
        if (checked && !answer) input.grant();
      });
      showBlocked();
    });
    const text = doc.createElement("span");
    text.textContent = label;
    row.append(box, text);
    item.append(row);
    list.append(item);
  }
  section.append(intro);
  if (!switchedOn) section.append(off);
  else if (!isEnabled(toggles, "end-times")) section.append(needs);
  section.append(list);

  const check = () => {
    permission
      .then((answer) => {
        permitted = answer;
        section.dataset.permitted = String(answer);
        showBlocked();
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] could not check the notifications permission", error);
      });
  };
  check();
  // Allowed in another tab (the permission page): checked again when the player comes back.
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState !== "visible" || !section.isConnected) return;
    permission = input.permitted();
    check();
  });
  return section;
}
