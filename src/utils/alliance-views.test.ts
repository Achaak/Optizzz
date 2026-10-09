import { describe, expect, it } from "vitest";
import { allianceViewHashes, showsAllianceView } from "./alliance-views";

describe("alliance views", () => {
  it("lists only the views switched on", () => {
    expect(allianceViewHashes({})).toEqual(["#carte", "#chaine", "#historique"]);
    expect(allianceViewHashes({ "alliance-map": false, "history.alliance": false })).toEqual(["#chaine"]);
  });

  it("hides the members table only for a view switched on", () => {
    history.replaceState(null, "", "/alliance.php?Membres#carte");
    expect(showsAllianceView(allianceViewHashes({}))).toBe(true);
    expect(showsAllianceView(allianceViewHashes({ "alliance-map": false }))).toBe(false);
    history.replaceState(null, "", "/alliance.php?Membres");
    expect(showsAllianceView(allianceViewHashes({}))).toBe(false);
  });
});
