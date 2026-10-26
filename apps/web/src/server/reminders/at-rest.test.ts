import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openUrl, reminderKey, sealUrl } from "./at-rest";

const KEY = reminderKey(randomBytes(32).toString("base64"));
const SPACE = "0b0e4f4c-1d2e-4a3b-8c4d-5e6f7a8b9c0d";
const URL_OK = "https://discord.com/api/webhooks/123456789012345678/AbC-def_GHI";

describe("the reminders' address at rest", () => {
  it("reads the site's key: 32 bytes in base64 or base64url, nothing else", () => {
    expect(KEY).not.toBeNull();
    expect(reminderKey(randomBytes(32).toString("base64url"))).not.toBeNull();
    expect(reminderKey(undefined)).toBeNull();
    expect(reminderKey("")).toBeNull();
    expect(reminderKey(randomBytes(16).toString("base64"))).toBeNull();
    expect(reminderKey("not base64 at all, but long enough to be 32 bytes once decoded!")).toBeNull();
  });

  it("opens what it sealed, for the same space only", () => {
    if (!KEY) throw new Error("no key");
    const sealed = sealUrl(KEY, SPACE, URL_OK);
    expect(sealed).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain("discord");
    expect(openUrl(KEY, SPACE, sealed)).toBe(URL_OK);
    expect(openUrl(KEY, "another-space", sealed)).toBeNull();
  });

  it("draws a new nonce each time", () => {
    if (!KEY) throw new Error("no key");
    expect(sealUrl(KEY, SPACE, URL_OK)).not.toBe(sealUrl(KEY, SPACE, URL_OK));
  });

  it("refuses another key, a change of a single byte, or an unknown format", () => {
    if (!KEY) throw new Error("no key");
    const other = reminderKey(randomBytes(32).toString("base64"));
    if (!other) throw new Error("no key");
    const sealed = sealUrl(KEY, SPACE, URL_OK);
    expect(openUrl(other, SPACE, sealed)).toBeNull();
    const bytes = Buffer.from(sealed.slice(2), "base64url");
    bytes[20] = (bytes[20] ?? 0) ^ 1;
    expect(openUrl(KEY, SPACE, `1.${bytes.toString("base64url")}`)).toBeNull();
    expect(openUrl(KEY, SPACE, `2.${sealed.slice(2)}`)).toBeNull();
    expect(openUrl(KEY, SPACE, "1.AAAA")).toBeNull();
  });
});
