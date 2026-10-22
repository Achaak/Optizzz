// « Suivre » on a profile and on an alliance's public page, styled as the game's own links.
import { loadAlliancesExport, loadPlayersExport } from "@/data/exports";
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  WATCH_LIMIT,
  watchKey,
  watchWatchlist,
  type WatchEntry,
  type WatchKey,
} from "@/data/watchlist";
import { sameTag } from "@optizzz/game/diplomacy";
import { findProfileStateRow } from "@optizzz/game/pages/scores";

const FOLLOW_ATTRIBUTE = "data-optizzz-follow";

const gameLink = (doc: Document, text: string, title: string, onClick: () => void) => {
  const link = doc.createElement("a");
  link.href = "#";
  link.textContent = text;
  link.title = title;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return link;
};

/**
 * Not watched: « Suivre ». Watched: « Dans vos suivis · Voir · Ne plus suivre ». `entry` is built on the click, from
 * the exports (the id, the field to compare with); `open` opens the « Suivis » view.
 */
function followControl(
  doc: Document,
  host: string,
  key: WatchKey,
  entry: () => Promise<WatchEntry | null>,
  open: () => void,
): HTMLElement {
  const wrap = doc.createElement("span");
  wrap.setAttribute(FOLLOW_ATTRIBUTE, "");
  const note = doc.createElement("span");
  let problem = "";

  const follow = () => {
    problem = "";
    void entry()
      .then((built) => (built ? addToWatchlist(host, built) : "missing"))
      .then((result) => {
        if (result === "full") problem = `Limite de ${String(WATCH_LIMIT)} suivis atteinte : retirez-en un d'abord.`;
        if (result === "missing") problem = "Absent de l'export public : réessayez dans une heure.";
        note.textContent = problem ? ` ${problem}` : "";
      })
      .catch((error: unknown) => {
        console.error("[Optizzz] could not follow", error);
        note.textContent = " Export public injoignable : réessayez plus tard.";
      });
  };

  const show = (entries: WatchEntry[]) => {
    const watched = entries.some((other) => watchKey(other) === key);
    note.textContent = problem && !watched ? ` ${problem}` : "";
    wrap.replaceChildren(
      ...(watched
        ? [
            "Dans vos suivis · ",
            gameLink(doc, "Voir", "Ouvrir vos suivis", open),
            " · ",
            gameLink(doc, "Ne plus suivre", "Retirer de vos suivis", () => {
              void removeFromWatchlist(host, key);
            }),
          ]
        : [gameLink(doc, "Suivre", "Voir ses changements (alliance, TDC, vacances…) dans « Suivis »", follow)]),
      note,
    );
  };
  void loadWatchlist(host).then(show);
  watchWatchlist(host, show);
  return wrap;
}

/** A « Suivis : Suivre » row under the profile's state, as the game's own rows. Once the export knows the player. */
export async function mountProfileFollow(doc: Document, origin: string, pseudo: string, open: () => void) {
  const stateRow = findProfileStateRow(doc);
  if (!stateRow || doc.querySelector(`[${FOLLOW_ATTRIBUTE}]`)) return;
  const { version, players } = await loadPlayersExport(origin);
  const player = players.find((candidate) => candidate.pseudo === pseudo);
  if (!player || doc.querySelector(`[${FOLLOW_ATTRIBUTE}]`)) return;
  const entry: WatchEntry = {
    kind: "player",
    id: player.id,
    pseudo: player.pseudo,
    seen: { version, field: player.field },
  };
  const row = doc.createElement("tr");
  const label = doc.createElement("td");
  // As the game's own labels.
  label.style.textAlign = "right";
  label.textContent = "Suivis :";
  const cell = doc.createElement("td");
  cell.append(followControl(doc, new URL(origin).host, watchKey(entry), () => Promise.resolve(entry), open));
  row.append(label, cell);
  stateRow.after(row);
}

/** « Suivre » under the alliance's name, on its public page. */
export function mountAllianceFollow(doc: Document, origin: string, tag: string, open: () => void): void {
  const title = doc.querySelector("#centre > h2");
  if (!title || doc.querySelector(`[${FOLLOW_ATTRIBUTE}]`)) return;
  const paragraph = doc.createElement("p");
  paragraph.style.textAlign = "center";
  const key: WatchKey = `alliance:${tag.toLowerCase()}`;
  paragraph.append(
    followControl(
      doc,
      new URL(origin).host,
      key,
      async () => {
        const [{ version }, { alliances }] = await Promise.all([
          loadPlayersExport(origin),
          loadAlliancesExport(origin),
        ]);
        const alliance = alliances.find((candidate) => sameTag(candidate.tag, tag));
        return alliance ? { kind: "alliance", tag: alliance.tag, seen: { version, field: alliance.totalField } } : null;
      },
      open,
    ),
  );
  title.after(paragraph);
}
