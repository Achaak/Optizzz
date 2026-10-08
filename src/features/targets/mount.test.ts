import { describe, expect, it } from "vitest";
import { armyFromKeys } from "@/game/army/units";
import type { Alliance, Player } from "@/data/exports";
import s2Html from "./__fixtures__/ennemie-s2.html?raw";
import { mountTargets, type TargetsContext } from "./mount";

let nextId = 1;
const player = (pseudo: string, fields: Partial<Player>): Player => ({
  id: nextId++,
  pseudo,
  alliance: null,
  masterPlayerId: null,
  x: 0,
  y: 0,
  field: 1000,
  grade: null,
  buildingScore: 0,
  technologyScore: 0,
  trophyScore: 0,
  onHoliday: false,
  isBanned: false,
  ...fields,
});

const alliance = (tag: string, diplomacy: Partial<Alliance["diplomacy"]> = {}): Alliance => ({
  tag,
  name: tag,
  playersCount: 1,
  totalField: 0,
  totalBuildingScore: 0,
  totalTechnologyScore: 0,
  totalTrophyScore: 0,
  diplomacy: { pacts: [], wars: [], ...diplomacy },
});

const now = new Date(2026, 9, 8, 10, 0, 0);
const me = player("Moi", { alliance: "MOI" });
const alliances = [
  alliance("MOI", { pacts: [{ tag: "AMI", name: "PNA ", description: "Un PNA de 6 mois." }], wars: ["RIVAL"] }),
  alliance("AMI"),
  alliance("RIVAL"),
];

