// The extension's token, asked by its script on /connect-extension (src/server/extension/extension-api.ts).
import { auth, ownOrigin } from "~/server/auth";
import { link } from "~/server/extension/extension-api";
import { extensionStore } from "~/server/extension/store";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableRefresh: true } });
  return link(request, { userId: session?.user.id ?? null, siteOrigin: ownOrigin, store: extensionStore });
}
