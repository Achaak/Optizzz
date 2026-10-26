// Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "~/generated/prisma/client";
import { reminderKey } from "./at-rest";
import { prismaReminderStore } from "./prisma-store";
import { reminderService } from "./reminder-service";

const url = process.env.TEST_DATABASE_URL;
const HOOK = "https://discord.com/api/webhooks/123456789012345678/AbC-def_GHIjkl";

describe.skipIf(!url)("the reminders' store on Postgres", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  const store = prismaReminderStore(db);
  const run = randomUUID();
  const spaceId = randomUUID();
  const base = 2_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const people = [
    { userId: `test-${run}-admin`, playerId: base, role: "admin" as const },
    { userId: `test-${run}-member`, playerId: base + 1, role: "member" as const },
  ];
  const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 404 })));
  const service = reminderService({
    store,
    key: reminderKey(randomBytes(32).toString("base64")),
    fetcher,
    origin: "https://optizzz.fr",
  });

  beforeAll(async () => {
    await db.space.create({ data: { id: spaceId, server: "s5", tag: `T${run.slice(0, 6)}`, name: "Les Messors" } });
    for (const person of people) {
      await db.user.create({ data: { id: person.userId, name: "", email: `${person.userId}@example.test` } });
      await db.declaredPlayer.create({
        data: { userId: person.userId, server: "s5", playerId: person.playerId, pseudo: person.userId },
      });
      await db.spaceMember.create({
        data: { spaceId, server: "s5", playerId: person.playerId, role: person.role, publicKey: "K".repeat(43) },
      });
    }
  });

  afterAll(async () => {
    await db.space.deleteMany({ where: { id: spaceId } });
    await db.user.deleteMany({ where: { id: { in: people.map((p) => p.userId) } } });
    await db.$disconnect();
  });

  it("reads the role and the space's name", async () => {
    expect(await store.roleOf(spaceId, `test-${run}-admin`)).toBe("admin");
    expect(await store.roleOf(spaceId, `test-${run}-member`)).toBe("member");
    expect(await store.roleOf(spaceId, "nobody")).toBeNull();
    expect(await store.spaceName(spaceId)).toBe("Les Messors");
  });

  it("claims a kind once in 30 minutes, even when two events come at once", async () => {
    const now = new Date("2026-10-26T12:00:00Z");
    const window = (at: Date) => new Date(at.getTime() - 30 * 60_000);
    const both = await Promise.all([
      store.claim(spaceId, "floods", now, window(now)),
      store.claim(spaceId, "floods", now, window(now)),
    ]);
    expect(both.sort()).toEqual([false, true]);
    expect(await store.claim(spaceId, "join-requests", now, window(now))).toBe(true);
    const soon = new Date(now.getTime() + 29 * 60_000);
    expect(await store.claim(spaceId, "floods", soon, window(soon))).toBe(false);
    const later = new Date(now.getTime() + 30 * 60_000);
    expect(await store.claim(spaceId, "floods", later, window(later))).toBe(true);
  });

  it("keeps the address encrypted, suspends it on a refusal, and forgets it with the space", async () => {
    await service.save(`test-${run}-admin`, { spaceId, url: HOOK, kinds: ["join-requests"] });
    const row = await db.spaceReminders.findUnique({ where: { spaceId } });
    expect(row?.sealedUrl).toMatch(/^1\./);
    expect(row?.sealedUrl).not.toContain("discord");
    expect(row?.kinds).toEqual(["join-requests"]);
    expect(await service.remind(spaceId, "join-requests")).toBe("suspended");
    expect((await service.view(`test-${run}-admin`, spaceId)).suspension).toMatchObject({ status: 404 });
    // An address replaced in the meantime is not suspended by a refusal of the old one.
    await service.save(`test-${run}-admin`, { spaceId, url: HOOK, kinds: ["join-requests"] });
    await store.suspend(spaceId, row?.sealedUrl ?? "", 404, new Date());
    expect((await store.reminders(spaceId))?.suspension).toBeNull();
    await service.save(`test-${run}-admin`, { spaceId, kinds: ["floods"] });
    expect((await store.reminders(spaceId))?.kinds).toEqual(["floods"]);
    await db.space.delete({ where: { id: spaceId } });
    expect(await db.spaceReminders.count({ where: { spaceId } })).toBe(0);
    expect(await db.spaceReminderSent.count({ where: { spaceId } })).toBe(0);
  });
});
