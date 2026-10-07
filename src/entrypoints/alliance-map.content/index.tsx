// Separate script: the map bundles React + ECharts, so it only loads on alliance.php.
import { createRoot, type Root } from "react-dom/client";
import { AllianceMap } from "@/features/alliance-map/AllianceMap";
import { readLoggedInPseudo, readMembersHuntingField } from "@/features/alliance-map/pages";
import { isFeatureEnabled } from "@/features/toggles";
import "@/features/alliance-map/style.css";
import { waitForElement } from "@/utils/wait-for-element";

const isMapPage = () => location.search === "?Membres" && location.hash === "#carte";

// The game fills #alliance over AJAX after load, replacing its content: the map is mounted
// next to it (never inside) and the members table is awaited before reading live fields.
const MEMBERS_TABLE_TIMEOUT_MS = 15_000;

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/alliance.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    if (!(await isFeatureEnabled("alliance-map"))) return;
    if (location.search !== "?Membres") return;
    const allianceContent = document.querySelector<HTMLElement>("#alliance");
    if (!allianceContent) return;

    let liveHuntingFields = new Map<string, number>();
    let root: Root | undefined;
    const renderMap = () =>
      root?.render(
        <AllianceMap
          origin={location.origin}
          loggedInPseudo={readLoggedInPseudo(document)}
          liveHuntingFields={liveHuntingFields}
        />,
      );

    const ui = await createShadowRootUi<Root>(ctx, {
      name: "optizzz-alliance-map",
      position: "inline",
      anchor: allianceContent,
      append: "before",
      onMount(container) {
        root = createRoot(container);
        renderMap();
        return root;
      },
      onRemove: (mounted) => {
        mounted?.unmount();
        root = undefined;
      },
    });

    // Mounted once, then only shown or hidden: remounting re-creates the chart while
    // its host is not laid out yet, and ECharts then draws nothing.
    const update = () => {
      const visible = isMapPage();
      if (visible && !ui.mounted) ui.mount();
      ui.shadowHost.style.display = visible ? "" : "none";
      allianceContent.style.display = visible ? "none" : "";
    };
    update();
    ctx.addEventListener(window, "hashchange", update);

    if (await waitForElement("#tabMembresAlliance", MEMBERS_TABLE_TIMEOUT_MS, allianceContent)) {
      liveHuntingFields = readMembersHuntingField(document);
      renderMap();
    }
  },
});
