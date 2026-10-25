import { describe, expect, it } from "vitest";
import {
  emptyTrustList,
  knowsMore,
  mergeTrustLists,
  spaceTrustOf,
  withCertificates,
  withVerified,
} from "./trust-store";

const KEY_A = "A".repeat(43);
const KEY_B = "B".repeat(43);

describe("the trust list in the browser", () => {
  it("keeps the keys checked by a code and the certificates seen, space by space", () => {
    let list = withVerified(emptyTrustList(), "s1", { publicKey: KEY_A, role: "admin", verifiedAt: 1 });
    list = withVerified(list, "s1", { publicKey: KEY_A, role: "admin", verifiedAt: 5 });
    list = withCertificates(list, "s1", ["c1", "c2"]);
    list = withCertificates(list, "s1", ["c2"]);
    expect(spaceTrustOf(list, "s1", ["c3", "c1"])).toEqual({
      spaceId: "s1",
      verified: [{ publicKey: KEY_A, role: "admin", verifiedAt: 5 }],
      certificates: ["c1", "c2", "c3"],
    });
    expect(spaceTrustOf(list, "s2")).toEqual({ spaceId: "s2", verified: [], certificates: [] });
  });

  it("merges two versions without losing what either knows", () => {
    const one = withCertificates(
      withVerified(emptyTrustList(), "s1", { publicKey: KEY_A, role: "admin", verifiedAt: 3 }),
      "s1",
      ["c1"],
    );
    const two = withVerified(withCertificates(emptyTrustList(), "s2", ["c9"]), "s1", {
      publicKey: KEY_B,
      role: "member",
      verifiedAt: 4,
    });
    const merged = mergeTrustLists(one, two);
    expect(spaceTrustOf(merged, "s1").verified).toHaveLength(2);
    expect(spaceTrustOf(merged, "s2").certificates).toEqual(["c9"]);
    expect(knowsMore(merged, one)).toBe(true);
    expect(knowsMore(one, merged)).toBe(false);
  });
});
