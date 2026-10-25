import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SpaceKeysProvider } from "~/components/spaces/space-keys";
import { SpacesHome } from "~/components/spaces/spaces-home";
import { auth } from "~/server/auth";

export const metadata: Metadata = { title: "Espaces d'alliance", robots: { index: false } };

export default async function SpacesPage() {
  const session = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
  if (!session) redirect("/login?next=/spaces");
  return (
    <SpaceKeysProvider userId={session.user.id} email={session.user.email}>
      <SpacesHome />
    </SpaceKeysProvider>
  );
}
