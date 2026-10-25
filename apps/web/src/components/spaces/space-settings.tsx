"use client";

// A space's settings: its name (Admins), « Quitter », and for an Admin « Supprimer l'espace », typing its name.
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
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
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Callout, Panel } from "./parts";
import type { MemberView } from "./use-space-access";

export function SpaceSettings({ view }: { view: MemberView }) {
  const id = useId();
  const router = useRouter();
  const utils = api.useUtils();
  const rename = api.spaces.rename.useMutation();
  const leave = api.spaces.leave.useMutation();
  const remove = api.spaces.delete.useMutation();
  const spaceId = view.space.id;
  const isAdmin = view.me.role === "admin";
  const [name, setName] = useState(view.space.name);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const alone = view.members.length === 1;

  const gone = async () => {
    await utils.spaces.invalidate();
    router.replace("/spaces");
  };

  return (
    <Panel title="Réglages">
      {isAdmin && (
        <form
          className="space-y-1"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            rename
              .mutateAsync({ spaceId, name })
              .then(() => utils.spaces.view.invalidate({ spaceId }))
              .catch((failure: unknown) => setError(errorText(failure)));
          }}
        >
          <label htmlFor={`${id}-name`} className="block font-medium">
            Nom de l&apos;espace
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" variant="outline" disabled={rename.isPending || name.trim() === view.space.name}>
              Renommer
            </Button>
          </div>
        </form>
      )}
      {error && <Callout>{error}</Callout>}
      <div className="flex flex-wrap gap-2">
        <AlertDialog onOpenChange={() => setDialogError(null)}>
          <AlertDialogTrigger render={<Button variant="outline" />}>Quitter</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Quitter {view.space.name}&nbsp;?</AlertDialogTitle>
              <AlertDialogDescription>
                {alone
                  ? "Vous êtes seul dans l'espace : il sera supprimé avec tout ce qu'il contient."
                  : "Vous ne lirez plus l'espace. Pour revenir, il faudra demander de nouveau à rejoindre."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {dialogError && <Callout>{dialogError}</Callout>}
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={leave.isPending}
                onClick={() => {
                  leave
                    .mutateAsync({ spaceId })
                    .then(gone)
                    .catch((failure: unknown) => setDialogError(errorText(failure)));
                }}
              >
                Quitter l&apos;espace
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {isAdmin && (
          <AlertDialog
            onOpenChange={() => {
              setDialogError(null);
              setTyped("");
            }}
          >
            <AlertDialogTrigger render={<Button variant="destructive" />}>Supprimer l&apos;espace</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer {view.space.name}&nbsp;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tout est effacé, pour tous les membres, sans retour possible. Tapez le nom de l&apos;espace pour
                  confirmer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                aria-label="Nom de l'espace"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
              {dialogError && <Callout>{dialogError}</Callout>}
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={remove.isPending || typed.trim() !== view.space.name}
                  onClick={() => {
                    remove
                      .mutateAsync({ spaceId, name: typed })
                      .then(gone)
                      .catch((failure: unknown) => setDialogError(errorText(failure)));
                  }}
                >
                  Supprimer
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </Panel>
  );
}
