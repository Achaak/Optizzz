// The site's own address, for the magic links and Better Auth's `baseURL`. Never read from the request: a forged Host
// would send another person's link to the forger's domain.

interface OriginSource {
  nodeEnv: "development" | "test" | "production";
  /** BETTER_AUTH_URL: required in production (https://optizzz.fr). */
  betterAuthUrl?: string;
  /** The dev server's port. */
  port?: string;
}

export function siteOrigin({ nodeEnv, betterAuthUrl, port }: OriginSource): string {
  if (betterAuthUrl) return new URL(betterAuthUrl).origin;
  if (nodeEnv !== "production") return `http://localhost:${port ?? "3000"}`;
  throw new Error("Set BETTER_AUTH_URL: the site's address, for the magic links");
}
