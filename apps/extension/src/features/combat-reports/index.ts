import type { Feature } from "../feature";
import { readCombatConversation } from "@optizzz/game/pages/combat-reports";
import { simulatorDialog } from "../combat-simulator/dialog";
import { COMBAT_REPORT_STYLE, mountCombatReport } from "./mount";

/** The conversation's header row, a few rows above its detail. */
function headerOf(conversation: Element): Element | null {
  let row = conversation.previousElementSibling;
  while (row && !row.classList.contains("en_tete_message")) row = row.previousElementSibling;
  return row;
}

const combatConversations = () =>
  [...document.querySelectorAll("tr.contenu_conversation")].filter(
    (conversation) => headerOf(conversation)?.getAttribute("data-type") === "Combats",
  );

/**
 * Table of the attacks of each « Combats » conversation the player opens, with what was taken and a way to fight
 * the army seen again in the simulator. See docs/features/combat-reports.md.
 */
export const combatReports: Feature = {
  id: "combat-reports",
  toggle: "combat-reports",
  matches: (url) => url.pathname.toLowerCase() === "/messagerie.php",
  run(ctx) {
    const style = document.createElement("style");
    style.textContent = COMBAT_REPORT_STYLE;
    document.head.append(style);

    const dialog = simulatorDialog(ctx);
    const input = {
      loots: () => combatConversations().flatMap((conversation) => readCombatConversation(conversation).loots),
      simulate: (opponent: string) => {
        dialog.open(opponent).catch((error: unknown) => {
          console.error("[Optizzz] combat simulator dialog failed", error);
        });
      },
    };
    const mounted = new WeakMap<Element, ReturnType<typeof mountCombatReport>>();
    const scan = () => {
      for (const conversation of combatConversations()) {
        const known = mounted.get(conversation);
        // Another conversation opened may hold the loot of this one's attack.
        if (known) known.update();
        else mounted.set(conversation, mountCombatReport(conversation, input));
      }
    };

    // The game loads each conversation over AJAX when its title is clicked. The report's own changes are skipped.
    const observer = new MutationObserver((records) => {
      const outside = records.some(
        (record) => !(record.target instanceof Element && record.target.closest(".optizzz-combat-report")),
      );
      if (outside) scan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    scan();
  },
};
