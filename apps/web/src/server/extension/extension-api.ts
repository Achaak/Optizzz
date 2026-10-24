// The extension's API (/api/extension/*), apart from Next and Prisma so a test can run it with a fake store. Only one
// route reads the site's session: /link, from /connect-extension, which gives the extension its token. Every other
// route takes that token alone (`Authorization: Bearer`), checked against its hash; the token is never a session of
// the site, and the session never opens these routes. No CORS header: a web page cannot read any answer.
// See docs/features/site-comptes-espaces.md, « Joueurs et extension ».
import { serverById } from "@optizzz/game/servers";
import { bearerToken, browserLabel, hashToken, newExtensionToken } from "./tokens";

export interface DeclaredPlayerRow {
  server: string;
  playerId: number;
  pseudo: string;
  declaredAt: Date;
}

/** What the API reads and writes; the site's is src/server/extension/prisma-store.ts. */
export interface ExtensionStore {
  createToken(userId: string, hash: string, browser: string): Promise<void>;
  /** The account of a token's hash, or null when the token was removed (or never existed). */
  userOfToken(hash: string): Promise<string | null>;
  deleteToken(hash: string): Promise<void>;
  playersOf(userId: string): Promise<DeclaredPlayerRow[]>;
  /** The player of the latest public export with this exact pseudo on this server. */
  exportPlayer(server: string, pseudo: string): Promise<{ id: number; pseudo: string } | null>;
  /** Declares the Player for the account: « taken » when another account already has it. */
  declarePlayer(
    userId: string,
    player: { server: string; playerId: number; pseudo: string },
  ): Promise<"declared" | "mine" | "taken">;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const problem = (status: number, error: string, message: string) => json({ error, message }, status);

const unauthorized = () =>
  problem(401, "unlinked", "Cette extension n'est plus liée à un Compte Optizzz. Connectez-la de nouveau.");

/**
 * POST /api/extension/link, from the extension's script on /connect-extension: a new token for the signed-in account.
 * Same-origin only (the browser's Origin and Sec-Fetch-Site), JSON only: another site cannot have one made.
 */
export async function link(
  request: Request,
  { userId, siteOrigin, store }: { userId: string | null; siteOrigin: string; store: ExtensionStore },
): Promise<Response> {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== siteOrigin || (fetchSite !== null && fetchSite !== "same-origin"))
    return problem(403, "forbidden", "Demande refusée.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return problem(415, "json", "Demande refusée.");
  if (!userId) return problem(401, "signed-out", "Connectez-vous à votre Compte Optizzz, puis revenez sur cette page.");
  const body: unknown = await request.json().catch(() => null);
  const browser = browserLabel(
    typeof body === "object" && body !== null ? (body as { browser?: unknown }).browser : null,
  );
  const { token, hash } = newExtensionToken();
  await store.createToken(userId, hash, browser);
  return json({ token }, 201);
}

/** The account of the request's token, or null. */
async function tokenUser(request: Request, store: ExtensionStore): Promise<{ userId: string; hash: string } | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return null;
  const hash = hashToken(token);
  const userId = await store.userOfToken(hash);
  return userId ? { userId, hash } : null;
}

const playerJson = (player: DeclaredPlayerRow) => ({
  server: player.server,
  playerId: player.playerId,
  pseudo: player.pseudo,
  declaredAt: player.declaredAt.toISOString(),
});

/** GET /api/extension/account: the account's Players, for the extension to know what to offer. */
export async function account(request: Request, store: ExtensionStore): Promise<Response> {
  const user = await tokenUser(request, store);
  if (!user) return unauthorized();
  return json({ players: (await store.playersOf(user.userId)).map(playerJson) });
}

/** DELETE /api/extension/token: « Déconnecter » in the extension removes its own token. */
export async function unlink(request: Request, store: ExtensionStore): Promise<Response> {
  const user = await tokenUser(request, store);
  if (!user) return unauthorized();
  await store.deleteToken(user.hash);
  return new Response(null, { status: 204 });
}

/**
 * POST /api/extension/players `{ server, pseudo }`: « Rattacher Pseudo (S5) à votre Compte Optizzz », clicked in the
 * extension. The id comes from the site's copy of the public export: a Player belongs to one account only.
 */
export async function declarePlayer(request: Request, store: ExtensionStore): Promise<Response> {
  const user = await tokenUser(request, store);
  if (!user) return unauthorized();
  const body: unknown = await request.json().catch(() => null);
  const { server: serverId, pseudo } = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const server = typeof serverId === "string" ? serverById(serverId) : undefined;
  if (!server || typeof pseudo !== "string" || pseudo.length === 0 || pseudo.length > 40)
    return problem(400, "invalid", "Demande incomplète.");

  const name = `${pseudo} (${server.name})`;
  const player = await store.exportPlayer(server.id, pseudo);
  if (!player)
    return problem(
      404,
      "not-in-export",
      `${name} n'est pas encore dans l'export public du serveur, que le site relit chaque heure. Réessayez plus tard.`,
    );
  const result = await store.declarePlayer(user.userId, {
    server: server.id,
    playerId: player.id,
    pseudo: player.pseudo,
  });
  if (result === "taken")
    return problem(409, "taken", `${name} est déjà rattaché à un autre Compte Optizzz ; contactez-nous.`);
  return json({ players: (await store.playersOf(user.userId)).map(playerJson) }, result === "declared" ? 201 : 200);
}
