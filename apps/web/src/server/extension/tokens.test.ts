import { describe, expect, it } from "vitest";
import { bearerToken, browserLabel, hashToken, newExtensionToken } from "./tokens";

describe("newExtensionToken", () => {
  it("gives 32 random bytes and keeps only their SHA-256", () => {
    const { token, hash } = newExtensionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
    expect(newExtensionToken().token).not.toBe(token);
  });
});

describe("bearerToken", () => {
  const { token } = newExtensionToken();

  it("reads the token of an Authorization header", () => {
    expect(bearerToken(`Bearer ${token}`)).toBe(token);
  });

  it("refuses anything that cannot be one of our tokens", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken(token)).toBeNull();
    expect(bearerToken(`Basic ${token}`)).toBeNull();
    expect(bearerToken("Bearer short")).toBeNull();
    expect(bearerToken(`Bearer ${token}x`)).toBeNull();
  });
});

describe("browserLabel", () => {
  it("keeps a known browser and names anything else « Navigateur »", () => {
    expect(browserLabel("Firefox")).toBe("Firefox");
    expect(browserLabel("<script>")).toBe("Navigateur");
    expect(browserLabel(undefined)).toBe("Navigateur");
  });
});
