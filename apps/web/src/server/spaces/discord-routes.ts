// The Discord webhook in the extension's API (/api/extension/discord, docs/features/site-discord.md), with the token
// alone, like the rest of it (src/server/extension/extension-api.ts): no session of the site, no CORS header. The site
// hands each member's extension the webhook still encrypted, and takes a refusal of Discord without any of the message:
// it never posts to this webhook itself (its own content-free reminders go to a second one: src/server/reminders/).
import { json, problem, tokenUser, unauthorized, type ExtensionStore } from "~/server/extension/extension-api";
import { SpaceError, type spaceService } from "./space-service";

interface Dependencies {
  tokens: Pick<ExtensionStore, "userOfToken">;
  service: Pick<ReturnType<typeof spaceService>, "discordForExtension" | "reportDiscordRefusal">;
}

const STATUS: Record<SpaceError["code"], number> = { invalid: 400, forbidden: 403, "not-found": 404, conflict: 409 };

async function answer(request: Request, { tokens }: Dependencies, work: (userId: string) => Promise<Response>) {
  const user = await tokenUser(request, tokens);
  if (!user) return unauthorized();
  try {
    return await work(user.userId);
  } catch (error) {
    if (error instanceof SpaceError) return problem(STATUS[error.code], error.code, error.message);
    throw error;
  }
}

/** GET /api/extension/discord: `{ spaces: [{ spaceId, blob, revision }] }`. */
export const getDiscord = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => json({ spaces: await deps.service.discordForExtension(userId) }));

/** POST /api/extension/discord `{ spaceId, revision, status }`: Discord refused a message with this HTTP status. */
export const postDiscordRefusal = (request: Request, deps: Dependencies) =>
  answer(request, deps, async (userId) => {
    const body: unknown = await request.json().catch(() => null);
    const { spaceId, revision, status } = (typeof body === "object" && body !== null ? body : {}) as Record<
      string,
      unknown
    >;
    if (typeof spaceId !== "string" || typeof revision !== "number" || typeof status !== "number")
      return problem(400, "invalid", "Demande incomplète.");
    await deps.service.reportDiscordRefusal(userId, { spaceId, revision, status });
    return new Response(null, { status: 204 });
  });
