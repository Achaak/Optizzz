import { GAME_ACCESS_PERMISSION, hasGameAccess } from "@/features/game-access/permission";
import { PAGE_BASE_CSS, THEME_CSS } from "@/theme";

const style = document.createElement("style");
style.textContent = `
${THEME_CSS}
${PAGE_BASE_CSS}
.grant { max-width: 520px; margin: 60px auto; padding: var(--optizzz-space-6) 24px; }`;
document.head.append(style);

const button = document.querySelector<HTMLButtonElement>("#grant");
const result = document.querySelector<HTMLElement>("#result");

const show = (granted: boolean) => {
  if (!result || !button) return;
  button.hidden = granted;
  result.textContent = granted
    ? "Optizzz est autorisé sur fourmizzz.fr. Rechargez vos onglets du jeu ; vous pouvez fermer celui-ci."
    : "Refusé : Optizzz ne s'activera sur le jeu qu'après un clic sur son bouton. Vous pouvez réessayer.";
};

if (await hasGameAccess()) show(true);

// The request must come from the click itself: no await before it.
button?.addEventListener("click", () => {
  browser.permissions.request(GAME_ACCESS_PERMISSION).then(show, (error: unknown) => {
    console.error("[Optizzz] the request for the game's pages failed", error);
    show(false);
  });
});
