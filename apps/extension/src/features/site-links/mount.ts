// « Voir sur optizzz.fr » on a profile and on an alliance's public page: the page the site has for them. Plain links,
// opened in a new tab: nothing is sent to the site but the address. See docs/features/liens-site.md.
import { loadPlayersExport } from "@/data/exports";
import { findProfileStateRow } from "@optizzz/game/pages/scores";
import { siteAlliancePath, sitePlayerPath } from "@optizzz/game/site-links/site";

const SITE_LINK_ATTRIBUTE = "data-optizzz-site-link";
const LABEL = "Voir sur optizzz.fr";

function siteLink(doc: Document, href: string, title: string): HTMLAnchorElement {
  const link = doc.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = LABEL;
  link.title = title;
  link.setAttribute(SITE_LINK_ATTRIBUTE, "");
  return link;
}

/**
 * A « Optizzz : Voir sur optizzz.fr » row under the profile's state (and its « Suivis » row), as the game's own rows.
 * Once the export knows the player: the site names players by the export's id.
 */
export async function mountProfileSiteLink(
  doc: Document,
  gameOrigin: string,
  siteOrigin: string,
  server: string,
  pseudo: string,
): Promise<void> {
  if (!findProfileStateRow(doc) || doc.querySelector(`[${SITE_LINK_ATTRIBUTE}]`)) return;
  const { players } = await loadPlayersExport(gameOrigin);
  const player = players.find((candidate) => candidate.pseudo === pseudo);
  const stateRow = findProfileStateRow(doc);
  if (!player || !stateRow || doc.querySelector(`[${SITE_LINK_ATTRIBUTE}]`)) return;
  const row = doc.createElement("tr");
  const label = doc.createElement("td");
  // As the game's own labels.
  label.style.textAlign = "right";
  label.textContent = "Optizzz :";
  const cell = doc.createElement("td");
  cell.append(
    siteLink(
      doc,
      `${siteOrigin}${sitePlayerPath(server, player.id)}`,
      "Son évolution, son historique de TDC et son journal",
    ),
  );
  row.append(label, cell);
  // Below « Suivis » when it is already there; when it comes later, it goes above this row, so the order holds.
  const after = stateRow.nextElementSibling?.querySelector("[data-optizzz-follow]")
    ? stateRow.nextElementSibling
    : stateRow;
  after.after(row);
}

/** « Voir sur optizzz.fr » under the alliance's name (and its « Suivre »), on its public page. */
export function mountAllianceSiteLink(doc: Document, siteOrigin: string, server: string, tag: string): void {
  const title = doc.querySelector("#centre > h2");
  if (!title || doc.querySelector(`[${SITE_LINK_ATTRIBUTE}]`)) return;
  const paragraph = doc.createElement("p");
  paragraph.style.textAlign = "center";
  paragraph.append(
    siteLink(doc, `${siteOrigin}${siteAlliancePath(server, tag)}`, "Son évolution, ses membres et son journal"),
  );
  const follow = title.nextElementSibling?.querySelector("[data-optizzz-follow]") ? title.nextElementSibling : title;
  follow.after(paragraph);
}
