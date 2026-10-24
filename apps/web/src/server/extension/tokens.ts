// The extension's token (docs/features/site-comptes-espaces.md, « Joueurs et extension »): 32 random bytes, given once
// to the extension by /connect-extension, kept by the site as a SHA-256 only. A token this long needs no slow hash: a
// stolen database gives hashes nobody can turn back into tokens.
import { createHash, randomBytes } from "node:crypto";

/** 32 bytes in base64url, without padding: 43 characters. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A new token and the hash the site keeps of it. */
export function newExtensionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** The token of an `Authorization: Bearer …` header, or null when there is none or it cannot be one of ours. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer (\S+)$/.exec(header ?? "");
  const token = match?.[1];
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

/** The browsers /account names; anything else is « Navigateur ». */
const BROWSERS = ["Chrome", "Firefox", "Edge", "Opera", "Brave"] as const;

/** The browser's name as the extension gives it, for « Chrome, lié le 24 oct. »: never free text from a request. */
export function browserLabel(value: unknown): string {
  return BROWSERS.find((browser) => browser === value) ?? "Navigateur";
}
