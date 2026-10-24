/** Why a cryptographic operation failed. The message is shown to the player, in French. */
type CryptoErrorCode =
  | "wrong-passphrase"
  | "passphrase-too-short"
  | "not-for-this-key"
  | "bad-signature"
  | "untrusted-signer"
  | "missing-key-version"
  | "undecryptable"
  | "unsupported-format"
  | "malformed";

type FixedCode = Exclude<CryptoErrorCode, "missing-key-version" | "untrusted-signer">;

const MESSAGES: Record<FixedCode, string> = {
  "wrong-passphrase": "Phrase de chiffrement incorrecte.",
  "passphrase-too-short": "La phrase doit faire au moins 16 caractères.",
  "not-for-this-key":
    "Cette Clé d'alliance n'a pas été chiffrée pour votre clé : demandez à un Admin de vous la renvoyer.",
  "bad-signature":
    "Cette Clé d'alliance ne porte pas de signature valable d'un Admin de cet espace : ne l'utilisez pas, et prévenez un Admin.",
  undecryptable: "Cette donnée ne se déchiffre pas : elle a été altérée, ou la Clé d'alliance ne correspond pas.",
  "unsupported-format":
    "Cette donnée vient d'une version plus récente d'Optizzz : mettez à jour l'extension ou rechargez la page.",
  malformed: "Cette donnée chiffrée est illisible.",
};

export class CryptoError extends Error {
  override readonly name = "CryptoError";

  private constructor(
    readonly code: CryptoErrorCode,
    message: string,
    /** For `untrusted-signer`: the public key (base64url) that did sign, whose fingerprint the interface can show. */
    readonly signer?: string,
  ) {
    super(message);
  }

  static of(code: FixedCode): CryptoError {
    return new CryptoError(code, MESSAGES[code]);
  }

  static missingKeyVersion(version: number): CryptoError {
    return new CryptoError(
      "missing-key-version",
      `Il vous manque la version ${version} de la Clé d'alliance : demandez à un Admin de vous la renvoyer.`,
    );
  }

  static untrustedSigner(signer: string): CryptoError {
    return new CryptoError(
      "untrusted-signer",
      "Cette Clé d'alliance est signée par une clé que vous n'avez pas reconnue : comparez son empreinte avec celle de l'Admin avant de l'accepter.",
      signer,
    );
  }
}
