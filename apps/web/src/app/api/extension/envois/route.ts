// An Envoi from the extension, and its relève of a space's Envois (src/server/envois/extension-routes.ts).
import { getEnvois, postEnvoi } from "~/server/envois/extension-routes";
import { envoiRoutes } from "~/server/envois/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getEnvois(request, envoiRoutes);
}

export function POST(request: Request) {
  return postEnvoi(request, envoiRoutes);
}
