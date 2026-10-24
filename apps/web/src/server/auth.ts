// Optizzz accounts: Better Auth with its magic link (docs/adr/0007, docs/features/site-comptes-espaces.md). Its tables
// live in the « accounts » schema, the only one the site writes (docs/adr/0008). Settings: src/server/auth-config.ts.
import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "~/env";
import { createAuth } from "~/server/auth-config";
import { db } from "~/server/db";
import { createEmailSender } from "~/server/email/send-email";
import { siteOrigin } from "~/server/site-origin";

/** The site's own address, never the request's: the magic links, and the only origin /api/extension/link answers. */
export const ownOrigin = siteOrigin({
  nodeEnv: env.NODE_ENV,
  betterAuthUrl: env.BETTER_AUTH_URL,
  vercelEnv: env.VERCEL_ENV,
  vercelUrl: env.VERCEL_URL,
  port: env.PORT,
});

export const auth = createAuth({
  baseURL: ownOrigin,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  sendEmail: createEmailSender({
    nodeEnv: env.NODE_ENV,
    brevoApiKey: env.BREVO_API_KEY,
    from: env.EMAIL_FROM,
    log: (message) => console.info(message),
    fetch,
  }),
});
