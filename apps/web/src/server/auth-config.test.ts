import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it, vi } from "vitest";
import { createAuth } from "./auth-config";
import type { Email } from "./email/send-email";

describe("createAuth", () => {
  it("builds the emailed link from the site's address, whatever Host the request claims", async () => {
    const sendEmail = vi.fn<(email: Email) => Promise<void>>().mockResolvedValue(undefined);
    const auth = createAuth({
      baseURL: "https://optizzz.fr",
      secret: "a-test-secret-of-at-least-thirty-two-characters",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      sendEmail,
    });

    // Someone asks a link for another person's email, through a forged Host and proxy headers.
    const response = await auth.handler(
      new Request("https://evil.example/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "evil.example",
          "x-forwarded-host": "evil.example",
          "x-forwarded-proto": "https",
          origin: "https://optizzz.fr",
        },
        body: JSON.stringify({ email: "lea@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    const email = sendEmail.mock.calls[0]?.[0];
    expect(email?.to).toBe("lea@example.com");
    expect(email?.text).toMatch(/https:\/\/optizzz\.fr\/login\/confirm\?token=\w+/);
    expect(email?.text).not.toContain("evil.example");
  });
});
