"use client";

import { LINK_STATE_ATTRIBUTE, type LinkState } from "@optizzz/game/site-links/extension-link";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Without a word from the extension after this, it is not installed, or has not been given optizzz.fr. */
const SILENCE_MS = 4000;

type Shown = LinkState | "waiting" | "absent";

const readState = (): LinkState | null => {
  const value = document.documentElement.getAttribute(LINK_STATE_ATTRIBUTE);
  return value === "linking" || value === "linked" || value === "not-requested" || value === "failed" ? value : null;
};

/** How the link goes, as the extension's script tells it by an attribute of <html>; it never shows the token. */
export function LinkStatus({ email }: { email: string }) {
  const [state, setState] = useState<Shown>("waiting");

  useEffect(() => {
    const update = () => {
      const read = readState();
      if (read) setState(read);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [LINK_STATE_ATTRIBUTE] });
    const silence = setTimeout(() => setState((current) => (current === "waiting" ? "absent" : current)), SILENCE_MS);
    return () => {
      observer.disconnect();
      clearTimeout(silence);
    };
  }, []);

  return (
    <div role="status" className="space-y-3 rounded-xl p-4 text-sm ring-1 ring-foreground/10">
      <p className="text-muted-foreground">
        Compte : <span className="break-all text-foreground">{email}</span>
      </p>
      {state === "waiting" || state === "linking" ? (
        <p>Liaison de l&apos;extension…</p>
      ) : state === "linked" ? (
        <>
          <p className="font-medium">
            C&apos;est fait : l&apos;extension de ce navigateur est liée à votre Compte Optizzz.
          </p>
          <p className="text-muted-foreground">
            Vous pouvez fermer cet onglet. L&apos;extension vous proposera de rattacher votre Joueur la prochaine fois
            que vous ouvrirez ses paramètres.{" "}
            <Link href="/account" className="underline">
              Mon compte
            </Link>
          </p>
        </>
      ) : state === "failed" ? (
        <p>La liaison n&apos;a pas abouti. Réessayez depuis l&apos;extension (« Connecter mon Compte Optizzz »).</p>
      ) : (
        <>
          <p>L&apos;extension n&apos;a pas demandé à être liée.</p>
          <p className="text-muted-foreground">
            Dans les paramètres de l&apos;extension Optizzz (« Fonctionnalités »), cliquez « Connecter mon Compte
            Optizzz » : elle vous demandera l&apos;accès à optizzz.fr, puis reviendra ici.
          </p>
        </>
      )}
    </div>
  );
}
