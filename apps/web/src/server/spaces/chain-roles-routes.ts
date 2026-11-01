// The chain's roles in the extension's API (/api/extension/chain-roles, docs/features/site-chaine.md), with the token
// alone, like the rest of it (src/server/extension/extension-api.ts): no session of the site, no CORS header. The site
// hands each member's extension the roles still encrypted with the Clé d'alliance; the extension never writes them.
import { json, tokenUser, unauthorized, type ExtensionStore } from "~/server/extension/extension-api";
import type { spaceService } from "./space-service";

interface Dependencies {
  tokens: Pick<ExtensionStore, "userOfToken">;
  service: Pick<ReturnType<typeof spaceService>, "chainRolesForExtension">;
}

/** GET /api/extension/chain-roles: `{ spaces: [{ spaceId, blob, revision }] }`. */
export async function getChainRoles(request: Request, { tokens, service }: Dependencies): Promise<Response> {
  const user = await tokenUser(request, tokens);
  if (!user) return unauthorized();
  return json({ spaces: await service.chainRolesForExtension(user.userId) });
}
