import type { NotificationKind, NotificationSettings } from "../alerts/notifications";
import { isEnabled, type Toggles } from "../toggles";
import { DEFAULT_LOSS_PERCENT, type WatchNotificationKind } from "../watchlist/describe";
import { loadLossPercent, setLossPercent } from "../watchlist/settings";

/** Styles of « Notifications », shared by the in-game dialog and the toolbar popup. */
export const NOTIFICATIONS_STYLE = `
.notifications-intro { margin: 0 0 var(--optizzz-space-4); }
.notifications { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--optizzz-space-3); }
.notifications label { display: flex; gap: var(--optizzz-space-3); align-items: center; cursor: pointer; }
.notifications input { margin: 0; }
.notifications input:disabled + span { opacity: 0.6; }
.notifications-blocked { display: flex; flex-wrap: wrap; align-items: center; gap: var(--optizzz-space-3) var(--optizzz-space-5); }
.notifications-section .optizzz-subtitle:first-of-type { margin-top: var(--optizzz-space-4); }
.notifications-percent { display: inline-flex; gap: var(--optizzz-space-2); align-items: center; }
.notifications-percent input { width: 4.5em; margin: 0; }`;

const KINDS: { kind: NotificationKind; label: string }[] = [
  { kind: "famine", label: "Famine dans moins d'1 h" },
  { kind: "full", label: "Entrepôt plein dans moins d'1 h" },
  { kind: "construction", label: "Chantier terminé (construction ou recherche)" },
  { kind: "hunt", label: "Chasse rentrée" },
  { kind: "attack", label: "Attaque arrivée sur sa cible" },
];

/** The watch list's, summed up in one notification per hourly reading. */
const WATCH_KINDS: { kind: WatchNotificationKind; label: string }[] = [
  { kind: "watch-field", label: "TDC perdu d'au moins" },
  { kind: "watch-alliance", label: "Changement d'alliance d'un joueur" },
  { kind: "watch-holiday", label: "Départ ou retour de vacances" },
  { kind: "watch-war", label: "Nouvelle guerre d'une alliance" },
  { kind: "watch-pact", label: "Pacte rompu par une alliance" },
  { kind: "watch-members", label: "Membre arrivé ou parti d'une alliance" },
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
  section.className = "notifications-section";
  const settings = { ...input.settings };
  const toggles = input.toggles ?? {};
  const switchedOn = isEnabled(toggles, "alerts", "notifications");
  /** Unknown until the background answers. */
  let permitted: boolean | null = null;
  let permission = input.permitted();

  const intro = doc.createElement("p");
  intro.className = "notifications-intro optizzz-note";
  intro.textContent =
    "Pour tous vos serveurs, même quand le jeu est fermé, tant que le navigateur est ouvert. Calculées depuis les pages lues ; celles des Suivis, depuis l'export public relevé chaque heure.";

  const off = doc.createElement("p");
  off.className = "notifications-off optizzz-callout optizzz-callout--warning";
  off.textContent =
    "Notifications coupées dans « Fonctionnalités » (Alertes › Notifications) : rien ne part, quelles que soient ces cases.";

  // « Chantier terminé », « Chasse rentrée » and « Attaque arrivée » come from the end times « Heures de fin » keeps.
  const needs = doc.createElement("p");
  needs.className = "notifications-needs optizzz-callout optizzz-callout--warning";
  needs.textContent =
    "« Chantier terminé », « Chasse rentrée » et « Attaque arrivée » ont besoin de « Heures de fin », coupée dans « Fonctionnalités ».";

  // Never asked yet, or refused: the browser has not allowed them so far.
  const blocked = doc.createElement("p");
  blocked.className = "notifications-blocked optizzz-callout optizzz-callout--warning";
  blocked.setAttribute("role", "status");
  blocked.textContent = "Notifications pas encore autorisées par le navigateur.";
  const allow = doc.createElement("button");
  allow.type = "button";
  allow.className = "optizzz-button-primary";
  allow.textContent = "Autoriser";
  allow.addEventListener("click", input.grant);
  blocked.append(allow);

  const watchOff = doc.createElement("p");
  watchOff.className = "notifications-needs optizzz-callout optizzz-callout--warning";
  watchOff.textContent = "Suivis coupés dans « Fonctionnalités » : aucun relevé, donc rien à notifier.";

  /** The percent of lost field from which « Perte de TDC » notifies. */
  const lossField = () => {
    const wrap = doc.createElement("span");
    wrap.className = "notifications-percent";
    const field = doc.createElement("input");
    field.type = "number";
    field.min = "1";
    field.max = "100";
    field.value = String(DEFAULT_LOSS_PERCENT);
    field.disabled = !switchedOn;
    field.setAttribute("aria-label", "Perte de TDC notifiée, en pourcentage");
    void loadLossPercent().then((percent) => {
      field.value = String(percent);
    });
    field.addEventListener("change", () => {
      const percent = Math.round(Number(field.value));
      if (percent >= 1 && percent <= 100) void setLossPercent(percent);
    });
    wrap.title = "Perte entre deux relevés horaires.";
    wrap.append(field, "%");
    return wrap;
  };

  const showBlocked = () => {
    const wanted = Object.values(settings).some(Boolean);
    // Right under the intro: the first thing to fix, whatever the length of the lists.
    if (permitted === false && wanted) intro.after(blocked);
    else blocked.remove();
  };

  const checkboxRow = (kind: NotificationKind, label: string) => {
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
    return item;
  };

  const gameTitle = doc.createElement("h3");
  gameTitle.className = "optizzz-subtitle";
  gameTitle.textContent = "Vos fourmilières";
  const list = doc.createElement("ul");
  list.className = "notifications";
  for (const { kind, label } of KINDS) list.append(checkboxRow(kind, label));

  const watchTitle = doc.createElement("h3");
  watchTitle.className = "optizzz-subtitle";
  watchTitle.textContent = "Suivis";
  const watchList = doc.createElement("ul");
  watchList.className = "notifications";
  for (const { kind, label } of WATCH_KINDS) {
    const item = checkboxRow(kind, label);
    // In the same line as its box: « TDC perdu d'au moins [20] % ».
    if (kind === "watch-field") item.querySelector("span")?.append(" ", lossField());
    watchList.append(item);
  }

  section.append(intro);
  if (!switchedOn) section.append(off);
  else if (!isEnabled(toggles, "end-times")) section.append(needs);
  section.append(gameTitle, list, watchTitle);
  if (!isEnabled(toggles, "watchlist")) section.append(watchOff);
  section.append(watchList);

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
