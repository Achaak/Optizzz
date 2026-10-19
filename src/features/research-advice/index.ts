import { storage } from "wxt/utils/storage";
import { isEmptyGarrison, loadGarrison } from "@/data/garrison";
import { loadLaying } from "@/data/laying";
import { fetchGamePage } from "@/utils/game-page";
import { readWholeArmy } from "./army";
import { mountSpeedUp, SPEED_UP_STYLE } from "./speed-up-mount";
import { readTimedRows } from "@/game/pages/resources";
import { queueEnd, readSpeedUp, startsAt } from "./speed-up-rows";
import { LAYING_BOOST_STYLE, mountLayingBoost } from "./laying-boost";
import { readLevelRows } from "@/game/pages/level-rows";
import { loadPlayersExport } from "@/data/exports";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import { CONVOYS_MAX_AGE, loadConvoys, refreshConvoys } from "@/data/convoys";
import { loadStoredLevels } from "@/data/levels";
import { spareWorkers } from "@/game/aphids";
import { aphidsAdvice, APHIDS_STYLE, COMMUNICATION, mountAphids, STABLE } from "./aphids";
import { LAYING_BOOSTS, rankLayingBoosts } from "@/game/laying-boost";
import { INCOME_MAX_AGE, loadCapacities, loadIncome } from "@/data/income";
import type { ColonyState } from "@/game/forecast";
import { LEVEL_TIME_GROWTH } from "@/game/speed-up";
import { readCapacities, readCosts, readStock } from "@/game/pages/resources";
import { readWorkQueue } from "@/game/pages/work-queue";
import { sameName } from "@/game/levels";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import {
  ADVICE_STYLE,
  DEFAULT_ADVICE_PREFS,
  mountResearchAdvice,
  type AdviceData,
  type AdvicePrefs,
  type AdvisedResearch,
} from "./mount";

const RESEARCH: Record<AdvisedResearch, string> = { shield: "Bouclier Thoracique", weapons: "Armes" };

const prefsKey = (host: string) => `local:researchAdvice:${host}:prefs` as const;

/** The whole army: Armee.php read now (and Ressources.php for the hunts), else the garrison last stored. */
async function loadArmy(
  origin: string,
  now: Date,
): Promise<Pick<Extract<AdviceData, { kind: "ready" }>, "army" | "armyReadAt" | "armySource"> | null> {
  const [armee, ressources] = await Promise.all(
    ["Armee.php", "Ressources.php"].map((page) => fetchGamePage(`${origin}/${page}`).catch(() => null)),
  );
  const whole = armee ? readWholeArmy(armee, ressources ?? null, now) : null;
  if (whole) {
    const { army, ...source } = whole;
    return { army, armyReadAt: now, armySource: { kind: "live", ...source } };
  }
  const garrison = await loadGarrison(origin);
  if (!garrison) return null;
  const previous = isEmptyGarrison(garrison) && !!garrison.previous;
  const { armies, readAt } = previous && garrison.previous ? garrison.previous : garrison;
  const army = armies.field.map((count, i) => count + (armies.nest[i] ?? 0) + (armies.lodge[i] ?? 0));
  return { army, armyReadAt: readAt, armySource: { kind: "stored", previous } };
}

/** The army, the laying speed and the units the player can lay, or what is missing. */
async function loadData(origin: string, now: Date): Promise<AdviceData> {
  const [army, laying] = await Promise.all([loadArmy(origin, now), loadLaying(origin, now)]);
  if (!laying)
    return { kind: "missing", message: "Vitesse de ponte inconnue : passez par la Reine pour qu'Optizzz la lise." };
  if (!army) return { kind: "missing", message: "Armée inconnue : passez par la page Armée pour qu'Optizzz la lise." };
  if (army.army.every((count) => count === 0))
    return { kind: "missing", message: "Aucune unité dans votre armée : rien à renforcer pour l'instant." };
  return { kind: "ready", ...army, speed: laying.speed, layable: laying.units, layingReadAt: laying.readAt };
}

/**
 * On laboratoire.php, under Armes and Bouclier Thoracique: whether the next level brings more to the army than the
 * units the Queen could lay while laying again the workers it costs. See docs/features/conseils-recherche.md.
 */
