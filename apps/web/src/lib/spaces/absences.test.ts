import { createAllianceKeyring, rotateAllianceKey } from "@optizzz/crypto/alliance-key";
import { describe, expect, it } from "vitest";
import { absencesToShow, lockAbsences, openAbsences, updateAbsences, type AbsenceRecord } from "./absences";

const T = Date.parse("2026-10-25T10:00:00Z");
const HOUR = 3_600_000;
const joined = new Date(T - 30 * 24 * HOUR);
const members = [
  { playerId: 1, pseudo: "Alice", joinedAt: joined },
  { playerId: 2, pseudo: "Bruno", joinedAt: joined },
  { playerId: 3, pseudo: "Chloe", joinedAt: joined },
];
const list = (pseudos: string[], readAt: number, tag: string | null = "ABC") => ({ tag, pseudos, readAt });
const space = { tag: "ABC", members };

describe("absences from the game's Members page", () => {
  it("flags a member from the first reading where they are missing, and keeps that date", () => {
    const first = updateAbsences(null, list(["Alice", "Chloe"], T), space);
    expect(first).toEqual({ listReadAt: T, absent: [{ playerId: 2, pseudo: "Bruno", since: T }] });
    const later = updateAbsences(first, list(["Alice", "Chloe"], T + HOUR), space);
    expect(later?.absent).toEqual([{ playerId: 2, pseudo: "Bruno", since: T }]);
    expect(later?.listReadAt).toBe(T + HOUR);
  });

  it("clears the alert when the member is back", () => {
    const first = updateAbsences(null, list(["Alice", "Chloe"], T), space);
    expect(updateAbsences(first, list(["Alice", "Bruno", "Chloe"], T + HOUR), space)).toEqual({
      listReadAt: T + HOUR,
      absent: [],
    });
  });

  it("ignores a list that is not newer than the last one used, or of another alliance", () => {
    const first = updateAbsences(null, list(["Alice", "Chloe"], T), space);
    expect(updateAbsences(first, list(["Alice", "Bruno", "Chloe"], T), space)).toBeNull();
    expect(updateAbsences(first, list(["Alice", "Bruno", "Chloe"], T - HOUR), space)).toBeNull();
    expect(updateAbsences(null, list(["Zed"], T, "XYZ"), space)).toBeNull();
    // Case of the tag does not matter, and a list without a tag read is taken.
    expect(updateAbsences(null, list(["Alice", "Bruno", "Chloe"], T, "abc"), space)?.absent).toEqual([]);
    expect(updateAbsences(null, list(["Alice", "Bruno"], T, null), space)?.absent).toHaveLength(1);
  });

  it("does not flag a member who joined the space after the list was read", () => {
    const newcomer = { playerId: 4, pseudo: "Dan", joinedAt: new Date(T + HOUR) };
    const record = updateAbsences(null, list(["Alice", "Bruno", "Chloe"], T), {
      tag: "ABC",
      members: [...members, newcomer],
    });
    expect(record?.absent).toEqual([]);
  });

  it("forgets members who left the space, and follows a renamed pseudo by its player", () => {
    const record: AbsenceRecord = {
      listReadAt: T,
      absent: [
        { playerId: 2, pseudo: "Bruno", since: T },
        { playerId: 9, pseudo: "Gone", since: T },
      ],
    };
    expect(absencesToShow(record, members)).toEqual([{ playerId: 2, pseudo: "Bruno", since: T }]);
    expect(absencesToShow(null, members)).toEqual([]);
    const next = updateAbsences(record, list(["Alice", "Chloe"], T + HOUR), space);
    expect(next?.absent).toEqual([{ playerId: 2, pseudo: "Bruno", since: T }]);
  });
});

describe("the alerts on the site", () => {
  it("are encrypted with the newest version of the Clé d'alliance and open with the keyring", async () => {
    const keyring = await rotateAllianceKey(await createAllianceKeyring());
    const record: AbsenceRecord = { listReadAt: T, absent: [{ playerId: 2, pseudo: "Bruno", since: T }] };
    const blob = await lockAbsences(record, keyring);
    expect(blob).not.toContain("Bruno");
    expect(await openAbsences(blob, keyring)).toEqual(record);
    await expect(openAbsences(blob, await createAllianceKeyring())).rejects.toThrow();
  });

  it("refuse a text that is not an alerts record", async () => {
    const { encryptData } = await import("@optizzz/crypto/data");
    const keyring = await createAllianceKeyring();
    await expect(openAbsences(await encryptData('{"absent":"x"}', keyring), keyring)).rejects.toThrow();
  });
});
