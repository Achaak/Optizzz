// The reminders' webhook address at rest (docs/features/site-discord.md, « Rappels du site »): encrypted with the
// site's own key, DISCORD_REMINDERS_KEY, never in the database. It protects the address from a stolen copy of the
// database or of a backup, not from whoever runs the site, who holds the key: the site has to read the address to post.
//
// Format 1: « 1. » then base64url (RFC 4648 §5, no padding) of nonce (12 bytes) ‖ ciphertext ‖ tag (16 bytes),
// AES-256-GCM (Node's crypto) with the associated data « optizzz reminders 1 » ‖ the space's id: a row moved to
// another space does not open. A new random nonce for each write. Another key (a rotation) opens nothing: the Admin
// enters the address again.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const FORMAT = "1.";
const NONCE = 12;
const TAG = 16;
const KEY_BYTES = 32;

/** The site's key, read from DISCORD_REMINDERS_KEY: 32 bytes, base64 or base64url. Null when unset or malformed. */
export function reminderKey(value: string | undefined): Buffer | null {
  if (!value || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value.trim())) return null;
  const key = Buffer.from(value.trim(), "base64");
  return key.length === KEY_BYTES ? key : null;
}

const associated = (spaceId: string) => Buffer.from(`optizzz reminders 1${spaceId}`, "utf8");

export function sealUrl(key: Buffer, spaceId: string, url: string): string {
  const nonce = randomBytes(NONCE);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG });
  cipher.setAAD(associated(spaceId));
  const body = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return FORMAT + Buffer.concat([nonce, body, cipher.getAuthTag()]).toString("base64url");
}

/** The address, or null when it does not open: another key, another space, a byte changed, an unknown format. */
export function openUrl(key: Buffer, spaceId: string, sealed: string): string | null {
  if (!sealed.startsWith(FORMAT)) return null;
  const bytes = Buffer.from(sealed.slice(FORMAT.length), "base64url");
  if (bytes.length <= NONCE + TAG) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, NONCE), { authTagLength: TAG });
    decipher.setAAD(associated(spaceId));
    decipher.setAuthTag(bytes.subarray(bytes.length - TAG));
    return Buffer.concat([decipher.update(bytes.subarray(NONCE, bytes.length - TAG)), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
