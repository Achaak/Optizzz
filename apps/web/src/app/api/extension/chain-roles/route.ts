// The chain's roles of the account's spaces, encrypted (src/server/spaces/chain-roles-routes.ts).
import { extensionStore } from "~/server/extension/store";
import { getChainRoles } from "~/server/spaces/chain-roles-routes";
import { spaces } from "~/server/spaces/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getChainRoles(request, { tokens: extensionStore, service: spaces });
}
