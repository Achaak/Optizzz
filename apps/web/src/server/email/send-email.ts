// Sending the site's emails. Brevo (docs/features/site-comptes-espaces.md) once its key is set; without it, outside
// production, the email goes to the server console so the magic link can be opened locally.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendEmail = (email: Email) => Promise<void>;

interface SenderOptions {
  nodeEnv: "development" | "test" | "production";
  /** Brevo's API key; unset, no email leaves the server. */
  brevoApiKey?: string;
  /** The sender address, on a domain verified in Brevo. */
  from?: string;
  log: (message: string) => void;
  fetch: typeof fetch;
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export function createEmailSender({ nodeEnv, brevoApiKey, from, log, fetch }: SenderOptions): SendEmail {
  if (!brevoApiKey || !from) {
    return (email) => {
      // In production, a magic link in the logs would let whoever reads them into the account.
      if (nodeEnv === "production")
        return Promise.reject(new Error("No email provider: set BREVO_API_KEY and EMAIL_FROM"));
      log(`\n── Email to ${email.to} ── ${email.subject}\n${email.text}`);
      return Promise.resolve();
    };
  }
  return async (email) => {
    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": brevoApiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "Optizzz", email: from },
        to: [{ email: email.to }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    if (!response.ok) throw new Error(`Brevo refused the email: ${String(response.status)}`);
  };
}
