import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Checked at build and start: set SKIP_ENV_VALIDATION to build without them (CI).
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    /** Secret of the revalidation route, called by the cron once the exports are stored. */
    REVALIDATE_SECRET: z.string().min(16),
    /** Signs the session cookies of Optizzz accounts (Better Auth). */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** The site's address, for the magic links (https://optizzz.fr); unset, Better Auth reads it from the request. */
    BETTER_AUTH_URL: z.url().optional(),
    /** Brevo, the email provider: optional until real sending is set up; unset, the link goes to the server console. */
    BREVO_API_KEY: z.string().optional(),
    /** The sender of the emails, on a domain verified in Brevo (connexion@optizzz.fr). */
    EMAIL_FROM: z.email().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
