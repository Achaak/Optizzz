"use client";

// Exchanging the Code de sécurité by copy-paste (docs/features/site-comptes-espaces.md, « Échanger le Code de
// sécurité »): one's own code to send, and a field for the other's. The browser compares by itself, against the code
// computed from the key the site gives for the other person: one's own code pasted does not match. No « j'ai comparé »
// box: only a matching paste goes further.
import { matchesPairCode, pairCodes, type PairCodes } from "@optizzz/crypto/pair-code";
import { useEffect, useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { describeProblem } from "~/lib/spaces/problems";
import { Callout, WhyCode } from "./parts";

const MISMATCH = "Les codes ne correspondent pas. N'allez pas plus loin et prévenez-nous.";

export function CodeExchange({
  mine,
  theirs,
  pseudo,
  side,
  done,
  onMatch,
}: {
  /** One's own public key, and the one the site gives for the other person. */
  mine: string;
  theirs: string;
  pseudo: string;
  /** « newcomer »: « Envoyez ce code à Pseudo » ; « admin »: « Copier mon code ». */
  side: "newcomer" | "admin";
  /** Already exchanged with this key: nothing to do. */
  done: boolean;
  /** The codes match: the other key goes into one's trust list. */
  onMatch: () => Promise<void>;
}) {
  const id = useId();
  const [codes, setCodes] = useState<PairCodes | null>(null);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "mismatch" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pairCodes(mine, theirs).then(
      (computed) => {
        if (!cancelled) setCodes(computed);
      },
      (failure: unknown) => {
        if (!cancelled) setError(describeProblem(failure));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mine, theirs]);

  async function check(value: string) {
    setPasted(value);
    if (!codes) return;
    const digits = value.replace(/\D/g, "");
    if (matchesPairCode(value, codes.theirs)) {
      setState("saving");
      try {
        await onMatch();
        setState("idle");
      } catch (failure) {
        setError(describeProblem(failure));
        setState("error");
      }
    } else setState(digits.length >= 24 ? "mismatch" : "idle");
  }

  if (error) return <Callout>{error}</Callout>;
  if (!codes) return <p className="text-muted-foreground">Calcul du Code de sécurité…</p>;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p>
          {side === "newcomer" ? (
            <>
              Envoyez ce code à <strong>{pseudo}</strong> sur Discord&nbsp;:
            </>
          ) : (
            <>Votre Code de sécurité, à envoyer à {pseudo}&nbsp;:</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-base tracking-wide">{codes.mine}</code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(codes.mine).then(
                () => setCopied("done"),
                () => setCopied("failed"),
              );
            }}
          >
            {side === "newcomer" ? "Copier" : "Copier mon code"}
          </Button>
          <span role="status" className="text-muted-foreground">
            {copied === "done" && "Code copié."}
            {copied === "failed" && "Copiez le code à la main."}
          </span>
        </div>
      </div>
      {done ? (
        <p className="font-medium">Code de sécurité échangé avec {pseudo}&nbsp;: les codes correspondent.</p>
      ) : (
        <div className="space-y-1">
          <label htmlFor={`${id}-pasted`} className="block">
            {side === "newcomer" ? `Collez le code que ${pseudo} vous a envoyé` : `Collez le code de ${pseudo}`}
          </label>
          <Input
            id={`${id}-pasted`}
            inputMode="numeric"
            autoComplete="off"
            value={pasted}
            onChange={(event) => void check(event.target.value)}
            disabled={state === "saving"}
            placeholder="0000 0000 0000 0000 0000 0000"
            className="max-w-sm font-mono"
            aria-invalid={state === "mismatch" ? true : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Espaces et tirets comptent pour rien ; les chiffres lus de vive voix se tapent aussi.
          </p>
          {state === "saving" && <p role="status">Enregistrement…</p>}
          {state === "mismatch" && <Callout>{MISMATCH}</Callout>}
        </div>
      )}
      <WhyCode pseudo={pseudo} />
    </div>
  );
}
