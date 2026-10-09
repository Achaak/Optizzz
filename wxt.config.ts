import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: { baseIconPath: "assets/icon.svg", sizes: [128, 96, 48, 32, 16] },
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Optizzz",
    description: "Outils pour le jeu Fourmizzz : carte de l'alliance, voisins les plus proches et temps de trajet.",
    // Version comes from package.json (single source of truth for releases).
    // String form: AMO rejects the { email } object form.
    author: "Axel Lavoie",
    homepage_url: "https://github.com/Achaak/Optizzz",
    // unlimitedStorage: the cached exports of a big server (S2: 4 MB of players) fill the 10 MB of storage.local.
    // alarms: the toolbar badge counts down to famine or a full warehouse (Alertes).
    permissions: ["storage", "unlimitedStorage", "alarms"],
    // Asked only when the player switches a notification on (Alertes).
    optional_permissions: ["notifications"],
    host_permissions: ["*://*.fourmizzz.fr/*"],
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          // Must never change once published: AMO ties updates to this id.
          id: "optizzz@achaak.github.io",
          // 142: first version honouring data_collection_permissions on Firefox for Android.
          strict_min_version: "142.0",
          data_collection_permissions: { required: ["none"] },
        },
        gecko_android: { strict_min_version: "142.0" },
      },
    }),
  }),
});
