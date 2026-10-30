"use client";

import { useEffect, useState } from "react";
import { LinkIcon } from "~/components/icons";
import { Button } from "~/components/ui/button";

/** « Copier le lien »: the address, whose fragment holds the tool's current state. The tool's main action. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <span role="status" className="text-xs text-muted-foreground">
        {copied === "done" && "Lien copié."}
        {copied === "failed" && "Copiez l'adresse de la page."}
      </span>
      <Button
        type="button"
        size="lg"
        onClick={() => {
          navigator.clipboard.writeText(window.location.href).then(
            () => setCopied("done"),
            () => setCopied("failed"),
          );
        }}
      >
        <LinkIcon />
        Copier le lien
      </Button>
    </>
  );
}
