import { createAllianceKeyring, rotateAllianceKey } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { describe, expect, it } from "vitest";
import { knownByExcluded, lockDiscord, openDiscord, refusalText, staleDiscord, suspensionText } from "./discord";

const URL_OK = "https://discord.com/api/webhooks/1234/tok";

describe("the Discord webhook, in an Admin's browser", () => {
  it("is encrypted with the newest version, and opens again", async () => {
    const keyring = await rotateAllianceKey(await createAllianceKeyring());
    const settings = { url: URL_OK, events: ["convoys" as const], urlSetAtVersion: 2 };
    const blob = await lockDiscord(settings, keyring);
    expect(blob).not.toContain("discord");
    expect(await openDiscord(blob, keyring)).toEqual(settings);
    expect(staleDiscord(blob, 2)).toBe(false);
  });

  it("is to encrypt again after a rotation, and its address known to whoever was excluded since", async () => {
    const before = await createAllianceKeyring();
    const blob = await lockDiscord({ url: URL_OK, events: [], urlSetAtVersion: 1 }, before);
    const after = await rotateAllianceKey(before);
    expect(staleDiscord(blob, 2)).toBe(true);
    const settings = await openDiscord(blob, after);
    expect(knownByExcluded(settings, 2)).toBe(true);
    expect(knownByExcluded({ ...settings, url: null }, 2)).toBe(false);
    expect(knownByExcluded(settings, 1)).toBe(false);
  });

  it("refuses a record that does not hold a Discord webhook", async () => {
    const keyring = await createAllianceKeyring();
    const blob = await encryptData('{"v":1,"url":"https://evil.fr/x","events":[],"urlSetAtVersion":1}', keyring);
    await expect(openDiscord(blob, keyring)).rejects.toThrow();
  });
});

describe("refusalText", () => {
  const at = new Date("2026-10-26T12:00:00Z");

  it("says what Discord answered, when and from whose extension, in words", () => {
    expect(refusalText({ status: 404, at, pseudo: "Bruno" })).toBe(
      "Discord a refusé le dernier message, envoyé depuis l'extension de Bruno le 26/10 à 13 h 00 : ce webhook n'existe plus (supprimé dans Discord ?). Enregistrez une nouvelle adresse.",
    );
    expect(refusalText({ status: 401, at, pseudo: "Bruno" })).toContain("l'adresse du webhook n'est pas valable");
    expect(refusalText({ status: 400, at, pseudo: "Bruno" })).toContain("erreur 400");
  });
});

describe("suspensionText", () => {
  it("says the site's reminders are suspended, since when and why", () => {
    expect(suspensionText({ status: 404, at: new Date("2026-10-26T12:00:00Z") })).toBe(
      "Discord a refusé le dernier rappel du site, le 26/10 à 13 h 00 : ce webhook n'existe plus (supprimé dans Discord ?). Les rappels sont suspendus : enregistrez une nouvelle adresse.",
    );
  });
});
