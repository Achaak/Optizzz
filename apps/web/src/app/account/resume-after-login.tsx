"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RETURN_KEY, returnPath } from "~/lib/login-links";

/** The page one was going back to after signing in, read and forgotten; null when storage refuses. */
function takeReturnPath(): string | null {
  try {
    const back = returnPath(localStorage.getItem(RETURN_KEY));
    localStorage.removeItem(RETURN_KEY);
    return back;
  } catch {
    return null;
  }
}

/** Back to the invitation link that sent one to sign in (src/app/login/login-form.tsx), once. */
export function ResumeAfterLogin() {
  const router = useRouter();
  useEffect(() => {
    const back = takeReturnPath();
    if (back) router.replace(back);
  }, [router]);
  return null;
}
