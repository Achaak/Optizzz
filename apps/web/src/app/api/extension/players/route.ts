// « Rattacher Pseudo (S5) à votre Compte Optizzz », clicked in the extension (src/server/extension/extension-api.ts).
import { declarePlayer } from "~/server/extension/extension-api";
import { extensionStore } from "~/server/extension/store";

export function POST(request: Request) {
  return declarePlayer(request, extensionStore);
}
