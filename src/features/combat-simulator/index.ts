import type { Feature } from "../feature";
import { storeLevels } from "../game-levels/levels";
import { readGarrison, storeGarrison } from "./garrison";
import { requestSimulator } from "./open";

const STYLE = `.optizzz-simulate { margin: 8px 0; font: inherit; font-weight: bold; cursor: pointer; }`;

/**
 * On Armee.php: remembers the army by place (and the dome and lodge levels) for the combat simulator, and adds a
 * button that opens it. See docs/features/combat-simulator.md.
 */
export const combatSimulator: Feature = {
  id: "combat-simulator",
  toggle: "combat-simulator",
  matches: (url) => url.pathname.toLowerCase() === "/armee.php",
  async run() {
    const garrison = readGarrison(document);
    if (!garrison) return;
    await storeGarrison(location.origin, garrison, new Date());
    await storeLevels(location.origin, { dome: garrison.dome, lodge: garrison.lodge });

    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "optizzz-simulate";
    button.textContent = "⚔ Simuler un combat avec cette armée";
    button.addEventListener("click", () => {
      requestSimulator(location.host, "attack").catch((error: unknown) => {
        console.error("[Optizzz] could not open the combat simulator", error);
      });
    });
    const table = [...document.querySelectorAll("table.simulateur")].find((candidate) =>
      candidate.textContent.includes("Troupes en Garnison"),
    );
    table?.before(button);
  },
};
