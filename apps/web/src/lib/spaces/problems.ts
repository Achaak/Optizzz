// What went wrong, told without « clé », « chiffrement », « certificat » nor « empreinte » (GLOSSARY.md, « Code de
// sécurité »): @optizzz/crypto's own messages name them, so the space pages say it their way.
import { CryptoError } from "@optizzz/crypto/errors";

export const BAD_CERTIFICATE =
  "Une autorisation enregistrée pour cet espace n'est pas valable : elle a été modifiée, ou vient d'ailleurs. Elle est ignorée ; prévenez un Admin.";

export const UNREADABLE_TRUST_LIST =
  "Vos vérifications du Code de sécurité ne s'ouvrent pas : elles ont été modifiées hors de votre navigateur. Prévenez-nous, puis refaites l'échange du code avec un Admin.";

/** « La clé de Pseudo a changé » (the framing's own words, docs/features/site-comptes-espaces.md). */
export const changedKey = (pseudo: string) => `La clé de ${pseudo} a changé`;

/** The access one received is signed by someone one does not believe (yet). */
export function untrustedAccess(pseudo: string | null): string {
  return pseudo
    ? `${changedKey(pseudo)} : votre accès à l'espace vient de lui. Échangez de nouveau le Code de sécurité avec ${pseudo}, ou avec un autre Admin, avant de l'utiliser.`
    : "Votre accès à l'espace vient d'une personne que vous n'avez pas vérifiée. Échangez le Code de sécurité avec un Admin avant de l'utiliser.";
}

/** A failure of a cryptographic step, for the person. `untrusted-signer` is better told with `untrustedAccess`. */
export function describeProblem(error: unknown): string {
  if (!(error instanceof CryptoError))
    return "Une erreur est survenue. Réessayez ; si cela se reproduit, prévenez-nous.";
  switch (error.code) {
    case "wrong-passphrase":
      return "Phrase secrète incorrecte.";
    case "passphrase-too-short":
      return "La phrase doit faire au moins 16 caractères.";
    case "not-for-this-key":
    case "missing-key-version":
      return "Votre accès à l'espace doit vous être renvoyé : demandez-le à un Admin.";
    case "bad-signature":
      return "L'accès reçu pour cet espace n'est pas valable : ne l'utilisez pas, et prévenez un Admin.";
    case "untrusted-signer":
      return untrustedAccess(null);
    case "bad-certificate":
      return BAD_CERTIFICATE;
    case "unreadable-trust-list":
      return UNREADABLE_TRUST_LIST;
    case "unsupported-format":
      return "Cette donnée vient d'une version plus récente d'Optizzz : rechargez la page.";
    case "undecryptable":
    case "malformed":
      return "Une donnée de l'espace est illisible. Rechargez la page ; si cela se reproduit, prévenez-nous.";
  }
}
