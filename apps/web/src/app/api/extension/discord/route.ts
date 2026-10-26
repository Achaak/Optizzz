// The Discord webhook of the account's spaces, encrypted, and Discord's refusals (src/server/spaces/discord-routes.ts).
import { extensionStore } from "~/server/extension/store";
import { getDiscord, postDiscordRefusal } from "~/server/spaces/discord-routes";
import { spaces } from "~/server/spaces/service";

export const dynamic = "force-dynamic";

const deps = { tokens: extensionStore, service: spaces };

export function GET(request: Request) {
  return getDiscord(request, deps);
}

export function POST(request: Request) {
  return postDiscordRefusal(request, deps);
}
