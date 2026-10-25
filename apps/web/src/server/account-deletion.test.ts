import { describe, expect, it } from "vitest";
import { accountDeletionBlocker } from "./account-deletion";

describe("accountDeletionBlocker", () => {
  it("lets an account be deleted when no rule objects", async () => {
    expect(await accountDeletionBlocker("user-1")).toBeNull();
  });

  it("gives the first reason a rule returns", async () => {
    const checks = [
      () => Promise.resolve(null),
      (id: string) => Promise.resolve(`Nommez un autre Admin de [${id}] d'abord`),
      () => Promise.resolve("never reached"),
    ];
    expect(await accountDeletionBlocker("ABC", checks)).toBe("Nommez un autre Admin de [ABC] d'abord");
  });
});