const setup = (players: Player[], options: Partial<TargetsContext> = {}) => {
  const doc = new DOMParser().parseFromString(s2Html, "text/html");
  const context: TargetsContext = {
    me: { pseudo: "Moi", field: 1000 },
    attackSpeed: 0,
    players: [me, ...players],
    alliances,
    live: [],
    open: true,
    onOpenChange: () => undefined,
    ...options,
  };
  mountTargets(doc, context, () => now);
  const box = () => doc.querySelector(".optizzz-targets");
  const rows = () =>
    [...doc.querySelectorAll(".optizzz-targets tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()),
    );
  const pseudos = () => rows().map((cells) => cells[0]);
  const click = (selector: string) => {
    doc.querySelector<HTMLElement>(selector)?.click();
  };
  const header = (text: string) => {
    const th = [...doc.querySelectorAll(".optizzz-targets th")].find((cell) =>
      cell.textContent.trim().startsWith(text),
    );
    (th?.querySelector("button") ?? (th as HTMLElement)).click();
  };
  return { doc, box, rows, pseudos, click, header };
};

describe("mountTargets", () => {
  it("lists the targets above the game's search form, nearest first", () => {
    const { doc, box, rows } = setup([
      player("Loin", { x: 5, y: 12, field: 2000 }),
      player("Proche", { x: 3, y: 4, field: 2345, alliance: "RIVAL" }),
    ]);
    expect(box()?.nextElementSibling?.querySelector("#formulairePageEnnemie")).not.toBeNull();
    expect(doc.querySelector(".optizzz-targets summary")?.textContent).toBe("Cibles à portée (2)");
    expect(rows()).toEqual([
      ["Proche", "RIVAL · Guerre", "2 345", "235 %", "469", "5", "2 h 31", "12 h 30", "libre ?", "Attaquer"],
      ["Loin", "", "2 000", "200 %", "400", "13", "6 h 28", "16 h 27", "libre ?", "Attaquer"],
    ]);
  });

  it("marks with the game's icon who can attack me back", () => {
    const { doc } = setup([player("Riposte", { x: 1, field: 2000 }), player("Trop gros", { x: 2, field: 2001 })]);
    const icons = [...doc.querySelectorAll(".optizzz-targets tbody tr")].map(
      (row) => row.querySelector("img")?.getAttribute("title") ?? null,
    );
    expect(icons).toEqual(["Peut vous attaquer en retour", null]);
  });

  it("links the pseudo to the profile and the attack to the game's form", () => {
    const target = player("Cible", { x: 1 });
    const { doc } = setup([target]);
    const links = [...doc.querySelectorAll(".optizzz-targets tbody a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(["Membre.php?Pseudo=Cible", `ennemie.php?Attaquer=${String(target.id)}&lieu=1`]);
  });

  it("hides the pacts until asked, then shows them without an attack link", () => {
    const { pseudos, rows, click } = setup([player("Allie", { alliance: "AMI", x: 1 }), player("Libre", { x: 2 })]);
    expect(pseudos()).toEqual(["Libre"]);
    click(".optizzz-targets-hide-pacts");
    expect(rows()[0]).toEqual([
      "Allie",
      "AMI · Pacte (PNA)",
      "1 000",
      "100 %",
      "200",
      "1",
      "31 min",
      "10 h 30",
      "libre ?",
      "",
    ]);
  });

  it("can keep only who can be attacked now", () => {
    const master = player("Maitre", { field: 1_000_000 });
    const { pseudos, rows, click } = setup(
      [
        master,
        player("Colonie", { masterPlayerId: master.id, x: 1 }),
        player("Absent", { onHoliday: true, x: 2 }),
        player("Protege", { x: 3 }),
      ],
      { live: [{ pseudo: "Protege", field: 1500, state: "protected", master: null }] },
    );
    expect(rows().map((cells) => cells[8])).toEqual(["colonisé par Maitre", "en vacances", "protection débutant"]);
    click(".optizzz-targets-attackable-only");
    expect(pseudos()).toEqual(["Colonie"]);
  });

  it("sorts by hunting field or trip when the header is clicked", () => {
    const { pseudos, header } = setup([
      player("Petit", { x: 1, field: 600 }),
      player("Gros", { x: 2, field: 2900 }),
      player("Moyen", { x: 3, field: 1500 }),
    ]);
    header("TDC");
    expect(pseudos()).toEqual(["Gros", "Moyen", "Petit"]);
    header("Trajet");
    expect(pseudos()).toEqual(["Petit", "Gros", "Moyen"]);
  });

  it("shows the 50 nearest, then 50 more on demand", () => {
    const many = Array.from({ length: 120 }, (_, i) => player(`J${String(i)}`, { x: i }));
    const { rows, click, doc } = setup(many);
    expect(rows()).toHaveLength(50);
    expect(doc.querySelector(".optizzz-targets-more")?.textContent).toBe("Voir plus (70 restants)");
    click(".optizzz-targets-more");
    expect(rows()).toHaveLength(100);
    click(".optizzz-targets-more");
    expect(rows()).toHaveLength(120);
    expect(doc.querySelector(".optizzz-targets-more")).toBeNull();
  });

  it("says when nobody is in range", () => {
    const { doc } = setup([]);
    expect(doc.querySelector(".optizzz-targets-empty")?.textContent).toBe("Aucune cible à portée.");
  });

  it("starts folded when the player folded it last time, and tells when it is unfolded", async () => {
    const changes: boolean[] = [];
    const { doc } = setup([], { open: false, onOpenChange: (open) => changes.push(open) });
    const details = doc.querySelector<HTMLDetailsElement>(".optizzz-targets");
    if (!details) throw new Error("no box");
    expect(details.open).toBe(false);
    details.open = true;
    await new Promise((resolve) => setTimeout(resolve));
    expect(changes).toEqual([true]);
  });

  it("tells, when my army is known, the most a flood takes from each target, and sorts by it", () => {
    const flood = {
      available: armyFromKeys({ JSN: 10_000 }),
      attackSpeed: 2,
      onWay: { launches: [], unknown: 0 },
      defenses: new Map(),
      weapons: 0,
      shield: 0,
      margin: 0,
    };
    const { doc, rows, header } = setup(
      [player("Loin", { x: 5, y: 12, field: 2900 }), player("Proche", { x: 3, y: 4, field: 2345 })],
      { flood },
    );
    const headers = [...doc.querySelectorAll(".optizzz-targets th")].map((th) => th.textContent);
    expect(headers).toContain("Flood max");
    // 2 345: 469, 375, 300. 2 900: 580, 464, 371.
    expect(rows().map((cells) => [cells[0], cells[5]])).toEqual([
      ["Proche", "1 144"],
      ["Loin", "1 415"],
    ]);
    header("Flood max");
    expect(rows().map((cells) => cells[0])).toEqual(["Loin", "Proche"]);
  });

  it("leaves the flood column out when my army is unknown", () => {
    const { doc } = setup([player("Cible", { x: 1 })]);
    const headers = [...doc.querySelectorAll(".optizzz-targets th")].map((th) => th.textContent);
    expect(headers).not.toContain("Flood max");
  });

  it("says « libre » only when the game's table shows the player, « libre ? » from the export", () => {
    const { pseudos, rows } = setup([player("Vu", { x: 1 }), player("Export", { x: 2 })], {
      live: [{ pseudo: "Vu", field: 1000, state: "free", master: null }],
    });
    expect(pseudos()).toEqual(["Vu", "Export"]);
    expect(rows().map((cells) => cells[8])).toEqual(["libre", "libre ?"]);
  });

  it("reminds a protected player that attacking ends the protection", () => {
    const { box } = setup([player("Cible", { x: 1 })], { protectedMe: true });
    expect(box()?.textContent).toContain("Vous êtes sous protection débutant : attaquer y met fin");
  });

  it("tells why the flood column is missing", () => {
    const { box } = setup([player("Cible", { x: 1 })], { floodMissing: "« Flood max » : aucune unité en garnison." });
    expect(box()?.textContent).toContain("aucune unité en garnison");
  });

  it("counts the attacks on their way in « Flood max », as the flood plan", () => {
    const target = player("Cible", { x: 1, field: 2000 });
    const flood = {
      available: armyFromKeys({ JSN: 10_000 }),
      attackSpeed: 2,
      onWay: {
        launches: [{ targetId: target.id, target: "Cible", ants: 400, take: 400, arrivesAt: new Date(2026, 9, 8, 11) }],
        unknown: 0,
      },
      defenses: new Map(),
      weapons: 0,
      shield: 0,
      margin: 0,
    };
    const { rows } = setup([target], { flood });
    // 2 slots left; it will have 1 600, me 1 400: 320 then 256.
    expect(rows()[0]?.[5]).toBe("576");
  });
});
