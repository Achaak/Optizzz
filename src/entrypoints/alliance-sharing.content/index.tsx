// Separate script: the sharing views bundle React, so they only load on fourmiliere.php (« Mon état ») and alliance.php
// (« Partage »).
import { createRoot, type Root } from "react-dom/client";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { AllianceSharing } from "@/features/alliance-sharing/AllianceSharing";
import { MY_STATE_HASH, SHARING_HASH } from "@/features/alliance-sharing/menu";
import { MyState } from "@/features/alliance-sharing/MyState";
import { isEnabled, loadToggles, type Toggles } from "@/features/toggles";
import { readAllianceTag, readLoggedInPseudo, readMembersHuntingField } from "@/game/pages/alliance";
import { allianceViewHashes, showsAllianceView } from "@/utils/alliance-views";
import "@/theme/theme.css";
import "@/features/alliance-sharing/style.css";
import { waitForElement } from "@/utils/wait-for-element";

// The game fills #alliance over AJAX after load: the view is mounted next to it (never inside)
// and the members table is awaited before reading the nicknames.
const MEMBERS_TABLE_TIMEOUT_MS = 15_000;

const server = () => location.host.split(".")[0] ?? location.host;

/** « Mon état » on fourmiliere.php#etat, in place of the colony picture while the hash is there. */
async function mountMyState(ctx: ContentScriptContext) {
  const picture = document.querySelector<HTMLElement>("#centre > center");
  if (!picture) return;
  const pseudo = readLoggedInPseudo(document);
  const alliance = readAllianceTag(document);
  const me = pseudo && alliance ? { server: server(), alliance, pseudo } : null;

  const ui = await createShadowRootUi<Root>(ctx, {
    name: "optizzz-my-state",
    position: "inline",
    anchor: picture,
    append: "before",
    onMount(container) {
      const root = createRoot(container);
      root.render(<MyState origin={location.origin} me={me} />);
      return root;
    },
    onRemove: (root) => root?.unmount(),
  });

  const update = () => {
    const visible = location.hash === MY_STATE_HASH;
    if (visible && !ui.mounted) ui.mount();
    if (ui.mounted) ui.shadowHost.hidden = !visible;
    picture.style.display = visible ? "none" : "";
  };
  update();
  ctx.addEventListener(window, "hashchange", update);
}

/** « Partage » on alliance.php?Membres#partage, in place of the members table. */
async function mountAllianceSharing(ctx: ContentScriptContext, toggles: Toggles) {
  if (location.search !== "?Membres") return;
  const allianceContent = document.querySelector<HTMLElement>("#alliance");
  if (!allianceContent) return;
  const alliance = readAllianceTag(document);

  let members: string[] | null = null;
  let root: Root | undefined;
  const render = () => root?.render(<AllianceSharing origin={location.origin} alliance={alliance} members={members} />);

  const ui = await createShadowRootUi<Root>(ctx, {
    name: "optizzz-alliance-sharing",
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
    const visible = location.hash === SHARING_HASH;
    if (visible && !ui.mounted) ui.mount();
    if (ui.mounted) ui.shadowHost.hidden = !visible;
    allianceContent.style.display = showsAllianceView(allianceViewHashes(toggles)) ? "none" : "";
  };
  update();
  ctx.addEventListener(window, "hashchange", update);

  if (await waitForElement("#tabMembresAlliance", MEMBERS_TABLE_TIMEOUT_MS, allianceContent)) {
    members = [...readMembersHuntingField(document).keys()];
    render();
  }
}

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/fourmiliere.php*", "*://*.fourmizzz.fr/alliance.php*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const toggles = await loadToggles();
    if (!isEnabled(toggles, "alliance-sharing")) return;
    if (location.pathname.toLowerCase() === "/fourmiliere.php") await mountMyState(ctx);
    else await mountAllianceSharing(ctx, toggles);
  },
});
