// Optizzz accounts: Better Auth with its magic link (docs/adr/0007, docs/features/site-comptes-espaces.md). Its tables
// live in the « accounts » schema, the only one the site writes (docs/adr/0008). Settings: src/server/auth-config.ts.
import "server-only";

import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "~/env";
import { createAuth } from "~/server/auth-config";
import { db } from "~/server/db";
import { createEmailSender } from "~/server/email/send-email";
import { siteOrigin } from "~/server/site-origin";

export const auth = createAuth({
  baseURL: siteOrigin({
    nodeEnv: env.NODE_ENV,
    betterAuthUrl: env.BETTER_AUTH_URL,
    vercelEnv: env.VERCEL_ENV,
    vercelUrl: env.VERCEL_URL,
    port: env.PORT,
  }),
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
