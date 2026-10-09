import { createRoot } from "react-dom/client";
import { CombatSimulator } from "@/features/combat-simulator/CombatSimulator";
import { loadLastServer } from "@/data/garrison";
import { CLOSE_SIMULATOR_MESSAGE } from "@/features/combat-simulator/open";
import "@/theme/theme.css";
import "./style.css";

const query = new URLSearchParams(location.search);
const side = query.get("side") === "defend" ? "defend" : "attack";
const server = query.get("server") ?? (await loadLastServer());
// Framed in the in-game dialog: its keys do not reach the game page, Escape asks the dialog to close.
const embedded = query.has("embedded");
if (embedded) {
  document.documentElement.classList.add("embedded");
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") window.parent.postMessage(CLOSE_SIMULATOR_MESSAGE, "*");
  });
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<CombatSimulator server={server} side={side} embedded={embedded} />);
