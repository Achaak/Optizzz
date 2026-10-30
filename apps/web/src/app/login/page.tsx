import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Panel } from "~/components/panel";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Se connecter", robots: { index: false } };

// Static: the form talks to Better Auth from the browser, and reads the returned error from the address.
export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader kicker="Compte Optizzz" title="Se connecter">
        Recevez un lien de connexion par e-mail, sans mot de passe. Sans compte, le même lien en crée un.
      </PageHeader>
      <Panel>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Panel>
      <p className="text-sm text-muted-foreground">
        Un Compte Optizzz servira à rejoindre l&apos;Espace de votre alliance. Les outils et les données des serveurs
        restent ouverts sans compte. Ce que le site garde :{" "}
        <Link href="/privacy" className="underline">
          Confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
