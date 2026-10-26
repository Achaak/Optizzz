// The relève of a space's Demandes by the extension, and the Demandes its Joueur reached
// (src/server/demandes/extension-routes.ts).
import { getDemandes, postDemandes } from "~/server/demandes/extension-routes";
import { demandeRoutes } from "~/server/demandes/service";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getDemandes(request, demandeRoutes);
}

export function POST(request: Request) {
  return postDemandes(request, demandeRoutes);
}
