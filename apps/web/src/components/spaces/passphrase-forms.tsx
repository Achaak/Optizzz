"use client";

// Choosing the passphrase (first space) and typing it on a device (docs/features/site-comptes-espaces.md, « Phrase
// secrète »): five words proposed at once, « En choisir une autre », a field the browser offers to save, and
// « Je l'ai notée ou enregistrée ». Nothing else: no strength meter, no second entry.
import { passphraseProblem, suggestPassphrase } from "@optizzz/crypto/passphrase";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { describeProblem } from "~/lib/spaces/problems";
import { errorText } from "./errors";
import { Callout, PASSPHRASE_INPUT, PassphraseLabel } from "./parts";
import { useSpaceKeys } from "./space-keys";

/** Lets React paint « … » before Argon2id takes the thread for about a second. */
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 30));

/** The hidden account name a password manager files the passphrase under: the email. */
function UsernameField({ email }: { email: string }) {
  return <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />;
}

export function PassphraseSetup({
  onDone,
  submitLabel = "Enregistrer ma phrase",
  save,
}: {
  onDone?: () => void;
  submitLabel?: string;
  /** Instead of creating the key pair (« Changer de phrase », « J'ai oublié ma phrase »). */
  save?: (passphrase: string) => Promise<void>;
}) {
  const { email, create } = useSpaceKeys();
  const id = useId();
  const [phrase, setPhrase] = useState("");
  const [noted, setNoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propose = () => {
    suggestPassphrase().then(setPhrase, () => setError(describeProblem(null)));
  };
  useEffect(propose, []);

  const problem = phrase ? passphraseProblem(phrase) : undefined;

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (problem || !noted || !phrase) return;
    setBusy(true);
    setError(null);
    await nextFrame();
    try {
      await (save ?? create)(phrase);
      onDone?.();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void submit(event)}>
      <UsernameField email={email} />
      <PassphraseLabel htmlFor={`${id}-phrase`} />
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-phrase`}
          name="new-password"
          type="text"
          autoComplete="new-password"
          {...PASSPHRASE_INPUT}
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          className="min-w-0 flex-1 font-mono sm:min-w-72"
          aria-describedby={`${id}-help`}
          aria-invalid={problem ? true : undefined}
        />
        <Button type="button" variant="outline" onClick={propose} disabled={busy}>
          En choisir une autre
        </Button>
      </div>
      <p id={`${id}-help`} className="text-muted-foreground">
        {problem ??
          "Optizzz ne peut pas la retrouver. Perdue, il faudra qu'un Admin vous réapprouve. Notez-la, ou laissez votre navigateur l'enregistrer."}
      </p>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={noted}
          onChange={(event) => setNoted(event.target.checked)}
          required
        />
        <span>Je l&apos;ai notée ou enregistrée</span>
      </label>
      {error && <Callout>{error}</Callout>}
      <Button type="submit" disabled={busy || !noted || !phrase || problem !== undefined}>
        {busy ? "Préparation…" : submitLabel}
      </Button>
    </form>
  );
}

/** The passphrase typed on a device; « Se souvenir sur cet appareil » keeps it opened for 30 days. */
export function PassphraseUnlock({ intro }: { intro?: React.ReactNode }) {
  const { email, unlock } = useSpaceKeys();
  const id = useId();
  const [phrase, setPhrase] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phrase) return;
    setBusy(true);
    setError(null);
    await nextFrame();
    try {
      await unlock(phrase, remember);
    } catch (failure) {
      setError(describeProblem(failure));
      setBusy(false);
    }
  }

  return (
    <form className="max-w-lg space-y-3" onSubmit={(event) => void submit(event)}>
      {intro ?? <p>Tapez la phrase secrète de votre compte pour ouvrir vos espaces sur cet appareil.</p>}
      <UsernameField email={email} />
      <PassphraseLabel htmlFor={`${id}-phrase`} />
      <Input
        id={`${id}-phrase`}
        name="current-password"
        type="password"
        autoComplete="current-password"
        {...PASSPHRASE_INPUT}
        value={phrase}
        onChange={(event) => setPhrase(event.target.value)}
      />
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        <span>
          Se souvenir sur cet appareil
          <span className="block text-muted-foreground">Pendant 30 jours. À éviter sur un appareil partagé.</span>
        </span>
      </label>
      {error && <Callout>{error}</Callout>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !phrase}>
          {busy ? "Ouverture…" : "Ouvrir"}
        </Button>
        <Link href="/account#phrase" className="text-muted-foreground underline underline-offset-4">
          J&apos;ai oublié ma phrase
        </Link>
      </div>
    </form>
  );
}
