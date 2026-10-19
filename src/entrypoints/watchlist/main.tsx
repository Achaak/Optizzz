import { createRoot } from "react-dom/client";
import { Watchlist } from "@/features/watchlist/Watchlist";
import { applyCompactNumbers } from "@/features/compact-numbers";
import { isEnabled, loadToggles } from "@/features/toggles";
import { closeOnEscapeWhenFramed } from "@/utils/page-dialog-frame";
import "@/theme/theme.css";
import "./style.css";

const query = new URLSearchParams(location.search);
const origin = query.get("server");
if (query.has("embedded")) {
  document.documentElement.classList.add("embedded");
  closeOnEscapeWhenFramed();
}
const toggles = await loadToggles();
applyCompactNumbers(toggles);

function Page() {
  if (!isEnabled(toggles, "watchlist"))
    return <p className="watchlist optizzz-panel">Suivis désactivés : rallumez-les dans « Fonctionnalités ».</p>;
  if (!origin || !/^https?:\/\/[a-z0-9-]+\.fourmizzz\.fr$/.test(origin))
    return <p className="watchlist optizzz-panel">Ouvrez les Suivis depuis une page du jeu.</p>;
  return <Watchlist origin={origin} />;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Page />);
