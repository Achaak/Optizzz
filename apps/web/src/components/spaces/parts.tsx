// Small pieces shared by the Alliance Spaces' pages, in the site's « Campagne » style (docs/features/site-refonte.md).
import { cn } from "cn";
import { Panel as SitePanel } from "~/components/panel";

/**
 * A boxed part of a page: the site's panel, its parts spaced. `aside` on the right of its header (« nourriture +
 * matériaux », « Voir les convois → »); `flush` for a table that runs to the panel's edges.
 */
export function Panel({
  title,
  aside,
  flush,
  id,
  children,
  className,
}: {
  title?: string;
  aside?: React.ReactNode;
  flush?: boolean;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn("min-w-0 scroll-mt-4 text-sm", className)}>
      <SitePanel title={title} aside={aside} flush={flush}>
        <div className={flush ? "" : "space-y-3"}>{children}</div>
      </SitePanel>
    </div>
  );
}

/** A small mono label over a field, as the tool forms write them. */
export const FIELD_LABEL = "block text-xs text-muted-foreground font-medium";

/** A square field on the page's ground, as tall as a button of the mockups. */
export const FIELD_INPUT = "h-9.5 rounded-none bg-background dark:bg-background";

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
        "border p-3 text-sm rounded-[0.625rem]",
        tone === "danger" && "border-destructive/60 bg-destructive/10",
        tone === "warning" && "border-warning-border bg-warning-soft",
        tone === "info" && "bg-muted",
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

/** « déclaré »: saisi à la main sur la page « Déclarer », pas envoyé par l'extension (ADR 0010). */
export function DeclaredTag({ count }: { count?: number }) {
  return (
    <span
      className="ml-1.5 inline-block rounded-full border border-dashed border-muted-foreground px-1.5 text-xs font-semibold whitespace-nowrap text-muted-foreground"
      title="Saisi à la main sur la page Déclarer : l'extension du membre ne l'a pas encore envoyé."
    >
      {count !== undefined && count > 1 ? `${String(count)} déclarés` : "déclaré"}
    </span>
  );
}
