import { createRoot } from "react-dom/client";
import { CombatSimulator } from "@/features/combat-simulator/CombatSimulator";
import { loadLastServer } from "@/data/garrison";
import "@/theme/theme.css";
import "./style.css";

const query = new URLSearchParams(location.search);
const side = query.get("side") === "defend" ? "defend" : "attack";
const server = query.get("server") ?? (await loadLastServer());

const root = document.getElementById("root");
if (root) createRoot(root).render(<CombatSimulator server={server} side={side} />);
