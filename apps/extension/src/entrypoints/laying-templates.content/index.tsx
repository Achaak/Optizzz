// Separate script: the templates bundle React, so they only load on Reine.php. See docs/features/laying-templates.md.
import { createRoot, type Root } from "react-dom/client";
import { LayingTemplates } from "@/features/laying-templates/LayingTemplates";
import { readQueueLines } from "@/features/laying-templates/pages";
import type { PlanContext } from "@/features/laying-templates/template";
import "@/theme/theme.css";
import "@/features/laying-templates/style.css";
import { INCOME_MAX_AGE, loadCapacities, loadIncome } from "@/data/income";
import { readSection } from "@/features/end-times/end-pages";
import { readLayableUnits, readLayingSpeed } from "@optizzz/game/pages/queen";
import { readStock } from "@optizzz/game/pages/resources";
import { loadCompactNumbers } from "@/features/compact-numbers";
import { isFeatureEnabled } from "@/features/toggles";

export default defineContentScript({
  // Match patterns are case-sensitive, the game's links are not always written the same way.
  matches: ["*://*.fourmizzz.fr/Reine.php*", "*://*.fourmizzz.fr/reine.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    if (!(await isFeatureEnabled("laying-templates"))) return;
    await loadCompactNumbers();
    // The units' table, right after the laying queue.
    const anchor = document.querySelector("tr.ligneAmelioration")?.closest("table");
    const stock = readStock(document);
    const speed = readLayingSpeed(document);
    if (!anchor || !stock || !speed) return;

    const readAt = new Date();
    const income = await loadIncome(location.origin, INCOME_MAX_AGE, readAt).catch((error: unknown) => {
      console.warn("[Optizzz] laying templates: income unreadable", error);
      return null;
    });
    const queued = readSection(document, "laying", readAt)?.items ?? [];
    const context: PlanContext | null = income
      ? {
          speed,
          state: { ...stock, ...income, capacities: await loadCapacities(location.origin, false) },
          queueEnd: new Date(Math.max(readAt.getTime(), ...queued.map((item) => item.endsAt.getTime()))),
          layable: readLayableUnits(document),
          readAt,
          now: readAt,
        }
      : null;

    const ui = await createShadowRootUi<Root>(ctx, {
      name: "optizzz-laying-templates",
      position: "inline",
      anchor,
      append: "before",
      onMount(container) {
        const root = createRoot(container);
        root.render(
          <LayingTemplates
            origin={location.origin}
            host={location.host}
            context={context}
            queue={readQueueLines(document)}
            reload={() => {
              location.reload();
            }}
          />,
        );
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
