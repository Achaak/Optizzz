import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeclarePage } from "~/components/spaces/declare-page";
import { SpaceKeysProvider } from "~/components/spaces/space-keys";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Déclarer", robots: { index: false } };

// The page « Déclarer » (ADR 0010): the link an Admin pins on the alliance's Discord. Signed out, « Se connecter »
// first, back here after.
export default async function DeclareRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) redirect(`/login?next=${encodeURIComponent(`/spaces/${id}/declarer`)}`);
  return (
    <SpaceKeysProvider userId={session.user.id} email={session.user.email}>
      <DeclarePage spaceId={id} />
    </SpaceKeysProvider>
  );
}
