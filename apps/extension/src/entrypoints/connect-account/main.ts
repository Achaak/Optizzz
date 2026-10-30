// « Connecter mon Compte Optizzz »: asks for optizzz.fr on the click (optional permission, ADR 0007), registers the
// link script, then goes to the site's page « Connecter l'extension », whose script takes the token.
import { CONNECT_EXTENSION_PATH } from "@optizzz/game/site-links/extension-link";
import { SITE_ORIGIN } from "@/utils/site";
import { requestLink } from "@/data/optizzz-account";
import { syncLinkScript } from "@/features/optizzz-account/link-script";
import { SITE_PERMISSION } from "@/features/optizzz-account/permission";
import { PAGE_BASE_CSS, THEME_CSS } from "@/theme";

const style = document.createElement("style");
style.textContent = `
${THEME_CSS}
${PAGE_BASE_CSS}
.connect { max-width: 560px; margin: 60px auto; padding: var(--optizzz-space-6) 24px; }
.connect ul { padding-left: var(--optizzz-space-6); }`;
document.head.append(style);

const button = document.querySelector<HTMLButtonElement>("#connect");
const result = document.querySelector<HTMLElement>("#result");

async function goToSite(): Promise<void> {
  await syncLinkScript();
  await requestLink(new Date());
  location.assign(`${SITE_ORIGIN}${CONNECT_EXTENSION_PATH}`);
}

// The request must come from the click itself: no await before it.
button?.addEventListener("click", () => {
  browser.permissions.request(SITE_PERMISSION).then(
    (granted) => {
      if (!granted) {
        if (result)
          result.textContent =
            "Refusé : sans l'accès à optizzz.fr, l'extension ne peut pas être liée. Elle marche comme avant, et vous pouvez réessayer.";
        return;
      }
      button.disabled = true;
      if (result) result.textContent = "Ouverture d'optizzz.fr…";
      return goToSite().catch((error: unknown) => {
        console.error("[Optizzz] could not open optizzz.fr", error);
        button.disabled = false;
        if (result) result.textContent = "L'ouverture d'optizzz.fr n'a pas abouti. Réessayez.";
      });
    },
    (error: unknown) => {
      console.error("[Optizzz] the optizzz.fr permission request failed", error);
      if (result) result.textContent = "La demande n'a pas abouti. Réessayez.";
    },
  );
});
