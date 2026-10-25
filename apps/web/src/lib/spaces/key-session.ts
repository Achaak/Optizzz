// Where the opened private key waits on this device (docs/features/site-comptes-espaces.md, « Sur un appareil »): for
// the browser's session (sessionStorage), or 30 days when « Se souvenir sur cet appareil » is ticked (localStorage).
// « Se déconnecter » forgets it. Storage can refuse (private browsing): the passphrase is then asked again.
import type { KeyPair } from "@optizzz/crypto/personal-key";

const PREFIX = "optizzz:key:";
const REVISION_PREFIX = "optizzz:trust-revision:";
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  publicKey: string;
  /** The 64-byte Ed25519 secret key, base64. */
  privateKey: string;
  /** Milliseconds since 1970; absent for the session only. */
  expiresAt?: number;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

function storages(): Storage[] {
  try {
    return [sessionStorage, localStorage];
  } catch {
    return [];
  }
}

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Keeps the opened key on this device, for the session or for 30 days. */
export function rememberKey(
  userId: string,
  pair: KeyPair,
  { remember, now }: { remember: boolean; now: number },
): void {
  const stored: Stored = {
    publicKey: pair.publicKey,
    privateKey: toBase64(pair.privateKey),
    ...(remember && { expiresAt: now + REMEMBER_MS }),
  };
  try {
    (remember ? localStorage : sessionStorage).setItem(PREFIX + userId, JSON.stringify(stored));
  } catch {
    // Refused: the passphrase will be asked again.
  }
}

/** The key opened earlier on this device for this account and this public key, or null. */
export function recallKey(userId: string, publicKey: string, now = Date.now()): KeyPair | null {
  for (const storage of storages()) {
    const text = read(storage, PREFIX + userId);
    if (!text) continue;
    try {
      const stored = JSON.parse(text) as Stored;
      if (stored.publicKey !== publicKey || (stored.expiresAt !== undefined && stored.expiresAt < now)) {
        storage.removeItem(PREFIX + userId);
        continue;
      }
      const privateKey = fromBase64(stored.privateKey);
      if (privateKey.length === 64) return { publicKey, privateKey };
    } catch {
      storage.removeItem(PREFIX + userId);
    }
  }
  return null;
}

/**
 * How long the opened key stays on this device: until its date with « Se souvenir sur cet appareil » (milliseconds
 * since 1970), or null for the browser's session. The extension keeps the Clé d'alliance as long (site-envois.md).
 */
export function keyKeptUntil(userId: string): number | null {
  try {
    const text = localStorage.getItem(PREFIX + userId);
    const expiresAt = text ? (JSON.parse(text) as Stored).expiresAt : undefined;
    return typeof expiresAt === "number" ? expiresAt : null;
  } catch {
    return null;
  }
}

/** « Se déconnecter », « J'ai oublié ma phrase », account deleted: no opened key stays on this device. */
export function forgetKeysOnDevice(): void {
  for (const storage of storages()) {
    try {
      for (const key of Object.keys(storage)) if (key.startsWith(PREFIX)) storage.removeItem(key);
    } catch {
      // Nothing to forget.
    }
  }
}

/**
 * The highest revision of the trust list this device has seen: a lower one served by the site is an older list
 * (ADR 0005, « Liste de confiance verrouillée », limite connue). 0 when unknown.
 */
export function seenTrustRevision(userId: string): number {
  try {
    return Number(localStorage.getItem(REVISION_PREFIX + userId) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function noteTrustRevision(userId: string, revision: number): void {
  try {
    if (revision > seenTrustRevision(userId)) localStorage.setItem(REVISION_PREFIX + userId, String(revision));
  } catch {
    // Refused: the check is skipped.
  }
}
