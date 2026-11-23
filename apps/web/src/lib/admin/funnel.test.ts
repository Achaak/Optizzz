import { describe, expect, it } from "vitest";
import { type AccountProgress, FUNNEL_STEPS, funnel, furthestStep, reachedStep, returnedLater } from "./funnel";

const NONE: AccountProgress = {
  extension: false,
  player: false,
  key: false,
  requested: false,
  member: false,
  withOthers: false,
  sharing: false,
};

describe("furthestStep", () => {
  it("is the account's creation when nothing else is done", () => {
    expect(furthestStep(NONE)).toBe(0);
  });

  it("counts a later step as having passed the earlier ones", () => {
    // A Player is only attached by the extension: one whose extension was unlinked since did link it once.
    expect(furthestStep({ ...NONE, player: true })).toBe(2);
    expect(furthestStep({ ...NONE, extension: true, player: true, key: true, member: true })).toBe(5);
    expect(furthestStep({ ...NONE, sharing: true })).toBe(FUNNEL_STEPS.length - 1);
  });
});

describe("funnel", () => {
  it("counts the accounts that reached each step, with their share of all accounts and who was lost", () => {
    const steps = funnel([
      NONE,
      NONE,
      { ...NONE, extension: true },
      { ...NONE, extension: true, player: true, key: true, requested: true },
    ]);
    expect(steps.map((s) => s.count)).toEqual([4, 2, 1, 1, 1, 0, 0, 0]);
    expect(steps[0]).toMatchObject({ label: "Compte créé", share: 1, lost: 0 });
    expect(steps[1]).toMatchObject({ label: "Extension liée", share: 0.5, lost: 2 });
    expect(steps[5]).toMatchObject({ share: 0, lost: 1 });
  });

  it("gives empty shares without accounts", () => {
    expect(funnel([]).every((s) => s.count === 0 && s.share === 0 && s.lost === 0)).toBe(true);
  });
});

describe("reachedStep", () => {
  it("names the furthest step reached, in the admin's words", () => {
    expect(reachedStep(NONE)).toBe("Compte créé");
    expect(reachedStep({ ...NONE, extension: true, player: true })).toBe("Joueur rattaché");
  });

  it("marks an account that went the whole way", () => {
    expect(reachedStep({ ...NONE, sharing: true })).toBe("✓ Partage des relevés");
  });
});

describe("returnedLater", () => {
  const created = new Date("2026-11-01T10:00:00Z");

  it("is true when the account was seen more than a day after its creation", () => {
    expect(returnedLater(created, new Date("2026-11-02T10:00:01Z"))).toBe(true);
  });

  it("is false for a visit on the first day only, or none", () => {
    expect(returnedLater(created, new Date("2026-11-02T09:59:59Z"))).toBe(false);
    expect(returnedLater(created, null)).toBe(false);
  });
});
