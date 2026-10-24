import { describe, expect, it } from "vitest";
import { gameServerOf, offerFor } from "./offer";

const S5 = "https://s5.fourmizzz.fr";
const base = { linked: true, origin: S5, pseudo: "Calystene", attached: [], declined: [] };

describe("gameServerOf", () => {
  it("knows the game's servers, and nothing else", () => {
    expect(gameServerOf(S5)?.name).toBe("S5");
    expect(gameServerOf("http://s2.fourmizzz.fr")?.name).toBe("S2");
    expect(gameServerOf("https://s5.fourmizzz.fr.evil.example")).toBeUndefined();
    expect(gameServerOf("https://optizzz.fr")).toBeUndefined();
    expect(gameServerOf("not an address")).toBeUndefined();
  });
});

describe("offerFor", () => {
  it("offers the Player of the server where one plays", () => {
    expect(offerFor(base)).toMatchObject({ origin: S5, pseudo: "Calystene", server: { id: "s5", name: "S5" } });
  });

  it("offers nothing without a linked account: nothing leaves the browser without one", () => {
    expect(offerFor({ ...base, linked: false })).toBeNull();
  });

  it("offers nothing without a game page or a pseudo", () => {
    expect(offerFor({ ...base, origin: null })).toBeNull();
    expect(offerFor({ ...base, pseudo: null })).toBeNull();
    expect(offerFor({ ...base, origin: "https://optizzz.fr" })).toBeNull();
  });

  it("offers nothing for a Player already attached, but still the same pseudo on another server", () => {
    const attached = [{ server: "s5", pseudo: "Calystene" }];
    expect(offerFor({ ...base, attached })).toBeNull();
    expect(offerFor({ ...base, attached, origin: "http://s2.fourmizzz.fr" })).not.toBeNull();
  });

  it("never offers again a refused Player", () => {
    expect(offerFor({ ...base, declined: ["s5:Calystene"] })).toBeNull();
    expect(offerFor({ ...base, declined: ["s5:Autre"] })).not.toBeNull();
  });
});
