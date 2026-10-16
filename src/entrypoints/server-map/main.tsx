import { createRoot } from "react-dom/client";
import { ServerMap } from "@/features/server-map/ServerMap";
import { decodeTarget } from "@/features/server-map/open";
import { loadLastServer } from "@/features/server-map/settings";
import { isEnabled, loadToggles } from "@/features/toggles";
import { closeOnEscapeWhenFramed } from "@/utils/page-dialog-frame";
import "@/theme/theme.css";
import "./style.css";

const query = new URLSearchParams(location.search);
const origin = query.get("server") ?? (await loadLastServer());
const target = decodeTarget(query.get("target"));
const embedded = query.has("embedded");
if (embedded) {
  document.documentElement.classList.add("embedded");
  closeOnEscapeWhenFramed();
}
const toggles = await loadToggles();

function Page() {
  if (!isEnabled(toggles, "server-map")) {
    return (
      <p className="optizzz-server-map server-map optizzz-panel">
        Carte du serveur désactivée : rallumez-la dans « Fonctionnalités ».
      </p>
    );
  }
  if (!origin || !/^https?:\/\/[a-z0-9-]+\.fourmizzz\.fr$/.test(origin)) {
    return (
      <p className="optizzz-server-map server-map optizzz-panel">
        Ouvrez d'abord une page du jeu : la carte prend le serveur du dernier onglet.
      </p>
    );
  }
  return (
    <ServerMap origin={origin} target={target} embedded={embedded} sharing={isEnabled(toggles, "alliance-sharing")} />
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Page />);
