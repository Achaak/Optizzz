// Separate script: the history bundles React + ECharts, so it only loads on alliance.php and Membre.php.
import { createRoot, type Root } from "react-dom/client";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { readLoggedInPseudo } from "@/game/pages/alliance";
import type { Scores } from "@/features/history/api";
import { AllianceHistory } from "@/features/history/AllianceHistory";
import { HISTORY_HASH } from "@/features/history/menu";
import { readMembersScores, readProfile } from "@/game/pages/scores";
import { ProfileHistory } from "@/features/history/ProfileHistory";
import { isEnabled, loadToggles, type Toggles } from "@/features/toggles";
import { allianceViewHashes, showsAllianceView } from "@/utils/alliance-views";
import "@/theme/theme.css";
import "@/features/history/style.css";
import { waitForElement } from "@/utils/wait-for-element";

const isHistoryPage = () => location.search === "?Membres" && location.hash === HISTORY_HASH;

// The game fills #alliance over AJAX after load: the view is mounted next to it (never inside)
// and the members table is awaited before reading live scores.
const MEMBERS_TABLE_TIMEOUT_MS = 15_000;

async function mountAllianceView(ctx: ContentScriptContext, toggles: Toggles) {
  if (location.search !== "?Membres") return;
  const allianceContent = document.querySelector<HTMLElement>("#alliance");
  if (!allianceContent) return;

  let liveScores = new Map<string, Partial<Scores>>();
  let liveTime = new Date();
  let root: Root | undefined;
  const render = () =>
    root?.render(
      <AllianceHistory
        origin={location.origin}
        loggedInPseudo={readLoggedInPseudo(document)}
        liveScores={liveScores}
        liveTime={liveTime}
      />,
    );

  const ui = await createShadowRootUi<Root>(ctx, {
    name: "optizzz-history",
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

  // Mounted once, then only shown or hidden: remounting re-creates the chart while
  // its host is not laid out yet, and ECharts then draws nothing.
  const update = () => {
    const visible = isHistoryPage();
    if (visible && !ui.mounted) ui.mount();
    if (ui.mounted) ui.shadowHost.hidden = !visible;
    allianceContent.style.display = showsAllianceView(allianceViewHashes(toggles)) ? "none" : "";
  };
  update();
  ctx.addEventListener(window, "hashchange", update);

  if (await waitForElement("#tabMembresAlliance", MEMBERS_TABLE_TIMEOUT_MS, allianceContent)) {
    liveScores = readMembersScores(document);
    liveTime = new Date();
    render();
  }
}

async function mountProfileBox(ctx: ContentScriptContext, allianceView: boolean) {
  const profile = readProfile(document);
  const anchor = document.querySelector(".boite_membre");
  if (!profile || !anchor) return;
  const liveTime = new Date();

  const ui = await createShadowRootUi<Root>(ctx, {
    name: "optizzz-profile-history",
    position: "inline",
    anchor,
    append: "after",
    onMount(container) {
      const root = createRoot(container);
      root.render(
        <ProfileHistory
          origin={location.origin}
          loggedInPseudo={readLoggedInPseudo(document)}
          profile={profile}
          liveTime={liveTime}
          allianceView={allianceView}
        />,
      );
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  ui.mount();
}

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/alliance.php*", "*://*.fourmizzz.fr/Membre.php*", "*://*.fourmizzz.fr/membre.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const toggles = await loadToggles();
    const allianceView = isEnabled(toggles, "history", "alliance");
    if (location.pathname === "/alliance.php") {
      if (allianceView) await mountAllianceView(ctx, toggles);
    } else if (isEnabled(toggles, "history", "profile")) {
      await mountProfileBox(ctx, allianceView);
    }
  },
});
