import { describe, expect, it } from "vitest";
import { discordPermission, SITE_DATA_COLLECTION, sitePermission } from "./permission";

describe("sitePermission", () => {
  it("asks Chrome for optizzz.fr and scripting only: it knows no data_collection", () => {
    expect(sitePermission(false)).toEqual({ origins: ["https://optizzz.fr/*"], permissions: ["scripting"] });
  });

  it("asks Firefox for the consent to send the account's data too, as the manifest declares it optional", () => {
    expect(sitePermission(true)).toEqual({
      origins: ["https://optizzz.fr/*"],
      permissions: ["scripting"],
      data_collection: SITE_DATA_COLLECTION,
    });
    expect(SITE_DATA_COLLECTION).toEqual(["authenticationInfo", "websiteContent"]);
  });
});

describe("discordPermission", () => {
  it("asks for Discord's webhooks only, and on Firefox the consent to send what the game showed", () => {
    expect(discordPermission(false)).toEqual({ origins: ["https://discord.com/api/webhooks/*"] });
    expect(discordPermission(true)).toEqual({
      origins: ["https://discord.com/api/webhooks/*"],
      data_collection: ["websiteContent"],
    });
  });
});
