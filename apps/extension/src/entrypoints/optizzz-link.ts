// The link script: registered at runtime (features/optizzz-account/link-script.ts) once optizzz.fr is granted, and only
// on its page « Connecter l'extension ». Not in the manifest, which would make optizzz.fr a required permission.
import { linkPageBrowser, runLinkPage } from "@/features/optizzz-account/link-page";

export default defineUnlistedScript(() => {
  runLinkPage({
    doc: document,
    origin: location.origin,
    send: (message) => browser.runtime.sendMessage(message),
    fetch: (url, init) => fetch(url, init),
    browser: linkPageBrowser(),
  }).catch((error: unknown) => {
    console.error("[Optizzz] linking the extension failed", error);
  });
});
