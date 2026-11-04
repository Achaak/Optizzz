import { createAllianceKeyring, rotateAllianceKey, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { beforeEach, describe, expect, it } from "vitest";
import { EnvoiError, envoiService } from "./envoi-service";
import { memoryEnvoiStore } from "./memory-store";

const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const NOW = new Date("2026-10-25T12:00:00Z");
const DAY = 24 * 3600_000;
const messor = { server: "s5", playerId: 1, pseudo: "Messor", userId: "u-messor" };
const lasius = { server: "s5", playerId: 2, pseudo: "Lasius", userId: "u-lasius" };
const outsider = { server: "s5", playerId: 3, pseudo: "Outsider", userId: "u-out" };

async function failure(promise: Promise<unknown>): Promise<EnvoiError> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(EnvoiError);
  return error as EnvoiError;
}

const fp = (n: number) => `fingerprint${String(n).padStart(11, "0")}`;

describe("the Envois on the site", () => {
  let memory: ReturnType<typeof memoryEnvoiStore>;
  let service: ReturnType<typeof envoiService>;
  let now: Date;
  let keyring: AllianceKeyring;
  let reminders: [string, string][];

  const item = async (n: number, text = `convoi ${String(n)}`, ring = keyring) => ({
    fingerprint: fp(n),
    blob: await encryptData(text, ring),
    expiresAt: now.getTime() + 90 * DAY,
  });
  const send = (
    who: typeof messor,
    items: Awaited<ReturnType<typeof item>>[],
    removed: string[] = [],
    keyVersion = 1,
  ) =>
    service.saveEnvoi(who.userId, {
      server: who.server,
      playerId: who.playerId,
      category: "convoys",
      keyVersion,
      items,
      removed,
    });

  beforeEach(async () => {
    memory = memoryEnvoiStore();
    now = NOW;
    reminders = [];
    service = envoiService(
      memory.store,
      () => now,
      (spaceId, kind) => reminders.push([spaceId, kind]),
    );
    keyring = await createAllianceKeyring();
    for (const p of [messor, lasius, outsider]) memory.addPlayer(p);
    memory.addSpace({ id: SPACE, server: "s5", tag: "ABC", name: "ABC sur S5" }, [messor, lasius]);
  });

  it("tells the extension each Player's space, its newest key version and what each member sends", async () => {
    memory.addVersion(SPACE, { version: 2, createdAt: new Date("2026-10-24T18:59:00Z"), createdByPseudo: "Lasius" });
    await service.saveSettings(lasius.userId, { server: "s5", playerId: 2, categories: ["convoys"] });
    const { players } = await service.spacesOf(messor.userId);
    expect(players).toEqual([
      {
        server: "s5",
        playerId: 1,
        pseudo: "Messor",
        categories: [],
        space: {
          id: SPACE,
          name: "ABC sur S5",
          tag: "ABC",
          version: { version: 2, createdAt: "2026-10-24T18:59:00.000Z", createdByPseudo: "Lasius" },
          members: [
            { playerId: 1, pseudo: "Messor", categories: [] },
            { playerId: 2, pseudo: "Lasius", categories: ["convoys"] },
          ],
        },
      },
    ]);
    expect((await service.spacesOf(outsider.userId)).players[0]?.space).toBeNull();
  });

  it("keeps a Joueur's categories, only the known ones, only for the account's own Players", async () => {
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys", "convoys"] });
    expect(await memory.store.settingsOf(messor)).toEqual(["convoys"]);
    expect(
      (await failure(service.saveSettings(messor.userId, { server: "s5", playerId: 2, categories: [] }))).code,
    ).toBe("forbidden");
    expect(
      (await failure(service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["passwords"] })))
        .code,
    ).toBe("invalid");
  });

  it("refuses convoys while the category is off: nothing is kept", async () => {
    const error = await failure(send(messor, [await item(1)]));
    expect(error.code).toBe("category-off");
    expect(memory.rows()).toEqual([]);
  });

  it("keeps the convoys attached to a Demande with « Convois » checked, and refuses them without it", async () => {
    const sendAttached = async () =>
      service.saveEnvoi(messor.userId, {
        server: "s5",
        playerId: 1,
        category: "demande-convoys",
        keyVersion: 1,
        items: [await item(1)],
        removed: [],
      });
    expect((await failure(sendAttached())).code).toBe("category-off");
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
    await sendAttached();
    expect(memory.rows().map((r) => r.category)).toEqual(["demande-convoys"]);
  });

  it("keeps a convoy declared on the space page without any setting, and lets its sender withdraw it", async () => {
    const declare = async (removed: string[] = []) =>
      service.saveEnvoi(messor.userId, {
        server: "s5",
        playerId: 1,
        category: "declared-convoys",
        keyVersion: 1,
        items: removed.length > 0 ? [] : [await item(1)],
        removed,
      });
    await declare();
    const [row] = memory.rows();
    expect(row?.category).toBe("declared-convoys");
    await declare([row?.fingerprint ?? ""]);
    expect(memory.rows()).toEqual([]);
  });

  it("keeps the encrypted convoys of a checked category, rewriting a row only when it changes", async () => {
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
    const first = await item(1);
    await send(messor, [first, await item(2)]);
    expect(memory.rows().map((r) => [r.fingerprint, r.blob])).toEqual([
      [fp(1), first.blob],
      [fp(2), expect.any(String)],
    ]);
    // Only ciphertext reaches the site.
    expect(JSON.stringify(memory.rows())).not.toContain("convoi");

    now = new Date(NOW.getTime() + 60_000);
    const changed = await item(2, "convoi 2, plus gros");
    await send(messor, [first, changed], [fp(3)]);
    const rows = memory.rows();
    expect(rows.find((r) => r.fingerprint === fp(1))?.updatedAt).toEqual(NOW);
    expect(rows.find((r) => r.fingerprint === fp(2))).toMatchObject({ blob: changed.blob, updatedAt: now });

    await send(messor, [], [fp(1)]);
    expect(memory.rows().map((r) => r.fingerprint)).toEqual([fp(2)]);
  });

  it("refuses an Envoi under an older version of the Clé d'alliance, or whose blob names another version", async () => {
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
    memory.addVersion(SPACE, { version: 2, createdAt: NOW, createdByPseudo: "Lasius" });
    const stale = await failure(send(messor, [await item(1)]));
    expect(stale.code).toBe("stale-key");
    expect(stale.message).toBe("Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi.");
    // Says version 2, but the blob was encrypted with version 1.
    expect((await failure(send(messor, [await item(1)], [], 2))).code).toBe("invalid");
    const newer = await rotateAllianceKey(keyring);
    await send(messor, [await item(1, "convoi", newer)], [], 2);
    expect(memory.rows()).toHaveLength(1);
  });

  it("refuses an Envoi for a Player of another account, or not in a space", async () => {
    await service.saveSettings(outsider.userId, { server: "s5", playerId: 3, categories: ["convoys"] });
    expect((await failure(send({ ...lasius, userId: messor.userId }, [await item(1)]))).code).toBe("forbidden");
    expect((await failure(send(outsider, [await item(1)]))).code).toBe("not-found");
  });

  it("refuses what is not an encrypted item", async () => {
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
    const good = await item(1);
    for (const bad of [
      { ...good, fingerprint: "short" },
      { ...good, blob: "not-base64!" },
      { ...good, expiresAt: Number.NaN },
    ])
      expect((await failure(send(messor, [bad]))).code).toBe("invalid");
  });

  it("forgets nothing before 90 days after the arrival, and never keeps a row longer than 100 days", async () => {
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
    const past = { ...(await item(1)), expiresAt: now.getTime() - 1 };
    const far = { ...(await item(2)), expiresAt: now.getTime() + 400 * DAY };
    await send(messor, [past, far]);
    expect(memory.rows().map((r) => [r.fingerprint, r.expiresAt.getTime()])).toEqual([
      [fp(2), now.getTime() + 100 * DAY],
    ]);
    now = new Date(now.getTime() + 101 * DAY);
    expect((await service.readEnvois(lasius.userId, { spaceId: SPACE })).items).toEqual([]);
  });

  it("shows every member the convoys of all, and a non-member nothing", async () => {
    for (const who of [messor, lasius])
      await service.saveSettings(who.userId, { server: "s5", playerId: who.playerId, categories: ["convoys"] });
    await send(messor, [await item(1)]);
    await send(lasius, [await item(1), await item(2)]);
    const read = await service.readEnvois(messor.userId, { spaceId: SPACE });
    expect(read.items.map((r) => [r.playerId, r.fingerprint])).toEqual([
      [1, fp(1)],
      [2, fp(1)],
      [2, fp(2)],
    ]);
    expect((await failure(service.readEnvois(outsider.userId, { spaceId: SPACE }))).code).toBe("forbidden");
    expect((await failure(service.readEnvois(outsider.userId, { spaceId: "nope" }))).code).toBe("not-found");
  });

  it("gives a relève only what changed since, and the rows still there", async () => {
    await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
    await send(messor, [await item(1), await item(2)]);
    // A write still committing as a relève reads must not be missed: the cursor gives back a few seconds.
    now = new Date(NOW.getTime() + 5_000);
    const early = await service.readEnvois(lasius.userId, { spaceId: SPACE });
    expect(early.cursor).toBeLessThan(NOW.getTime());
    now = new Date(NOW.getTime() + 60_000);
    const first = await service.readEnvois(lasius.userId, { spaceId: SPACE, since: early.cursor });
    expect(first.items).toHaveLength(2);

    now = new Date(NOW.getTime() + 5 * 60_000);
    await send(messor, [await item(3)], [fp(1)]);
    const next = await service.readEnvois(lasius.userId, { spaceId: SPACE, since: first.cursor });
    expect(next.items.map((r) => r.fingerprint)).toEqual([fp(3)]);
    expect(next.live).toHaveLength(2);
    expect(next.live).not.toContain(first.items.find((r) => r.fingerprint === fp(1))?.id);
    expect(next.cursor).toBeGreaterThan(first.cursor);
  });

  describe("the hunts log", () => {
    const hunt = async (n: number, expiresAt = now.getTime() + 90 * DAY) => ({
      fingerprint: fp(n),
      blob: await encryptData(`hunt ${String(n)}`, keyring),
      expiresAt,
    });
    const sendHunts = (items: Awaited<ReturnType<typeof hunt>>[]) =>
      service.saveEnvoi(messor.userId, {
        server: "s5",
        playerId: 1,
        category: "hunts-log",
        keyVersion: 1,
        items,
        removed: [],
      });

    it("is kept with « Chasses », one row per hunt, 90 days after its return and never more than 120 days", async () => {
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
      expect((await failure(sendHunts([await hunt(1)]))).code).toBe("category-off");
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["hunts"] });
      await sendHunts([await hunt(1), await hunt(2, now.getTime() + 400 * DAY)]);
      expect(memory.rows().map((r) => [r.category, r.fingerprint, r.expiresAt.getTime()])).toEqual([
        ["hunts-log", fp(1), now.getTime() + 90 * DAY],
        ["hunts-log", fp(2), now.getTime() + 120 * DAY],
      ]);
      const read = await service.readEnvois(lasius.userId, { spaceId: SPACE });
      expect(read.items.map((r) => r.category)).toEqual(["hunts-log", "hunts-log"]);
    });
  });

  describe("the floods", () => {
    const flood = async (n: number, detail: string | null = null, ring = keyring) => ({
      fingerprint: fp(n),
      blob: await encryptData(`flood ${String(n)}`, ring),
      ...(detail !== null && { detail: await encryptData(detail, ring) }),
      expiresAt: now.getTime() + 2 * DAY,
    });
    const sendFloods = (who: typeof messor, items: Awaited<ReturnType<typeof flood>>[], removed: string[] = []) =>
      service.saveEnvoi(who.userId, {
        server: who.server,
        playerId: who.playerId,
        category: "floods",
        keyVersion: 1,
        items,
        removed,
      });

    it("are kept only while « Floods » is checked, apart from the convoys", async () => {
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["convoys"] });
      expect((await failure(sendFloods(messor, [await flood(1)]))).code).toBe("category-off");
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["floods"] });
      await sendFloods(messor, [await flood(1)]);
      expect(memory.rows().map((r) => [r.category, r.fingerprint])).toEqual([["floods", fp(1)]]);
      expect((await failure(send(messor, [await item(2)]))).code).toBe("category-off");
    });

    it("hand the army sent to the space's Admins only", async () => {
      memory.setRole(SPACE, messor, "admin");
      for (const who of [messor, lasius])
        await service.saveSettings(who.userId, { server: "s5", playerId: who.playerId, categories: ["floods"] });
      const sent = await flood(1, "12 000 JSN");
      await sendFloods(lasius, [sent, await flood(2)]);
      const admin = await service.readEnvois(messor.userId, { spaceId: SPACE });
      expect(admin.items.map((r) => [r.fingerprint, r.detail])).toEqual([
        [fp(1), sent.detail],
        [fp(2), null],
      ]);
      const member = await service.readEnvois(lasius.userId, { spaceId: SPACE });
      expect(member.items.map((r) => [r.fingerprint, r.detail])).toEqual([
        [fp(1), null],
        [fp(2), null],
      ]);
      expect(JSON.stringify(member)).not.toContain(sent.detail ?? "none");
    });

    it("rewrite a flood whose army alone changed, and refuse an army under another version or for the convoys", async () => {
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["floods", "convoys"] });
      const first = await flood(1, "100 JSN");
      await sendFloods(messor, [first]);
      now = new Date(NOW.getTime() + 60_000);
      const changed = { ...first, detail: await encryptData("200 JSN", keyring) };
      await sendFloods(messor, [changed]);
      expect(memory.rows()[0]).toMatchObject({ detail: changed.detail, updatedAt: now });

      const other = await createAllianceKeyring();
      expect(
        (
          await failure(
            sendFloods(messor, [{ ...first, detail: await encryptData("x", await rotateAllianceKey(other)) }]),
          )
        ).code,
      ).toBe("invalid");
      expect((await failure(send(messor, [{ ...(await item(3)), detail: first.detail } as never]))).code).toBe(
        "invalid",
      );
    });

    it("ask for a reminder on Discord when a flood row is new, never for one already kept nor for convoys", async () => {
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["floods", "convoys"] });
      const first = await flood(1);
      await sendFloods(messor, [first]);
      expect(reminders).toEqual([[SPACE, "floods"]]);
      await sendFloods(messor, [first]);
      await sendFloods(messor, [], [fp(1)]);
      await send(messor, [await item(2)]);
      expect(reminders).toHaveLength(1);
      await sendFloods(messor, [await flood(3)]);
      expect(reminders).toEqual([
        [SPACE, "floods"],
        [SPACE, "floods"],
      ]);
    });

    it("never keep a flood longer than 40 days, whatever the extension says", async () => {
      await service.saveSettings(messor.userId, { server: "s5", playerId: 1, categories: ["floods"] });
      await sendFloods(messor, [{ ...(await flood(1)), expiresAt: now.getTime() + 400 * DAY }]);
      const [row] = memory.rows();
      expect(row && row.expiresAt.getTime() - now.getTime()).toBeLessThanOrEqual(40 * DAY);
    });
  });

  describe("the states", () => {
    const state = async (text: string, detail: string | null = null, ring = keyring) => ({
      fingerprint: fp(9),
      blob: await encryptData(text, ring),
      ...(detail !== null && { detail: await encryptData(detail, ring) }),
      expiresAt: now.getTime() + 90 * DAY,
    });
    const sendState = (who: typeof messor, category: string, items: Awaited<ReturnType<typeof state>>[]) =>
      service.saveEnvoi(who.userId, {
        server: who.server,
        playerId: who.playerId,
        category,
        keyVersion: 1,
        items,
        removed: [],
      });
    const choose = (who: typeof messor, categories: string[]) =>
      service.saveSettings(who.userId, { server: "s5", playerId: who.playerId, categories });

    it("keep one row per Joueur and category, each only while it is checked", async () => {
      await choose(messor, ["production", "hunts", "levels"]);
      for (const category of ["production", "hunts", "levels"])
        await sendState(messor, category, [await state(category)]);
      expect(memory.rows().map((r) => r.category)).toEqual(["production", "hunts", "levels"]);
      expect((await failure(sendState(messor, "army", [await state("army")]))).code).toBe("category-off");
    });

    it("refuse a state of more than one row", async () => {
      await choose(messor, ["production"]);
      const two = [await state("a"), { ...(await state("b")), fingerprint: fp(8) }];
      expect((await failure(sendState(messor, "production", two))).code).toBe("invalid");
    });

    it("take the army as a number or by unit, the units only « Par unité », for the Admins only", async () => {
      memory.setRole(SPACE, messor, "admin");
      await choose(lasius, ["army-count"]);
      expect((await failure(sendState(lasius, "army", [await state("12 000", "12 000 JSN")]))).code).toBe(
        "category-off",
      );
      await sendState(lasius, "army", [await state("12 000")]);
      await choose(lasius, ["army-units"]);
      const sent = await state("12 001", "12 001 JSN");
      now = new Date(NOW.getTime() + 60_000);
      await sendState(lasius, "army", [sent]);
      const admin = await service.readEnvois(messor.userId, { spaceId: SPACE });
      expect(admin.items.map((r) => [r.category, r.detail])).toEqual([["army", sent.detail]]);
      const member = await service.readEnvois(lasius.userId, { spaceId: SPACE });
      expect(member.items.map((r) => [r.category, r.detail])).toEqual([["army", null]]);
    });

    it("go when their category is unchecked, and the units when « Par unité » is", async () => {
      await choose(messor, ["production", "army-units", "convoys"]);
      await sendState(messor, "production", [await state("production")]);
      await sendState(messor, "army", [await state("army", "units")]);
      await send(messor, [await item(1)]);
      now = new Date(NOW.getTime() + 60_000);
      await choose(messor, ["army-count", "convoys"]);
      expect(memory.rows().map((r) => [r.category, r.detail, r.updatedAt])).toEqual([
        ["army", null, now],
        ["convoys", null, NOW],
      ]);
      await choose(messor, []);
      expect(memory.rows().map((r) => r.category)).toEqual(["convoys"]);
    });

    it("never stay longer than 100 days without a new Envoi", async () => {
      await choose(messor, ["levels"]);
      await sendState(messor, "levels", [{ ...(await state("levels")), expiresAt: now.getTime() + 400 * DAY }]);
      const [row] = memory.rows();
      expect(row && row.expiresAt.getTime() - now.getTime()).toBeLessThanOrEqual(100 * DAY);
    });
  });
});
