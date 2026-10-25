import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  categoriesOf,
  EnvoiRefused,
  newestPerFingerprint,
  NO_ENVOIS,
  openEnvoi,
  sealEnvoi,
  sendsLabel,
  type EnvoiCrypto,
  type EnvoiRow,
} from "./envois";

// The real cipher is libsodium's (@optizzz/crypto), tested there: here, a reversible stand-in is enough to check what
// the envelope carries and what a reader refuses.
const fake: EnvoiCrypto = {
  encrypt: (text) => Promise.resolve(`sealed:${btoa(encodeURIComponent(text))}`),
  decrypt: (blob) => {
    if (!blob.startsWith("sealed:")) return Promise.reject(new Error("undecryptable"));
    return Promise.resolve(decodeURIComponent(atob(blob.slice("sealed:".length))));
  },
  fingerprint: (text) => Promise.resolve(`fp-${text}`),
};

const ITEM = z.object({ note: z.string() });
const OBSERVED = new Date("2026-10-25T13:36:00+02:00").getTime();

async function row(overrides: Partial<EnvoiRow> = {}, inside: Partial<Parameters<typeof sealEnvoi>[0]> = {}) {
  const blob = await sealEnvoi(
    {
      server: "s5",
      playerId: 42,
      category: "convoys",
      fingerprint: "fp-1",
      observedAt: OBSERVED,
      item: { note: "convoi" },
      ...inside,
    },
    fake,
  );
  return { server: "s5", playerId: 42, category: "convoys" as const, fingerprint: "fp-1", blob, ...overrides };
}

describe("an Envoi, inside and out", () => {
  it("opens to what was sealed, with the time of the reading", async () => {
    expect(await openEnvoi(await row(), fake, ITEM)).toEqual({ observedAt: OBSERVED, item: { note: "convoi" } });
  });

  it("is refused when its inside names another Joueur, Serveur, catégorie or fingerprint than its row", async () => {
    for (const moved of [
      { playerId: 43 },
      { server: "s2" },
      { category: "floods" as const },
      { fingerprint: "fp-2" },
    ]) {
      const error: unknown = await openEnvoi(await row(moved), fake, ITEM).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(EnvoiRefused);
      expect((error as EnvoiRefused).reason).toBe("mismatch");
    }
  });

  it("is refused when it does not open or is not an Envoi", async () => {
    const garbage = await openEnvoi(await row({ blob: "nope" }), fake, ITEM).catch((e: unknown) => e);
    expect((garbage as EnvoiRefused).reason).toBe("unreadable");
    const otherItem = await openEnvoi(await row({}, { item: { note: 3 } }), fake, ITEM).catch((e: unknown) => e);
    expect((otherItem as EnvoiRefused).reason).toBe("unreadable");
  });

  it("keeps the newest reading of each fingerprint, whoever reported it", () => {
    const kept = newestPerFingerprint([
      { fingerprint: "a", observedAt: 1, from: "Messor" },
      { fingerprint: "a", observedAt: 3, from: "Polyergus" },
      { fingerprint: "b", observedAt: 2, from: "Messor" },
      { fingerprint: "a", observedAt: 2, from: "Messor" },
    ]);
    expect(kept).toEqual([
      { fingerprint: "a", observedAt: 3, from: "Polyergus" },
      { fingerprint: "b", observedAt: 2, from: "Messor" },
    ]);
  });
});

describe("the categories a Joueur sends", () => {
  it("are all off by default", () => {
    expect(categoriesOf(NO_ENVOIS)).toEqual([]);
    expect(sendsLabel([])).toBe("N'envoie rien");
  });

  it("are listed as the space page says them", () => {
    expect(categoriesOf({ ...NO_ENVOIS, convoys: true, army: "count" })).toEqual(["convoys", "army-count"]);
    expect(sendsLabel(["convoys"])).toBe("Envoie : convois");
    expect(sendsLabel(["convoys", "floods", "army-units"])).toBe("Envoie : convois, floods, armée (par unité)");
  });
});
