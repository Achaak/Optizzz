import { defineLinkFormat } from "@optizzz/game/site-links/link-state";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { openingState } from "./tool-state";

const format = defineLinkFormat({ version: 1, schema: z.object({ n: z.number().int() }) });
const empty = { n: 0 };
const open = (address: string, stored: { n: number } | string | null) =>
  openingState(
    new URL(address, "https://optizzz.fr"),
    typeof stored === "object" && stored !== null ? format.encode(stored) : stored,
    format,
    empty,
  );

describe("the state a tool opens with", () => {
  it("is the link's when the address holds one, even over the browser's last state", () => {
    expect(open(`/tools/costs#p=${format.encode({ n: 2 })}`, { n: 1 })).toEqual({
      state: { n: 2 },
      fromLink: true,
      invalidLink: false,
    });
  });

  it("is not from a link when the address holds what the tool wrote itself (a reload)", () => {
    expect(open(`/tools/costs#p=${format.encode({ n: 1 })}`, { n: 1 })).toEqual({
      state: { n: 1 },
      fromLink: false,
      invalidLink: false,
    });
  });

  it("is the browser's last state without a link, else the empty one", () => {
    expect(open("/tools/costs", { n: 1 })).toEqual({ state: { n: 1 }, fromLink: false, invalidLink: false });
    expect(open("/tools/costs", null)).toEqual({ state: empty, fromLink: false, invalidLink: false });
    expect(open("/tools/costs", "1.broken")).toEqual({ state: empty, fromLink: false, invalidLink: false });
  });

  it("is empty, with the note, when the link cannot be read", () => {
    expect(open("/tools/costs#p=1.abc", { n: 1 })).toEqual({ state: empty, fromLink: false, invalidLink: true });
  });
});
