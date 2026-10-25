// What a Joueur sends, chosen in the extension (src/server/envois/extension-routes.ts).
import { putSettings } from "~/server/envois/extension-routes";
import { envoiRoutes } from "~/server/envois/service";

export function PUT(request: Request) {
  return putSettings(request, envoiRoutes);
}
