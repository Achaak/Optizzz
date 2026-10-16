import { describe, expect, it, vi } from "vitest";
import alliancePageHtml from "@/game/pages/__fixtures__/alliance-page.html?raw";
import profileHtml from "../history/__fixtures__/profile.html?raw";
import { MAP_LINK_ATTRIBUTE, mountAllianceLink, mountProfileLink } from "./index";

const page = (html: string) => {
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = html;
  return doc;
};

describe("« Voir sur la carte » links", () => {
  it("adds a row under the profile's state, once, opening the map on click", () => {
    const doc = page(profileHtml);
    const open = vi.fn();
    mountProfileLink(doc, open);
    mountProfileLink(doc, open);
    const links = doc.querySelectorAll<HTMLElement>(`[${MAP_LINK_ATTRIBUTE}]`);
    expect(links).toHaveLength(1);
    expect(links[0]?.closest("tr")?.previousElementSibling?.textContent).toContain("Etat");
    links[0]?.click();
    expect(open).toHaveBeenCalledOnce();
  });

  it("adds a link under the alliance's name", () => {
    const doc = page(alliancePageHtml);
    const open = vi.fn();
    mountAllianceLink(doc, open);
    const link = doc.querySelector<HTMLElement>(`[${MAP_LINK_ATTRIBUTE}]`);
    expect(link?.parentElement?.previousElementSibling?.textContent).toBe("Victory");
    link?.click();
    expect(open).toHaveBeenCalledOnce();
  });
});
