// Optizzz accounts: Better Auth with its magic link (docs/adr/0007, docs/features/site-comptes-espaces.md). Its tables
// live in the « accounts » schema, the only one the site writes (docs/adr/0008).
import "server-only";

import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { env } from "~/env";
import { confirmLinkUrl } from "~/lib/login-links";
import { accountDeletionBlocker } from "~/server/account-deletion";
import { db } from "~/server/db";
import { magicLinkEmail } from "~/server/email/magic-link-email";
import { createEmailSender } from "~/server/email/send-email";

const DAY = 24 * 60 * 60;

const sendEmail = createEmailSender({
  nodeEnv: env.NODE_ENV,
  brevoApiKey: env.BREVO_API_KEY,
  from: env.EMAIL_FROM,
  log: (message) => console.info(message),
  fetch,
});

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  session: {
    // 30 days, extended at each visit — written at most once a day, not at every request.
    expiresIn: 30 * DAY,
    updateAge: DAY,
  },
  user: {
    deleteUser: {
      enabled: true,
      // Better Auth then deletes the user: the database cascades to everything it owns.
      beforeDelete: async (user) => {
        const reason = await accountDeletionBlocker(user.id);
        if (reason) throw new APIError("BAD_REQUEST", { message: reason });
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // The site keeps no IP address nor browser of its visitors (/privacy).
        before: (session) => Promise.resolve({ data: { ...session, ipAddress: null, userAgent: null } }),
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      // Only a hash of the token is stored: a read of the database cannot open an account.
      storeToken: "hashed",
      sendMagicLink: async ({ email, token }, ctx) => {
        const baseUrl = ctx?.context.baseURL ?? env.BETTER_AUTH_URL;
        if (!baseUrl) throw new Error("No base URL for the magic link");
        await sendEmail(magicLinkEmail(email, confirmLinkUrl(new URL(baseUrl).origin, token)));
      },
    }),
  ],
});
