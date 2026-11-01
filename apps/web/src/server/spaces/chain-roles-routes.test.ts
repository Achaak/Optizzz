import { encryptData } from "@optizzz/crypto/data";
import { createAllianceKeyring } from "@optizzz/crypto/alliance-key";
import { generateKeyPair } from "@optizzz/crypto/personal-key";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newSpace } from "~/lib/spaces/access";
import { hashToken } from "~/server/extension/tokens";
import { getChainRoles } from "./chain-roles-routes";
import { memoryStore } from "./memory-store";
import { spaceService } from "./space-service";

const TOKEN = "T".repeat(43);
const NOW = new Date("2026-11-01T12:00:00Z");

const request = (token = TOKEN) =>
  new Request("https://optizzz.fr/api/extension/chain-roles", { headers: { authorization: `Bearer ${token}` } });

describe("the chain's roles in the extension's API", () => {
  it("hands a linked extension the roles of its space, still encrypted, and nothing without the token", async () => {
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

    expect((await getChainRoles(request("x".repeat(43)), deps)).status).toBe(401);
    expect(await (await getChainRoles(request(), deps)).json()).toEqual({ spaces: [] });
    // The blob only has to name version 1 here: the site never opens it.
    const blob = await encryptData("{}", await createAllianceKeyring());
    await service.saveChainRoles("u1", { spaceId, blob, expectedRevision: 0 });
    expect(await (await getChainRoles(request(), deps)).json()).toEqual({ spaces: [{ spaceId, blob, revision: 1 }] });
  });
});
