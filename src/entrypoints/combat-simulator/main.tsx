import { createRoot } from "react-dom/client";
import { CombatSimulator } from "@/features/combat-simulator/CombatSimulator";
import { decodeOpponent } from "@/features/combat-simulator/form";
import { loadLastServer } from "@/data/garrison";
import { loadCompactNumbers } from "@/features/compact-numbers";
import { closeOnEscapeWhenFramed } from "@/utils/page-dialog-frame";
import "@/theme/theme.css";
import "./style.css";

const query = new URLSearchParams(location.search);
const side = query.get("side") === "defend" ? "defend" : "attack";
const server = query.get("server") ?? (await loadLastServer());
await loadCompactNumbers();
// Framed in the in-game dialog: its keys do not reach the game page, Escape asks the dialog to close.
const embedded = query.has("embedded");
const opponent = decodeOpponent(query.get("opponent"));
if (embedded) {
  document.documentElement.classList.add("embedded");
  closeOnEscapeWhenFramed();
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(<CombatSimulator server={server} side={side} embedded={embedded} opponent={opponent} />);
