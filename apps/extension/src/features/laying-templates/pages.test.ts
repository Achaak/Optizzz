import { describe, expect, it } from "vitest";
import { reineWithQueue } from "./__fixtures__/reine";
import { readQueueLines } from "./pages";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("readQueueLines", () => {
  it("turns the laying queue into template lines, in order", () => {
    const doc = parse(
      reineWithQueue(
        ['<span id="unites_restantes_premiere_ponte">6 Jeunes Soldates Naines</span>', "Loge Impériale"],
        ["2 000 ouvrières", "Fourmilière"],
        ["1 Artilleuse", "Terrain de Chasse"],
        ["65 Jeunes Soldates Naines", "Fourmilière"],
      ),
    );
    expect(readQueueLines(doc)).toEqual([
      { unit: "JSN", destination: "lodge", amount: 6 },
      { unit: "worker", destination: "nest", amount: 2000 },
      { unit: "A", destination: "field", amount: 1 },
      { unit: "JSN", destination: "nest", amount: 65 },
    ]);
  });

  it("is empty without a queue", () => {
    expect(readQueueLines(parse(reineWithQueue()))).toEqual([]);
  });
});
