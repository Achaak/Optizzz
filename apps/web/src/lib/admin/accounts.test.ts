import { describe, expect, it } from "vitest";
import { discordState, latest, maskEmail, remindersState } from "./accounts";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("axel@gmail.com")).toBe("a•••@gmail.com");
    expect(maskEmail("x@free.fr")).toBe("x•••@free.fr");
  });

  it("hides everything of an address it cannot read", () => {
    expect(maskEmail("no-at-sign")).toBe("•••");
    expect(maskEmail("@domain.fr")).toBe("•••");
  });
});

describe("latest", () => {
  it("takes the latest date, skipping the missing ones", () => {
    const a = new Date("2026-11-01T10:00:00Z");
    const b = new Date("2026-11-02T10:00:00Z");
    expect(latest([a, null, b, undefined])).toBe(b);
    expect(latest([null, undefined])).toBeNull();
  });
});

describe("Discord states", () => {
  it("tells a refused webhook from an active one, and none", () => {
    expect(discordState(null)).toBe("— aucun");
    expect(discordState({ refusedStatus: null })).toBe("✓ actif");
    expect(discordState({ refusedStatus: 404 })).toBe("▲ refusé (404)");
  });

  it("counts reminders with no event switched on as none", () => {
    expect(remindersState({ suspendedStatus: null, kinds: [] })).toBe("— aucun");
    expect(remindersState({ suspendedStatus: null, kinds: ["demande"] })).toBe("✓ actifs");
    expect(remindersState({ suspendedStatus: 401, kinds: ["demande"] })).toBe("▲ suspendus (401)");
  });
});