export const researchAdviceFeature: Feature = {
  id: "research-advice",
  toggle: "research-advice",
  matches: (url) => url.pathname.toLowerCase() === "/laboratoire.php",
  async run(_ctx, toggles) {
    if (!isEnabled(toggles, "research-advice", "weapons-shield")) return;
    const now = new Date();
    const queue = readWorkQueue(document, now);
    const rows = (Object.keys(RESEARCH) as AdvisedResearch[]).flatMap((research) => {
      const cost = readCosts(document).find((row) => sameName(row.name, RESEARCH[research]));
      const description = cost?.description;
      const shown = /\d+/.exec(description?.querySelector(".niveau_amelioration")?.textContent ?? "");
      if (!cost || !description || !shown || cost.cost.workers <= 0) return [];
      // Under way: the row already shows the cost of the level after the queued one.
      const queued = queue.items
        .filter((item) => sameName(item.name, RESEARCH[research]))
        .map((item) => item.targetLevel);
      return [
        { description, row: { research, level: Math.max(Number(shown[0]), ...queued), workers: cost.cost.workers } },
      ];
    });
    if (rows.length === 0) return;

    const style = document.createElement("style");
    style.textContent = ADVICE_STYLE;
    document.head.append(style);
    const key = prefsKey(location.host);
    const prefs = { ...DEFAULT_ADVICE_PREFS, ...(await storage.getItem<AdvicePrefs>(key)) };
    const data = await loadData(location.origin, now);
    // Both blocks share the choices: each sends only what changed.
    let current = prefs;
    const save = (change: Partial<AdvicePrefs>) => {
      current = { ...current, ...change, open: { ...current.open, ...change.open } };
      storage.setItem(key, current).catch((error: unknown) => {
        console.error("[Optizzz] saving research advice prefs failed", error);
      });
    };
    for (const { description, row } of rows) mountResearchAdvice(description, row, data, prefs, save, now);
  },
};

/** Stock, income and warehouses, to know when a row is paid; null when unreadable (then as if paid now). */
async function loadColonyState(origin: string, now: Date): Promise<ColonyState | null> {
  const stock = readStock(document);
  const income = await loadIncome(origin, INCOME_MAX_AGE, now).catch(() => null);
  if (!stock || !income) return null;
  return { ...stock, ...income, capacities: readCapacities(document) ?? (await loadCapacities(origin, false)) };
}

/** Each page and what speeds it up, read on the other page. */
const PAGES = {
  "/construction.php": { speedUp: "Architecture", other: "laboratoire.php", growth: LEVEL_TIME_GROWTH.research },
  "/laboratoire.php": { speedUp: "Salle d'analyse", other: "construction.php", growth: LEVEL_TIME_GROWTH.construction },
} as const;

/**
 * On construction.php and laboratoire.php: in each row, whether waiting for the next level of Architecture (or Salle
 * d'analyse) makes it end sooner. See docs/features/conseils-recherche.md.
 */
export const speedUpAdvice: Feature = {
  id: "speed-up-advice",
  toggle: "research-advice",
  matches: (url) => url.pathname.toLowerCase() in PAGES,
  async run(_ctx, toggles) {
    const path = location.pathname.toLowerCase() as keyof typeof PAGES;
    const page = PAGES[path];
    const on =
      path === "/construction.php"
        ? isEnabled(toggles, "research-advice", "architecture")
        : isEnabled(toggles, "research-advice", "analysis-room");
    if (!on) return;
    const now = new Date();
    const rows = readTimedRows(document).filter((row) => !row.locked);
    if (rows.length === 0) return;
    const [other, state] = await Promise.all([
      fetchGamePage(`${location.origin}/${page.other}`).catch(() => null),
      loadColonyState(location.origin, now),
    ]);
    const speedUp = other ? readSpeedUp(other, page.speedUp, page.growth, state, now) : null;
    if (!speedUp) return;
    const style = document.createElement("style");
    style.textContent = SPEED_UP_STYLE;
    document.head.append(style);
    const ownQueueEnd = queueEnd(document, now);
    for (const row of rows) {
      // Started when paid, then after the queue: as « Disponible … » of the resource forecast counts it.
      const start = startsAt(state, row.cost, ownQueueEnd, now);
      if (start) mountSpeedUp(row, speedUp, start, now);
    }
  },
};

