import { NOTIFICATIONS_PERMISSION } from "@/features/alerts/permission";
import { PAGE_BASE_CSS, THEME_CSS } from "@/theme";

const style = document.createElement("style");
style.textContent = `
${THEME_CSS}
${PAGE_BASE_CSS}
.grant { max-width: 520px; margin: 60px auto; padding: 16px 24px; background: var(--optizzz-surface-raised);
  border: 2px solid var(--optizzz-border); border-radius: var(--optizzz-radius); }
h1 { margin: 0 0 12px; font-size: 18px; font-style: italic; color: var(--optizzz-title); }
button { font: inherit; font-weight: bold; cursor: pointer; }`;
document.head.append(style);

const button = document.querySelector<HTMLButtonElement>("#grant");
const result = document.querySelector<HTMLElement>("#result");

const show = (granted: boolean) => {
  if (!result || !button) return;
  button.hidden = granted;
  result.textContent = granted
    ? "Notifications autorisées. Vous pouvez fermer cet onglet."
    : "Refusé : les notifications cochées ne s'afficheront pas. Vous pouvez réessayer.";
};

if (await browser.permissions.contains(NOTIFICATIONS_PERMISSION)) show(true);

// The request must come from the click itself: no await before it.
button?.addEventListener("click", () => {
  browser.permissions.request(NOTIFICATIONS_PERMISSION).then(
    (granted) => {
      show(granted);
      if (granted) setTimeout(() => window.close(), 1500);
    },
    (error: unknown) => {
      console.error("[Optizzz] the notifications permission request failed", error);
      show(false);
    },
  );
});
