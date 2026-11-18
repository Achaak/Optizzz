import { describe, expect, it } from "vitest";
import { audience, pageName } from "./audience";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("audience", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const rows = [
    { day: day("2026-11-18"), page: "/", server: "", views: 5 },
    { day: day("2026-11-18"), page: "/[server]/players/[id]", server: "s5", views: 3 },
    { day: day("2026-11-17"), page: "/", server: "", views: 2 },
    { day: day("2026-11-13"), page: "/tools/combat", server: "", views: 4 },
    { day: day("2026-10-25"), page: "/tools/combat", server: "", views: 100 }, // more than 7 days, less than 30
    { day: day("2026-11-18"), page: "/api/[server]/map", server: "s5", views: 7 },
    { day: day("2026-11-12"), page: "/api/[server]/map", server: "s2", views: 1 },
  ];

  it("adds up the site's pages, apart from the extension's map reads", () => {
    const a = audience(rows, now, 3);
    expect(a.today).toBe(8);
    expect(a.week).toBe(14);
    expect(a.month).toBe(114);
    expect(a.daily).toEqual([
      { label: "16/11", value: 0 },
      { label: "17/11", value: 2 },
      { label: "18/11", value: 8 },
    ]);
  });

  it("ranks the pages by their views over 30 days, a server's pages together", () => {
    expect(audience(rows, now, 3).pages).toEqual([
      { page: "/tools/combat", name: "Simulateur de combat", week: 4, month: 104 },
      { page: "/", name: "Accueil", week: 7, month: 7 },
      { page: "/[server]/players/[id]", name: "Serveur · fiche d'un joueur", week: 3, month: 3 },
    ]);
  });

  it("counts the map reads per server", () => {
    const a = audience(rows, now, 3);
    expect(a.mapReads.week).toBe(8);
    expect(a.mapReads.servers).toEqual([
      { server: "s5", week: 7, month: 7 },
      { server: "s2", week: 1, month: 1 },
    ]);
  });
});

describe("pageName", () => {
  it("falls back on the route", () => {
    expect(pageName("/something/new")).toBe("/something/new");
  });
});
