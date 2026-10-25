"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";

/** « Copier le lien d'invitation »: the space's address, without any secret (ADR 0005: never a key in a link). */
export function CopyInvitation({ spaceId }: { spaceId: string }) {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const link = () => `${window.location.origin}/spaces/${spaceId}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(link()).then(
            () => setCopied("done"),
            () => setCopied("failed"),
          );
        }}
      >
        Copier le lien d&apos;invitation
      </Button>
      <span role="status" className="text-muted-foreground">
        {copied === "done" && "Lien copié : envoyez-le sur le Discord de votre alliance."}
        {copied === "failed" && "Le lien n'a pas pu être copié : copiez l'adresse de cette page."}
      </span>
    </div>
  );
}
