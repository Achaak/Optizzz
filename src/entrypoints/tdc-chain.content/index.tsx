// Separate script: the chain bundles React, so it only loads on alliance.php.
import { createRoot, type Root } from "react-dom/client";
import { readLoggedInPseudo, readMembersHuntingField } from "@/game/pages/alliance";
import { CHAIN_HASH } from "@/features/tdc-chain/menu";
import { TdcChain } from "@/features/tdc-chain/TdcChain";
import { isEnabled, loadToggles } from "@/features/toggles";
import { allianceViewHashes, showsAllianceView } from "@/utils/alliance-views";
import "@/theme/theme.css";
import "@/features/tdc-chain/style.css";
import { waitForElement } from "@/utils/wait-for-element";

const isChainPage = () => location.search === "?Membres" && location.hash === CHAIN_HASH;

// The game fills #alliance over AJAX after load: the view is mounted next to it (never inside)
// and the members table is awaited before reading live fields.
const MEMBERS_TABLE_TIMEOUT_MS = 15_000;

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/alliance.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const toggles = await loadToggles();
    if (!isEnabled(toggles, "tdc-chain")) return;
    if (location.search !== "?Membres") return;
    const allianceContent = document.querySelector<HTMLElement>("#alliance");
    if (!allianceContent) return;

    let liveHuntingFields = new Map<string, number>();
    let root: Root | undefined;
    const render = () =>
      root?.render(
        <TdcChain
          origin={location.origin}
          loggedInPseudo={readLoggedInPseudo(document)}
          liveHuntingFields={liveHuntingFields}
          sharing={isEnabled(toggles, "alliance-sharing")}
        />,
      );

    const ui = await createShadowRootUi<Root>(ctx, {
      name: "optizzz-tdc-chain",
      position: "inline",
      anchor: allianceContent,
      append: "before",
      onMount(container) {
        root = createRoot(container);
        render();
        return root;
      },
      onRemove: (mounted) => {
        mounted?.unmount();
        root = undefined;
      },
    });

    const update = () => {
      const visible = isChainPage();
      if (visible && !ui.mounted) ui.mount();
      if (ui.mounted) ui.shadowHost.hidden = !visible;
      allianceContent.style.display = showsAllianceView(allianceViewHashes(toggles)) ? "none" : "";
    };
    update();
    ctx.addEventListener(window, "hashchange", update);

    if (await waitForElement("#tabMembresAlliance", MEMBERS_TABLE_TIMEOUT_MS, allianceContent)) {
      liveHuntingFields = readMembersHuntingField(document);
      render();
    }
  },
});
