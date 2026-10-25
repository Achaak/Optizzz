import { decryptData, encryptData } from "@optizzz/crypto/data";
import { dataFingerprint } from "@optizzz/crypto/data-fingerprint";
import { fromBase64Url } from "@optizzz/crypto/encoding";
import type { EnvoiCrypto } from "@optizzz/game/site-links/envois";
import type { HandedKey } from "@optizzz/game/site-links/space-bridge";
import { sendNotice, setUpAlerts } from "@/features/alerts/background";
import { loadNotificationSettings } from "@/features/alerts/notification-settings";
import { setUpWatchlist } from "@/features/watchlist/background";
import { isOpenWatchlistMessage, watchlistUrl } from "@/features/watchlist/open";
import { isOpenSimulatorMessage, simulatorUrl } from "@/features/combat-simulator/open";
import { isOpenServerMapMessage, serverMapUrl } from "@/features/server-map/open";
import { loadToggles } from "@/features/toggles";
import { setUpOptizzzAccount } from "@/features/optizzz-account/background";

/**
 * libsodium bound to the versions of a space's Clé d'alliance (ADR 0005, « Donnée d'alliance chiffrée »). Only here
 * and in the extension's pages: the game's scripts never load it (ADR 0007).
 */
function envoiCrypto(keys: HandedKey[]): EnvoiCrypto {
  const keyring = keys.map(({ version, key }) => ({ version, key: fromBase64Url(key) }));
  return {
    encrypt: (text) => encryptData(text, keyring),
    decrypt: (blob) => decryptData(blob, keyring),
    fingerprint: (text) => dataFingerprint(text, keyring),
  };
}

export default defineBackground(() => {
  setUpAlerts();
  setUpWatchlist();
  setUpOptizzzAccount({
    crypto: envoiCrypto,
    // « Un convoi de Pseudo vous arrive à 18 h 12 »: off unless switched on, once per convoy.
    notify: async (notice) => {
      if ((await loadNotificationSettings())["alliance-convoy"]) await sendNotice(notice, { once: true });
    },
  });

  // No answer is sent: the content script only asks for the tab.
  browser.runtime.onMessage.addListener((message: unknown) => {
    // A tool of optizzz.fr (src/utils/site-tool.ts), only while « Liens vers optizzz.fr » is on.
    if (isOpenSiteToolMessage(message)) {
      void loadToggles()
        .then((toggles) =>
          siteLinksEnabled(toggles) ? browser.tabs.create({ url: siteToolMessageUrl(message) }) : null,
        )
        .catch((error: unknown) => {
          console.error("[Optizzz] could not open a tool of optizzz.fr", error);
        });
      return;
    }
    const url = isOpenSimulatorMessage(message)
      ? simulatorUrl(message.server, message.side, { opponent: message.opponent })
      : isOpenServerMapMessage(message)
        ? serverMapUrl(message.origin, message.target)
        : isOpenWatchlistMessage(message)
          ? watchlistUrl(message.origin)
          : null;
    if (!url) return;
    browser.tabs.create({ url }).catch((error: unknown) => {
      console.error("[Optizzz] could not open an extension page", error);
    });
  });
});
