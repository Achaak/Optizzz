// « Déconnecter » in the extension: its token is removed (src/server/extension/extension-api.ts).
import { unlink } from "~/server/extension/extension-api";
import { extensionStore } from "~/server/extension/store";

export function DELETE(request: Request) {
  return unlink(request, extensionStore);
}
