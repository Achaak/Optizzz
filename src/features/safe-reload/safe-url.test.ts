import { describe, expect, it } from "vitest";
import { safeUrl } from "./safe-url";

const safe = (href: string) => safeUrl(new URL(href, "http://s5.fourmizzz.fr"));

describe("safeUrl", () => {
  it("keeps a page without query", () => {
    expect(safe("/Reine.php")).toBe("/Reine.php");
  });

  it("keeps a display query", () => {
    expect(safe("/Membre.php?Pseudo=Toto")).toBe("/Membre.php?Pseudo=Toto");
    expect(safe("/ennemie.php?Attaquer=42&lieu=1")).toBe("/ennemie.php?Attaquer=42&lieu=1");
  });

  it("drops the query of an action link", () => {
    expect(safe("/construction.php?Construire=9&t=abcd")).toBe("/construction.php");
    expect(safe("/construction.php?annuler=3&t=abcd")).toBe("/construction.php");
    expect(safe("/laboratoire.php?Rechercher=10&t=abcd")).toBe("/laboratoire.php");
  });

  it("keeps the hash", () => {
    expect(safe("/alliance.php?Membres#carte")).toBe("/alliance.php?Membres#carte");
    expect(safe("/construction.php?annuler=3&t=abcd#x")).toBe("/construction.php#x");
  });
});
