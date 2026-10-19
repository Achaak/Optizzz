import { formatCompact, formatNumber } from "@/utils/number-format";

/**
 * Where the game writes big numbers, page by page (inventory of 2026-10-19 on S2 and S5, docs/features/arrondis.md).
 * Each zone is a root to scan; the header is on every page.
 */
const HEADER = ".texte_ligne_boite_info";

const PAGE_ZONES: Record<string, string[]> = {
  "reine.php": ["#centre"],
  "construction.php": ["#centre"],
  "laboratoire.php": ["#centre"],
  "ressources.php": ["#centre"],
  "armee.php": ["#centre"],
  "commerce.php": ["#centre"],
  "ennemie.php": ["#centre"],
  "acquerirterrain.php": ["#centre"],
  "colonies.php": ["#centre"],
  "classement.php": ["#centre"],
  "classementalliance.php": ["#centre"],
  "membre.php": ["#centre"],
};

/**
 * Never touched, even inside a zone: fields; what the game's scripts read back (`$('#cout_…').text()` on Reine);
 * what players wrote (alliance and profile descriptions). Optizzz's own additions are skipped too (`isOptizzz`).
 */
const FIELDS_AND_SCRIPTS = [
  "input",
  "textarea",
  "select",
  "option",
  "script",
  "style",
  "[contenteditable]",
  "[id^='cout_']",
  "[id^='armee_initial']",
].join(",");

const SKIPPED = `${FIELDS_AND_SCRIPTS},.contenuJoueur`;

/**
 * Conversations of the messagerie written by the game (« Fourmizzz » for participant, checked on S2 and S5): hunt and
 * attack reports, convoys. Their text sits in a `.contenuJoueur` like a player's message. « Conversations » and
 * « Alliance » hold what players write: never touched.
 */
const REPORT_TYPES = ["Chasses", "Combats", "Commerce"];

/**
 * Added by Optizzz, its numbers already written by `formatAmount` or kept exact on purpose (amounts to send): only
 * `optizzz-` classes. A game element Optizzz merely marks (`tr.alt.optizzz-members-me`) keeps its own classes.
 */
const isOptizzz = (element: Element) =>
  element.classList.length > 0 && [...element.classList].every((name) => name.startsWith("optizzz"));

/** A number as the game writes it, with thousands separators: « 1 234 567 », « −2 397 ». */
const GAME_NUMBER = /(?<![\w.,])[-−]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?![\w,])/g;

const COMPACT_CLASS = "optizzz-compact";
const FULL_CLASS = "optizzz-compact-full";

/**
 * The compact text is drawn by CSS from an attribute: the game's number stays in the page, visually hidden, so
 * `textContent` and `innerText` (read by the game, its table sorting and Optizzz's own readers) do not change, and
 * copying the text copies the exact number.
 */
export const COMPACT_STYLE = `
.${COMPACT_CLASS}::after { content: attr(data-compact); }
.${FULL_CLASS} {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}`;

/** The zones of this page: the header, plus the page's own (alliance members only, not the chat or forum). */
export function zonesOf(url: URL): string[] {
  const page = url.pathname.split("/").pop()?.toLowerCase() ?? "";
  const own = page === "alliance.php" && url.searchParams.has("Membres") ? ["#centre"] : (PAGE_ZONES[page] ?? []);
  return [HEADER, ...own];
}

const isSkipped = (node: Node, root: Element, skippedSelector: string) => {
  const parent = node.parentElement;
  if (!parent) return true;
  const skipped = parent.closest(skippedSelector);
  if (skipped !== null && root.contains(skipped)) return true;
  for (let element: Element | null = parent; element && element !== root; element = element.parentElement) {
    if (isOptizzz(element)) return true;
  }
  return false;
};

/** The exact value goes where the game already shows a tooltip (the header's « entrepôt rempli à 7% »), else on the number. */
function showExact(span: HTMLElement, exact: string, root: Element) {
  const titled = span.parentElement?.closest("[title]");
  if (titled && (root.contains(titled) || titled.contains(root))) {
    titled.setAttribute("title", `${exact} · ${titled.getAttribute("title") ?? ""}`);
  } else {
    span.title = exact;
  }
}

function compactTextNode(text: Text, root: Element) {
  const source = text.data;
  const matches = [...source.matchAll(GAME_NUMBER)].filter((match) => Number(match[0].replace(/\D/g, "")) >= 10_000);
  if (matches.length === 0) return;
  const doc = text.ownerDocument;
  const parts: Node[] = [];
  const exact: [HTMLElement, string][] = [];
  let from = 0;
  for (const match of matches) {
    const start = match.index;
    const written = match[0];
    const value = Number(written.replace(/\D/g, "")) * (/^[-−]/.test(written) ? -1 : 1);
    if (start > from) parts.push(doc.createTextNode(source.slice(from, start)));
    const span = doc.createElement("span");
    span.className = COMPACT_CLASS;
    span.dataset.compact = formatCompact(value);
    const full = doc.createElement("span");
    full.className = FULL_CLASS;
    full.textContent = written;
    span.append(full);
    parts.push(span);
    from = start + written.length;
    exact.push([span, formatNumber(value)]);
  }
  if (from < source.length) parts.push(doc.createTextNode(source.slice(from)));
  text.replaceWith(...parts);
  for (const [span, value] of exact) showExact(span, value, root);
}

/**
 * Shortens the game's numbers of 10 000 and more inside `root`; numbers already shortened are left alone. `report`:
 * a report of the game, whose `.contenuJoueur` is the game's text and not a player's.
 */
export function compactNumbersIn(root: Element, report = false) {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  const skipped = report ? FIELDS_AND_SCRIPTS : SKIPPED;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && !isSkipped(node, root, skipped)) texts.push(node);
  }
  for (const text of texts) compactTextNode(text, root);
}

/** The rows of the game's reports: each one's header (its title) and the detail rows the game opens under it. */
function reportRows(doc: Document): Element[] {
  return [...doc.querySelectorAll("tr.en_tete_message")].flatMap((header) => {
    if (!REPORT_TYPES.includes(header.getAttribute("data-type") ?? "")) return [];
    const rows = [header];
    for (let row = header.nextElementSibling; row && !row.matches("tr.en_tete_message"); row = row.nextElementSibling) {
      rows.push(row);
    }
    return rows;
  });
}

/** Shortens the numbers of the messagerie's reports and convoys, never those of the players' messages. */
export function compactReports(doc: Document) {
  for (const row of reportRows(doc)) compactNumbersIn(row, true);
}

const isMessagerie = (url: URL) => url.pathname.split("/").pop()?.toLowerCase() === "messagerie.php";

/** Shortens the numbers of every zone of the page, now and when the game fills a zone later (alliance members, AJAX). */
export function compactGameNumbers(doc: Document, url: URL): MutationObserver[] {
  const roots = zonesOf(url).flatMap((selector) => [...doc.querySelectorAll(selector)]);
  const observers = roots.map((root) => {
    compactNumbersIn(root);
    const observer = new MutationObserver((records) => {
      // Only what the game added: a second pass finds nothing left to shorten, so this ends.
      if (records.some((record) => record.addedNodes.length > 0)) compactNumbersIn(root);
    });
    observer.observe(root, { childList: true, subtree: true });
    return observer;
  });
  if (!isMessagerie(url)) return observers;
  // The game loads a report's detail when the player opens it, and reloads the list of a folder.
  compactReports(doc);
  const messages = new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length > 0)) compactReports(doc);
  });
  messages.observe(doc.querySelector("#centre") ?? doc.body, { childList: true, subtree: true });
  return [...observers, messages];
}
