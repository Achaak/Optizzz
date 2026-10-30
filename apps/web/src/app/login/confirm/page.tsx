import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Panel } from "~/components/panel";
import { ConfirmLogin } from "./confirm-login";

export const metadata: Metadata = { title: "Se connecter", robots: { index: false } };

// Where the emailed link lands: a click consumes the token, so a mail scanner that opens links cannot burn it.
export default function ConfirmPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader kicker="Compte Optizzz" title="Se connecter" />
      <Panel>
        <Suspense>
          <ConfirmLogin />
        </Suspense>
      </Panel>
    </div>
  );
}
