import type { MembersAnswer } from "@optizzz/game/site-links/space-bridge";
import { describe, expect, it } from "vitest";
import { checkMembersList, membersCheckMessage } from "./members-check";

const now = new Date("2026-10-25T12:00:00Z");
const hours = (n: number) => now.getTime() - n * 3_600_000;
const linked = (readAt: number, tag: string | null = "ABC"): MembersAnswer => ({
  status: "linked",
  members: { tag, pseudos: ["Bruno", "Alice"], readAt },
});
const check = (answer: Parameters<typeof checkMembersList>[0], pseudo = "Bruno") =>
  checkMembersList(answer, { tag: "abc", pseudo, now });

describe("the Members page before « Donner l'accès »", () => {
  it("accepts a pseudo on a list of the alliance read less than 24 hours ago", () => {
    expect(check(linked(hours(23)))).toEqual({ ok: true });
    expect(check(linked(hours(1), null))).toEqual({ ok: true });
  });

  it("says why otherwise", () => {
    expect(check(null)).toEqual({ ok: false, reason: "no-extension" });
    expect(check({ status: "unlinked" })).toEqual({ ok: false, reason: "unlinked" });
    expect(check({ status: "linked", members: null })).toEqual({ ok: false, reason: "no-list" });
    expect(check(linked(hours(25)))).toEqual({ ok: false, reason: "stale" });
    expect(check(linked(hours(-1)))).toEqual({ ok: false, reason: "stale" });
    expect(check(linked(hours(1), "XYZ"))).toEqual({ ok: false, reason: "other-alliance" });
    expect(check(linked(hours(1)), "Chloe")).toEqual({ ok: false, reason: "absent" });
  });

  it("tells the Admin to open the Members page when the list will not do", () => {
    expect(membersCheckMessage({ ok: false, reason: "stale" }, { pseudo: "Bruno", tag: "ABC" })).toBe(
      "La dernière page Membres lue date de plus de 24 heures. Ouvrez la page Membres de votre alliance dans le jeu, puis revenez.",
    );
    expect(membersCheckMessage({ ok: false, reason: "absent" }, { pseudo: "Bruno", tag: "ABC" })).toContain(
      "Bruno n'est pas sur la dernière page Membres de ABC",
    );
  });
});
