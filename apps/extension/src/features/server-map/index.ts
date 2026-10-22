import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { loadPlayersExport } from "@/data/exports";
import { readLoggedInPseudo } from "@optizzz/game/pages/alliance";
import { readAllianceRanking } from "@optizzz/game/pages/alliance-ranking";
import { findProfileStateRow, readProfile } from "@optizzz/game/pages/scores";
import { insertMenuBarButton } from "@/utils/menu-bar";
import { createPageDialog } from "@/utils/page-dialog";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import { decodeTarget, encodeTarget, requestServerMap, serverMapUrl } from "./open";
import type { ChipTarget } from "./selection";
import { rememberPlayer } from "./settings";

export const SERVER_MAP_BUTTON_CLASS = "optizzz-server-map-button";
export const MAP_LINK_ATTRIBUTE = "data-optizzz-map-link";

// A folded map, drawn in the menu's link colour like the gear.
const MAP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/>
  <line x1="16" y1="6" x2="16" y2="22"/></svg>`;

let shared: ReturnType<typeof createPageDialog> | undefined;

/** The page's one map dialog: the top bar button and the « Voir sur la carte » links open the same one. */
export function serverMapDialog(ctx: ContentScriptContext) {
  shared ??= createPageDialog(ctx, {
    name: "optizzz-server-map",
    title: "Carte du serveur",
    src: (target) => serverMapUrl(location.origin, decodeTarget(target), { embedded: true }),
    openInTab: (target) => requestServerMap(location.origin, decodeTarget(target)),
  });
  return shared;
}

function openMap(ctx: ContentScriptContext, target: ChipTarget | null) {
  serverMapDialog(ctx)
    .open(target ? encodeTarget(target) : undefined)
    .catch((error: unknown) => {
      console.error("[Optizzz] server map dialog failed", error);
    });
}

/** « Voir sur la carte », styled as the game's links. */
function mapLink(doc: Document, onClick: () => void): HTMLAnchorElement {
  const link = doc.createElement("a");
  link.href = "#";
  link.setAttribute(MAP_LINK_ATTRIBUTE, "");
  link.textContent = "Voir sur la carte";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return link;
}

/** A « Carte : Voir sur la carte » row under the profile's state. */
export function mountProfileLink(doc: Document, onClick: () => void): void {
  const stateRow = findProfileStateRow(doc);
  if (!stateRow || doc.querySelector(`[${MAP_LINK_ATTRIBUTE}]`)) return;
  const row = doc.createElement("tr");
  const label = doc.createElement("td");
  // As the game's own labels.
  label.style.textAlign = "right";
  label.textContent = "Carte :";
  const cell = doc.createElement("td");
  cell.append(mapLink(doc, onClick));
  row.append(label, cell);
  stateRow.after(row);
}

/** « Voir sur la carte » under the alliance's name, on its public page. */
export function mountAllianceLink(doc: Document, onClick: () => void): void {
  const title = doc.querySelector("#centre > h2");
  if (!title || doc.querySelector(`[${MAP_LINK_ATTRIBUTE}]`)) return;
  const paragraph = doc.createElement("p");
  paragraph.style.textAlign = "center";
  paragraph.append(mapLink(doc, onClick));
  title.after(paragraph);
}

/**
 * The server map, over the game: a top bar button on every page, « Voir sur la carte » on profiles and alliance pages.
 * Remembers who is logged in, for the map opened from the toolbar popup. See docs/features/carte-serveur.md.
 */
export const serverMap: Feature = {
  id: "server-map",
  toggle: "server-map",
  matches: () => true,
  async run(ctx, toggles) {
    if (isEnabled(toggles, "server-map", "button")) {
      insertMenuBarButton(document, {
        className: SERVER_MAP_BUTTON_CLASS,
        title: "Carte du serveur",
        label: "Carte du serveur",
        icon: MAP_ICON,
        onClick: () => {
          serverMapDialog(ctx)
            .toggle()
            .catch((error: unknown) => {
              console.error("[Optizzz] server map dialog failed", error);
            });
        },
      });
    }

    const path = location.pathname.toLowerCase();
    const profile = path === "/membre.php" ? readProfile(document) : null;
    if (profile && isEnabled(toggles, "server-map", "profile")) {
      mountProfileLink(document, () => {
        // The export knows players by id: a pseudo can change.
        void loadPlayersExport(location.origin)
          .then(({ players }) => players.find((player) => player.pseudo === profile.pseudo))
          .catch(() => undefined)
          .then((player) => {
            openMap(ctx, player ? { kind: "player", id: player.id } : null);
          });
      });
    }
    const tag = path === "/classementalliance.php" ? new URLSearchParams(location.search).get("alliance") : null;
    if (tag && readAllianceRanking(document) && isEnabled(toggles, "server-map", "alliance")) {
      mountAllianceLink(document, () => {
        openMap(ctx, { kind: "alliance", tag });
      });
    }

    await rememberPlayer(location.origin, readLoggedInPseudo(document));
  },
};