/**
 * On construction.php and laboratoire.php, under Couveuse, Solarium and Technique de ponte: which one makes laying 10 %
 * faster for the least. See docs/features/conseils-recherche.md.
 */
export const layingBoostAdvice: Feature = {
  id: "laying-boost-advice",
  toggle: "research-advice",
  matches: (url) => url.pathname.toLowerCase() in PAGES,
  async run(_ctx, toggles) {
    if (!isEnabled(toggles, "research-advice", "laying-boost")) return;
    const rows = readLevelRows([document]);
    const own = rows.filter((row) => LAYING_BOOSTS.some((name) => sameName(name, row.name)));
    if (own.length === 0) return;
    const page = PAGES[location.pathname.toLowerCase() as keyof typeof PAGES];
    const other = await fetchGamePage(`${location.origin}/${page.other}`).catch(() => null);
    if (!other) return;
    const ranked = rankLayingBoosts([...rows, ...readLevelRows([other])]);
    const style = document.createElement("style");
    style.textContent = LAYING_BOOST_STYLE;
    document.head.append(style);
    for (const row of own) mountLayingBoost(row.description, row.name, ranked);
  },
};

/** The TDC of my colonies, from the last public export; null when unknown. */
async function loadColonyFields(origin: string): Promise<number[] | null> {
  const me = readLoggedInPseudo(document);
  const players = me
    ? await loadPlayersExport(origin).then(
        (data) => data.players,
        () => null,
      )
    : null;
  const self = players?.find((player) => player.pseudo === me);
  if (!players || !self) return null;
  return players.filter((player) => player.masterPlayerId === self.id).map((player) => player.field);
}

/** The workers free for convoys: at home and carrying convoys, less the TDC; null when the convoys are unknown. */
async function loadSpareWorkers(origin: string, aphids: number): Promise<number | null> {
  const stock = readStock(document);
  if (!stock) return null;
  const now = new Date();
  let kept = await loadConvoys(origin);
  if (!kept || now.getTime() - kept.readAt.getTime() > CONVOYS_MAX_AGE) kept = (await refreshConvoys(origin)) ?? kept;
  if (!kept) return null;
  return spareWorkers({ atHome: stock.workers, huntingField: stock.huntingField }, kept.convoys, aphids, now);
}

/**
 * On construction.php under the Étable à pucerons, and on laboratoire.php under Communication avec les animaux when
 * its next level unlocks the stable's: how soon the colonies pay the next level back, its requirements included.
 * See docs/features/conseils-recherche.md.
 */
export const aphidsAdviceFeature: Feature = {
  id: "aphids-advice",
  toggle: "research-advice",
  matches: (url) => url.pathname.toLowerCase() in PAGES,
  async run(_ctx, toggles) {
    if (!isEnabled(toggles, "research-advice", "aphids")) return;
    const own = readLevelRows([document]);
    const stable = own.find((row) => sameName(row.name, STABLE));
    const research = own.find((row) => sameName(row.name, COMMUNICATION));
    if (!stable && !research) return;
    const page = PAGES[location.pathname.toLowerCase() as keyof typeof PAGES];
    const [other, colonies, built] = await Promise.all([
      fetchGamePage(`${location.origin}/${page.other}`).catch(() => null),
      loadColonyFields(location.origin),
      loadStoredLevels(location.origin),
    ]);
    if (!other) return;
    const rows = [...own, ...readLevelRows([other])];
    const level = rows.find((row) => sameName(row.name, STABLE))?.level ?? 0;
    const spare = await loadSpareWorkers(location.origin, built.aphids ?? level);
    const advice = aphidsAdvice(rows, colonies, spare);
    if (!advice) return;
    const style = document.createElement("style");
    style.textContent = APHIDS_STYLE;
    document.head.append(style);
    if (stable) mountAphids(stable.description, advice, "stable");
    // Only when the research's next level is the one the stable waits for.
    if (research && advice.unlockedBy?.level === research.level + 1)
      mountAphids(research.description, advice, "research");
  },
};
