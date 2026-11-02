import { describe, expect, it } from "vitest";
import { isAdmin, parseAdminEmails } from "./admin-emails";

describe("the back office's admins", () => {
  it("reads a comma-separated list, whatever the case and the spaces", () => {
    expect([...parseAdminEmails(" Axel@Example.fr, ,b@example.fr ")]).toEqual(["axel@example.fr", "b@example.fr"]);
  });

  it("lets nobody in when ADMIN_EMAILS is unset or empty", () => {
    expect(isAdmin(parseAdminEmails(undefined), { email: "", emailVerified: true })).toBe(false);
    expect(isAdmin(parseAdminEmails(""), { email: "a@example.fr", emailVerified: true })).toBe(false);
  });

  it("needs a listed and verified address", () => {
    const admins = parseAdminEmails("a@example.fr");
    expect(isAdmin(admins, { email: "A@example.fr", emailVerified: true })).toBe(true);
    expect(isAdmin(admins, { email: "a@example.fr", emailVerified: false })).toBe(false);
    expect(isAdmin(admins, { email: "b@example.fr", emailVerified: true })).toBe(false);
  });
});
