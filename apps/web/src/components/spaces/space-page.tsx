"use client";

// One space's page, for a signed-in person: as a member, or as someone invited. Asked again every few seconds while
// something waits on someone else (a request, an access to send back), and for Admins and Délégués (requests,
// departure alerts), so that the page follows without a reload.
import Link from "next/link";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Invitation } from "./invitation";
import { MemberSpace } from "./member-space";
import { Callout } from "./parts";

const WAITING_MS = 10_000;
const ADMIN_MS = 30_000;

export function SpacePage({ spaceId }: { spaceId: string }) {
  const view = api.spaces.view.useQuery(
    { spaceId },
    {
      staleTime: 0,
      retry: false,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return false;
        if (data.kind === "invitation") return data.request?.status === "pending" ? WAITING_MS : false;
        if (data.me.keyStatus === "resend") return WAITING_MS;
        return data.me.role === "member" ? false : ADMIN_MS;
      },
    },
  );

  if (view.isPending) return <p className="text-sm text-muted-foreground">Chargement de l&apos;espace…</p>;
  if (view.isError)
    return (
      <div className="max-w-lg space-y-3">
        <Callout>{errorText(view.error)}</Callout>
        <Link href="/spaces" className="text-sm underline underline-offset-4">
          Mes espaces
        </Link>
      </div>
    );
  return view.data.kind === "member" ? <MemberSpace view={view.data} /> : <Invitation view={view.data} />;
}
