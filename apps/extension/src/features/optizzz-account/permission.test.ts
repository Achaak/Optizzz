import { describe, expect, it } from "vitest";
import { SITE_DATA_COLLECTION, sitePermission } from "./permission";

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
