import { describe, expect, it } from "vitest";
import { magicLinkEmail } from "./magic-link-email";

describe("magicLinkEmail", () => {
  const url = "https://optizzz.fr/login/confirm?token=abc&x=1";

  it("addresses the person, with the link and how long it lasts", () => {
    const email = magicLinkEmail("lea@example.com", url);
    expect(email.to).toBe("lea@example.com");
    expect(email.subject).toBe("Votre lien de connexion à Optizzz");
    expect(email.text).toContain(url);
    expect(email.text).toContain("15 minutes");
    expect(email.text).toContain("ne sert qu'une fois");
  });

  it("escapes the link in the HTML version", () => {
    const email = magicLinkEmail("lea@example.com", url);
    expect(email.html).toContain('href="https://optizzz.fr/login/confirm?token=abc&#38;x=1"');
    expect(email.html).not.toContain("&x=1");
  });

  it("tells whoever did not ask for it to ignore it", () => {
    expect(magicLinkEmail("lea@example.com", url).text).toContain("ignorez cet e-mail");
  });
});
