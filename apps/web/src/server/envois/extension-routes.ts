// The Envois in the extension's API (/api/extension/spaces, /envoi-settings, /envois), with the token alone, like
// the rest of it (src/server/extension/extension-api.ts): no session of the site, no CORS header.
import { json, problem, tokenUser, unauthorized, type ExtensionStore } from "~/server/extension/extension-api";
import { EnvoiError, type envoiService } from "./envoi-service";

type Service = ReturnType<typeof envoiService>;

interface Dependencies {
  tokens: Pick<ExtensionStore, "userOfToken">;
  service: Service;
}

const STATUS: Record<EnvoiError["code"], number> = {
  invalid: 400,
  forbidden: 403,
  "not-found": 404,
  "stale-key": 409,
  "category-off": 409,
};

async function answer(request: Request, { tokens }: Dependencies, work: (userId: string) => Promise<Response>) {
  const user = await tokenUser(request, tokens);
  if (!user) return unauthorized();
  try {
    return await work(user.userId);
  } catch (error) {
    if (error instanceof EnvoiError) return problem(STATUS[error.code], error.code, error.message);
    throw error;
  }
}

const body = (request: Request): Promise<unknown> => request.json().catch(() => null);

/** GET /api/extension/spaces: the account's Players, their space and what its members send. */
export const getSpaces = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => json(await deps.service.spacesOf(userId)));

/** PUT /api/extension/envoi-settings `{ server, playerId, categories }`. */
export const putSettings = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => {
    await deps.service.saveSettings(userId, await body(request));
    return new Response(null, { status: 204 });
  });

/** POST /api/extension/envois: an Envoi of a list category. */
export const postEnvoi = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => {
    await deps.service.saveEnvoi(userId, await body(request));
    return new Response(null, { status: 204 });
  });

/** GET /api/extension/envois?space=…&since=…: the relève of a space's Envois. */
export const getEnvois = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => {
    const params = new URL(request.url).searchParams;
    const since = params.get("since");
    return json(
      await deps.service.readEnvois(userId, {
        spaceId: params.get("space") ?? "",
        ...(since !== null && /^\d{1,15}$/.test(since) && { since: Number(since) }),
      }),
    );
  });
