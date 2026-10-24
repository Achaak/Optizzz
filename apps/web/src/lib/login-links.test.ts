import { describe, expect, it } from "vitest";
import { confirmLinkUrl, loginErrorMessage, verifyLinkPath } from "./login-links";

describe("confirmLinkUrl", () => {
  it("points the emailed link at the confirmation page, not at the verification itself", () => {
    expect(confirmLinkUrl("https://optizzz.fr", "abc123")).toBe("https://optizzz.fr/login/confirm?token=abc123");
  });

  it("keeps the token intact whatever it holds", () => {
    expect(confirmLinkUrl("http://localhost:3100/", "a+b/c=")).toBe(
      "http://localhost:3100/login/confirm?token=a%2Bb%2Fc%3D",
    );
  });
});

describe("verifyLinkPath", () => {
  it("verifies the token, then opens the account page, or the login page with the error", () => {
    const url = new URL(verifyLinkPath("abc123"), "https://optizzz.fr");
    expect(url.pathname).toBe("/api/auth/magic-link/verify");
    expect(url.searchParams.get("token")).toBe("abc123");
    expect(url.searchParams.get("callbackURL")).toBe("/account");
    expect(url.searchParams.get("errorCallbackURL")).toBe("/login");
  });
});

describe("loginErrorMessage", () => {
  it("says nothing without an error", () => {
    expect(loginErrorMessage(null)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
  });

  it("explains a used or expired link (Better Auth tells them apart from neither)", () => {
    expect(loginErrorMessage("INVALID_TOKEN")).toBe(
      "Ce lien ne vaut plus : il a déjà servi ou ses 15 minutes sont passées. Demandez-en un nouveau.",
    );
  });

  it("falls back to a generic message for any other error", () => {
    expect(loginErrorMessage("failed_to_create_session")).toBe(
      "La connexion n'a pas abouti. Demandez un nouveau lien.",
    );
  });
});
