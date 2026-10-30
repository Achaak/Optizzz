import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmLogin } from "./confirm-login";

export const metadata: Metadata = { title: "Se connecter", robots: { index: false } };

// Where the emailed link lands: a click consumes the token, so a mail scanner that opens links cannot burn it.
export default function ConfirmPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1>Se connecter</h1>
      <Suspense>
        <ConfirmLogin />
      </Suspense>
    </div>
  );
}
