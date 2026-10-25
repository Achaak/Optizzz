// The invitation's steps (docs/features/site-comptes-espaces.md, « Inviter »): sign in, connect the extension, attach
// one's pseudo, choose one's phrase, then the request. A step already done is passed. Done, current and to come are
// told by a word and a mark, not by colour alone (ADR 0003).
import { cn } from "cn";

const INVITATION_STEPS = [
  "Se connecter",
  "Connecter l'extension",
  "Rattacher votre pseudo",
  "Choisir votre phrase",
  "Demander à rejoindre",
] as const;

/** `current`: the index of the step to do (5 once the request is made). */
export function StepBar({ current }: { current: number }) {
  return (
    <ol className="grid gap-2 text-sm sm:grid-cols-5" aria-label="Étapes pour rejoindre l'espace">
      {INVITATION_STEPS.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 ring-1",
              state === "current" ? "font-semibold ring-foreground/60" : "ring-foreground/10",
              state === "todo" && "text-muted-foreground",
            )}
          >
            <span aria-hidden className="tabular-nums">
              {state === "done" ? "✓" : `${String(index + 1)}.`}
            </span>
            <span>
              {label}
              <span className="sr-only">{state === "done" ? " : fait" : state === "current" ? " : à faire" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
