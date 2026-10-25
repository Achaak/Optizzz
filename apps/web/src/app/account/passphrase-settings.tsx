"use client";

// « Phrase secrète de votre compte » on /account: change it (same key pair, locked again), or « J'ai oublié ma phrase »
// (a new pair: every space marks the person « accès à renvoyer » until an Admin sends it again, after the Code de
// sécurité). docs/features/site-comptes-espaces.md, « Phrase de chiffrement et clés ».
import { generateKeyPair, lockPrivateKey } from "@optizzz/crypto/personal-key";
import Link from "next/link";
import { useState } from "react";
import { PassphraseSetup, PassphraseUnlock } from "~/components/spaces/passphrase-forms";
import { Callout } from "~/components/spaces/parts";
import { useSpaceKeys } from "~/components/spaces/space-keys";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function PassphraseSettings({ soleAdminOf }: { soleAdminOf: string[] }) {
  const keys = useSpaceKeys();
  const change = api.spaces.changePassphrase.useMutation();
  const forget = api.spaces.forgetPassphrase.useMutation();
  const [mode, setMode] = useState<"idle" | "change" | "confirm-forget" | "forget">("idle");
  const [done, setDone] = useState<string | null>(null);

  if (keys.loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!keys.hasKey)
    return (
      <p className="text-sm text-muted-foreground">
        Vous la choisirez en créant ou en rejoignant votre premier{" "}
        <Link href="/spaces" className="underline">
          Espace d&apos;alliance
        </Link>
        .
      </p>
    );

  return (
    <div className="space-y-3 text-sm">
      {done && <p role="status">{done}</p>}
      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMode("change")}>
            Changer de phrase
          </Button>
          <Button variant="outline" onClick={() => setMode("confirm-forget")}>
            J&apos;ai oublié ma phrase
          </Button>
        </div>
      )}

      {mode === "change" &&
        (keys.pair ? (
          <PassphraseSetup
            submitLabel="Enregistrer la nouvelle phrase"
            save={async (phrase) => {
              const pair = keys.pair;
              if (!pair) return;
              await change.mutateAsync({
                publicKey: pair.publicKey,
                lockedPrivateKey: await lockPrivateKey(pair, phrase),
              });
              await keys.adopt(pair);
            }}
            onDone={() => {
              setMode("idle");
              setDone("Nouvelle phrase enregistrée. Vos accès aux espaces ne changent pas.");
            }}
          />
        ) : (
          <PassphraseUnlock intro={<p>Tapez d&apos;abord votre phrase actuelle.</p>} />
        ))}

      {mode === "confirm-forget" && (
        <div className="space-y-3 rounded-lg p-3 ring-1 ring-foreground/10">
          <p>
            Vous allez choisir une nouvelle phrase. Vous restez membre de vos espaces, avec vos rôles, mais vous ne les
            lirez plus jusqu&apos;à ce qu&apos;un Admin vous renvoie l&apos;accès, après un nouvel échange du Code de
            sécurité. Vos vérifications du Code de sécurité sont aussi à refaire.
          </p>
          {soleAdminOf.length > 0 && (
            <Callout tone="warning">
              Vous êtes le seul Admin de {soleAdminOf.join(", ")}&nbsp;: personne ne pourra vous renvoyer l&apos;accès.
              Nommez d&apos;abord un autre Admin.
            </Callout>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => setMode("forget")}>
              Choisir une nouvelle phrase
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {mode === "forget" && (
        <PassphraseSetup
          submitLabel="Enregistrer la nouvelle phrase"
          save={async (phrase) => {
            const fresh = await generateKeyPair();
            await forget.mutateAsync({
              publicKey: fresh.publicKey,
              lockedPrivateKey: await lockPrivateKey(fresh, phrase),
            });
            await keys.adopt(fresh);
          }}
          onDone={() => {
            setMode("idle");
            setDone(
              "Nouvelle phrase enregistrée. Demandez à un Admin de chacun de vos espaces de vous renvoyer l'accès.",
            );
          }}
        />
      )}
    </div>
  );
}
