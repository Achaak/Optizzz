import { readGarrison, storeGarrison } from "@/data/garrison";
import { readSection, sourceOf } from "@/features/end-times/end-pages";
import { storeSection } from "@/data/end-times";
import { readIncomingConvoys, readKeptConvoys, storeConvoys, storeIncomingConvoys } from "@/data/convoys";
import { sendsCategory } from "@/data/envois";
import { storeSentAttacks } from "@/data/sent-attacks";
import { readSentAttacks } from "@/features/flood/attacks";
import { isInbox, keepConvoyMessages } from "@/data/convoy-history";
import { readConvoyMessages } from "@optizzz/game/pages/messages";
import type { Feature } from "../feature";
import { storeLevels } from "@/data/levels";
import { readLaying, storeLaying } from "@/data/laying";
import { storeCapacities, storeIncome } from "@/data/income";
import { readCapacities, readIncome, readStock } from "@optizzz/game/pages/resources";
import { isEnabled } from "../toggles";
import { readLoggedInPseudo } from "@optizzz/game/pages/alliance";
import { readAllianceMembers, storeAllianceMembers } from "@/data/alliance-members";
import { storeCurrentPlayer } from "@/data/optizzz-account";

/**
 * Keeps what the current page shows (never a request) for the features that need it, whichever of them is on:
 * switching a feature off only removes what it shows and the pages it reads in the background. Always on, out of
 * « Fonctionnalités », like game-levels. See docs/features/feature-toggles.md.
 */
export const collect: Feature = {
  id: "collect",
  matches: () => true,
  async run(_ctx, toggles) {
    const on = (feature: Parameters<typeof isEnabled>[1], option?: string) => isEnabled(toggles, feature, option);
    const origin = location.origin;
    const path = location.pathname.toLowerCase();
    const now = new Date();

    // End times: the « Prochaines fins » box, and the end notifications of the alerts.
    if (on("end-times") || on("alerts", "notifications")) {
      const kind = sourceOf(location.pathname, location.search);
      const section = kind ? readSection(document, kind, now) : null;
      if (section) await storeSection(origin, section);
    }

    // Income and warehouses: resource forecast, toolbar badge, laying planner, convoy calculator.
    if (on("resource-forecast") || on("alerts") || on("laying-planner") || on("convoy")) {
      const income = path === "/ressources.php" ? readIncome(document, now) : null;
      if (income) await storeIncome(origin, income, now);
      const capacities = readCapacities(document);
      if (capacities) await storeCapacities(origin, capacities);
    }

    // The Convois Envoi of the logged-in player, checked in « Compte Optizzz »: their convoys both ways and the
    // inbox's history, as this page shows them (docs/features/site-envois.md). Sent by the background, encrypted.
    const pseudo = on("optizzz-account") ? readLoggedInPseudo(document) : null;
    const sendsConvoysHere =
      pseudo !== null &&
      (path === "/commerce.php" || path === "/messagerie.php") &&
      (await sendsCategory(origin, pseudo, "convoys"));

    // Convoys on their way: the workers they carry, off the header's count.
    if (path === "/commerce.php" && (on("convoy", "workers") || sendsConvoysHere)) {
      const convoys = readKeptConvoys(document, now);
      if (convoys) await storeConvoys(origin, convoys, now, readStock(document)?.workers);
    }
    // Convoys on their way to me: only for the Envoi, they take none of my workers.
    if (path === "/commerce.php" && sendsConvoysHere) {
      const incoming = readIncomingConvoys(document, now);
      if (incoming) await storeIncomingConvoys(origin, incoming, now);
    }

    // Convoys delivered and received, read in the inbox: the game deletes its messages after a week.
    if (path === "/messagerie.php" && (on("convoy", "history") || sendsConvoysHere) && isInbox(document)) {
      await keepConvoyMessages(origin, readConvoyMessages(document, now), now);
    }

    // The Floods Envoi of the logged-in player, checked in « Compte Optizzz »: the attacks on their way with the game's
    // number of each, where the game lists them (Armee.php and the attack form). Sent by the background, encrypted.
    const listsAttacks =
      path === "/armee.php" || (path === "/ennemie.php" && new URLSearchParams(location.search).has("Attaquer"));
    if (pseudo !== null && listsAttacks && (await sendsCategory(origin, pseudo, "floods"))) {
      await storeSentAttacks(origin, readSentAttacks(document, now), now);
    }

    // The army by place: combat simulator, flood plan and its « Flood max » column, research advice.
    if (path === "/armee.php" && (on("combat-simulator") || on("flood") || on("research-advice"))) {
      const garrison = readGarrison(document);
      if (garrison) {
        await storeGarrison(origin, garrison, now);
        await storeLevels(origin, { dome: garrison.dome, lodge: garrison.lodge });
      }
    }

    // Optizzz account: the header's pseudo, for the offer « Rattacher Pseudo (S5) » (sent only on that click), and the
    // last list of the alliance's members, kept here for the Alliance Spaces: nothing of either leaves the browser.
    if (on("optizzz-account")) {
      if (pseudo) await storeCurrentPlayer(origin, pseudo);
      if (path === "/alliance.php" && location.search === "?Membres") {
        const members = readAllianceMembers(document, now);
        if (members) await storeAllianceMembers(origin, members);
      }
    }

    // The laying speed and the units the player can lay: research advice on laboratoire.php.
    if (path === "/reine.php" && on("research-advice")) {
      const laying = readLaying(document);
      if (laying) await storeLaying(origin, laying, now);
    }
  },
};
