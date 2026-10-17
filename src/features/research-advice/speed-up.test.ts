import { describe, expect, it } from "vitest";
import constructionHtml from "@/features/resource-forecast/__fixtures__/construction-costs.html?raw";
import laboratoryQueueHtml from "@/features/work-queue/__fixtures__/laboratory-one.html?raw";
import laboratoryHtml from "@/features/resource-forecast/__fixtures__/laboratory-costs.html?raw";
import { mountSpeedUp } from "./speed-up-mount";
import { readTimedRows } from "@/game/pages/resources";
import { queueEnd, readSpeedUp, startsAt, type SpeedUpSource } from "./speed-up-rows";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const now = new Date("2026-10-16T10:00:00Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
/** Architecture 7, raised to 8 (or waited for, when already queued) by `ready`. */
const architecture = (ready: Date, queued = false): SpeedUpSource => ({
  name: "Architecture",
  level: 7,
  queued: queued ? 1 : 0,
  plans: [{ levels: 1, ready }],
});

describe("readTimedRows", () => {
  it("reads each row's name, level and time on construction.php", () => {
    const rows = readTimedRows(parse(constructionHtml));
    expect(rows[0]).toMatchObject({ name: "Champignonnière", duration: (3600 + 25 * 60 + 54) * 1000, locked: false });
  });
});

describe("readSpeedUp", () => {
  it("waits for the levels already queued, or adds more after them, each 1.7 × longer", () => {
    const speedUp = readSpeedUp(parse(laboratoryQueueHtml), "Architecture", 1.7, null, now);
    expect(speedUp).toMatchObject({ name: "Architecture", level: 0, queued: 1 });
    const queuedEnd = now.getTime() + 189_000;
    // The row shows the level after the one queued: 5 min 40 s, then 1.7 × longer each.
    expect(speedUp?.plans.slice(0, 3)).toEqual([
      { levels: 1, ready: new Date(queuedEnd) },
      { levels: 2, ready: new Date(queuedEnd + 340_000) },
      { levels: 3, ready: new Date(queuedEnd + 340_000 + 578_000) },
    ]);
    expect(speedUp?.plans).toHaveLength(11);
  });

  it("starts the next level once its queue is free", () => {
    const doc = parse(laboratoryHtml);
    expect(queueEnd(doc, now)).toEqual(now);
    expect(readSpeedUp(doc, "Génétique", 1.7, null, now)?.plans[0]).toEqual({
      levels: 1,
      ready: new Date(now.getTime() + 180_000),
    });
  });

  it("is null when locked or absent", () => {
    expect(readSpeedUp(parse(laboratoryHtml), "Architecture", 1.7, null, now)).toBeNull();
  });
});

describe("mountSpeedUp", () => {
  const row = (minutes: number) => {
    const [first] = readTimedRows(parse(constructionHtml));
    if (!first) throw new Error("fixture");
    return { ...first, duration: minutes * 60_000 };
  };

  it("says to wait, by how much and until when, when it ends sooner", () => {
    const line = mountSpeedUp(row(20 * 60), architecture(at(100)), now, now);
    expect(line?.textContent).toBe(
      "Conseil Architecture 8 d'abord : fin 20 min plus tôt (demain 7 h 40 au lieu de demain 8 h 00)",
    );
    expect(line?.querySelector(".optizzz-advice-tag")?.textContent).toBe("Conseil");
  });

  it("says to wait for the level under way", () => {
    const line = mountSpeedUp(row(20 * 60), architecture(at(30), true), now, now);
    expect(line?.textContent).toContain("Attendez la fin d'Architecture 8 : fin 1 h 30 plus tôt");
  });

  it("speaks of « la Salle d'analyse »", () => {
    const salle = { ...architecture(at(30), true), name: "Salle d'analyse" };
    expect(mountSpeedUp(row(20 * 60), salle, now, now)?.textContent).toContain(
      "Attendez la fin de la Salle d'analyse 8",
    );
  });

  it("says nothing when waiting does not make it end sooner", () => {
    const target = row(60);
    expect(mountSpeedUp(target, architecture(at(100)), now, now)).toBeNull();
    expect(target.description.querySelector(".optizzz-speed-up")).toBeNull();
  });

  it("counts from when the row can start: paid, then its queue free", () => {
    // Paid only in 3 h: Architecture (1 h 40) is done before, waiting costs nothing.
    expect(mountSpeedUp(row(60), architecture(at(100)), at(180), now)?.textContent).toContain("fin 6 min plus tôt");
  });

  it("raises the speed-up several levels when that ends the row sooner", () => {
    const speedUp: SpeedUpSource = {
      name: "Architecture",
      level: 7,
      queued: 0,
      plans: [
        { levels: 1, ready: at(100) },
        { levels: 2, ready: at(270) },
        { levels: 3, ready: at(400) },
      ],
    };
    // 40 h: ends at 37 h 40 with one level, 36 h 54 with two, 35 h 50 with three (6 h 40 + 29 h 10).
    const line = mountSpeedUp(row(40 * 60), speedUp, now, now);
    expect(line?.textContent).toContain("Architecture jusqu'au niveau 10 d'abord : fin");
    expect(line?.title).toContain("Architecture 10 fini");
  });

  it("goes after the resource forecast line, which is redrawn every minute", () => {
    const target = row(20 * 60);
    const forecast = target.description.ownerDocument.createElement("div");
    forecast.className = "optizzz-forecast";
    target.description.append(forecast);
    const line = mountSpeedUp(target, architecture(at(100)), now, now);
    expect(forecast.nextElementSibling).toBe(line);
  });
});

describe("startsAt", () => {
  it("starts when paid, after the queue", () => {
    const cost = { food: 0, materials: 0, workers: 0 };
    expect(startsAt(null, cost, at(30), now)).toEqual(at(30));
    expect(startsAt(null, cost, now, now)).toEqual(now);
  });
});
