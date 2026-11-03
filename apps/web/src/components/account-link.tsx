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
      className={
        signedIn
          ? "flex h-10 shrink-0 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap hover:bg-accent"
          : "flex h-10 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground transition hover:-translate-y-px hover:brightness-110 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      }
    >
      {signedIn ? "Mon compte" : "Se connecter"}
    </Link>
  );
}
