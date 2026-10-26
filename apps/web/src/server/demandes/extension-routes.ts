// The Demandes in the extension's API (/api/extension/demandes), with the token alone, like the rest of it
// (src/server/extension/extension-api.ts): no session of the site, no CORS header.
import { json, problem, tokenUser, unauthorized, type ExtensionStore } from "~/server/extension/extension-api";
import { DemandeError, type demandeService } from "./demande-service";

interface Dependencies {
  tokens: Pick<ExtensionStore, "userOfToken">;
  service: ReturnType<typeof demandeService>;
}

const STATUS: Record<DemandeError["code"], number> = {
  invalid: 400,
  forbidden: 403,
  "not-found": 404,
  "stale-key": 409,
  "needs-envois": 409,
  conflict: 409,
};

async function answer(request: Request, { tokens }: Dependencies, work: (userId: string) => Promise<Response>) {
  const user = await tokenUser(request, tokens);
  if (!user) return unauthorized();
  try {
    return await work(user.userId);
  } catch (error) {
    if (error instanceof DemandeError) return problem(STATUS[error.code], error.code, error.message);
    throw error;
  }
}

/**
 * GET /api/extension/demandes?space=…&since=…: the relève of a space's Demandes, what the extension shows (validated,
 * to validate for an Admin or a Délégué, its Joueur's own open ones).
 */
export const getDemandes = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => {
    const params = new URL(request.url).searchParams;
    const since = params.get("since");
    return json(
      await deps.service.read(userId, {
        spaceId: params.get("space") ?? "",
        scope: "extension",
        ...(since !== null && /^\d{1,15}$/.test(since) && { since: Number(since) }),
      }),
    );
  });

/** POST /api/extension/demandes `{ server, playerId, close: [ids] }`: the level reached or the work under way. */
export const postDemandes = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => {
    const body: unknown = await request.json().catch(() => null);
    const { server, playerId, close } = (typeof body === "object" && body !== null ? body : {}) as Record<
      string,
      unknown
    >;
    return json(await deps.service.close(userId, { server, playerId, ids: close }));
  });
