import { describe, expect, it, vi } from "vitest";
import { createEmailSender, type Email } from "./send-email";

const email: Email = { to: "lea@example.com", subject: "Sujet", text: "Texte", html: "<p>Texte</p>" };

describe("createEmailSender", () => {
  it("writes the email to the server console when no provider is set, outside production", async () => {
    const log = vi.fn();
    const fetch = vi.fn();
    await createEmailSender({ nodeEnv: "development", log, fetch })(email);
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("lea@example.com"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Texte"));
  });

  it("refuses to send in production without a provider: a link in the logs would open the account", async () => {
    const log = vi.fn();
    await expect(createEmailSender({ nodeEnv: "production", log, fetch: vi.fn() })(email)).rejects.toThrow(
      /BREVO_API_KEY/,
    );
    expect(log).not.toHaveBeenCalled();
  });

  it("sends through Brevo's transactional API when its key and sender are set", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    await createEmailSender({
      nodeEnv: "production",
      brevoApiKey: "key",
      from: "connexion@optizzz.fr",
      log: vi.fn(),
      fetch,
    })(email);
    expect(fetch).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": "key", "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Optizzz", email: "connexion@optizzz.fr" },
        to: [{ email: "lea@example.com" }],
        subject: "Sujet",
        textContent: "Texte",
        htmlContent: "<p>Texte</p>",
      }),
    });
  });

  it("fails when Brevo refuses the email", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    const send = createEmailSender({
      nodeEnv: "production",
      brevoApiKey: "key",
      from: "connexion@optizzz.fr",
      log: vi.fn(),
      fetch,
    });
    await expect(send(email)).rejects.toThrow(/401/);
  });
});
