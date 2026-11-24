"use client";

import { ATTACH_SLOT_ATTRIBUTE, LINK_STATE_ATTRIBUTE, type LinkState } from "@optizzz/game/site-links/extension-link";
import Link from "next/link";
import { CHROME_STORE, FIREFOX_ADDONS } from "~/lib/extension-stores";
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
    <div role="status" className="space-y-3 rounded-[0.875rem] bg-card p-4.5 text-sm shadow-panel">
      <p className="text-muted-foreground">
        Compte&nbsp;: <span className="break-all text-foreground">{email}</span>
      </p>
      {state === "waiting" || state === "linking" ? (
        <p>Liaison de l&apos;extension…</p>
      ) : state === "linked" ? (
        <>
          <p className="font-medium">
            C&apos;est fait : l&apos;extension de ce navigateur est liée à votre Compte Optizzz.
          </p>
          {/* The extension draws « Rattacher Pseudo (S5) » here, in its own shadow root: React leaves it empty. */}
          <div {...{ [ATTACH_SLOT_ATTRIBUTE]: "" }} />
          <p className="text-muted-foreground">
            Pour rejoindre un Espace d&apos;alliance, rattachez votre pseudo du jeu. Si rien n&apos;est proposé
            ci-dessus, ouvrez une page du jeu, puis les paramètres de l&apos;extension (icône Optizzz)&nbsp;:
            «&nbsp;Rattacher&nbsp;».{" "}
            <Link href="/spaces" className="underline">
              Espaces d&apos;alliance
            </Link>
          </p>
        </>
      ) : state === "failed" ? (
        <p>
          La liaison n&apos;a pas abouti. Réessayez depuis l&apos;extension («&nbsp;Connecter mon Compte
          Optizzz&nbsp;»).
        </p>
      ) : (
        <>
          <p>L&apos;extension n&apos;a pas demandé à être liée.</p>
          <p className="text-muted-foreground">
            Dans les paramètres de l&apos;extension Optizzz («&nbsp;Fonctionnalités&nbsp;»), cliquez «&nbsp;Connecter
            mon Compte Optizzz&nbsp;» : elle vous demandera l&apos;accès à optizzz.fr, puis reviendra ici.
          </p>
          {state === "absent" && (
            <p className="text-muted-foreground">
              Pas encore installée&nbsp;? L&apos;extension Optizzz{" "}
              <a href={CHROME_STORE} className="underline">
                pour Chrome
              </a>{" "}
              ou{" "}
              <a href={FIREFOX_ADDONS} className="underline">
                pour Firefox
              </a>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
