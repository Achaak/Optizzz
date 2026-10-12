// Separate script at document_start: the look must be on before the page is drawn, not after the features.
// Listed in the manifest (cssInjectionMode "manifest"): injected before the page is drawn.
import "@/features/game-look/style.css";
import "@/features/game-look/icons.css";

/** On <html>: every rule of the look is scoped under it, to outweigh the game's selectors (design7.css). */
const LOOK_CLASS = "optizzz-game-look";

export default defineContentScript({
  matches: ["*://*.fourmizzz.fr/*"],
  runAt: "document_start",
  main() {
    document.documentElement.classList.add(LOOK_CLASS);
  },
});
