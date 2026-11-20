import { describe, expect, it } from "vitest";
import { allianceViewHashes, isMembersPage, showsAllianceView } from "./alliance-views";

describe("alliance views", () => {
  it("lists only the views switched on", () => {
    expect(allianceViewHashes({})).toEqual(["#carte", "#chaine", "#historique", "#stats", "#partage"]);
    expect(
      allianceViewHashes({
        "alliance-map": false,
        "history.alliance": false,
        "alliance-stats": false,
        "alliance-sharing": false,
      }),
    ).toEqual(["#chaine"]);
  });

  it("hides the members table only for a view switched on", () => {
    history.replaceState(null, "", "/alliance.php?Membres#carte");
    expect(showsAllianceView(allianceViewHashes({}))).toBe(true);
    expect(showsAllianceView(allianceViewHashes({ "alliance-map": false }))).toBe(false);
    history.replaceState(null, "", "/alliance.php?Membres");
    expect(showsAllianceView(allianceViewHashes({}))).toBe(false);
  });

  it("keeps a view open when the game adds its token to the link", () => {
    history.replaceState(null, "", "/alliance.php?Membres&jt=1.6103327eba885c62#chaine");
    expect(showsAllianceView(allianceViewHashes({}))).toBe(true);
  });
});

describe("isMembersPage", () => {
  it("knows the members page whatever else its query holds", () => {
    expect(isMembersPage(new URL("https://s5.fourmizzz.fr/alliance.php?Membres"))).toBe(true);
    expect(isMembersPage(new URL("https://s5.fourmizzz.fr/alliance.php?Membres&jt=1.6103327eba885c62#carte"))).toBe(
      true,
    );
    expect(isMembersPage(new URL("https://s5.fourmizzz.fr/alliance.php?forum_menu&jt=1.6103327eba885c62"))).toBe(false);
    expect(isMembersPage(new URL("https://s5.fourmizzz.fr/Membre.php?Pseudo=Membres"))).toBe(false);
  });
});
