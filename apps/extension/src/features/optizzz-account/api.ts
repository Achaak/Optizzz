// The site's API for a linked extension (apps/web/src/server/extension/extension-api.ts), called by the background
// script only, with the token. Answers are checked with zod: they are data, never code.
import { EXTENSION_API } from "@optizzz/game/site-links/extension-link";
import { SITE_URL } from "@optizzz/game/site-links/site";
import { z } from "zod";
import type { AttachedPlayer } from "@/data/optizzz-account";

const TIMEOUT_MS = 15_000;

const playersSchema = z.object({ players: z.array(z.object({ server: z.string(), pseudo: z.string() })) });
const problemSchema = z.object({ message: z.string(), error: z.string().optional() });

const spacesSchema = z.object({
  players: z.array(
    z.object({
      server: z.string(),
      playerId: z.number().int(),
      pseudo: z.string(),
      categories: z.array(z.string()),
      space: z
        .object({
          id: z.string(),
          name: z.string(),
          tag: z.string(),
          version: z.object({
            version: z.number().int(),
            createdAt: z.string(),
            createdByPseudo: z.string().nullable(),
          }),
          members: z.array(
            z.object({ playerId: z.number().int(), pseudo: z.string(), categories: z.array(z.string()) }),
          ),
        })
        .nullable(),
    }),
  ),
});

const envoisSchema = z.object({
  cursor: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      server: z.string(),
      playerId: z.number().int(),
      category: z.string(),
      fingerprint: z.string(),
      blob: z.string(),
    }),
  ),
  live: z.array(z.string()).nullable(),
});

/** An Envoi of a list category, as POST /api/extension/envois takes it. */
export interface EnvoiBody {
  server: string;
  playerId: number;
  category: "convoys";
  keyVersion: number;
  items: { fingerprint: string; blob: string; expiresAt: number }[];
  removed: string[];
}

export type ApiResult<T> =
  | { ok: true; value: T }
  /** The token was removed (from /account): the extension is no longer linked. */
  | { ok: false; unlinked: true }
  | { ok: false; unlinked: false; message: string; error?: string };

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const UNREACHABLE = "optizzz.fr ne répond pas. Réessayez plus tard.";

async function call<T>(
  fetchFn: Fetch,
  token: string,
  path: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetchFn(`${SITE_URL}${path}`, {
      ...init,
      // The token alone: no cookie of the site goes with it.
      credentials: "omit",
      headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, unlinked: false, message: UNREACHABLE };
  }
  if (response.status === 401) return { ok: false, unlinked: true };
  if (!response.ok) {
    const problem = problemSchema.safeParse(await response.json().catch(() => null));
    return problem.success
      ? {
          ok: false,
          unlinked: false,
          message: problem.data.message,
          ...(problem.data.error !== undefined && { error: problem.data.error }),
        }
      : { ok: false, unlinked: false, message: UNREACHABLE };
  }
  try {
    return { ok: true, value: await read(response) };
  } catch {
    return { ok: false, unlinked: false, message: UNREACHABLE };
  }
}

const readPlayers = async (response: Response): Promise<AttachedPlayer[]> =>
  playersSchema.parse(await response.json()).players;

export function siteApi(token: string, fetchFn: Fetch = (url, init) => fetch(url, init)) {
  return {
    /** The account's Players. */
    players: () => call(fetchFn, token, EXTENSION_API.account, { method: "GET" }, readPlayers),
    /** « Rattacher »: the account's Players after it, or the site's message (« déjà rattaché à un autre compte… »). */
    attach: (server: string, pseudo: string) =>
      call(
        fetchFn,
        token,
        EXTENSION_API.players,
        { method: "POST", body: JSON.stringify({ server, pseudo }) },
        readPlayers,
      ),
    /** « Déconnecter »: the site removes the token. */
    unlink: () => call(fetchFn, token, EXTENSION_API.token, { method: "DELETE" }, () => Promise.resolve(null)),
    /** The account's Players, their space, its newest key version and what its members send. */
    spaces: () =>
      call(fetchFn, token, EXTENSION_API.spaces, { method: "GET" }, async (r) => spacesSchema.parse(await r.json())),
    /** What a Joueur sends, for the space page. */
    saveSettings: (server: string, playerId: number, categories: string[]) =>
      call(
        fetchFn,
        token,
        EXTENSION_API.envoiSettings,
        { method: "PUT", body: JSON.stringify({ server, playerId, categories }) },
        () => Promise.resolve(null),
      ),
    /** An Envoi: the category's items, encrypted, and the fingerprints gone. */
    sendEnvoi: (body: EnvoiBody) =>
      call(fetchFn, token, EXTENSION_API.envois, { method: "POST", body: JSON.stringify(body) }, () =>
        Promise.resolve(null),
      ),
    /** The relève of a space's Envois: what was written since `since`, and the rows still there. */
    readEnvois: (spaceId: string, since: number | null) =>
      call(
        fetchFn,
        token,
        `${EXTENSION_API.envois}?space=${encodeURIComponent(spaceId)}${since === null ? "" : `&since=${String(Math.max(0, Math.floor(since)))}`}`,
        { method: "GET" },
        async (r) => envoisSchema.parse(await r.json()),
      ),
  };
}
