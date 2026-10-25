// Small pieces shared by the Alliance Spaces' pages, in the site's shadcn style.
import { cn } from "cn";

/** A boxed part of a page. */
export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3 rounded-xl p-4 text-sm ring-1 ring-foreground/10", className)}>
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

/**
 * A message that must be read: an error (`danger`) or a warning. Never colour alone: the text says it, the border only
 * underlines it (ADR 0003).
 */
export function Callout({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn(
        "rounded-lg border p-3 text-sm",
        tone === "danger" && "border-destructive/50",
        tone === "warning" && "border-foreground/30",
        tone === "info" && "border-foreground/10 bg-muted/50",
      )}
    >
      {children}
    </div>
  );
}

/** The passphrase's label, with the exact term under it (GLOSSARY.md, « Phrase de chiffrement »). */
export function PassphraseLabel({ htmlFor }: { htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="font-medium">Phrase secrète de votre compte</span>
      <span className="block text-xs text-muted-foreground">Phrase de chiffrement</span>
    </label>
  );
}

/** The passphrase field's attributes: the case counts, the keyboard must not change it. */
export const PASSPHRASE_INPUT = {
  autoCapitalize: "off",
  autoCorrect: "off",
  spellCheck: false,
} as const;

/** « Pourquoi ? », folded: two sentences on the Code de sécurité (docs/features/site-comptes-espaces.md). */
export function WhyCode({ pseudo }: { pseudo: string }) {
  return (
    <details className="text-muted-foreground">
      <summary className="cursor-pointer">Pourquoi&nbsp;?</summary>
      <p className="mt-1">
        Ce code prouve que vous parlez bien à {pseudo}, et pas à quelqu&apos;un qui se ferait passer pour lui. Même
        Optizzz ne peut pas lire les données de votre alliance.
      </p>
    </details>
  );
}
