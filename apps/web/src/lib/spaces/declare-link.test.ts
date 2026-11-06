import { describe, expect, it, vi } from "vitest";
import { declareLinkMessage, declareUrl, postDeclareLink } from "./declare-link";

const SPACE = "4f1c2b3a-1d2e-4f5a-8b9c-0d1e2f3a4b5c";
const WEBHOOK = "https://discord.com/api/webhooks/123/abc";

describe("the declaration link", () => {
  it("is the space's page « Déclarer », with nothing of the alliance in it", () => {
    expect(declareUrl("https://optizzz.fr", SPACE)).toBe(`https://optizzz.fr/spaces/${SPACE}/declarer`);
  });

  it("goes to Discord as one plain line, the link between angle brackets (no preview)", () => {
    expect(declareLinkMessage(`https://optizzz.fr/spaces/${SPACE}/declarer`)).toBe(
      `Déclarez un flood, un convoi ou une chasse sur Optizzz : <https://optizzz.fr/spaces/${SPACE}/declarer>`,
    );
  });

  it("is posted from the Admin's browser on the announcements' webhook, with no mention allowed", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(postDeclareLink(fetcher, WEBHOOK, "https://optizzz.fr/x")).resolves.toEqual({ kind: "sent" });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(WEBHOOK);
    expect(JSON.parse(init?.body as string)).toEqual({
      content: "Déclarez un flood, un convoi ou une chasse sur Optizzz : <https://optizzz.fr/x>",
      allowed_mentions: { parse: [] },
    });
  });

  it("says what Discord answered when it refuses, and when it cannot be reached", async () => {
    const refused = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(postDeclareLink(refused, WEBHOOK, "u")).resolves.toEqual({ kind: "refused", status: 404 });
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(postDeclareLink(down, WEBHOOK, "u")).resolves.toEqual({ kind: "unreachable" });
  });
});
