// The back office's gate (docs/features/site-back-office.md): an account whose verified address is in ADMIN_EMAILS.
import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { env } from "~/env";
import { isAdmin, parseAdminEmails } from "~/lib/admin/admin-emails";
import { auth } from "~/server/auth";

const admins = parseAdminEmails(env.ADMIN_EMAILS);

/** The admin's session; anyone else gets the site's 404, which does not tell the back office exists. */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session || !isAdmin(admins, session.user)) notFound();
  return session;
}
