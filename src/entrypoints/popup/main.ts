import { ABOUT_STYLE, buildAboutSection } from "@/features/settings/about-section";

const style = document.createElement("style");
style.textContent = `
body { margin: 0; background: #f7ecc6; }
.popup { width: 280px; padding: 12px 16px; font-family: Verdana, Arial, sans-serif; font-size: 12px; color: #222; }
${ABOUT_STYLE}`;
document.head.append(style);

const popup = document.createElement("main");
popup.className = "popup";
popup.append(buildAboutSection(document, browser.runtime.getManifest().version, navigator.userAgent));
document.body.append(popup);
