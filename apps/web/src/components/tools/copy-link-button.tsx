"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

/** « Copier le lien »: the address, whose fragment holds the tool's current state. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(window.location.href).then(
            () => setCopied("done"),
            () => setCopied("failed"),
          );
        }}
      >
        Copier le lien
      </Button>
      <span role="status" className="text-sm text-muted-foreground">
        {copied === "done" && "Lien copié."}
        {copied === "failed" && "Le lien n'a pas pu être copié : copiez l'adresse de la page."}
      </span>
    </>
  );
}
