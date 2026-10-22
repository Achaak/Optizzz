import { describe, expect, it } from "vitest";
import { serverById, SERVERS } from "./servers";

describe("SERVERS", () => {
  it("lists S1 to S5, S1–S4 over HTTP only", () => {
    expect(SERVERS.map((server) => server.name)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(serverById("s2")?.origin).toBe("http://s2.fourmizzz.fr");
    expect(serverById("s5")?.origin).toBe("https://s5.fourmizzz.fr");
  });
});

describe("serverById", () => {
  it("ignores the case, and knows no other server", () => {
    expect(serverById("S5")?.id).toBe("s5");
    expect(serverById("s6")).toBeUndefined();
  });
});
