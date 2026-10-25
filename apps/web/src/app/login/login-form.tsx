"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth-client";
import { loginErrorMessage, RETURN_KEY, returnPath } from "~/lib/login-links";

type State = { step: "form"; error: string | null } | { step: "sending" } | { step: "sent"; email: string };

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ step: "form", error: null });

  async function send(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    setState({ step: "sending" });
    // Back to the invitation link once signed in, even though the link comes back by email (src/app/account).
    const back = returnPath(params.get("next"));
    try {
      if (back) localStorage.setItem(RETURN_KEY, back);
    } catch {
      // Refused: one lands on /account, which links to the spaces.
    }
    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: "/account",
      errorCallbackURL: "/login",
    });
    if (!error) {
      setState({ step: "sent", email: address });
      return;
    }
    setState({
      step: "form",
      error:
        error.status === 429
          ? "Trop de demandes : réessayez dans une minute."
          : error.status === 400
            ? "Cette adresse e-mail ne semble pas valide."
            : "La connexion n'est pas disponible ici. Réessayez plus tard.",
    });
  }

  if (state.step === "sent")
    return (
      <div role="status" className="space-y-3 rounded-xl p-4 text-sm ring-1 ring-foreground/10">
        <p>
          Un lien de connexion vient de partir vers <strong>{state.email}</strong>. Il vaut 15 minutes et ne sert
          qu&apos;une fois.
        </p>
        <p className="text-muted-foreground">Rien reçu ? Regardez dans les indésirables, ou redemandez un lien.</p>
        <Button variant="outline" onClick={() => setState({ step: "form", error: null })}>
          Redemander un lien
        </Button>
      </div>
    );

  const deleted = params.get("deleted") !== null;
  const error = state.step === "form" ? (state.error ?? loginErrorMessage(params.get("error"))) : null;
  return (
    <form onSubmit={(event) => void send(event)} className="space-y-4">
      {deleted && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          Votre Compte Optizzz est supprimé, avec tout ce qui lui appartenait.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={state.step === "sending"}>
        {state.step === "sending" ? "Envoi…" : "Recevoir un lien de connexion"}
      </Button>
    </form>
  );
}
