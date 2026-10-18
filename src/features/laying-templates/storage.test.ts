import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { readTemplates, writeTemplates, type StoredTemplates } from "./storage";

const army: StoredTemplates = {
  open: true,
  templates: [
    {
      id: "a",
      name: "Armée du jour",
      lines: [
        { unit: "JSN", destination: "lodge", amount: 10 },
        { unit: "JS", destination: "field", amount: 5 },
      ],
      target: { kind: "duration", hours: 24 },
      rotations: 10,
    },
  ],
};

describe("templates storage", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts empty and open, and remembers templates per server", async () => {
    expect(await readTemplates("s5.fourmizzz.fr")).toEqual({ open: true, templates: [] });
    await writeTemplates("s5.fourmizzz.fr", army);
    expect(await readTemplates("s5.fourmizzz.fr")).toEqual(army);
    expect((await readTemplates("s1.fourmizzz.fr")).templates).toEqual([]);
  });

  it("drops what it cannot read instead of failing", async () => {
    await fakeBrowser.storage.local.set({
      "layingTemplates:s5.fourmizzz.fr": {
        open: false,
        templates: [
          army.templates[0],
          { id: "b", name: "Cassé", lines: "oops", target: null },
          {
            ...army.templates[0],
            id: "c",
            lines: [{ unit: "JSN", destination: "moon", amount: 3 }],
            target: { kind: "x" },
          },
        ],
      },
    });
    const stored = await readTemplates("s5.fourmizzz.fr");
    expect(stored.open).toBe(false);
    expect(stored.templates.map((template) => template.id)).toEqual(["a", "c"]);
    expect(stored.templates[1]?.lines).toEqual([]);
    expect(stored.templates[1]?.target).toBeNull();
  });

  it("gives one rotation to a template saved before rotations existed", async () => {
    const old = { ...army.templates[0], rotations: undefined };
    await fakeBrowser.storage.local.set({ "layingTemplates:s5.fourmizzz.fr": { open: true, templates: [old] } });
    expect((await readTemplates("s5.fourmizzz.fr")).templates[0]?.rotations).toBe(1);
  });
});
