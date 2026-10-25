import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  autoIcons: { baseIconPath: "assets/icon.svg", sizes: [128, 96, 48, 32, 16] },
  manifestVersion: 3,
  zip: {
    // The package is @optizzz/extension: keep the store files named optizzz-X.Y.Z-*.zip.
    name: "optizzz",
    // AMO rebuilds from the sources: they include the shared packages of the monorepo.
    sourcesRoot: "../..",
    excludeSources: ["apps/!(extension)/**", "plans/**", "scripts/**", ".claude/**", "coverage/**"],
  },
  manifest: ({ browser }) => ({
    name: "Optizzz",
    description:
      "Outils pour Fourmizzz : heures de fin, ressources, ponte, chasse, combat, flood, convois, alertes et outils d'alliance.",
    // Version comes from package.json (single source of truth for releases).
    // String form: AMO rejects the { email } object form.
    author: "Axel Lavoie",
    homepage_url: "https://github.com/Achaak/Optizzz",
    // unlimitedStorage: the cached exports of a big server (S2: 4 MB of players) fill the 10 MB of storage.local.
    // alarms: the toolbar badge counts down to famine or a full warehouse (Alertes).
    permissions: ["storage", "unlimitedStorage", "alarms"],
    // notifications: asked only when the player switches a notification on (Alertes).
    // scripting and optizzz.fr: asked only on « Connecter mon Compte Optizzz » (ADR 0007), to put the link script on
    // the site's page « Connecter l'extension ». Optional: an update must disable nobody's extension.
    optional_permissions: ["notifications", "scripting"],
    host_permissions: ["*://*.fourmizzz.fr/*"],
    optional_host_permissions: ["https://optizzz.fr/*"],
    // libsodium's WebAssembly, in the background only, for the Envois (ADR 0007, docs/features/site-envois.md):
    // 'wasm-unsafe-eval' lets it compile, nothing else is allowed. Each browser's own default plus this keyword:
    // Chrome's already has it; Firefox's (MV3) does not.
    content_security_policy: {
      extension_pages:
        browser === "firefox"
          ? "script-src 'self' 'wasm-unsafe-eval'; upgrade-insecure-requests;"
          : "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    // The combat simulator and the server map are framed over the game (src/utils/page-dialog.ts). Side effect: the
    // game's pages can tell the extension is installed by loading these pages.
    web_accessible_resources: [
      { resources: ["combat-simulator.html", "server-map.html", "watchlist.html"], matches: ["*://*.fourmizzz.fr/*"] },
    ],
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          // Must never change once published: AMO ties updates to this id.
          id: "optizzz@achaak.github.io",
          // 142: first version honouring data_collection_permissions on Firefox for Android.
          strict_min_version: "142.0",
          // Nothing without an Optizzz account. Linked, on a click: the account's token and the game's pseudo and
          // server, and for an Admin's « Donner l'accès » the Members page list handed to the Alliance Space page in
          // the same browser (src/features/optizzz-account/permission.ts), consented to on « Connecter mon Compte
          // Optizzz ».
          data_collection_permissions: { required: ["none"], optional: ["authenticationInfo", "websiteContent"] },
        },
        gecko_android: { strict_min_version: "142.0" },
      },
    }),
  }),
});
