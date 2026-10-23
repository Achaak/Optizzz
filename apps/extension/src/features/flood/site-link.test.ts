import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { armyFromKeys, emptyArmy, unitLabel, UNITS } from "@optizzz/game/army/units";
import { formatNumber } from "@optizzz/game/format/number-format";
import { readLinkState } from "@optizzz/game/site-links/link-state";
import { floodLinkFormat, floodToolPlan } from "@optizzz/game/site-links/flood";
import { isOpenSiteToolMessage, siteToolMessageUrl } from "@/utils/site-tool";
import formHtml from "./__fixtures__/attack-form.html?raw";
import { mountFloodPlanner, type FloodContext } from "./mount";

const now = new Date(2026, 9, 8, 10, 0, 0);

const setup = (options: Partial<FloodContext> = {}) => {
  const doc = new DOMParser().parseFromString(formHtml, "text/html");
  const context: FloodContext = {
    me: { field: 1000, weapons: 3, shield: 2 },
    target: { id: 101, pseudo: "Cible_1", field: 2000 },
    available: {
      field: armyFromKeys({ JSN: 1000, S: 50 }),
      nest: armyFromKeys({ JSN: 200 }),
      lodge: armyFromKeys({ JSN: 5000 }),
    },
    attackSpeed: 2,
    travelSeconds: 1800,
    onWay: { launches: [], unknown: 0 },
    defense: null,
    countLodge: false,
    probes: {},
    // The extension's margin: the site uses the same.
    margin: 0.01,
    siteLinks: true,
    onCountLodgeChange: () => undefined,
    onDefenseChange: () => undefined,
    onSend: () => undefined,
    ...options,
  };
  mountFloodPlanner(doc, context, () => now);
  const button = (name: string) =>
    [...doc.querySelectorAll<HTMLButtonElement>(".optizzz-flood-site button")].find(
      (candidate) => candidate.textContent === name,
    );
  // N°, army, (losses), take, its field after, mine after: what the extension shows.
  const rows = () =>
    [...doc.querySelectorAll(".optizzz-flood tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].slice(0, -1).map((cell) => cell.textContent.trim()),
    );
  return { doc, button, rows };
};

/** « Copier le lien »: the link the clipboard received. */
async function copiedLink(button: HTMLButtonElement | undefined): Promise<string> {
  const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  button?.click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalled();
  });
  return writeText.mock.calls[0]?.[0] ?? "";
}

/** The rows the site shows for a link, written as the extension writes them. */
function siteRows(link: string): string[][] {
  const request = readLinkState(new URL(link), floodLinkFormat);
  if (request.kind !== "state") throw new Error(`Not a flood link: ${link}`);
  const plan = floodToolPlan(request.state);
  if (plan.kind !== "plan") throw new Error("The site cannot plan this link");
  const army = (counts: readonly number[]) =>
    UNITS.flatMap((unit, i) =>
      (counts[i] ?? 0) > 0 ? [`${formatNumber(counts[i] ?? 0)} ${unitLabel(unit.key)}`] : [],
    ).join(", ");
  return plan.attacks.map((attack, index) => [
    String(index + 1),
    army(attack.army),
    ...(plan.attacks.some((one) => one.lost) ? [attack.lost ? army(attack.lost) || "aucune" : ""] : []),
    formatNumber(attack.take),
    formatNumber(attack.targetAfter),
    formatNumber(attack.attackerAfter),
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the flood plan's links to optizzz.fr", () => {
  it("shows nothing while « Liens vers optizzz.fr » is off", () => {
    const { doc } = setup({ siteLinks: false });
    expect(doc.querySelector<HTMLElement>(".optizzz-flood-site")?.hidden).toBe(true);
  });

  it("copies a link to the site's flood tool that gives the same attacks", async () => {
    const { button, rows } = setup();
    const link = await copiedLink(button("Copier le lien"));
    expect(link.startsWith("https://optizzz.fr/tools/flood#p=1.")).toBe(true);
    expect(rows()).toHaveLength(3);
    expect(siteRows(link)).toEqual(rows());
  });

  it("gives the same attacks against a defense, with attacks on their way, the Loge and the probes", async () => {
    const { button, rows } = setup({
      defense: { army: armyFromKeys({ JSN: 60 }), readAt: now },
      onWay: {
        launches: [{ targetId: 101, target: "Cible_1", ants: 100, take: 100, arrivesAt: now }],
        unknown: 1,
      },
      attackSpeed: 4,
      countLodge: true,
      probes: { nest: armyFromKeys({ JSN: 1 }) },
    });
    const link = await copiedLink(button("Copier le lien"));
    expect(rows().length).toBeGreaterThan(1);
    expect(rows()[0]).toHaveLength(6);
    expect(siteRows(link)).toEqual(rows());
  });

  it("shows the link to copy by hand when the clipboard refuses it", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    const { doc, button } = setup();
    button("Copier le lien")?.click();
    const field = doc.querySelector<HTMLInputElement>(".optizzz-flood-site-link");
    await vi.waitFor(() => {
      expect(field?.hidden).toBe(false);
    });
    expect(field?.value.startsWith("https://optizzz.fr/tools/flood#p=1.")).toBe(true);
    expect(doc.querySelector(".optizzz-flood-site-status")?.textContent).toBe(
      "Le presse-papiers a refusé : copiez ce lien.",
    );
  });

  it("asks the background script to open the same link", async () => {
    const sent: unknown[] = [];
    fakeBrowser.runtime.onMessage.addListener((message: unknown) => {
      sent.push(message);
    });
    const { button } = setup({
      available: { field: armyFromKeys({ JSN: 900 }), nest: emptyArmy(), lodge: emptyArmy() },
    });
    const link = await copiedLink(button("Copier le lien"));
    button("Ouvrir sur optizzz.fr")?.click();
    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    const [message] = sent;
    expect(isOpenSiteToolMessage(message) && siteToolMessageUrl(message)).toBe(link);
  });
});
