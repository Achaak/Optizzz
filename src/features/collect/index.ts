import { readGarrison, storeGarrison } from "@/data/garrison";
import { readSection, sourceOf } from "@/game/pages/end-times";
import { storeSection } from "@/data/end-times";
import type { Feature } from "../feature";
import { storeLevels } from "@/data/levels";
import { storeCapacities, storeIncome } from "@/data/income";
import { readCapacities, readIncome } from "@/game/pages/resources";
import { isEnabled } from "../toggles";

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
      const kind = sourceOf(location.pathname);
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

    // The army by place: combat simulator, flood plan and its « Flood max » column.
    if (path === "/armee.php" && (on("combat-simulator") || on("flood"))) {
      const garrison = readGarrison(document);
      if (garrison) {
        await storeGarrison(origin, garrison, now);
        await storeLevels(origin, { dome: garrison.dome, lodge: garrison.lodge });
      }
    }
  },
};
