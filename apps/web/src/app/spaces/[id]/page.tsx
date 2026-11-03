import { serverById } from "@optizzz/game/servers";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpaceKeysProvider } from "~/components/spaces/space-keys";
import { SpacePage } from "~/components/spaces/space-page";
import { StepBar } from "~/components/spaces/step-bar";
import { shortDate } from "~/lib/short-date";
import { auth } from "~/server/auth";
import { invitationSummary } from "~/server/spaces/service";

export const metadata: Metadata = { title: "Espace d'alliance", robots: { index: false } };

// The invitation link: this page, without any secret. Signed in, the space or the steps to join it; otherwise, what the
// space is, and « Se connecter » first.
export default async function SpaceRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (session)
    return (
      <SpaceKeysProvider userId={session.user.id} email={session.user.email}>
        <SpacePage spaceId={id} />
      </SpaceKeysProvider>
    );

  const space = await invitationSummary(id);
  if (!space) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="break-words">Rejoindre {space.name}</h1>
        <p className="text-sm text-muted-foreground">
          Espace d&apos;alliance de {space.tag} sur {serverById(space.server)?.name ?? space.server} · Admins&nbsp;:{" "}
          {space.admins.join(", ") || "aucun"} · créé le {shortDate(space.createdAt, new Date())}
        </p>
      </div>
      <StepBar current={0} />
      <section className="space-y-3 rounded-[0.875rem] bg-card p-4.5 text-sm shadow-panel">
        <p>
          Connectez-vous à votre Compte Optizzz, avec votre seule adresse e-mail&nbsp;: vous reviendrez ici pour la
          suite.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/spaces/${space.id}`)}`}
          className="inline-block font-medium underline underline-offset-4"
        >
          Se connecter
        </Link>
      </section>
    </div>
  );
}
