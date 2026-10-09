// Separate script: the launcher bundles React + ECharts and its engine, so it only loads on Ressources.php.
import { createRoot, type Root } from "react-dom/client";
import { HuntLauncher } from "@/features/hunt-launcher/HuntLauncher";
import { readOngoingHunts } from "@/features/hunt-launcher/pages";
import "@/theme/theme.css";
import "@/features/hunt-launcher/style.css";
import { readStock } from "@/game/pages/resources";
import { isFeatureEnabled } from "@/features/toggles";

export default defineContentScript({
  // Match patterns are case-sensitive, the game's links are not always written the same way.
  matches: ["*://*.fourmizzz.fr/Ressources.php*", "*://*.fourmizzz.fr/ressources.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    if (!(await isFeatureEnabled("hunt-launcher"))) return;
    const anchor = document.querySelector<HTMLElement>("#boite_tdc");
    const stock = readStock(document);
    if (!anchor || !stock) return;

    const ui = await createShadowRootUi<Root>(ctx, {
      name: "optizzz-hunt-launcher",
      position: "inline",
      anchor,
      append: "after",
      onMount(container) {
        const root = createRoot(container);
        const readAt = new Date();
        root.render(
          <HuntLauncher
            origin={location.origin}
            currentField={stock.huntingField}
            ongoing={readOngoingHunts(document, readAt)}
            readAt={readAt}
          />,
        );
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
