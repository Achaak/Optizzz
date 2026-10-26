import { createAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { generateKeyPair } from "@optizzz/crypto/personal-key";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newSpace } from "~/lib/spaces/access";
import { hashToken } from "~/server/extension/tokens";
import { getDiscord, postDiscordRefusal } from "./discord-routes";
import { memoryStore } from "./memory-store";
import { spaceService } from "./space-service";

const SITE = "https://optizzz.fr";
const TOKEN = "T".repeat(43);
const NOW = new Date("2026-10-26T12:00:00Z");

async function setUp() {
  const memory = memoryStore();
  const service = spaceService(memory.store, () => NOW);
  memory.addPlayer("u1", { server: "s5", playerId: 1, pseudo: "Messor", alliance: "ABC" });
  memory.link("u1");
  const pair = await generateKeyPair();
  await service.createKey("u1", { publicKey: pair.publicKey, lockedPrivateKey: "A".repeat(130) });
  const spaceId = randomUUID();
  const { sealed } = await newSpace(pair, spaceId, NOW.getTime());
  await service.createSpace("u1", { id: spaceId, server: "s5", playerId: 1, sealed });
  const deps = {
    tokens: { userOfToken: (hash: string) => Promise.resolve(hash === hashToken(TOKEN) ? "u1" : null) },
    service,
  };
  return { deps, service, spaceId };
}

const request = (init: { method?: string; body?: unknown; token?: string } = {}) =>
  new Request(`${SITE}/api/extension/discord`, {
    method: init.method ?? "GET",
    headers: { authorization: `Bearer ${init.token ?? TOKEN}`, "content-type": "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });

describe("the Discord webhook in the extension's API", () => {
  it("hands a linked extension the webhook of its spaces, still encrypted, and nothing without the token", async () => {
    const { deps, service, spaceId } = await setUp();
    expect((await getDiscord(request({ token: "x".repeat(43) }), deps)).status).toBe(401);
    expect(await (await getDiscord(request(), deps)).json()).toEqual({ spaces: [] });
    // The blob only has to name version 1 here: the site never opens it.
    const blob = await encryptData("{}", await createAllianceKeyring());
    await service.saveDiscord("u1", { spaceId, blob, expectedRevision: 0 });
    const response = await getDiscord(request(), deps);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(await response.json()).toEqual({ spaces: [{ spaceId, blob, revision: 1 }] });
  });

  it("takes a refusal of Discord for the Admins, and refuses what is not one", async () => {
    const { deps, service, spaceId } = await setUp();
    const blob = await encryptData("{}", await createAllianceKeyring());
    await service.saveDiscord("u1", { spaceId, blob, expectedRevision: 0 });
    const sent = await postDiscordRefusal(
      request({ method: "POST", body: { spaceId, revision: 1, status: 404 } }),
      deps,
    );
    expect(sent.status).toBe(204);
    const view = await service.view("u1", spaceId);
    expect(view.kind === "member" && view.discord?.refusal).toEqual({ status: 404, at: NOW, pseudo: "Messor" });
    expect(
      (await postDiscordRefusal(request({ method: "POST", body: { spaceId, revision: 1, status: 500 } }), deps)).status,
    ).toBe(400);
    expect((await postDiscordRefusal(request({ method: "POST", body: "nope" }), deps)).status).toBe(400);
    expect(
      (
        await postDiscordRefusal(
          request({ method: "POST", body: { spaceId: randomUUID(), revision: 1, status: 404 } }),
          deps,
        )
      ).status,
    ).toBe(404);
  });
});
