// « Autoriser Discord » (docs/features/site-discord.md): asks for https://discord.com/api/webhooks/* on the click, an
// optional permission never asked at install. Only an extension page may ask, and Firefox's popup would close.
import { DISCORD_PERMISSION } from "@/features/optizzz-account/permission";
import { PAGE_BASE_CSS, THEME_CSS } from "@/theme";

const style = document.createElement("style");
style.textContent = `
${THEME_CSS}
${PAGE_BASE_CSS}
.grant { max-width: 560px; margin: 60px auto; padding: var(--optizzz-space-6) 24px; }
.grant ul { padding-left: var(--optizzz-space-6); }`;
document.head.append(style);

const button = document.querySelector<HTMLButtonElement>("#grant");
const result = document.querySelector<HTMLElement>("#result");

const show = (granted: boolean) => {
  if (!result || !button) return;
  button.hidden = granted;
  result.textContent = granted
    ? "Discord autorisé : vos prochains convois y seront annoncés. Vous pouvez fermer cet onglet."
    : "Refusé : rien n'est annoncé sur Discord, le reste de l'extension marche comme avant. Vous pouvez réessayer.";
};

if (await browser.permissions.contains(DISCORD_PERMISSION)) show(true);

// The request must come from the click itself: no await before it.
button?.addEventListener("click", () => {
  browser.permissions.request(DISCORD_PERMISSION).then(show, (error: unknown) => {
    console.error("[Optizzz] the Discord permission request failed", error);
    show(false);
  });
});
