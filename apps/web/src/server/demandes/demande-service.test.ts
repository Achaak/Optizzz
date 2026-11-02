import { createAllianceKeyring, rotateAllianceKey, type AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { encryptData } from "@optizzz/crypto/data";
import { beforeEach, describe, expect, it } from "vitest";
import { DemandeError, demandeService } from "./demande-service";
import { memoryDemandeStore } from "./memory-store";

const SPACE = "0b9d6f0e-3c4a-4f5e-9a7b-1c2d3e4f5a6b";
const NOW = new Date("2026-10-26T12:00:00Z");
const DAY = 24 * 3600_000;
const messor = { server: "s5", playerId: 1, pseudo: "Messor", userId: "u-messor" };
const lasius = { server: "s5", playerId: 2, pseudo: "Lasius", userId: "u-lasius" };
const formica = { server: "s5", playerId: 3, pseudo: "Formica", userId: "u-formica" };
const outsider = { server: "s5", playerId: 4, pseudo: "Outsider", userId: "u-out" };

const id = (n: number) => `6f1c2d3e-4b5a-4c7d-8e9f-${String(n).padStart(12, "0")}`;

async function failure(promise: Promise<unknown>): Promise<DemandeError> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DemandeError);
  return error as DemandeError;
}

describe("the Demandes on the site", () => {
  let memory: ReturnType<typeof memoryDemandeStore>;
  let service: ReturnType<typeof demandeService>;
  let now: Date;
  let keyring: AllianceKeyring;

  const sends = (who: typeof messor, categories: string[]) => memory.saveSettings(who, categories);
  const ask = async (who: typeof messor, n: number, ring = keyring, keyVersion = 1) =>
    service.create(who.userId, {
      server: who.server,
      playerId: who.playerId,
      id: id(n),
      blob: await encryptData(`demande ${String(n)}`, ring),
      keyVersion,
    });
  const read = (who: typeof messor, input: { since?: number; scope?: "page" | "extension" } = {}) =>
    service.read(who.userId, { spaceId: SPACE, scope: input.scope ?? "page", ...input });

  beforeEach(async () => {
    memory = memoryDemandeStore();
    now = NOW;
    service = demandeService(memory.store, () => now);
    keyring = await createAllianceKeyring();
    for (const p of [messor, lasius, formica, outsider]) memory.addPlayer(p);
    memory.addSpace({ id: SPACE, server: "s5", tag: "ABC", name: "ABC sur S5" }, [messor, lasius, formica]);
    memory.setRole(SPACE, messor, "admin");
    memory.setRole(SPACE, formica, "delegate");
    for (const p of [messor, lasius, formica]) await sends(p, ["production", "convoys"]);
  });

  it("keeps a Demande encrypted, à valider, last in its requester's order, and shows it to every member", async () => {
    await ask(lasius, 1);
    await ask(lasius, 2);
    const { demandes } = await read(formica);
    expect(demandes.map((d) => ({ id: d.id, playerId: d.playerId, status: d.status, rank: d.rank }))).toEqual([
      { id: id(1), playerId: 2, status: "pending", rank: 0 },
      { id: id(2), playerId: 2, status: "pending", rank: 1 },
    ]);
    expect(demandes[0]?.blob).not.toContain("demande");
  });

  it("asks for the site's reminder on Discord when a Demande waits to be validated, only then", async () => {
    const reminders: [string, string][] = [];
    service = demandeService(
      memory.store,
      () => now,
      (spaceId, kind) => reminders.push([spaceId, kind]),
    );
    await ask(lasius, 1);
    await service.decide(messor.userId, { id: id(1), decision: "validated" });
    await service.cancel(lasius.userId, { id: id(1) });
    expect(reminders).toEqual([[SPACE, "demands"]]);
    await sends(lasius, []);
    await failure(ask(lasius, 2));
    expect(reminders).toHaveLength(1);
  });

  it("asks the requester to send Production and Convois first", async () => {
    await sends(lasius, ["convoys"]);
    const error = await failure(ask(lasius, 1));
    expect(error.code).toBe("needs-envois");
    expect(error.message).toBe(
      "Pour faire une Demande, envoyez d'abord Production et Convois depuis l'extension (Fonctionnalités › Compte Optizzz).",
    );
  });

  it("refuses a Demande of another account's Joueur, out of a space, or sealed with an older version of the key", async () => {
    expect(
      (await failure(service.create(messor.userId, { server: "s5", playerId: 2, id: id(1), blob: "x", keyVersion: 1 })))
        .code,
    ).toBe("invalid");
    expect(
      (
        await failure(
          service.create(messor.userId, {
            server: "s5",
            playerId: 2,
            id: id(1),
            blob: await encryptData("x", keyring),
            keyVersion: 1,
          }),
        )
      ).code,
    ).toBe("forbidden");
    await sends(outsider, ["production", "convoys"]);
    expect((await failure(ask(outsider, 1))).code).toBe("not-found");
    const rotated = await rotateAllianceKey(keyring);
    memory.addVersion(SPACE, { version: 2, createdAt: NOW, createdByPseudo: "Messor" });
    expect((await failure(ask(lasius, 1, keyring, 1))).code).toBe("stale-key");
    await ask(lasius, 2, rotated, 2);
  });

  it("lets an Admin or a Délégué validate or refuse, a Délégué never their own Demande, and only once", async () => {
    await ask(lasius, 1);
    await ask(lasius, 2);
    await ask(formica, 3);
    expect((await failure(service.decide(lasius.userId, { id: id(1), decision: "validated" }))).code).toBe("forbidden");
    expect((await failure(service.decide(formica.userId, { id: id(3), decision: "validated" }))).message).toBe(
      "Un Admin ou un autre Délégué doit décider de votre Demande.",
    );
    now = new Date(NOW.getTime() + 60_000);
    await service.decide(formica.userId, { id: id(1), decision: "validated" });
    await service.decide(messor.userId, { id: id(2), decision: "refused" });
    expect((await failure(service.decide(messor.userId, { id: id(1), decision: "refused" }))).code).toBe("conflict");
    const { demandes } = await read(lasius);
    expect(demandes.map((d) => [d.status, d.decidedByPseudo, d.decidedAt])).toEqual([
      ["validated", "Formica", now.getTime()],
      ["refused", "Messor", now.getTime()],
      ["pending", null, null],
    ]);
  });

  it("lets an Admin validate or refuse their own Demande: a lone Admin needs no Délégué", async () => {
    await ask(messor, 1);
    await ask(messor, 2);
    await service.decide(messor.userId, { id: id(1), decision: "validated" });
    await service.decide(messor.userId, { id: id(2), decision: "refused" });
    const { demandes } = await read(messor);
    expect(demandes.map((d) => [d.id, d.status, d.decidedByPseudo])).toEqual([
      [id(1), "validated", "Messor"],
      [id(2), "refused", "Messor"],
    ]);
  });

  it("lets the requester cancel and order their open Demandes, and nobody else", async () => {
    for (const n of [1, 2, 3]) await ask(lasius, n);
    expect((await failure(service.cancel(messor.userId, { id: id(1) }))).code).toBe("forbidden");
    await service.cancel(lasius.userId, { id: id(1) });
    expect((await failure(service.cancel(lasius.userId, { id: id(1) }))).code).toBe("conflict");
    // The open ones, every one of them, in the new order.
    expect((await failure(service.reorder(lasius.userId, { server: "s5", playerId: 2, ids: [id(3)] }))).code).toBe(
      "invalid",
    );
    await service.reorder(lasius.userId, { server: "s5", playerId: 2, ids: [id(3), id(2)] });
    const { demandes } = await read(lasius);
    expect(demandes.filter((d) => d.status === "pending").map((d) => [d.id, d.rank])).toEqual([
      [id(3), 0],
      [id(2), 1],
    ]);
  });

  it("closes the requester's open Demandes from their extension, and keeps finished ones 90 days", async () => {
    await ask(lasius, 1);
    await ask(lasius, 2);
    await ask(lasius, 3);
    await service.decide(messor.userId, { id: id(1), decision: "validated" });
    await service.cancel(lasius.userId, { id: id(3) });
    expect(
      await service.close(messor.userId, { server: "s5", playerId: 2, ids: [id(1)] }).catch((e: unknown) => e),
    ).toBeInstanceOf(DemandeError);
    expect(await service.close(lasius.userId, { server: "s5", playerId: 2, ids: [id(1), id(3)] })).toEqual({
      closed: [id(1)],
    });
    now = new Date(NOW.getTime() + 89 * DAY);
    expect((await read(lasius)).demandes.map((d) => d.status)).toEqual(["closed", "pending", "cancelled"]);
    now = new Date(NOW.getTime() + 91 * DAY);
    expect((await read(lasius)).demandes.map((d) => d.status)).toEqual(["pending"]);
  });

  it("gives an extension the validated Demandes, those to validate to the Admins and Délégués, and its own", async () => {
    await ask(lasius, 1);
    await ask(lasius, 2);
    await service.decide(messor.userId, { id: id(1), decision: "validated" });
    const ids = async (who: typeof messor) => (await read(who, { scope: "extension" })).demandes.map((d) => d.id);
    expect(await ids(lasius)).toEqual([id(1), id(2)]);
    expect(await ids(formica)).toEqual([id(1), id(2)]);
    memory.setRole(SPACE, formica, "member");
    expect(await ids(formica)).toEqual([id(1)]);
  });

  it("gives a relève what changed since its cursor, and the Demandes still to keep", async () => {
    await ask(lasius, 1);
    await ask(lasius, 2);
    const first = await read(formica, { scope: "extension" });
    expect(first.live).toBeNull();
    now = new Date(NOW.getTime() + 60_000);
    await service.decide(messor.userId, { id: id(1), decision: "validated" });
    await service.cancel(lasius.userId, { id: id(2) });
    const next = await read(formica, { scope: "extension", since: first.cursor });
    expect(next.demandes.map((d) => d.id)).toEqual([id(1)]);
    expect(next.live).toEqual([id(1)]);
  });

  it("is for the space's members only, and leaves out the open Demandes of one who left", async () => {
    expect((await failure(read(outsider))).code).toBe("forbidden");
    await ask(lasius, 1);
    memory.removeMember(SPACE, lasius);
    expect((await read(messor)).demandes).toEqual([]);
  });

  describe("changed after they are made", () => {
    const update = async (who: typeof messor, n: number, revalidate: boolean, ring = keyring) =>
      service.update(who.userId, {
        id: id(n),
        blob: await encryptData(`demande ${String(n)} changée`, ring),
        keyVersion: 1,
        revalidate,
      });
    const statusOf = async (n: number) => (await read(messor)).demandes.find((d) => d.id === id(n))?.status;

    it("lets the requester change their open Demande, a validated one back to validation when it asks for more", async () => {
      await ask(lasius, 1);
      await service.decide(messor.userId, { id: id(1), decision: "validated" });
      expect((await failure(update(messor, 1, false))).code).toBe("forbidden");

      await update(lasius, 1, false);
      expect(await statusOf(1)).toBe("validated");
      await update(lasius, 1, true);
      expect(await statusOf(1)).toBe("pending");
      expect((await read(messor)).demandes[0]?.decidedByPseudo).toBeNull();

      await service.cancel(lasius.userId, { id: id(1) });
      expect((await failure(update(lasius, 1, false))).code).toBe("conflict");
    });

    it("lets an Admin or a Délégué suspend a validated Demande, a Délégué never their own", async () => {
      await ask(lasius, 1);
      await ask(formica, 2);
      await service.decide(messor.userId, { id: id(1), decision: "validated" });
      await service.decide(messor.userId, { id: id(2), decision: "validated" });
      expect((await failure(service.suspend(lasius.userId, { id: id(1) }))).code).toBe("forbidden");
      expect((await failure(service.suspend(formica.userId, { id: id(2) }))).code).toBe("forbidden");

      await service.suspend(formica.userId, { id: id(1) });
      const suspended = (await read(messor)).demandes.find((d) => d.id === id(1));
      expect([suspended?.status, suspended?.decidedByPseudo]).toEqual(["pending", "Formica"]);
      expect((await failure(service.suspend(formica.userId, { id: id(1) }))).code).toBe("conflict");
    });

    it("lets the requester, an Admin or a Délégué close an open Demande by hand, nobody else", async () => {
      await ask(lasius, 1);
      await ask(lasius, 2);
      await ask(messor, 3);
      expect((await failure(service.finish(lasius.userId, { id: id(3) }))).code).toBe("forbidden");

      await service.finish(lasius.userId, { id: id(1) });
      await service.finish(formica.userId, { id: id(2) });
      const { demandes } = await read(messor);
      expect(demandes.filter((d) => d.status === "closed").map((d) => [d.id, d.decidedByPseudo])).toEqual([
        [id(1), null],
        [id(2), "Formica"],
      ]);
      expect((await failure(service.finish(lasius.userId, { id: id(1) }))).code).toBe("conflict");
    });
  });
});
