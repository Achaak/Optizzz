// Better Auth for Optizzz accounts, apart from the database and the environment so a test can run it (src/server/auth.ts
// wires them). With a fixed `baseURL`, Better Auth never derives the site's address from the request: its handler only
// reads the request's origin when `options.baseURL` is empty (better-auth/dist/auth/base.mjs, `handler`).
import { APIError, betterAuth, type DBAdapterInstance } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { confirmLinkUrl } from "~/lib/login-links";
import { magicLinkEmail } from "~/server/email/magic-link-email";
import type { SendEmail } from "~/server/email/send-email";

const DAY = 24 * 60 * 60;

interface AuthOptions {
  /** The site's origin (src/server/site-origin.ts), never the request's. */
  baseURL: string;
  secret: string;
  database: DBAdapterInstance;
  sendEmail: SendEmail;
  /**
   * Before an account is deleted: the reason that blocks it (shown to the person), or null once what the cascades do
   * not take is tidied (src/server/auth.ts: the last Admin of a space with others; a space where it is alone).
   */
  beforeDeleteUser?: (userId: string) => Promise<string | null>;
}

export function createAuth({ baseURL, secret, database, sendEmail, beforeDeleteUser }: AuthOptions) {
  return betterAuth({
    secret,
    baseURL,
    database,
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
          const reason = beforeDeleteUser ? await beforeDeleteUser(user.id) : null;
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
        // The link is built from the site's fixed origin, not from anything in the request.
        sendMagicLink: ({ email, token }) => sendEmail(magicLinkEmail(email, confirmLinkUrl(baseURL, token))),
      }),
    ],
  });
}
