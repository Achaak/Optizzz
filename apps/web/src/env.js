import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Production outside a Vercel preview (`next build`, `next start`, Vercel Production): the magic links need the site's
// fixed address, never one read from the request (src/server/site-origin.ts).
const needsSiteUrl = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

// Checked at build and start: set SKIP_ENV_VALIDATION to build without them (CI).
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    /** Secret of the revalidation route, called by the cron once the exports are stored. */
    REVALIDATE_SECRET: z.string().min(16),
    /** Signs the session cookies of Optizzz accounts (Better Auth). */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** The site's address, for the magic links (https://optizzz.fr). Required in production, except Vercel previews. */
    BETTER_AUTH_URL: needsSiteUrl ? z.url() : z.url().optional(),
    /** Set by Vercel: « production », « preview » or « development ». A preview's links use its VERCEL_URL. */
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    VERCEL_URL: z.string().optional(),
    /** The dev server's port, for the magic links without BETTER_AUTH_URL (http://localhost:3000 by default). */
    PORT: z.string().optional(),
    /** Brevo, the email provider: optional until real sending is set up; unset, the link goes to the server console. */
    BREVO_API_KEY: z.string().optional(),
    /** The sender of the emails, on a domain verified in Brevo (connexion@optizzz.fr). */
    EMAIL_FROM: z.email().optional(),
    /**
     * Encrypts the address of the site's Discord reminders at rest (src/server/reminders/at-rest.ts): 32 bytes in
     * base64, `openssl rand -base64 32`. Optional: unset or malformed, the reminders stay off and the Admins read so.
     */
    DISCORD_REMINDERS_KEY: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    /**
     * The AdSense publisher (« ca-pub-1234567890123456 ») and its responsive display unit (« 1234567890 »): both set,
     * the public pages show ads without tracking (src/lib/ads.ts); unset (dev, previews), no ad and no Google script.
     */
    NEXT_PUBLIC_ADSENSE_CLIENT: z
      .string()
      .regex(/^ca-pub-\d{10,20}$/)
      .optional(),
    NEXT_PUBLIC_ADSENSE_SLOT: z
      .string()
      .regex(/^\d{6,20}$/)
      .optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    PORT: process.env.PORT,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    DISCORD_REMINDERS_KEY: process.env.DISCORD_REMINDERS_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOT: process.env.NEXT_PUBLIC_ADSENSE_SLOT,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
