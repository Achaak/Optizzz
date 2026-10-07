import { defineConfig } from "wxt";

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Optizzz",
    description: "Outils d'aide pour Fourmizzz.",
    host_permissions: ["*://*.fourmizzz.fr/*"],
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          id: "optizzz@axel-lavoie",
          data_collection_permissions: { required: ["none"] },
        },
      },
    }),
  }),
});
