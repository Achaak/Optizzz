// The account's Players and their space, for the extension's Envois (src/server/envois/extension-routes.ts).
import { getSpaces } from "~/server/envois/extension-routes";
import { envoiRoutes } from "~/server/envois/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getSpaces(request, envoiRoutes);
}
