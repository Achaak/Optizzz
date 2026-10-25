"use client";

import Link from "next/link";
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
import { authClient } from "~/lib/auth-client";
import { tellExtensionToForgetKeys } from "~/lib/spaces/extension-bridge";
import { forgetKeysOnDevice } from "~/lib/spaces/key-session";
import { removeExtension } from "./actions";

/** « Se déconnecter » (this browser) and « Se déconnecter partout » (every session of the account). */
export function SignOutButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run(everywhere: boolean) {
    setBusy(true);
    setError(false);
    if (everywhere) {
      const { error } = await authClient.revokeSessions();
      if (error) {
        setBusy(false);
        setError(true);
        return;
      }
    }
    // « Se déconnecter » also forgets the opened key on this device, and the Clé d'alliance in the extension.
    forgetKeysOnDevice();
    tellExtensionToForgetKeys();
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void run(false)}>
          Se déconnecter
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void run(true)}>
          Se déconnecter partout
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">« Partout » ferme aussi vos connexions sur vos autres appareils.</p>
      {error && (
        <p role="alert" className="text-sm">
          La déconnexion n&apos;a pas abouti. Réessayez.
        </p>
      )}
    </div>
  );
}

/** « Retirer » a linked extension: its token stops working at once. */
export function RemoveExtensionButton({ id, browser }: { id: string; browser: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      aria-label={`Retirer l'extension ${browser}`}
      onClick={() => {
        setBusy(true);
        removeExtension(id).catch(() => setBusy(false));
      }}
    >
      Retirer
    </Button>
  );
}

/** Deleting the account, after a confirmation. Better Auth asks for a sign-in of less than a day. */
export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.deleteUser({});
    setBusy(false);
    if (!error) {
      forgetKeysOnDevice();
      tellExtensionToForgetKeys();
      router.replace("/login?deleted");
      router.refresh();
      return;
    }
    setError(
      error.code === "SESSION_EXPIRED" ? (
        <>
          Par sécurité, la suppression demande une connexion de moins d&apos;un jour.{" "}
          <Link href="/login" className="underline">
            Reconnectez-vous
          </Link>{" "}
          par un nouveau lien, puis revenez ici.
        </>
      ) : error.status === 400 && error.message ? (
        error.message
      ) : (
        "La suppression n'a pas abouti. Réessayez plus tard."
      ),
    );
  }

  return (
    <AlertDialog onOpenChange={() => setError(null)}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>Supprimer mon compte</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer votre Compte Optizzz ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le compte de <span className="break-all">{email}</span> et tout ce qui lui appartient sont effacés tout de
            suite. Rien ne pourra être récupéré.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
