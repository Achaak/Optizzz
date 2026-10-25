// The space script: registered at runtime (features/optizzz-account/link-script.ts) once optizzz.fr is granted, and only
// on the pages of the Alliance Spaces. It hands « Donner l'accès » the last list of the game's Members page.
import { runSpacePage } from "@/features/optizzz-account/space-page";

export default defineUnlistedScript(() => {
  runSpacePage({ win: window, send: (message) => browser.runtime.sendMessage(message) });
});
