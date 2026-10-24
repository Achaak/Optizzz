"use client";

import Link from "next/link";
import { authClient } from "~/lib/auth-client";

/**
 * « Se connecter », or « Mon compte » once signed in. Asked by the browser, so the public pages stay static; the
 * question sets no cookie for a visitor without an account, and extends a signed-in session (at most once a day).
 */
export function AccountLink() {
  const { data } = authClient.useSession();
  const signedIn = !!data;
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      className="shrink-0 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap hover:bg-muted"
    >
      {signedIn ? "Mon compte" : "Se connecter"}
    </Link>
  );
}
