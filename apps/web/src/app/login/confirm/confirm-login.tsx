"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { verifyLinkPath } from "~/lib/login-links";

export function ConfirmLogin() {
  const token = useSearchParams().get("token");
  const [going, setGoing] = useState(false);

  if (!token)
    return (
      <p className="text-sm">
        Ce lien est incomplet.{" "}
        <Link href="/login" className="underline">
          Demandez un nouveau lien
        </Link>
        .
      </p>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ce lien vaut 15 minutes et ne sert qu&apos;une fois. Il vous connecte sur ce navigateur.
      </p>
      <Button
        className="w-full"
        disabled={going}
        onClick={() => {
          setGoing(true);
          window.location.assign(verifyLinkPath(token));
        }}
      >
        {going ? "Connexion…" : "Se connecter à Optizzz"}
      </Button>
    </div>
  );
}
