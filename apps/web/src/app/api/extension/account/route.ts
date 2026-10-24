// The linked account's Players, for the extension (src/server/extension/extension-api.ts).
import { account } from "~/server/extension/extension-api";
import { extensionStore } from "~/server/extension/store";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return account(request, extensionStore);
}
