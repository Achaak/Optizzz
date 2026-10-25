// The magic link's path: email → /login/confirm (a click) → Better Auth's verification → /account.
// The email never points at the verification itself: mail scanners that open links would burn the single-use token.

/** The address sent by email: the confirmation page, carrying the token. */
export function confirmLinkUrl(baseUrl: string, token: string): string {
  const url = new URL("/login/confirm", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Where « Se connecter » on the confirmation page goes: Better Auth consumes the token and sets the session. */
export function verifyLinkPath(token: string): string {
  const params = new URLSearchParams({ token, callbackURL: "/account", errorCallbackURL: "/login" });
  return `/api/auth/magic-link/verify?${params.toString()}`;
}

/** Where to go back after signing in (an invitation link, /spaces): only those pages of the site, nothing else. */
export function returnPath(value: string | null): string | null {
  return value !== null && /^\/spaces(\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/.test(value)
    ? value
    : null;
}

/** The browser's note of where to go back, kept while the magic link travels by email. */
export const RETURN_KEY = "optizzz:after-login";

/** What the login page says about the `error` Better Auth sends back to it. */
export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  // Better Auth answers INVALID_TOKEN for a link that is unknown, already used or past its 15 minutes.
  if (code === "INVALID_TOKEN")
    return "Ce lien ne vaut plus : il a déjà servi ou ses 15 minutes sont passées. Demandez-en un nouveau.";
  return "La connexion n'a pas abouti. Demandez un nouveau lien.";
}
