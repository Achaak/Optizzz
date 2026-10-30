import { describe, expect, it } from "vitest";
import { adsTxt } from "./ads";

describe("adsTxt", () => {
  it("names the publisher without its « ca- » prefix, as ads.txt wants", () => {
    expect(adsTxt("ca-pub-1234567890123456")).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  });
});
