// Separate script: the statistics bundle React + ECharts, so they only load on alliance.php and the alliances' pages.
import { createRoot, type Root } from "react-dom/client";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { AllianceBox } from "@/features/alliance-stats/AllianceBox";
import { AllianceStats } from "@/features/alliance-stats/AllianceStats";
import { STATS_HASH } from "@/features/alliance-stats/menu";
import type { Scores } from "@/features/history/api";
import { isEnabled, loadToggles, type Toggles } from "@/features/toggles";
import { readAllianceTag, readLoggedInPseudo } from "@/game/pages/alliance";
import { findAllianceRankingTable, readAllianceRanking, type AllianceRanking } from "@/game/pages/alliance-ranking";
import { readStock } from "@/game/pages/resources";
import { readMembersScores } from "@/game/pages/scores";
import { allianceViewHashes, showsAllianceView } from "@/utils/alliance-views";
import { fetchGamePage } from "@/utils/game-page";
import "@/theme/theme.css";
import "@/utils/history-chart/style.css";
import "@/features/alliance-stats/style.css";
import { waitForElement } from "@/utils/wait-for-element";

const isStatsPage = () => location.search === "?Membres" && location.hash === STATS_HASH;

// The game fills #alliance over AJAX after load: the view is mounted next to it (never inside)
// and the members table is awaited before reading live scores.
const MEMBERS_TABLE_TIMEOUT_MS = 15_000;

/** My alliance's public page: its live totals and the game's ranks; null when it cannot be read. */
async function readMyRanking(tag: string): Promise<AllianceRanking | null> {
  try {
    const page = await fetchGamePage(`${location.origin}/classementAlliance.php?alliance=${encodeURIComponent(tag)}`);
    return page && readAllianceRanking(page);
  } catch (error) {
    console.warn("[Optizzz] alliance stats: the alliance page could not be read", error);
    return null;
  }
}

async function mountStatsView(ctx: ContentScriptContext, toggles: Toggles) {
  if (location.search !== "?Membres") return;
  const allianceContent = document.querySelector<HTMLElement>("#alliance");
  if (!allianceContent) return;
  const myTag = readAllianceTag(document);

  let members = new Map<string, Partial<Scores>>();
  let ranking: AllianceRanking | null | undefined;
  let liveTime = new Date();
  let root: Root | undefined;
  const render = () =>
    root?.render(
      <AllianceStats
        origin={location.origin}
        myTag={myTag}
        loggedInPseudo={readLoggedInPseudo(document)}
        myWorkers={readStock(document)?.workers ?? null}
        members={members}
        liveTime={liveTime}
        ranking={ranking}
        membersView={isEnabled(toggles, "history", "alliance")}
      />,
    );

  const ui = await createShadowRootUi<Root>(ctx, {
    name: "optizzz-alliance-stats",
    position: "inline",
    anchor: allianceContent,
    append: "before",
    onMount(container) {
      root = createRoot(container);
      render();
      // Read when the view is first opened, never in the background.
      if (myTag)
        void readMyRanking(myTag).then((read) => {
          ranking = read;
          liveTime = new Date();
          render();
        });
      else ranking = null;
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
    const visible = isStatsPage();
    if (visible && !ui.mounted) ui.mount();
    if (ui.mounted) ui.shadowHost.hidden = !visible;
    allianceContent.style.display = showsAllianceView(allianceViewHashes(toggles)) ? "none" : "";
  };
  update();
  ctx.addEventListener(window, "hashchange", update);

  if (await waitForElement("#tabMembresAlliance", MEMBERS_TABLE_TIMEOUT_MS, allianceContent)) {
    members = readMembersScores(document);
    render();
  }
}

async function mountAllianceBox(ctx: ContentScriptContext, statsView: boolean) {
  const tag = new URLSearchParams(location.search).get("alliance");
  const ranking = readAllianceRanking(document);
  const anchor = findAllianceRankingTable(document);
  // An unknown tag shows an empty page: no box.
  if (!tag || !ranking || !anchor) return;
  const liveTime = new Date();

  const ui = await createShadowRootUi<Root>(ctx, {
    name: "optizzz-alliance-box",
    position: "inline",
    anchor,
    append: "after",
    onMount(container) {
      const root = createRoot(container);
      root.render(
        <AllianceBox
          origin={location.origin}
          tag={tag}
          ranking={ranking}
          liveTime={liveTime}
          myTag={readAllianceTag(document)}
          statsView={statsView}
        />,
      );
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });
  ui.mount();
}

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/alliance.php*", "*://*.fourmizzz.fr/classementAlliance.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const toggles = await loadToggles();
    const statsView = isEnabled(toggles, "alliance-stats", "alliance");
    if (location.pathname === "/alliance.php") {
      if (statsView) await mountStatsView(ctx, toggles);
    } else if (isEnabled(toggles, "alliance-stats", "page")) {
      await mountAllianceBox(ctx, statsView);
    }
  },
});
