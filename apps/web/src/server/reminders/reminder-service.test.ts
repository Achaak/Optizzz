import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { webhookHash } from "~/lib/spaces/reminders";
import { SpaceError } from "~/server/spaces/space-service";
import { openUrl, reminderKey } from "./at-rest";
import { memoryReminderStore } from "./memory-store";
import { reminderService } from "./reminder-service";

const SPACE = "0b0e4f4c-1d2e-4a3b-8c4d-5e6f7a8b9c0d";
const HOOK = "https://discord.com/api/webhooks/123456789012345678/AbC-def_GHIjkl";
const ORIGIN = "https://optizzz.fr";
const KEY = reminderKey(randomBytes(32).toString("base64"));

function setUp({ key = KEY, status = 204 }: { key?: Buffer | null; status?: number } = {}) {
  const memory = memoryReminderStore();
  memory.addSpace(SPACE, "Les Messors", { admin: "admin", delegate: "delegate", member: "member" });
  let at = new Date("2026-10-26T12:00:00Z");
  const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status })));
  const service = reminderService({ store: memory.store, key, fetcher, origin: ORIGIN, now: () => at });
  return {
    memory,
    service,
    fetcher,
    later: (minutes: number) => {
      at = new Date(at.getTime() + minutes * 60_000);
    },
  };
}

const posted = (fetcher: ReturnType<typeof setUp>["fetcher"]) =>
  fetcher.mock.calls.map(([url, init]) => ({ url, body: JSON.parse(init?.body as string) as { content: string } }));

describe("the reminders' settings, for an Admin", () => {
  it("keeps the address encrypted with the site's key, and shows it masked with its hash", async () => {
    const { service, memory } = setUp();
    await service.save("admin", { spaceId: SPACE, url: ` ${HOOK}/ `, kinds: ["join-requests"] });
    const row = memory.row(SPACE);
    expect(row?.sealedUrl).not.toContain("discord");
    if (!KEY || !row) throw new Error("no row");
    expect(openUrl(KEY, SPACE, row.sealedUrl)).toBe(HOOK);
    expect(await service.view("admin", SPACE)).toEqual({
      available: true,
      address: { masked: "discord.com/api/webhooks/1234…/••••Ijkl", hash: await webhookHash(HOOK) },
      unreadable: false,
      kinds: ["join-requests"],
      suspension: null,
    });
  });

  it("is an Admin's alone", async () => {
    const { service } = setUp();
    for (const userId of ["delegate", "member", "stranger"]) {
      await expect(service.view(userId, SPACE)).rejects.toThrow(SpaceError);
      await expect(service.save(userId, { spaceId: SPACE, url: HOOK, kinds: [] })).rejects.toThrow(SpaceError);
    }
  });

  it("refuses what is not a Discord webhook, and a kind it does not know", async () => {
    const { service } = setUp();
    await expect(
      service.save("admin", { spaceId: SPACE, url: "https://example.com/api/webhooks/1/t", kinds: [] }),
    ).rejects.toThrow(/webhook Discord/);
    await expect(service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["army"] })).rejects.toThrow(SpaceError);
  });

  it("changes the kinds alone, the address kept; not before an address", async () => {
    const { service } = setUp();
    await expect(service.save("admin", { spaceId: SPACE, kinds: ["floods"] })).rejects.toThrow(SpaceError);
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: [] });
    await service.save("admin", { spaceId: SPACE, kinds: ["floods", "join-requests", "floods"] });
    const view = await service.view("admin", SPACE);
    expect(view.kinds).toEqual(["join-requests", "floods"]);
    expect(view.address?.hash).toBe(await webhookHash(HOOK));
  });

  it("« Retirer l'adresse » forgets the address and the kinds", async () => {
    const { service, memory } = setUp();
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["floods"] });
    await service.save("admin", { spaceId: SPACE, url: null, kinds: [] });
    expect(memory.row(SPACE)).toBeUndefined();
    expect((await service.view("admin", SPACE)).address).toBeNull();
  });

  it("without the site's key: unavailable, nothing saved, nothing posted, and no crash", async () => {
    const { service, fetcher } = setUp({ key: null });
    expect(await service.view("admin", SPACE)).toMatchObject({ available: false, address: null });
    await expect(service.save("admin", { spaceId: SPACE, url: HOOK, kinds: [] })).rejects.toThrow(
      /pas encore disponibles/,
    );
    expect(await service.remind(SPACE, "join-requests")).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("says when the address no longer opens (the site's key changed)", async () => {
    const first = setUp();
    await first.service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["floods"] });
    const row = first.memory.row(SPACE);
    if (!row) throw new Error("no row");
    const second = setUp({ key: reminderKey(randomBytes(32).toString("base64")) });
    await second.memory.store.saveReminders(SPACE, row.sealedUrl, row.kinds);
    expect(await second.service.view("admin", SPACE)).toMatchObject({ unreadable: true, address: null });
    expect(await second.service.remind(SPACE, "floods")).toBe("skipped");
    expect(second.fetcher).not.toHaveBeenCalled();
  });
});

describe("posting a reminder", () => {
  it("posts the space's name, the kind and the link, for a kind an Admin switched on", async () => {
    const { service, fetcher } = setUp();
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["join-requests"] });
    expect(await service.remind(SPACE, "join-requests")).toBe("sent");
    expect(posted(fetcher)).toEqual([
      {
        url: HOOK,
        body: expect.objectContaining({
          content: `Nouvelle demande pour rejoindre l'espace Les Messors, à voir sur Optizzz : <${ORIGIN}/spaces/${SPACE}>`,
        }) as unknown,
      },
    ]);
  });

  it("posts nothing for a kind left off, nor without an address", async () => {
    const { service, fetcher } = setUp();
    expect(await service.remind(SPACE, "floods")).toBe("skipped");
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["join-requests"] });
    expect(await service.remind(SPACE, "floods")).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts one reminder of a kind every 30 minutes at most, per space", async () => {
    const { service, fetcher, later } = setUp();
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["join-requests", "floods"] });
    expect(await service.remind(SPACE, "floods")).toBe("sent");
    expect(await service.remind(SPACE, "floods")).toBe("skipped");
    expect(await service.remind(SPACE, "join-requests")).toBe("sent");
    later(29);
    expect(await service.remind(SPACE, "floods")).toBe("skipped");
    later(1);
    expect(await service.remind(SPACE, "floods")).toBe("sent");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([401, 404])("suspends the reminders when Discord answers %i, until an Admin saves again", async (status) => {
    const { service, fetcher, later } = setUp({ status });
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["floods", "join-requests"] });
    expect(await service.remind(SPACE, "floods")).toBe("suspended");
    expect((await service.view("admin", SPACE)).suspension).toEqual({
      status,
      at: new Date("2026-10-26T12:00:00Z"),
    });
    later(60);
    expect(await service.remind(SPACE, "join-requests")).toBe("skipped");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["floods"] });
    expect((await service.view("admin", SPACE)).suspension).toBeNull();
  });

  it.each([429, 500])("drops the reminder on %i, and keeps the reminders on", async (status) => {
    const { service } = setUp({ status });
    await service.save("admin", { spaceId: SPACE, url: HOOK, kinds: ["floods"] });
    expect(await service.remind(SPACE, "floods")).toBe("dropped");
    expect((await service.view("admin", SPACE)).suspension).toBeNull();
  });

  it("never throws: a store that fails is logged, not raised", async () => {
    const { service, memory } = setUp();
    vi.spyOn(memory.store, "reminders").mockRejectedValue(new Error("database down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.remind(SPACE, "floods")).toBe("dropped");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
