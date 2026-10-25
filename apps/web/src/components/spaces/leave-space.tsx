"use client";

// « Quitter », with its confirmation: from the settings, or offered when the export says the Player left the alliance.
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Callout } from "./parts";
import type { MemberView } from "./use-space-access";

export function LeaveSpace({ view, label = "Quitter" }: { view: MemberView; label?: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const leave = api.spaces.leave.useMutation();
  const [error, setError] = useState<string | null>(null);
  const alone = view.members.length === 1;

  return (
    <AlertDialog onOpenChange={() => setError(null)}>
      <AlertDialogTrigger render={<Button variant="outline" />}>{label}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quitter {view.space.name}&nbsp;?</AlertDialogTitle>
          <AlertDialogDescription>
            {alone
              ? "Vous êtes seul dans l'espace : il sera supprimé avec tout ce qu'il contient."
              : "Vous ne lirez plus l'espace. Pour revenir, il faudra demander de nouveau à rejoindre."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <Callout>{error}</Callout>}
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={leave.isPending}
            onClick={() => {
              leave
                .mutateAsync({ spaceId: view.space.id })
                .then(async () => {
                  await utils.spaces.invalidate();
                  router.replace("/spaces");
                })
                .catch((failure: unknown) => setError(errorText(failure)));
            }}
          >
            Quitter l&apos;espace
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
