import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, publicMessage, tooLarge } from "./limits";

const request = (length?: string) =>
  new Request("https://optizzz.test/api/trpc", length === undefined ? {} : { headers: { "content-length": length } });

describe("tooLarge", () => {
  it("refuses a body declared above 4 MB", () => {
    expect(tooLarge(request("4000001"))).toBe(true);
  });

  it("lets a body of 4 MB through", () => {
    expect(tooLarge(request("4000000"))).toBe(false);
  });

  it("lets a request without a declared length through", () => {
    expect(tooLarge(request())).toBe(false);
  });

  it("lets a length that is not a number through", () => {
    expect(tooLarge(request("lots"))).toBe(false);
  });
});

describe("publicMessage", () => {
  it("hides the details of an unexpected error", () => {
    expect(publicMessage("INTERNAL_SERVER_ERROR", "Unique constraint failed on …")).toBe(GENERIC_ERROR);
  });

  it("keeps a message meant for the person", () => {
    expect(publicMessage("FORBIDDEN", "Vous n'êtes pas membre de cet espace.")).toBe(
      "Vous n'êtes pas membre de cet espace.",
    );
  });
});
