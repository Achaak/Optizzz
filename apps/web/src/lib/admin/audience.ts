// The back office's « Audience » (docs/features/site-audience.md): the page views counter's figures, per day and per
// page. Counts only: the counter keeps nothing about the visitors.
import { MAP_API_PAGE, parisDay } from "~/lib/page-views";
import { dailySums } from "./overview";

export interface PageViewRow {
  /** The Paris day, at midnight UTC. */
  day: Date;
  page: string;
  server: string;
  views: number;
}

const NAMES: Record<string, string> = {
  "/": "Accueil",
  "/about": "À propos",
  "/account": "Mon compte",
  "/connect-extension": "Connecter l'extension",
  "/guides": "Guides",
  "/guides/combat": "Guide du combat",
  "/guides/food": "Guide de la nourriture",
  "/guides/hunt": "Guide de la chasse",
  "/guides/tdc-chain": "Guide de la Chaîne de TDC",
  "/guides/travel": "Guide des trajets",
  "/legal": "Mentions légales",
  "/login": "Connexion",
  "/login/confirm": "Connexion · lien reçu",
  "/privacy": "Confidentialité",
  "/spaces": "Espaces d'alliance",
  "/spaces/[id]": "Un Espace d'alliance",
  "/spaces/[id]/declarer": "Un Espace · déclarer",
  "/tools": "Outils",
  "/tools/combat": "Simulateur de combat",
  "/tools/costs": "Coûts",
  "/tools/flood": "Plan de flood",
  "/tools/hunt": "Lanceur de chasse",
  "/tools/travel": "Temps de trajet",
  "/[server]": "Serveur · accueil",
  "/[server]/alliances": "Serveur · alliances",
  "/[server]/alliances/[tag]": "Serveur · fiche d'une alliance",
  "/[server]/compare": "Serveur · comparer",
  "/[server]/journal": "Serveur · Journal",
  "/[server]/map": "Serveur · carte",
  "/[server]/players": "Serveur · joueurs",
  "/[server]/players/[id]": "Serveur · fiche d'un joueur",
};

/** A page's name in the back office: « Simulateur de combat », « Serveur · carte ». */
export const pageName = (page: string): string => NAMES[page] ?? page;

const DAY = 24 * 60 * 60_000;

export interface Audience {
  /** The site's page views today, over the last 7 days and over the last 30 (today included). */
  today: number;
  week: number;
  month: number;
  /** Page views per Paris day, oldest first. */
  daily: { label: string; value: number }[];
  /** Per page, a server's pages together, most viewed over 30 days first. */
  pages: { page: string; name: string; week: number; month: number }[];
  /** The extension's reads of a server's map. */
  mapReads: { week: number; month: number; servers: { server: string; week: number; month: number }[] };
}

/** The figures of `rows` at `now`: `rows` holds at least the last 30 days. */
export function audience(rows: readonly PageViewRow[], now: Date, days: number): Audience {
  // « The last 7 days » are the 7 day keys up to today's (each at midnight UTC).
  const today = parisDay(now).getTime();
  const within = (row: PageViewRow, n: number) => row.day.getTime() > today - n * DAY && row.day.getTime() <= today;
  const pageRows = rows.filter((r) => r.page !== MAP_API_PAGE && within(r, 30));
  const mapRows = rows.filter((r) => r.page === MAP_API_PAGE && within(r, 30));
  const sum = (list: readonly PageViewRow[], n: number) =>
    list.filter((r) => within(r, n)).reduce((total, r) => total + r.views, 0);
  const grouped = (list: readonly PageViewRow[], key: (r: PageViewRow) => string) => {
    const groups = new Map<string, PageViewRow[]>();
    for (const row of list) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
    return [...groups].map(([k, group]) => ({ key: k, week: sum(group, 7), month: sum(group, 30) }));
  };
  const byMonth = (a: { month: number }, b: { month: number }) => b.month - a.month;

  return {
    today: sum(pageRows, 1),
    week: sum(pageRows, 7),
    month: sum(pageRows, 30),
    daily: dailySums(
      // Noon of the row's day: the Paris day, whatever the time of year.
      pageRows.map((r) => ({ date: new Date(r.day.getTime() + DAY / 2), value: r.views })),
      now,
      days,
    ),
    pages: grouped(pageRows, (r) => r.page)
      .sort(byMonth)
      .map(({ key, week, month }) => ({ page: key, name: pageName(key), week, month })),
    mapReads: {
      week: sum(mapRows, 7),
      month: sum(mapRows, 30),
      servers: grouped(mapRows, (r) => r.server)
        .sort(byMonth)
        .map(({ key, week, month }) => ({ server: key, week, month })),
    },
  };
}
